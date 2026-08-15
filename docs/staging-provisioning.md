# Staging provisioning plan

The plan for standing up the V2 backend in staging. This is the **Staging** pass named in
[`STATUS.md`](STATUS.md); it is not a numbered code pass.

**Nothing in this document has been created.** No Apps Script project, Sheet, calendar,
trigger, deployment, endpoint, email, or calendar event exists. Every value below is
recorded so provisioning is one reviewed decision rather than a sequence of small ones.

**Live V1 identifiers are deliberately not repeated here.** The V1 script id, bound
spreadsheet id, deployment id, and `/exec` URL live in [`deployment.md`](deployment.md).
Copying them into a planning document that describes creating a parallel system is how the
wrong id gets pasted into the wrong field.

---

## 1. Apps Script project and ownership

| Item | Value |
|---|---|
| Project | `AxisPoint V2 STAGING`, standalone |
| Owner | Zach@axispoint.llc |
| Runtime | V8 |
| Time zone | `America/Chicago` |
| Local config | new `scripts/gas-v2/.clasp.json`, gitignored, never committed |

**Separation from the historical V1 project.** V2 staging gets its own project, its own
spreadsheet, its own calendar, and its own deployment. It is standalone rather than
container-bound, so it has no handle on the V1 spreadsheet. V1's source was deleted from this
repository on 2026-08-15 and its external Apps Script project is untouched by provisioning or
by anything else here.

---

## 2. Spreadsheet: six tabs and exact headers

One new spreadsheet, `AxisPoint V2 CRM STAGING`.

Tab names are case-sensitive (`TAB_NAMES`, `src/SheetRepository.js`). Header text is matched
case- and whitespace-insensitively but **must occupy row 1**.

| Tab | Columns |
|---|---|
| `Submissions` | 48 |
| `Deliveries` | 8 |
| `Leads` | 47 |
| `Contacts` | 28 |
| `Work` | 9 |
| `Log` | 7 |

**Submissions**

```
submissionId, submissionKind, schemaVersion, receivedAt, submittedAt, sourceCategory,
sourceDetail, acquisitionSource, scannedPartner, landingPage, intentToken, refToken,
utmSource, utmMedium, utmCampaign, utmContent, utmTerm, pageLocale,
preferredFollowUpLocale, preferredFollowUpStated, fullName, email, phone, organization,
contactCategory, roleOrTitle, normalizedEmail, normalizedPhone, pathway, serviceScope,
topic, propertyType, propertyScope, propertyLocation, propertyScale, propertyScaleUnknown,
propertyCount, situationCurrent, situationInvolvement, situationTiming, situationNotes,
spamSuspected, spamReason, possibleMatches, matchNote, payloadFingerprint, leadId, contactId
```

**Deliveries**

```
submissionId, submissionKind, createdAt, updatedAt, ackEmailStatus, partnerNotifyStatus,
digestStatus, digestDeliveredAt
```

**Leads**

```
leadId, sourceSubmissionId, receivedAt, pathway, serviceScope, topic, propertyType,
propertyScope, propertyLocation, propertyScale, propertyScaleUnknown, propertyCount,
situationCurrent, situationInvolvement, situationTiming, situationNotes, fullName, email,
phone, organization, pageLocale, preferredFollowUpLocale, preferredFollowUpStated,
sourceCategory, sourceDetail, landingPage, intentToken, refToken, utmSource, utmMedium,
utmCampaign, utmContent, utmTerm, leadStatus, ownerPartner, firstHumanContactAt,
qualificationOutcome, proposalSentAt, slaDueAt, possibleMatches, matchNote, spamSuspected,
spamReason, bookingEligible, calendarStatus, calendarEventId, activeBookingRequestId
```

**Contacts**

```
contactId, createdAt, updatedAt, sourceSubmissionId, fullName, email, phone, company,
roleOrTitle, contactCategory, normalizedEmail, normalizedPhone, preferredFollowUpLocale,
firstSourceCategory, firstSourceDetail, acquisitionSource, scannedPartner, ownerPartner,
followUpState, submissionCount, lastSubmissionId, lastSubmissionAt, linkedLeadIds,
possibleMatches, contactSyncStatus, externalContactResourceName, externalContactEtag,
externalContactSyncedAt
```

**Work**

```
workId, createdAt, kind, subjectId, state, attempts, nextAttemptAt, lastError, completedAt
```

**Log**

```
logId, at, level, event, submissionId, leadId, detail
```

---

## 3. Script Properties

