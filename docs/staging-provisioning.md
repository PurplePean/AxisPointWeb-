# Staging provisioning plan

The plan for standing up the V2 backend in staging. This is the **Staging** pass named in
[`STATUS.md`](STATUS.md); it is not a numbered code pass.

**Provisioning is underway.** As of 2026-08-19: the Apps Script project (`AxisPoint V2
STAGING`), the staging spreadsheet with its six tabs, and the staging booking calendar
(`AxisPoint Booking STAGING`) have been created. `AXP_CALENDAR_ID` is set as a Script
Property. Triggers, the web-app deployment, and the remaining Script Properties are not yet
created. Every value below is recorded so provisioning is one reviewed decision rather than
a sequence of small ones.

**Live V1 identifiers are deliberately not repeated here.** The V1 script id, bound
spreadsheet id, deployment id, and `/exec` URL are not in any tracked file. They exist only at
the `pre-v1-retirement-2026-08-14` tag
(`git show pre-v1-retirement-2026-08-14:docs/deployment.md`). Copying them into a planning
document that describes creating a parallel system is how the wrong id gets pasted into the
wrong field.

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

Tab names are case-sensitive (`TAB_NAMES`, `src/platform/SheetRepository.js`). Header text is matched
case- and whitespace-insensitively but **must occupy row 1**.

Listed in the order `expectedTabLayout()` returns them
(`src/platform/SheetRepository.js:444-453`).

| Tab | Columns | Header constant |
|---|---|---|
| `Submissions` | 48 | `SUBMISSION_HEADERS`, `src/core/Records.js:31` |
| `Deliveries` | 8 | `DELIVERY_HEADERS`, `src/core/Records.js:78` |
| `Leads` | 47 | `LEAD_HEADERS`, `src/core/Domain.js:60` |
| `Contacts` | 28 | `CONTACT_HEADERS`, `src/core/Domain.js:93` |
| `Log` | 7 | `LOG_HEADERS`, `src/core/Domain.js:112` |
| `Work` | 11 | `WORK_HEADERS` + 2, `src/core/Domain.js:124` |

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

**Log**

```
logId, at, level, event, submissionId, leadId, detail
```

**Work**

```
workId, createdAt, kind, subjectId, state, attempts, nextAttemptAt, lastError,
completedAt, idempotencyKey, payload
```

`Work` is the one tab whose header row is **not** just its `_HEADERS` constant.
`expectedTabLayout()` returns `WORK_HEADERS.concat(['idempotencyKey', 'payload'])`
(`src/platform/SheetRepository.js:451`), because those two columns are what the queue
serializes rather than fields of the domain record. Provisioning eleven columns here and
nine there is the difference between a queue that dedupes and one that sends twice:
`appendRecord` silently skips any field whose column is absent
(`src/platform/SheetRepository.js:83-84`), so a nine-column `Work` tab drops the
idempotency key without erroring. Asserted by `tests/sheet-repository.test.js:453-457`.

---

## 3. Script Properties

**13 properties**, and exactly 13: `PROP_KEYS` in `src/platform/Config.js:14-55` names
these and nothing else. Eleven are set at provisioning; `AXP_FIRM_PHONE` and `AXP_LOGO_URL`
are deliberately left unset.

The **Status** column is not a preference. It is what `missingConfigFor()`
(`src/platform/Config.js:177-206`) and `configHealth()` (`src/platform/Config.js:223-255`)
actually do with an absent value:

- **Blocker** — named by `missingConfigFor()`, so the listed capability reports itself
  unconfigured and refuses to run rather than half-running.
- **Warning** — never named by `missingConfigFor()`; `configHealth()` records a warning and
  the feature degrades in a defined way.
- **Fails safe** — absence is not an error at all, because the safe value is the default.

