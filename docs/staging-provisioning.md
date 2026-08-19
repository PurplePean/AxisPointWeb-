# Staging provisioning plan

The plan for standing up the V2 backend in staging. This is the **Staging** pass named in
[`STATUS.md`](STATUS.md); it is not a numbered code pass.

**Nothing in this document has been created.** No Apps Script project, Sheet, calendar,
trigger, deployment, endpoint, email, or calendar event exists. Every value below is
recorded so provisioning is one reviewed decision rather than a sequence of small ones.

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
| Retention | `runRetentionMaintenanceTrigger` | daily, off-peak | `src/entrypoints/Entry.js:214` |

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
| `createEvent` | `{ok: true, status: 'dry_run', eventId: ''}` | `src/platform/GoogleServices.js:142-143` |
| `deleteEvent` | `{ok: true, status: 'dry_run'}` | `src/platform/GoogleServices.js:166` |

Records are still written and the queue still runs, so Phase 1 exercises the real logic.
Nothing leaves the project and no calendar event is created. Note that `createEvent`
returns an **empty** `eventId` in dry run, so a dry-run booking cannot be cancelled by id —
that is expected, not a defect to chase.

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
| 11 | QR exchange to Ethaniel's address | one acknowledgement; digest next morning, **in the shared section** |
| 12 | Booking | one real event on the staging calendar |
| 13 | Slot-taken refusal | see below |

**Case 11 lands in the digest's shared section, not in a partner's own group.** Since the
2026-08-17 single-page collapse the QR card sends the firm slug for every exchange, so the
Contact resolves to `acquisitionSource: 'firm'` and both partners receive it identically. A
verifier expecting to see it under "Gathered through Ethaniel Vu" would read correct behaviour
as a bug. See [`design-sources.md`](design-sources.md) for why per-partner attribution was
given up.

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

1. Apps Script project `AxisPoint V2 STAGING`
2. Spreadsheet `AxisPoint V2 CRM STAGING` with the six tabs above — 48, 8, 47, 28, 7, and
   **11** columns respectively
3. Calendar `AxisPoint Booking STAGING`
4. **11** Script Properties set per §3, of the 13 names that exist; `AXP_FIRM_PHONE` and
   `AXP_LOGO_URL` are deliberately left unset
5. 3 time-driven triggers per §5
6. 1 Web app deployment
7. Local `scripts/gas-v2/.clasp.json`, gitignored

## Open before provisioning

### Provisioning functions

`src/platform/Provisioning.js` provides three administrative functions and two GAS entry points:

| Function | What it does |
|---|---|
| `runSheetProvisioning(sheetId)` | Opens the spreadsheet by ID and runs `provisionSheet`. Entry point; calls `SpreadsheetApp` directly. |
| `provisionSheet(book)` | Idempotent: creates any missing tab with the correct headers; reports `header_mismatch` (never auto-corrects) if a tab exists with wrong headers. |
| `verifyProperties(reader)` | Reports all 13 Script Properties by tier (required/warning) and whether each is present. |
| `setProperties(writer, values)` | Targeted write: only keys present in `values` are written; others are left untouched. |

`makePropertyWriter()` in `src/platform/GoogleServices.js` is the adapter that backs `setProperties`
against the real Script Properties store. `makePropertyReader()` (same file) backs `verifyProperties`.

These functions cannot be called during normal request handling. Each is an administrative
operation run by hand in the Apps Script editor. The invocation procedure is in
[§ Invoking admin functions: the temporary wrapper pattern](#invoking-admin-functions-the-temporary-wrapper-pattern)
below.

### Everything else

Nothing else blocks provisioning.