**15 properties.** `AXP_FIRM_PHONE` and `AXP_LOGO_URL` are deliberately left unset, and both
are warnings rather than blockers: the firm phone row is omitted rather than shown empty,
and emails render the wordmark as text.

| Property | Staging value | Source |
|---|---|---|
| `AXP_SHEET_ID` | new staging spreadsheet id | created in §2 |
| `AXP_CALENDAR_ID` | new staging calendar id | created in §4 |
| `AXP_RUN_MODE` | `dry_run` | flipped to `live` only for the §8 window |
| `AXP_REPLY_TO` | `info@axispoint.llc` | settled |
| `AXP_FROM_NAME` | `AxisPoint Partners` | brand |
| `AXP_PARTNER_NOTIFY_TO` | `Zach@axispoint.llc,Ethaniel@axispoint.llc` | settled |
| `AXP_PARTNER_EMAIL_MAP` | `{"zachary_russell":"Zach@axispoint.llc","ethaniel_vu":"Ethaniel@axispoint.llc"}` | tokens from `PARTNERS` |
| `AXP_PARTNER_DIRECT_EMAIL_MAP` | same mapping as above | settled |
| `AXP_PARTNER_DIRECT_PHONE_MAP` | `{"zachary_russell":"832-580-2815","ethaniel_vu":"832-499-8389"}` | settled |
| `AXP_FIRM_EMAIL` | `info@axispoint.llc` | settled |
| `AXP_WEBSITE_URL` | `https://axispoint.llc` | live site |
| `AXP_REPLY_TO_MONITORED` | **`false`** | pending owner approval |
| `AXP_REMOVAL_PROCEDURE_CONFIGURED` | **`false`** | pending owner approval |
| `AXP_FIRM_PHONE` | **unset** | not supplied |
| `AXP_LOGO_URL` | **unset** | optional |

**Both flags are provisioned as `false` and stay false in this pass.**

While either is false the QR acknowledgement omits its correction and removal lines, so
nothing is displayed or sent promising that information will be corrected or removed. That
is the intended behaviour here, not a gap to close.

### Operational note

AxisPoint retains voluntarily submitted business information for normal operations. Any rare
information request is handled manually by Zach on a case-by-case basis. **This is not an
approved legal-compliance policy.**

No automated removal system exists and none is planned in this pass.

---

## 4. Dedicated staging booking calendar

New calendar `AxisPoint Booking STAGING`, owned by Zach, **not a personal calendar**.
Test events are isolated and bulk-deletable, and no test booking can land on a real day.

One shared calendar remains the model: `AXP_CALENDAR_ID` is a single property, unchanged.

---

## 5. Triggers and permissions

**There is no trigger installer in the code** (`ScriptApp` appears nowhere in `src/`). All
three are created by hand in the Apps Script UI.

| Trigger | Function | Schedule |
|---|---|---|
| Work queue | `runWorkerTrigger` | every 5 minutes |
| QR digest | `runDailyQrDigestTrigger` | daily, 8:00 AM Central |
| Retention | `runRetentionMaintenanceTrigger` | daily, off-peak |

Queue bounds: 20 items per cycle, 4 attempts, backoff 5/15/60 minutes. Operational records
are retained 90 days.

### OAuth scopes

The manifest requests **exactly three**, each backed by an API the code actually calls:

| Scope | Justified by |
|---|---|
| `.../auth/spreadsheets` | `SpreadsheetApp` |
| `.../auth/calendar` | `CalendarApp` |
| `.../auth/script.send_mail` | `MailApp.sendEmail` |

Four requests were removed before provisioning, each verified unused first:

| Removed | Why |
|---|---|
| `https://mail.google.com/` | Full read, send, and delete access to the deploying account's mailbox. `MailApp.sendEmail` needs only `script.send_mail`. |
| `.../auth/script.scriptapp` | `ScriptApp`: 0 occurrences. Triggers are created in the UI, which does not require the script to hold it. |
| `.../auth/script.external_request` | `UrlFetchApp`: 0 occurrences. Nothing calls out. |
| `.../auth/calendar.events` | A strict subset of `calendar`. |

The advanced Calendar service (`Calendar` v3) was also enabled while the code used only
`CalendarApp`, and is removed. `deployability.test.js` now pins the exact scope set and
asserts no advanced service remains, so widening either is a deliberate, reviewed edit.

---

## 6. Web-app deployment

| Setting | Value |
|---|---|
| Execute as | `USER_DEPLOYING` |
| Access | `ANYONE_ANONYMOUS` |