| Property | Staging value | Status | Source |
|---|---|---|---|
| `AXP_SHEET_ID` | new staging spreadsheet id | Blocker — `intake` | created in §2 |
| `AXP_CALENDAR_ID` | new staging calendar id | Blocker — `booking` | created in §4 |
| `AXP_RUN_MODE` | `dry_run` | Fails safe — anything but `live` is `dry_run` | flipped to `live` only for the §8 window |
| `AXP_REPLY_TO` | `info@axispoint.llc` | Blocker — `acknowledge`, `qr_acknowledge` | settled |
| `AXP_FROM_NAME` | `AxisPoint Partners [STAGING]` | Blocker — all four sending capabilities | brand + §7.4 test label; drop the suffix for production |
| `AXP_PARTNER_NOTIFY_TO` | `Zach@axispoint.llc,Ethaniel@axispoint.llc` | Blocker — `notify` | settled |
| `AXP_PARTNER_EMAIL_MAP` | `{"zachary_russell":"Zach@axispoint.llc","ethaniel_vu":"Ethaniel@axispoint.llc"}` | Blocker — `digest` | tokens from `PARTNERS` |
| `AXP_FIRM_EMAIL` | `info@axispoint.llc` | Blocker — `qr_acknowledge` | settled |
| `AXP_WEBSITE_URL` | `https://axispoint.llc` | Blocker — `qr_acknowledge` | live site |
| `AXP_PARTNER_DIRECT_EMAIL_MAP` | same mapping as above | Warning — that partner's acknowledgement falls back to the firm address | settled |
| `AXP_PARTNER_DIRECT_PHONE_MAP` | `{"zachary_russell":"832-580-2815","ethaniel_vu":"832-499-8389"}` | Warning — the phone row is omitted | settled |
| `AXP_FIRM_PHONE` | **unset** | Warning — the firm phone row is omitted rather than shown empty | not supplied |
| `AXP_LOGO_URL` | **unset** | Warning — emails render the wordmark as text | optional |

`AXP_RUN_MODE` is the one property whose absence is harmless and whose *mis*-setting is
not: `readConfig` coerces every value other than the exact string `live` to `dry_run`
(`src/platform/Config.js:136`), so a typo cannot accidentally start sending. It can only
accidentally stop it, which is the correct direction to fail.

The four **Warning** rows are the ones a reader is most likely to get wrong, because two of
them are set here anyway. Setting them is a quality decision, not a requirement:
`missingConfigFor()` never names `AXP_PARTNER_DIRECT_EMAIL_MAP` or
`AXP_PARTNER_DIRECT_PHONE_MAP`, so leaving either out degrades an acknowledgement rather
than blocking one.

**There are no promise flags to provision.** `AXP_REPLY_TO_MONITORED` and
`AXP_REMOVAL_PROCEDURE_CONFIGURED` were listed here as `false` pending owner approval. On
2026-08-15 the QR acknowledgement copy they gated was removed, and both properties with it:
correction and removal on request are not offered. Do not set either name on a staging or
production project; nothing reads it. The acknowledgement displays and sends nothing
promising that information will be corrected or removed.

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

**Status (2026-08-19): complete.** Calendar `AxisPoint Booking STAGING` created under
`Zach@axispoint.llc`. `AXP_CALENDAR_ID` set as a Script Property via the temporary-wrapper
pattern (`runSetCalendarId`, `setProperties` + `makePropertyWriter`). Calendar ID is not
recorded here.

---

## 5. Triggers and permissions

**There is no trigger installer in the code** (`ScriptApp` appears nowhere in `src/`,
verified: 0 occurrences). All three are created by hand in the Apps Script UI.

**Three triggers, not four.** Each row below is a real, callable top-level function in
`src/entrypoints/Entry.js`; nothing else in the repository is trigger-shaped.

| Trigger | Function | Schedule | Defined at |
|---|---|---|---|
| Work queue | `runWorkerTrigger` | every 5 minutes | `src/entrypoints/Entry.js:192` |
| QR digest | `runDailyQrDigestTrigger` | daily, 8:00 AM Central | `src/entrypoints/Entry.js:204` |
| Retention | `runRetentionMaintenanceTrigger` | daily, 3:00–4:00 AM Central | `src/entrypoints/Entry.js:214` |

**Retry is not a fourth trigger, and looking for one is a provisioning mistake.** Retry
happens *inside* the work-queue cycle: a failed item is written back with
`nextAttemptAt = now + backoff` (`src/scheduled/Worker.js:98`) and is simply claimed again
by a later run of the same 5-minute trigger, via `claimDue`
(`src/scheduled/Worker.js:117`). Installing a separate "retry" trigger would run a second
concurrent worker over the same queue, which is how one acknowledgement gets sent twice.

Queue bounds, all from `src/platform/Config.js:63-68`: 20 items per cycle
(`WORKER_MAX_ITEMS_PER_RUN`), 4 attempts (`WORKER_MAX_ATTEMPTS`), backoff 5/15/60 minutes
(`WORKER_BACKOFF_MINUTES = [0, 5, 15, 60]`, indexed by attempts already made). The digest's
intended hour is `DIGEST_HOUR_LOCAL = 8` (`src/platform/Config.js:87`). Operational records
are retained 90 days (`OPERATIONAL_RETENTION_DAYS`, `src/platform/Config.js:107`); business
records never expire automatically and `selectExpired` will not return one under any input
(`src/scheduled/Retention.js:1-26`).