`ANYONE_ANONYMOUS` is required: a public form must reach the endpoint unauthenticated.

**There is deliberately no allowed-origins property.** An Apps Script web app cannot read
the request's `Origin`, so any such setting would be applied to a value the caller itself
supplies, creating the appearance of an access control that does not exist. The staging
endpoint is therefore POST-able by anyone who learns the URL. The mitigations are
`dry_run`, server-side spam screening, and not publishing the URL.

Sequence: `clasp push`, then **Deploy → New deployment → Web app**, then record the `/exec`.
Afterwards `clasp deploy -i <staging-deployment-id>` updates the pinned version. `push`
alone does not change what `/exec` serves.

---

## 7. Safe staging recipients

The visitor acknowledgement goes to **whatever address the submission contains**. The
binding rule for all testing:

> **Only ever submit an address you control.** Never a client, never a colleague, never a
> plausible invented address that might belong to a real person.

With `AXP_RUN_MODE=dry_run`, `MailApp.sendEmail`, `createEvent`, and `deleteEvent` each stop
at the boundary and return `{ok: true, status: 'dry_run'}`. Records are written and the
queue runs; nothing leaves the project and no calendar event is created.

Reply-To is `info@axispoint.llc` on every outbound message.

---

## 8. Controlled E2E matrix and cleanup

### Phase 1: `dry_run`, no external effect

| # | Case | Asserts |
|---|---|---|
| 1 | `doGet` health check | capabilities and blockers |
| 2 | Management Proposal | Lead, SLA, `bookingEligible: true` |
| 3 | Investor Services | Lead, `bookingEligible: false` |
| 4 | General Inquiry | Lead, no property block |
| 5 | QR Contact Exchange | Contact and **no** Lead |
| 6 | Replay a used `submissionId` | replay, no second record |
| 7 | Same id, changed data | `SUBMISSION_ID_CONFLICT` |
| 8 | Booking | Lead calendar fields, queued confirmation |
| 9 | Booking retry, same id | replay, no second hold |

### Phase 2: `live`, one narrow window, separately authorized

| # | Case | Real effect |
|---|---|---|
| 10 | Inquiry to Zach's address | one acknowledgement, one partner notification |
| 11 | QR exchange to Ethaniel's address | one acknowledgement; digest next morning |
| 12 | Booking | one real event on the staging calendar |
| 13 | Slot-taken refusal | see below |

**Case 13 requires a deliberately seeded event.** The backend returns `SLOT_UNAVAILABLE`
only when `listBusy` reports the slot occupied, so the refusal cannot be produced by the
form alone. Before the case: create a **manually seeded blocking event** on the staging
calendar covering the exact slot to be requested. Then submit a booking for that slot and
confirm the neutral copy, "That time is no longer available. Please choose another.",
appears with no retry offered. **Delete the seeded event as part of cleanup**; it is a
fixture, not a booking, and leaving it behind would silently block that slot in every later
test.

### Cleanup

1. Delete every Phase-2 calendar event, **including the seeded blocking event**.
2. Clear data rows in all six tabs, keeping row 1.
3. Set `AXP_RUN_MODE` back to `dry_run`.
4. Confirm no `Work` rows remain pending.

Email already sent cannot be recalled, which is why Phase 2 is small, partner-only, and
separately authorized.

---

## 9. Rollback and separation from live V1

| Failure | Rollback |
|---|---|
| Bad code deployed | `clasp deploy -i <staging-deployment-id>` to a prior version |
| Bad data | clear tab data rows, keep headers |
| Runaway sending | set `AXP_RUN_MODE=dry_run`, one property, immediate |
| Runaway triggers | delete the three triggers |
| Abandon staging | delete the staging project, spreadsheet, and calendar |

**V1 is unaffected by all of them.** Separate script, spreadsheet, calendar, and deployment.
Its identifiers are in [`deployment.md`](deployment.md) and are not repeated here.

---

## What provisioning will create

1. Apps Script project `AxisPoint V2 STAGING`
2. Spreadsheet `AxisPoint V2 CRM STAGING` with the six tabs above
3. Calendar `AxisPoint Booking STAGING`
4. 15 Script Properties per §3
5. 3 time-driven triggers per §5
6. 1 Web app deployment
7. Local `scripts/gas-v2/.clasp.json`, gitignored

## Open before provisioning

Nothing blocks provisioning. Both flags are `false`, the acknowledgement omits the two
promise lines, and every other capability works.