**The retention trigger should be run once by hand with `{ dryRun: true }` before it is
scheduled**, against real staging data — `runRetentionMaintenanceTrigger` accepts that
option (`src/entrypoints/Entry.js:214`).

**QR is fully retained and all three triggers matter to it.** The QR path writes a Contact,
queues an acknowledgement the worker sends, and is swept into the next morning's digest.
Skipping the digest trigger does not disable a nice-to-have; it silently strips the QR
path of its only internal notification, since a Contact Exchange produces no Lead and
therefore no partner notification.

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

### Critical gotcha: "Anyone" ≠ "Anyone, even anonymous" in the deploy dialog

The Apps Script deploy dialog presents two distinct access levels that look similar but
behave completely differently:

| Dialog label | Manifest value | Behavior |
|---|---|---|
| **"Anyone"** | `ANYONE` | Requires a Google account — anonymous visitors are redirected to sign-in |
| **"Anyone, even anonymous"** | `ANYONE_ANONYMOUS` | Truly public — no Google account required |

**"Anyone, even anonymous" is what you must select.** Choosing "Anyone" produces a web app
that silently requires authentication: both the domain-branded URL format
(`/a/axispoint.llc/macros/s/.../exec`) and the plain format (`/macros/s/.../exec`) return
HTTP 302 to Google sign-in when accessed without a session. The two URL formats differ only
in *which* sign-in page the redirect targets (org-specific vs. generic), not in whether
auth is required. The URL format has no effect on anonymous access.

**This was the root cause of the V2 staging deployment blocking anonymous access.** The
V2 deployment was initially created with "Anyone" selected, while V1 used "Anyone, even
anonymous."

**Why the correct option may not appear in the dialog:** In a Google Workspace org, the
"Anyone, even anonymous" option is hidden from the deployment UI unless the Admin Console
setting "Allow users in organization to publish files on the web or make them visible to
the world as public or unlisted files" is enabled. To fix: Admin Console → Apps → Google
Workspace → Drive and Docs → Sharing settings → Sharing outside of organization → enable
"Allow users to publish files on the web." After saving, open the deployment dialog again
— the "Anyone, even anonymous" option should now appear. If it still does not appear,
allow 10–30 minutes for the setting to propagate before retrying.

**To fix an existing deployment that used the wrong access level:** Deploy → Manage
deployments → edit the deployment → change "Who has access" to "Anyone, even anonymous" →
Save. Editing in-place keeps the same `/exec` URL; no `VITE_V2_SUBMISSION_ENDPOINT` update
is needed. Verify with:
```
curl -L "https://script.google.com/macros/s/<deployment-id>/exec"
```
The response should be the `doGet` health check directly — no redirect to accounts.google.com.

### What `clasp push` is allowed to send

`clasp` runs from `scripts/gas-v2/`, against a gitignored `scripts/gas-v2/.clasp.json`
(`.gitignore:55`). The manifest pushed is `scripts/gas-v2/appsscript.json`.

**The source is nested, not flat.** `src/` is grouped into six directories:

```
src/entrypoints/   Entry.js — doGet, doPost, and the three trigger functions
src/core/          domain logic: Intake, Domain, Records, Booking, Matching, Routing, ...
src/platform/      Config, GoogleServices, SheetRepository, Ports, Runtime
src/scheduled/     Worker, Digest, Retention
src/emails/        the templates and their registry
src/shared/        Util.js
```

**`.claspignore` is an allowlist, and the allow rule is recursive.** It denies `**/**`
first, then re-allows exactly two patterns:

```
!appsscript.json
!src/**/*.js
```

The recursion is load-bearing and is the detail most likely to be got wrong. A
single-segment `!src/*.js` matched every file back when `src/` was flat, and matches
**nothing** now that the files sit one level down — which would push a project containing
a manifest and no code at all. The web app would then return an error for every request
while `clasp push` reported success. `tests/deployability.test.js:51-73` pins both the
deny-first ordering and the recursive form, so a regression to `src/*.js` fails the suite
rather than the deployment.

The allowlist direction matters just as much. Apps Script evaluates every pushed file's
top-level statements in one shared global scope on every invocation, so a single pushed
Node test file — opening with `require()`, which GAS does not define — makes every
`doPost` and every trigger throw. That is a full backend outage caused by files that are
not source.

**Verify after the first push:** run `clasp status` and confirm it lists exactly
`appsscript.json` plus the `src/**` files, and no `tests/`, `tools/`, `audit/`, or
`README.md`.

---

## 7. Rehearsal guardrails

Four independent guardrails. They are independent on purpose: each one alone is a single
point of failure, and the one most likely to fail is the human.

### 7.1 Recipients — only addresses you control

The visitor acknowledgement goes to **whatever address the submission contains**
(`src/platform/GoogleServices.js:92-98` sends to `message.to`; nothing filters or
allowlists it). There is no recipient allowlist in the code, so this rule is the only
thing standing between a rehearsal and a real person receiving a test email:

> **Only ever submit an address you control.** Never a client, never a colleague, never a
> plausible invented address that might belong to a real person.

"Plausible invented" is the one that actually bites. `firstname.lastname@gmail.com` typed
as a placeholder is very likely somebody's real mailbox. Use only `Zach@axispoint.llc`,
`Ethaniel@axispoint.llc`, or a `+tag` alias on one of them.

### 7.2 Run mode — the boundary is in the code

With `AXP_RUN_MODE=dry_run`, three calls stop at the boundary and return without touching
Google:

| Call | Dry-run return | Guard |
|---|---|---|
| `MailApp.sendEmail` | `{ok: true, status: 'dry_run'}` | `src/platform/GoogleServices.js:87-89` |
| `createEvent` | `{ok: true, status: 'dry_run', eventId: 'dry_run_evt'}` | `src/platform/GoogleServices.js:142-143` |
| `deleteEvent` | `{ok: true, status: 'dry_run'}` | `src/platform/GoogleServices.js:166` |

Records are still written and the queue still runs, so Phase 1 exercises the real logic.
Nothing leaves the project and no calendar event is created. `createEvent` returns the
clearly-fake placeholder id `dry_run_evt` rather than a real calendar id; a dry-run
booking cannot be cancelled by id, but the booking command still reaches `confirmed` status
and queues the confirmation email work item.

### 7.3 Calendar — a dedicated staging calendar, never a personal one

Rehearsal bookings land on `AxisPoint Booking STAGING` (§4), never on a partner's personal
calendar and never on a production booking calendar. This is enforced by one property,
`AXP_CALENDAR_ID`, read per call (`src/platform/GoogleServices.js:146`,
`src/platform/GoogleServices.js:168`).

The point is bulk cleanup. A test event on a dedicated calendar can be deleted by
selecting everything on that calendar; a test event on a personal calendar has to be
picked out from real appointments by hand, and one missed event is a partner being held at
a time nobody booked. **Before Phase 2, confirm `AXP_CALENDAR_ID` is the staging calendar
id and not a personal one** — the code cannot tell the difference and will use whatever it
is given.

### 7.4 Labels — every test artifact must be identifiable as a test

The failure this prevents is a rehearsal record surviving into production data and being
worked as a real lead. Labelling is **not automatic**: nothing in the code marks a record,
email, or event as a test, so it has to be carried in the fields a tester controls.

| Artifact | How to label it | Why it works this way |
|---|---|---|
| Sheet rows | Put `TEST` in `fullName` — e.g. `TEST Zach Russell` | Written verbatim; submitted values are never reformatted (`src/core/Records.js:31-40`) |
| Organization | Set `organization` to `TEST — staging rehearsal` | Same; also appears in the internal notification body |
| Outbound email | Set `AXP_FROM_NAME` to `AxisPoint Partners [STAGING]` for the whole rehearsal | Subjects are template-built and not tester-controlled, but the From name is a property and labels **every** outbound message at once |
| Calendar event | Comes free from `fullName` | The title is built as `'AxisPoint call' + ' with ' + attendeeName` (`src/platform/GoogleServices.js:149-151`), and `attendeeName` is `lead.fullName` (`src/core/Booking.js:119`) |

**Do not try to label the subject line.** Email subjects are built by the templates
(`src/emails/*.js`, each returning `subject: escSubject(subject)`) and no Script Property
overrides them. `AXP_FROM_NAME` is the one lever that marks every message, which is why it
carries the label rather than the subject.

**Reset `AXP_FROM_NAME` to `AxisPoint Partners` before production.** It carries the
`[STAGING]` suffix in §3 because this is the staging plan; shipping that suffix to a real
visitor is the obvious way this guardrail turns into an embarrassment.

Reply-To is `info@axispoint.llc` on every outbound message (`AXP_REPLY_TO`, §3).

---

## 8. Controlled E2E matrix and cleanup

### Phase 1: `dry_run`, no external effect

**Phase 1 run: 2026-08-21.** Cases 1-7 PASS. Cases 8 and 9 initially FAIL — two bugs found and fixed in PR #104 and PR #106. Cases 8 and 9 re-verified PASS on 2026-08-23 (post-PR #106 deploy, behavioural confirmation via live endpoint).

| # | Case | Asserts | Result |
|---|---|---|---|
| 1 | `doGet` health check | capabilities and blockers | **PASS** — all 6 capabilities true, runMode: dry_run, 2 expected warnings |
| 2 | Management Proposal | Lead, SLA, `bookingEligible: true` | **PASS** — leadId returned, slaDueAt 5 PM CDT next business day, bookingEligible: true |
| 3 | Investor Services | Lead, `bookingEligible: false` | **PASS** — leadId returned, bookingEligible: false, contactId: null |
| 4 | General Inquiry | Lead, no property block | **PASS** — leadId returned, bookingEligible: false, contactId: null |
| 5 | QR Contact Exchange | Contact and **no** Lead | **PASS** — contactId returned, leadId: null, bookingEligible: false, slaDueAt: null |
| 6 | Replay a used `submissionId` | replay, no second record | **PASS** — same leadId, replay: true |
| 7 | Same id, changed data | `SUBMISSION_ID_CONFLICT` | **PASS** — ok: false, SUBMISSION_ID_CONFLICT, no new record |
| 8 | Booking | Lead calendar fields, queued confirmation | **PASS** — bookingStatus: confirmed, calendarEventId: dry_run_evt (initial run: CALENDAR_CREATE_FAILED; fixed PR #104 + #106; re-verified 2026-08-23) |
| 9 | Booking retry, same id | replay, no second hold | **PASS** — same bookingRequestId returns bookingStatus: confirmed, replay: true (initial run: missing `code` field on failed-booking replay; fixed PR #104; re-verified 2026-08-23) |

**Wire notes (confirmed, permanent):**

- `attribution.sourceDetail` is validated as a required non-empty string. Website submissions must send the page pathname (e.g. `/en/contact`), not an empty string. The frontend already does this via `window.location.pathname`.
- `property.scale` must be a string, not a number. The frontend sends it as a string.
- SLA computed correctly: submissions at 04:00 UTC Thursday (23:00 CDT Wednesday/Thursday) resolve to 5:00 PM CDT next business day as expected.

### Phase 2: `live`, one narrow window, separately authorized

**Phase 2 run: 2026-08-23. Two cases run; both PASS. Verified directly by owner.**

The original Phase 2 matrix listed four cases (10–13). This run covered the two that prove
the live path works end-to-end — email delivery and calendar creation — which is the scope
the owner authorised. Cases 11 (QR digest) and 13 (slot-taken refusal) were not run; they
are not pre-production blockers and can be verified separately if needed.

| # | Case | Real effect | Result (2026-08-23) |
|---|---|---|---|
| 10 | `service_inquiry` to `Zach@axispoint.llc` | acknowledgement + partner notification | **PASS** — acknowledgement and partner notification both arrived at `Zach@axispoint.llc`; confirmed by owner directly |
| 11 | QR exchange to Ethaniel's address | acknowledgement; digest next morning | not run this pass |
| 12 | `booking_request` — 30-min slot on `AxisPoint Booking STAGING` | real calendar event + confirmation email | **PASS** — event created on `AxisPoint Booking STAGING` for 2026-08-26 10:00–10:30 AM CDT; confirmation email arrived; Sheet shows `calendarStatus: booked`; all confirmed by owner directly |
| 13 | Slot-taken refusal | `SLOT_UNAVAILABLE` with neutral copy | not run this pass |

**Submission IDs used (Phase 2 live window):**

| Submission | submissionId | leadId |
|---|---|---|
| Case 10 inquiry | `f0e1d2c3-b4a5-4697-8f8e-d9c0b1a2f3e4` | `32a5cc8b-0d83-4835-ae9d-0e80ec259668` |
| Case 12 booking | bookingRequestId `a9b8c7d6-e5f4-4321-9abc-1234567890ab` | same lead |

**Deployed version at time of Phase 2 run:** version @2 (post-PR #106, `clasp deploy -i` run 2026-08-23). Verified behaviourally before flipping to `live`: a dry_run booking returned `bookingStatus: confirmed` (not `CALENDAR_CREATE_FAILED`), confirming the PR #106 fix was deployed.

**Post-run state (confirmed 2026-08-23):**
- `AXP_RUN_MODE` reverted to `dry_run` immediately after both cases completed; confirmed via `verifyProperties()` in the editor and via health-check endpoint (`runMode: "dry_run"`).
- `tmp_phase2_admin.js` removed from the live Apps Script project via two-pass clasp push; confirmed via `clasp pull` (33 files, no stray files).
- Phase 2 calendar event on `AxisPoint Booking STAGING` remains (test artefact — delete manually as part of data cleanup before the next test pass).

**Note on Case 11 vs. the original plan.** The original plan said Case 11 would use a QR submission to Ethaniel's address. Since 2026-08-17 the QR card sends the firm slug for every exchange, so any QR submission resolves to `acquisitionSource: 'firm'` and lands in the digest's shared section (not under "Gathered through Ethaniel Vu"). This is correct behaviour, not a bug.

### Post-PR #108 deployment (2026-08-24)

PR #108 (Meet link + .ics attachment) merged to `main` 2026-08-24. `clasp push` was a no-op
(the worktree push from the same session had already updated HEAD). `clasp deploy -i` was run
immediately after merge, creating version @4 with description "PR #108 merged -- Meet link +
.ics attachment". Two verifications run against @4:

- **Health check (GET):** `{"ok":true,"runMode":"dry_run","capabilities":{"intake":true,"acknowledge":true,"qrAcknowledge":true,"notify":true,"digest":true,"booking":true},"promisesKeepable":true,"blockers":[],"warnings":[logo_absent, firm_phone_absent]}` — identical to Phase 1 baseline.
- **Dry-run booking (POST):** `submissionId a1b2c3d4-e5f6-4789-8abc-def012345678` (management_proposal inquiry, replay) → `leadId b0fbeca5-4e3e-4307-bae3-1545a0085f74`; then `bookingRequestId c1d2e3f4-a5b6-4789-8abc-0123456789ab`, `slotStart 2026-08-25T15:00:00Z`, `mode: phone_call` → `{"ok":true,"bookingStatus":"confirmed","replay":false}`.

### Post-PR #110 deployment (2026-08-24)

PR #110 (partner attendees on booking events) merged to `main` 2026-08-24. `clasp push` from
the feature worktree updated HEAD to 33 files. `clasp deploy -i` created version @5 with
description "PR #110 merged -- partner attendees on booking events". Verifications against @5:

- **Health check (GET):** `{"ok":true,"runMode":"dry_run","capabilities":{all true},"promisesKeepable":true,"blockers":[],"warnings":[logo_absent,firm_phone_absent]}` — identical baseline.
- **Dry-run booking (POST):** `submissionId f7a8b9c0-d1e2-4345-af56-789012345678` (fresh management_proposal) → `leadId 546d0360-7d08-4fa6-888e-0bd90573930b`, `bookingEligible: true`; then `bookingRequestId a1b2c3d4-e5f6-4789-8abc-098765432110`, `slotStart 2026-08-25T16:00:00Z`, `mode: phone_call` → `{"ok":true,"bookingStatus":"confirmed","replay":false}`.
- **Calendar.Events.insert capture (Node, real source, staging config):** `createEvent` in live mode sends to the Calendar API (captured by loading the real GAS source under Node with the staging `partnerNotifyTo` values):
  ```json
  {
    "resource": {
      "summary": "AxisPoint call with TEST Attendee Verification",
      "attendees": [{ "email": "Zach@axispoint.llc" }, { "email": "Ethaniel@axispoint.llc" }]
    },
    "options": { "conferenceDataVersion": 1, "sendUpdates": "all" }
  }
  ```
  Visitor email is NOT in the attendees array. Verified 2026-08-24.

Current deployment: version @5, `AXP_RUN_MODE: dry_run`.

### Live E2E verification at @5 (2026-08-24)

`AXP_RUN_MODE` flipped to `live` for two cases against version @5; reverted to `dry_run`
immediately after both completed. Both verified by owner via screenshot.

| Case | submissionId | leadId | bookingRequestId | slotStart (UTC) |
|---|---|---|---|---|
| `phone_call` | `b366143a-8880-4eee-8625-bb1b8a5311b9` | `38cc610a-7ec8-4407-b379-b4bfc7dcdef2` | `0558ec3a-5c08-4f1d-bbe8-07d8e66df3d8` | `2026-08-27T15:00:00.000Z` |
| `video_meeting` | `006dd8f0-47ef-4d13-8538-b6653186ea69` | `2daa4c23-…` (truncated; confirm full UUID from Sheet Leads tab) | `e84ee0cd-f0c5-4bc6-b933-e556f9e0b5cf` | `2026-08-28T15:00:00.000Z` |

**`phone_call` result:** Confirmation email arrived with .ics attachment; real calendar event
created on `AxisPoint Booking STAGING` (2026-08-27 10:00–10:30 AM CDT) with both partners
(`Zach@axispoint.llc`, `Ethaniel@axispoint.llc`) as attendees; `sendUpdates: "all"` confirmed.
Owner-verified via screenshot.

**`video_meeting` result:** Confirmation email arrived with Google Meet link
(`https://meet.google.com/caq-osot-yyj`) rendered in the "Join Google Meet" section and .ics
attachment (495 bytes); Meet link also present in the calendar event on `AxisPoint Booking
STAGING` (2026-08-28 10:00–10:30 AM CDT). Owner-verified via screenshot.

### Cleanup (after Phase 2 and live @5 verification)

**Completed 2026-08-24. Owner-confirmed.**

Three test calendar events were deleted from `AxisPoint Booking STAGING`:

1. 2026-08-26 10:00–10:30 AM CDT — Phase 2 live booking (Case 12, 2026-08-23) ✓
2. 2026-08-27 10:00–10:30 AM CDT — `phone_call` live E2E at @5 (2026-08-24) ✓
3. 2026-08-28 10:00–10:30 AM CDT — `video_meeting` live E2E at @5 (2026-08-24) ✓

Data rows in all six Sheet tabs cleared (row 1 headers kept). ✓  
`AXP_RUN_MODE` is `dry_run` — confirmed. ✓  
No `Work` rows remain pending. ✓

Email already sent cannot be recalled. The acknowledgement and notification emails from Case 10,
the confirmation email from Case 12, and the two confirmation emails from the live @5 runs are
permanent artefacts of these runs.

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
Its identifiers are not in any tracked file; they exist only at the
`pre-v1-retirement-2026-08-14` tag.

---

---

## Invoking admin functions: the temporary wrapper pattern

### Why a wrapper is needed

`runSheetProvisioning(sheetId)` requires a `sheetId` argument. `setProperties(writer, values)`
requires both a writer and a values object. The Apps Script editor's plain **Run** button calls
functions with no arguments; there is no way to supply one through that interface. `clasp run`
can pass arguments, but requires GCP Execution API linkage that has not been set up for this
project, and the setup is non-trivial. The workaround is a temporary no-argument wrapper
function added directly in the live Apps Script editor.

**`clasp push` removes any function added only in the editor.** The push mechanism sends only the
files that pass `.claspignore` — `appsscript.json` and `src/**/*.js` — by calling
`projects.updateContent` with a complete replacement of the project's file set (clasp 3.3.0
`build/src/core/files.js`, `push()` method). Any function added manually in the
editor but absent from `scripts/gas-v2/src/` is erased on the next push. This is intentional and
expected behavior; it is the same mechanism that keeps Node test files out of the live project.

**The required sequence is: add wrapper → run → remove wrapper.** Never leave a wrapper with a
hardcoded Sheet ID in the live project permanently.

### Template

Add a function like this directly in the Apps Script editor (as a new script file or appended to
an existing one). Replace the placeholder with the real ID. Never commit this to source.

```js
// TEMPORARY — remove after use. Never commit.
function runRehearsalProvisioning() {
  var result = runSheetProvisioning('<SHEET_ID_HERE>');
  Logger.log(JSON.stringify(result, null, 2));
}
```

For setting Script Properties:

```js
// TEMPORARY — remove after use. Never commit.
function runSetStagingProperties() {
  var result = setProperties(makePropertyWriter(), {
    AXP_SHEET_ID:                  '<SHEET_ID_HERE>',
    AXP_CALENDAR_ID:               '<CALENDAR_ID_HERE>',
    AXP_RUN_MODE:                  'dry_run',
    AXP_REPLY_TO:                  'info@axispoint.llc',
    AXP_FROM_NAME:                 'AxisPoint Partners [STAGING]',
    AXP_PARTNER_NOTIFY_TO:         '<NOTIFY_TO_HERE>',
    AXP_PARTNER_EMAIL_MAP:         '<JSON_OBJECT_HERE>',
    AXP_FIRM_EMAIL:                'info@axispoint.llc',
    AXP_WEBSITE_URL:               'https://axispoint.llc',
  });
  Logger.log(JSON.stringify(result, null, 2));
}
```

For verifying Script Properties (`verifyProperties` needs a reader, not a Sheet ID, so the
adapter is the whole wrapper):

```js
// TEMPORARY — remove after use. Never commit.
function runVerifyProperties() {
  var result = verifyProperties(makePropertyReader());
  Logger.log(JSON.stringify(result, null, 2));
}
```

### Step by step

1. Open the live Apps Script project in the editor.
2. Create a new script file (or append to an existing one) with the temporary wrapper above.
   Replace `<SHEET_ID_HERE>` (or other placeholders) with the real values. Do not save the
   wrapper to source control.
3. Select the wrapper function from the function-name dropdown at the top of the editor.
4. Click **Run**.
5. Read the result in the **Execution log** panel.
6. **Immediately delete the wrapper from the editor.** Do not leave it in place — a hardcoded
   real Sheet ID sitting in the live project with no expiry is how a future push accidentally
   loses it versus a future hand-edit accidentally keeps it.

`JSON.stringify(result, null, 2)` renders the structured return value from `provisionSheet`
and `setProperties` readably in the Execution log. The `null, 2` indent is optional; without it
the output is still valid but not human-scanned as easily.

### This pattern is needed again for the production run

The production provisioning run uses the same wrapper approach. Sheet ID and property values
will differ (no `[STAGING]` suffix on `AXP_FROM_NAME`, `AXP_RUN_MODE` starts `dry_run` and
stays that way until a live send is explicitly authorized). The procedure is identical.

### Why not build a permanent invocation method?

**Property-reading wrapper** — a no-argument wrapper that reads `AXP_SHEET_ID` from Script
Properties would avoid hardcoding a Sheet ID in editor code. The bootstrapping problem: at
provisioning time `AXP_SHEET_ID` does not yet exist as a property, so you would need to set it
manually in the Script Properties panel first, then run the wrapper. For a two-person team
running provisioning exactly twice (staging, production), the temporary wrapper pattern costs
less total effort than any wrapper-avoidance infrastructure.

**GCP Execution API (`clasp run` with arguments)** — enabling `clasp run` would genuinely solve
this problem for all current and future admin calls, not just this one. The one-time setup is
real: you need a GCP project linked to the Apps Script project, an OAuth client configured for
the CLI, and a local credential file. Worth revisiting if admin function frequency increases or
if new admin capabilities require frequent invocation. Not worth the setup cost before the
production run.

---

## What provisioning will create

1. ~~Apps Script project `AxisPoint V2 STAGING`~~ **Done (2026-08-19)**
2. ~~Spreadsheet `AxisPoint V2 CRM STAGING` with the six tabs above — 48, 8, 47, 28, 7, and
   **11** columns respectively~~ **Done (2026-08-19)**
3. ~~Calendar `AxisPoint Booking STAGING`~~ **Done (2026-08-19) — `AXP_CALENDAR_ID` set**
4. **11** Script Properties set per §3, of the 13 names that exist; `AXP_FIRM_PHONE` and
   `AXP_LOGO_URL` are deliberately left unset — **`AXP_CALENDAR_ID` set; 9 more pending
   (`runSetStagingProperties` ready to run in the editor); `AXP_SHEET_ID` pending (requires
   staging spreadsheet ID from the sheet URL)**
5. 3 time-driven triggers per §5 — **pending (browser steps documented above)**
6. 1 Web app deployment — **pending (browser steps documented above)**
7. ~~Local `scripts/gas-v2/.clasp.json`, gitignored~~ **Done (2026-08-19)**

## Open before provisioning

### Provisioning functions

`src/platform/Provisioning.js` provides three pure, testable administrative functions.
`src/entrypoints/Entry.js` provides the GAS entry point that wraps one of them:

| Function | File | What it does |
|---|---|---|
| `runSheetProvisioning(sheetId)` | `entrypoints/Entry.js` | Opens the spreadsheet by ID and runs `provisionSheet`. Calls `SpreadsheetApp` directly; only runs in a real GAS runtime. |
| `provisionSheet(book)` | `platform/Provisioning.js` | Idempotent: creates any missing tab with the correct headers; reports `header_mismatch` (never auto-corrects) if a tab exists with wrong headers. |
| `verifyProperties(reader)` | `platform/Provisioning.js` | Reports all 13 Script Properties by tier (required/warning) and whether each is present. |
| `setProperties(writer, values)` | `platform/Provisioning.js` | Targeted write: only keys present in `values` are written; others are left untouched. |

`makePropertyWriter()` in `src/platform/GoogleServices.js` is the adapter that backs `setProperties`
against the real Script Properties store. `makePropertyReader()` (same file) backs `verifyProperties`.

These functions cannot be called during normal request handling. Each is an administrative
operation run by hand in the Apps Script editor. The invocation procedure is in
[§ Invoking admin functions: the temporary wrapper pattern](#invoking-admin-functions-the-temporary-wrapper-pattern)
below.

### Everything else

Nothing else blocks provisioning.
