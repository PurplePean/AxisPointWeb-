# Backend Architecture — `scripts/gas/Code.gs`

Single-file Google Apps Script Web App that backs the contact form for both
`apps/web` and `apps/qr`. It logs leads to a Google Sheet CRM, sends
transactional email, syncs Google Contacts, creates Calendar booking events,
and runs three time-based digests plus an installable edit trigger.

All facts below are verified against `scripts/gas/Code.gs` as of this commit.

## ✅ The unified schema is LIVE. `USE_UNIFIED_SCHEMA = true`.

**This is the current production design, not a pending plan.** `Code.gs` line 1275
reads `var USE_UNIFIED_SCHEMA = true;` (flipped 2026-07-15, PR #47), and the code carrying
that flag has been pushed and deployed to the pinned production deployment
(`clasp deploy -i …ZgBqg`, version @25). Every lead read and write now targets **one
`Leads` table** — 25 columns + a `Details`
JSON blob — via `UNIFIED_LEAD_HEADERS` / `UCOLS` / `resolveUnifiedCols`. The migration
that got here is documented stage-by-stage in `UNIFIED_SCHEMA_MIGRATION_PLAN.md`; this
document describes the **result**, which is what runs.

**The legacy per-role architecture still exists in the file, in parallel, as an
intentional rollback safety net — it is NOT deleted.** Thirteen `xxxLegacy` bodies
(`existingReferralCodesLegacy`, `findExistingLeadLegacy`, `matchReferrerLegacy`,
`updateReferrerStatsLegacy`, `buildLeadRowLegacy`, `persistNewLeadLegacy`,
`handleResubmissionLegacy`, `sendDailyDigestLegacy`, `sendMonthlyReferralSummariesLegacy`,
`moveColdLeadsLegacy`, `onSheetEditLegacy`, `handleManualReferralLinkLegacy`,
`handleStatusEditLegacy`) survive unchanged, and each migrated function is a dispatcher
`return USE_UNIFIED_SCHEMA ? xxxUnified(...) : xxxLegacy(...)`. Flipping the switch back
to `false` (then `clasp push` + `clasp deploy -i`) restores the entire legacy path. The
nine legacy lead tabs and the 31-column `LEAD_HEADERS` layout (documented later in this
file, now marked **LEGACY**) are the tabs those bodies read/write. **Deleting them is
Phase D, with no fixed timeline** — and per `CLAUDE.md`, deleting a live Sheet tab is
not git-revertible, so it destroys the rollback path for good. Until then, both schemas
coexist in the source and exactly one (unified) is active.

> **⚠ Two operational steps are NOT verifiable from this repo and must be confirmed
> against the live Sheet before relying on them.** The cutover runbook
> (`UNIFIED_SCHEMA_MIGRATION_PLAN.md` §8) requires **Phase A** — running
> `setupSpreadsheetUnified()` by hand from the Apps Script editor to create the `Leads`
> tab **before** the deploy, because a migrated function pointed at a missing tab throws
> on every request — and **Phase C** — verifying one live submission per lead type plus
> the live-concurrency checks. There is **no record in the repo (CHANGELOG, deployment
> docs) that either was completed**, and this repo cannot read the live Sheet (the
> `clasp` token lacks the Sheets scope). The switch comment in `Code.gs` still carries
> the pre-cutover warning that the manual run "has NOT happened." So: the code is `true`
> and deployed, but *whether the `Leads` tab exists and whether live traffic was
> verified are open, unconfirmed items* — see *Known open defects* below.

### What runs under the live unified schema

- **One row per lead, forever, in `Leads`.** Status and Category are column *values*,
  not tab membership. A cold lead is a `Status = 'Cold'` write; a status edit is just a
  status edit plus its Contacts side effect; a promotion to `Client` is a Category/Status
  value. **No unified path deletes or relocates a lead row** — both former row-deleting
  functions (`moveColdLeads`, `handleStatusEdit`) had that logic removed, not ported.
- **The edit trigger is fully wired** (`onSheetEditUnified`): the tab guard is a single
  `sheet.getName() === 'Leads'` check, and the three watched columns resolve **by name**
  via `resolveUnifiedCols`.

  | Watched column | Handler | State |
  |---|---|---|
  | Status | `handleStatusEditUnified` | Acts on the **live** cell value under the shared lock; logs conflicts; does not auto-restore. |
  | Category | `handleCategoryEdit` | **Unchanged / schema-agnostic** — reads only `rowData` + `EMAIL` (a key in both `COLS` and `UCOLS`), so it needed no migration. |
  | Referred By Email | `handleManualReferralLinkUnified` | Scans the one `Leads` table; back-fills the referral columns with `Match Type = manual`; updates stats; logs a Referrals row; notifies. |

- **Both data-fidelity fixes are live** (`buildLeadRowUnified` + `buildLeadDetails`):
  - **All 13 `qualData` fields persist** into `Details`, keyed per the **registry**
    (`LEAD_TYPES.detailsFields`), never re-derived from field names. The legacy row
    builder wrote exactly one (`assetClasses` → Asset Class) and dropped the other twelve.
  - **`submit_referral.referred` is a structured object**
    (`{firstName, lastName, email, phone, notes}`), not prose prepended to the message.
  - **The `Details` contract:** a field the lead type **asks** is always **present**
    (`''` or `[]` when blank); a field it does **not** ask is **absent**, so "asked and
    not answered" is distinguishable from "never asked". `message`, `preferences`, and
    `booking` (incl. `meetLink`) are on every type. `Reports Enabled` is a normal column
    seeded by the row builder from `LEAD_TYPES.seedReportsEnabled`. (For EAO, `message`
    is now `''` and its free text lives once in `Details.pressing_issue` — see the EAO
    normalizer note under *Known open defects* / the 2026-07-15 cleanup.)

- **The append is name-projected.** Every read AND write resolves columns by name.
  `persistNewLeadUnified` resolves the live `Leads` header and projects
  `buildLeadRow`'s canonical array onto the sheet's real columns
  (`projectLeadRowByName`) before appending:

  | Live header | Behavior |
  |---|---|
  | Canonical order | **Exact no-op** — byte-for-byte identical (verified). |
  | Reordered / columns inserted | Every value still lands under its own column. |
  | Extra columns past the 25 | Preserved as blanks, not clipped. |
  | **Missing a required column** | **Throws `headerLookupError` and refuses the write** — never guesses a cell. |

  `buildLeadRow` itself stays positional, which is correct: it *constructs* the canonical
  layout; knowing where the columns really are is the append's job.

- **The script lock is NOT reentrant.** `updateReferrerStats` takes the script lock
  itself, and `nextLeadSequence` / `nextReferralSequence` call `waitLock()` on the same
  lock. Apps Script does not document it as reentrant, so a function must **release the
  lock before calling any of those three.** `handleManualReferralLinkUnified` and
  `handleResubmissionUnified` are scoped exactly this way — the lock covers only their
  own row read-modify-write. The test suite's lock stub throws on a reentrant `waitLock`,
  so a widening refactor fails a test rather than deadlocking in production.

## Entry points

| Function | Kind | Behavior |
|---|---|---|
| `doPost(e)` | Web App POST | `JSON.parse(e.postData.contents)`. Routes to `handleSubscribe` when `payload.type === 'subscribe'` **or** (`!payload.role && payload.email`); otherwise `handleFormSubmission`. Errors return `{ success:false, error }`. |
| `doGet(e)` | Web App GET | `?unsubscribe=<email>` → `handleUnsubscribe`. `?action=availability&date=<"June 27, 2026">` → `handleAvailability` (free/busy JSON for the shared booking calendar, see below). Otherwise returns plain text `"AxisPoint Partners API"`. |

## Form-submission path

`handleFormSubmission(payload)` — **live behavior, unified schema.** Every schema-
dependent call below is a dispatcher already routing to its `xxxUnified` body; the
orchestration itself is not duplicated:

1. `leadTypeFor(payload.role).normalizer` — if the role's registry entry names one (today only `existing_asset_owner` → `normalizeEaoPayload`), it reshapes the flat wire payload **in place** into the generic `{ person, qualData }` shape so no role branching is needed downstream. Normalizers **add** the generic fields; they never strip the role-specific ones, so `payload.role` and e.g. `payload.current_situation` / `payload.pressing_issue` remain readable afterwards (`buildLeadDetails`, `bookingEventInternalDescription`, and the visitor note rely on this). **(EAO normalizer, as of 2026-07-15: it no longer copies `pressing_issue` onto `message` or stuffs a JSON summary into `preferences` — see the cleanup note under *Known open defects*.)**
2. Dedupe: `findExistingLead(email)` scans **the `Leads` table** by lowercased email. On match → `handleResubmission`, which read-modify-writes `Details.message` (parse, append a resubmission note, re-serialize) under the shared script lock, updates previously-empty fields, notifies partners, and returns the original Lead ID; **no new row / no new contact**.
3. New lead: `nextLeadSequence()` → `buildLeadId()` (`AXP-YYYY-XXXX`), `generateReferralCode()` (`AXP-` + 6 unambiguous chars, collision-checked against the `Leads` table).
4. `matchReferrer(payload)` — priority **code → email → name** against the `Leads` table.
5. If `payload.booking.date` → `createBookingEvent(payload, leadId)` first, to capture the Google Meet link **and** the event's calendar `htmlLink`. **All booking events (Meet and phone) are written to the dedicated shared "AxisPoint Bookings" calendar** identified by `CONFIG.BOOKING_CALENDAR_ID`, not the deploying account's personal default calendar. If that property is unset or the account lacks edit access, the event is skipped and logged (the call is try/caught upstream, so submission still succeeds without a booking).
6. `buildLeadRow(...)` builds the **25-column row + serialized `Details` blob**, then `persistNewLead(row, leadId, leadType)` — the one schema-dependent persistence step — does **ONE** name-projected `appendRow` to the single `Leads` table (`projectLeadRowByName`; refuses the write on a header missing a required column). `Reports Enabled` is seeded from the row builder for roles whose registry entry sets `seedReportsEnabled`. **There is no Lifetime/Active/category-tab fan-out any more** — that was the legacy three-append behavior, now the rollback path only.
7. If referral matched → `updateReferrerStats(referrerLeadId, chain)` (credits **Direct Referrals** to the immediate referrer and **Total Downstream** to every ancestor in the chain, script-locked), `logReferralEntry` (Referrals tab), `sendReferrerNotification`.
8. `createContact(payload)`, `sendVisitorConfirmation(...)`, `sendPartnerNotification(...)` — each wrapped in try/catch so one failure can't abort the response.
9. Returns `{ success:true, leadId, referralCode }`.

## Calendar booking + availability

Both the write (event creation) and read (free/busy check) paths reference the
**same** `CONFIG.BOOKING_CALENDAR_ID` — a getter that reads the
`BOOKING_CALENDAR_ID` Script Property — so availability shown to visitors and the
events actually booked can never point at different calendars.

- `createBookingEvent(payload, leadId)` — **both** Meet and phone bookings are inserted via `Calendar.Events.insert(resource, CONFIG.BOOKING_CALENDAR_ID, {sendUpdates:'all', …})` (Meet adds `conferenceData` + `conferenceDataVersion:1`; phone omits both). The advanced service is used for the phone path too, specifically so the event's `htmlLink` can be captured (`CalendarApp.createEvent` does not cleanly expose it); `CalendarApp.getCalendarById(...).createEvent(...)` remains only as a last-resort fallback if the advanced insert throws. Attendees on every event are `CONFIG.NOTIFY_EMAILS` (zach@, ethaniel@) plus the visitor's submitted email, and `sendUpdates:'all'`/`sendInvites:true` means Google emails all three a real invite, so the event also lands on the partners' personal calendars. **PRIVACY: because the visitor is an attendee, the event's title/description land in the visitor's own calendar, so both use the CLIENT-facing helpers only** — event **title** `bookingEventTitle(payload)` (`AxisPoint Partners intro call with <name>`, no internal category) and **description** `bookingEventClientDescription(payload)` (warm, minimal: what the call is + how to join; **no** lead ID, source, asset class, or category). The full internal detail dump lives in `bookingEventInternalDescription(payload, leadId)` and is used **only** in the internal partner-notification email, never on the shared event or the `.ics`. Returns `{ meetLink, calendarLink, created, degraded, error }` — `created` is `true` only when an event was actually inserted (advanced or fallback), `degraded` is `true` when an event exists but no `calendarLink` could be captured (the `CalendarApp` fallback, which also provisions no Meet conference), and `error` holds the reason for whichever non-healthy state applies. Skips + logs (and surfaces `error`) if the calendar ID is unset or inaccessible. `handleFormSubmission` threads a `calendarStatus` object into `sendPartnerNotification`, which renders a red "⚠ Calendar event was NOT created" banner when no event resulted and an amber "⚠ Calendar event created, but no link captured" notice when one exists without a link — so neither failure is silent. See *Booking failure is fail-visible* below.

**`.ics` attachment (visitor confirmation).** `buildBookingIcs(payload, leadId, meetLink)` produces an iCalendar `VEVENT` blob (`text/calendar`, `axispoint-call.ics`) attached to the booking visitor-confirmation emails (meet + phone) via `GmailApp.sendEmail`'s `attachments` option. Because it is delivered straight to the visitor, it carries **only** the client-facing `bookingEventTitle` / `bookingEventClientDescription` (no CRM internals); `leadId` appears solely in the opaque `UID` field (a machine identifier for dedup, never displayed). It emits America/Chicago wall-clock times with a real `VTIMEZONE` block, and sets `LOCATION` to the Meet link (video) or the phone number (phone). `METHOD:PUBLISH` so clients treat it as an event to add. This is a **deliberate belt-and-suspenders backup** to Google's native attendee invite (which can be delayed, spam-filtered, or useless to a non-Google visitor): the visitor is still added as an attendee on the real event with `sendUpdates:'all'`, so both the native invite **and** the attached `.ics` reach them. Generation is wrapped in try/catch — a failure never blocks the confirmation email.
- `handleAvailability(dateStr)` — GET endpoint. Runs `Calendar.Freebusy.query` for the calendar day against `BOOKING_CALENDAR_ID`, then `computeSlotAvailability(dateStr, busy, BOOKING_SLOTS)` marks each slot free/booked by 30-minute overlap. Returns `{ success:true, date, slots:{ "8:00 AM":true, … } }` (`true` = free) or `{ success:false, error }`. The frontend treats any non-success as "all slots available".
- `computeSlotAvailability(dateStr, busyPeriods, slots)` — pure overlap logic (no GAS globals beyond the pure `parseBookingDateTime`), so it is exercised in Node against a stubbed Freebusy response. **A committed test suite now exists** at `scripts/gas/tests/` (added 2026-07-10), run with `pnpm test:gas` and in CI via `.github/workflows/test-gas.yml`. It `vm`-loads the real `Code.gs` with GAS globals stubbed and covers this function, the other pure functions, `resolveCols`, the seven email-template parity pairs, and the `BOOKING_SLOTS`/frontend `SLOTS` sync. Earlier changelog verification runs predating this were throwaway harnesses; those are now superseded by the committed suite.
- `BOOKING_SLOTS` — the 16 fixed CT slot labels, mirrored from `SLOTS` in `packages/brand/src/components/form/utils.ts` (must stay in sync — same drift risk as the email template mirrors).

### Why the client/internal content split exists

This is a **privacy** decision, not a formatting one. `createBookingEvent` adds the
visitor to the event's `attendees` array and sends real invites
(`sendUpdates:'all'`). That means the event's `summary` and `description` are
rendered **inside the visitor's own Google Calendar**, and the `.ics` is delivered
straight to their inbox. Anything written to those two surfaces is visitor-facing,
permanently, on a system we do not control.

Before the split, both surfaces rendered the full CRM dump: `Lead ID: AXP-2026-0041`,
the raw `Source` value, asset class, and an internal `(Category)` label in the title.
Every booked visitor was shown our internal lead record.

The split is therefore enforced at the helper level, so the safe default is the one
that's easy to reach for:

| Helper | Content | Where it may appear |
|---|---|---|
| `bookingEventTitle(payload)` | `AxisPoint Partners intro call with <name>` — no category | Calendar event, `.ics`, (also reused internally) |
| `bookingEventClientDescription(payload)` | Warm, minimal: what the call is, how to join, callback number if phone | Calendar event, `.ics` |
| `bookingEventInternalDescription(payload, leadId)` | Full dump: lead ID, email, phone, callback number, asset class, source, EAO situation, message | **`partner-notification` email only** (`NOTIFY_EMAILS`) |

`leadId` does still reach the visitor, but only inside the `.ics` `UID` field
(`axp-<leadId>-<timestamp>@axispoint.llc`) — an opaque machine identifier used for
calendar-client dedup, never rendered to a human. That is deliberate and acceptable.

**Rule for future edits:** if you are adding a field to a booking event or the
`.ics`, it must go through `bookingEventClientDescription`, and you must ask whether
the visitor should see it. `bookingEventInternalDescription` must never be passed to
`Calendar.Events.insert`, `CalendarApp.createEvent`, or `buildBookingIcs`.

### Booking failure is fail-visible, by design

`createBookingEvent` returns `{ meetLink, calendarLink, created, degraded, error }`.
There are **three** distinct outcomes, not two, and each gets its own signal in the
internal `partner-notification` email:

| Outcome | `created` | `degraded` | `calendarLink` | Signal in the partner email |
|---|---|---|---|---|
| **Healthy** — advanced `Calendar.Events.insert` succeeded and returned an `htmlLink` | `true` | `false` | set | "View in calendar" link, no banner |
| **Degraded** — an event genuinely exists, but no link could be captured | `true` | `true` | `''` | Amber **"⚠ Calendar event created, but no link captured"** notice + the underlying cause |
| **Failed** — no event exists at all | `false` | `false` | `''` | Loud red **"⚠ Calendar event was NOT created"** banner + the underlying cause |

`handleFormSubmission` builds a `calendarStatus` object
(`{ requested, created, degraded, error }`) and passes it to
`sendPartnerNotification`, which derives
`calendarFailed = requested && !created` and
`calendarDegraded = requested && created && !calendarLink`.

**Failed** covers: unset `BOOKING_CALENDAR_ID`, an unparseable date/time, no calendar
access, and an exception from the `CalendarApp` fallback itself (which propagates to
`handleFormSubmission`'s try/catch, leaving `created` false).

**Degraded** covers the two paths where the event is real but link-less:

1. The **`CalendarApp` fallback** (taken when the advanced `insert` throws).
   `CalendarApp.createEvent` exposes no `htmlLink` and provisions no Meet
   conference. It therefore keeps `degraded = true` and **preserves the
   advanced-insert error** that forced the fallback.
2. An `insert` that returns no `htmlLink` (defensive; the Calendar API always sets
   one in practice).

This three-state design replaced a two-state one that was still partly fail-silent.
The `CalendarApp` fallback used to set `created = true` and then **clear `error` to
`''`**, returning an empty `calendarLink`. That produced an email with no "View in
calendar" link, no warning banner, and no explanation — *byte-for-byte identical to a
healthy booking that just happened to render no link*. Worse, for a Meet booking the
fallback creates no conference, so the partner email rendered
`<a href="">Join Google Meet →</a>`: a button that looks live and goes nowhere. Both
are fixed; the empty-`href` anchor is now a plain "No Google Meet link was created"
marker.

The submission still must never break on a calendar failure (that part was always
right), but the failure now has to announce itself. Logs nobody reads are not a
signal, and neither is a missing link.

## `source` vs `heardAbout` — two different questions

These are separate fields answering separate questions, and conflating them once
already corrupted the CRM's Source column.

| Field | Question it answers | Values | Where it lands |
|---|---|---|---|
| `payload.source` | *Through which channel did this submission physically arrive?* | `'qr'` (QR microsite) or `''` (direct site visit) | Sheet **Source** column, via `leadSource(payload)` → `QR` / blank |
| `payload.heardAbout` | *How did the visitor say they first heard of us?* | The form's "How did you hear about us?" answer, e.g. `'LinkedIn'`, `'Referral'` | Sheet **Heard About** column, via `leadHeardAbout(payload)`, **and** a `Heard about us` row in the internal `partner-notification` email. Never client-facing. |

`leadSource(payload)` reads **only** `payload.source`. It deliberately does **not**
fall back to `payload.page`: every main-site submission carries
`page === 'axispoint.llc'`, which would stamp the domain into Source on every row.
Any other explicit non-empty origin passes through verbatim so a future channel
doesn't silently vanish.

**Current state of `heardAbout` — verified against source, not assumed:**

- `packages/brand/src/types.ts` declares it, and `buildPayload` in
  `components/form/utils.ts` sends it **unconditionally** (`heardAbout: s.sourceSel ?? ''`)
  on all four `buildPayload` roles.
- `buildEAOPayload` does **not** send it, so EAO rows carry a blank **Heard About**
  cell. This is **structural, not an oversight, and adding the field would not fix
  it**: `buildPayload` sends `heardAbout: s.sourceSel`, and `sourceSel` is set only
  by `Step4Contact`, which `STEP_ORDER_EAO` does not include. The EAO flow never
  asks the question. Since `leadHeardAbout()` already yields `''` for a missing
  field, adding `heardAbout: ''` to `buildEAOPayload` would change no cell value and
  would only make a hardcoded blank look like a captured answer. Populating this for
  EAO is a **product change** (add the question to the EAO step order, then thread
  the answer through), not a plumbing one. Verified against source 2026-07-09.
- `Code.gs` reads it through **`leadHeardAbout(payload)`** (defined next to
  `leadSource`, deliberately, so the distinction is visible at the definition site).
- **Column 31, `Heard About`**, is the last entry in `LEAD_HEADERS`;
  `COLS.HEARD_ABOUT === 30`.

It is persisted as of 2026-07-08. Where it goes:

| Surface | Carries `heardAbout`? |
|---|---|
| Sheet **Heard About** column (every lead tab) | ✅ |
| `partner-notification` email (`NOTIFY_EMAILS`) — its own `Heard about us` row, directly under `Source` | ✅ |
| Visitor confirmation email / `.ics` / Calendar event | ❌ never, by the same client/internal split as the booking helpers |

It sits in its own clearly-labeled row rather than being merged into `Source`,
because they answer different questions and conflating them once already corrupted
the Source column.

## Lead types → the `LEAD_TYPES` registry

**`LEAD_TYPES` is the single definition site for a lead type.** Adding or changing
one means editing that object and nothing else in `Code.gs`. Added 2026-07-09.

| Wire `role` | `category` | `tab` | `contactGroup` | `normalizer` | `seedReportsEnabled` |
|---|---|---|---|---|---|
| `investor` | `Investor` | `Investors` | `AxisPoint Investors` | — | — |
| `referral` | `Referral Partner` | `Referral Partners` | `AxisPoint Referral Partners` | — | ✅ |
| `pro` | `RE Professional` | `RE Professionals` | `AxisPoint RE Professionals` | — | — |
| `existing_asset_owner` | `Existing Asset Owner` | `Existing Asset Owners` | `AxisPoint Existing Asset Owners` | `normalizeEaoPayload` | — |
| `submit_referral` | `Referral` | **`null`** (by design) | **`null`** (by design) | — | — |

`submit_referral`'s two `null`s are **assertions, not omissions**: the submitter's
lead lives in Active/Lifetime only, the referral relationship is logged to the
**Referrals** tab, and submitting a referral does not itself categorize the
submitter. **Every** role additionally lands in Lifetime Leads + Active Leads.

`'Client'` is a Category value but **not** a lead type — no wire role produces it;
it is a status a lead is promoted into. It is therefore absent from `LEAD_TYPES`
and handled explicitly inside `contactGroupForCategory()`.

### Everything derives from it

| Consumer | Reads |
|---|---|
| `roleToCategory(role)` | `.category` (`''` for an unknown role) |
| `categoryTabForRole(role)` | `.tab` (`null` for unknown **or** deliberately tab-less) |
| `contactGroupForCategory(category)` | `.category` → `.contactGroup`, plus the `'Client'` special case |
| `handleFormSubmission` | `.normalizer` (applied in place, before anything reads the payload), `.seedReportsEnabled` |
| `setupSpreadsheet()` | `leadTabConfigs()` → `.tab` + `.tabColor` |
| `updateReferrerStatsLegacy()` | `leadTabConfigs()` → every lead tab's `.tab` (was a hardcoded 7-tab list; see below). The **unified** implementation reads no tab list at all — one table, one row per lead. |
| `onSheetEdit()` | `leadTabConfigs()` → the lead-tab guard that gates dispatch |
| `handleCategoryEdit()` | `allCategoryContactGroups()` → every `.contactGroup` + Clients |

Helpers: `leadTypeFor(role)` (own-key guarded, so a POSTed `role: "constructor"`
resolves to `null` rather than to `Object`), `leadTypeTabConfigs()`,
`leadTabConfigs()`, `allCategoryContactGroups()`.

**Under the live unified schema, the `.tab` / `.tabColor` consumers above
(`categoryTabForRole`, `setupSpreadsheet`, `updateReferrerStatsLegacy`, the
`onSheetEdit` legacy guard) are all on the LEGACY / rollback path.** The registry
still carries `.tab` and `.tabColor` **only** so those legacy bodies stay byte-for-byte
intact as the rollback path; they are removed at Phase D. The live path reads
`.category`, `.contactGroup`, `.normalizer`, `.seedReportsEnabled`, and Stage 6's
`.detailsFields` / `.detailsFrom`. It uses no per-role tab at all — one `Leads` table,
one row per lead.

**Why this exists.** Before the registry, those seven consumers each carried a
hand-maintained copy of the role list and nothing kept them in sync. When
`existing_asset_owner` shipped it was entered into some and not others:
`CONFIG.CONTACT_GROUPS` had **no EAO entry**, so `contactGroupForCategory('Existing
Asset Owner')` returned `null` and every EAO lead was created as a Google Contact
with no category group. Separately, the `Existing Asset Owners` **tab was named in
`CONFIG.TABS` and listed in `setupSpreadsheet`, but `setupSpreadsheet` was never
re-run**, so the tab did not exist; `appendRow()` logs-and-returns on a missing
tab, so every EAO category-tab row was silently dropped. Both are fixed. The class
of bug is now structurally harder: omitting a field is a visible hole in one
object, not a silent absence spread across a 3,000-line file.

(That EAO breakage is why the registry exists. The category-tab-existence check and the
"Lifetime/Active already hold the row" fallback it describes are **legacy-path**
behavior — under the live unified schema there are no category tabs and the single
`Leads` append is the only write.)

### Adding a lead type (live unified schema)

1. Add one entry to `LEAD_TYPES`: `category`, `contactGroup`, `normalizer` (or `null`), `seedReportsEnabled`, and `detailsFields` + `detailsFrom` (which `qualData`/top-level fields persist into `Details`, and from where). Add `.tab`/`.tabColor` too **only** while the legacy rollback path still exists — they feed nothing on the live path.
2. Add its Contact group to `CONFIG.CONTACT_GROUPS` (the per-category Google Contact Groups sync still runs).
3. **No tab creation is needed** — every lead lands in the one `Leads` table, which already exists. (Under the *legacy* schema this step was `setupSpreadsheet()` by hand to create the role's tab; skipping it is what broke EAO. That hazard is gone with the single table.)

## Time-based triggers

Created by `setupTriggers()` (deletes all existing project triggers first):

**Behavior below is the LIVE unified path** (each is a dispatcher whose `xxxUnified`
body runs because `USE_UNIFIED_SCHEMA = true`). The legacy body still exists as the
rollback path.

| Function | Schedule | Purpose (live unified) |
|---|---|---|
| `sendDailyDigest` | daily, `atHour(18)` (6 pm CT) | Plain-text digest of leads whose **Timestamp** falls on today's CT calendar date (ISO parsed, formatted to CT `MM/dd/yyyy`), to `NOTIFY_EMAILS`. Silent if none. Reads the single **`Leads`** table and pulls Asset Class + Booking out of the `Details` blob. **Read-only → no lock.** |
| `moveColdLeads` | weekly, Monday `atHour(8)` **+ the "Run Cold Lead Sweep Now" menu item** | Selects `Leads` rows with status in `[New Lead, Contacted, Active]` whose **Timestamp** is older than `COLD_LEAD_DAYS` (60) and sets **`Status = 'Cold'` in place** — **no append, no `deleteRow`, no category-tab sync.** Re-reads each row's live Status immediately before stamping (skips it if no longer active), then does the Google Contact move to the Cold group and the summary email **outside** the script lock. *(Legacy rollback body instead relocated the row to a Cold Leads tab and deleted it from Active.)* |
| `sendMonthlyReferralSummaries` | `onMonthDay(1)` `atHour(9)` | Filters the **`Leads`** table on `Category = 'Referral Partner'`, tallies per-referrer totals from the Referrals tab, and emails each partner (skips `Cold`/`Archive` status, skips `Reports Enabled = FALSE` read as a standard column, skips zero-referral partners). **Read-only → no lock.** |

## `onEdit` trigger

`onSheetEdit(e)` — installable trigger (`forSpreadsheet(...).onEdit()`), created by `setupTriggers`; dispatcher over `onSheetEditUnified` / `onSheetEditLegacy`. **Live behavior (unified): the tab guard is a single `sheet.getName() === 'Leads'` check, columns resolve through `resolveUnifiedCols`, and all three watched columns are wired** (the header row is ignored):

- **Status** (`handleStatusEditUnified`): a status edit is **just a status edit** — the row moves nowhere (no relocation, no delete). It acts on the **live** cell value under the shared script lock, drives the Google Contact side effect (`Client` labels the contact, `Cold`/`Archive` move it to the Cold group, active statuses restore it), logs conflicts, and does **not** auto-restore the event's value.
- **Category** (`handleCategoryEdit`): re-labels the Google Contact's category group. Schema-agnostic (reads only `rowData` + `EMAIL`), so unchanged from legacy.
- **Referred By Email** (`handleManualReferralLinkUnified`): looks up the referrer in the **`Leads`** table, back-fills all referral columns with `Match Type = manual`, updates referrer stats, logs a Referrals-tab entry, and sends the referrer notification. Script-locked around the row write only (the lock is not reentrant).

*(The legacy `onSheetEditLegacy` body — the rollback path — instead watches those columns on any of the nine lead tabs and moves rows between Active / Cold Leads / Clients / Archive.)*

## Subscriber path

- `handleSubscribe(payload)` — appends to **Subscribers** (dedupes by email, returns `alreadySubscribed` when present), then `sendWelcomeEmail`.
- `sendWelcomeEmail(email, firstName, preferences)` — renders `welcome-subscriber` with a per-preference list and an unsubscribe URL.
- `notifySubscribers(title, excerpt, url)` — invoked from the sheet's **AxisPoint → Send publish notification** menu (`openPublishDialog`); emails active subscribers a new-article notice.
- `handleUnsubscribe(rawEmail)` — flips `Active` to false and returns an HTML confirmation page.

## Spreadsheet UI / setup functions

| Function | Role |
|---|---|
| `onOpen()` | Adds the **AxisPoint** custom menu (publish notification, cold sweep now, daily digest now). |
| `openPublishDialog()` | 3-prompt dialog → `notifySubscribers`. |
| `setProperties()` | One-time: stores `SPREADSHEET_ID`, `SCRIPT_URL`, and `BOOKING_CALENDAR_ID` in Script Properties. |
| `setupSpreadsheet()` | **Legacy / rollback only.** Creates the 11 legacy tabs with headers (Referral Partners gets an extra `Reports Enabled` column, via `expectedHeadersFor()`). Lead-tab list derived from `leadTabConfigs()`. **Only touches tabs where `getLastRow() === 0`.** Not part of the live path; kept until Phase D. |
| `setupSpreadsheetUnified()` | **The live setup.** Creates **exactly** `Leads` (25-col `UNIFIED_LEAD_HEADERS`, `Details` last) + `Referrals` + `Subscribers` (both unchanged schemas). Same `getLastRow() === 0` guard. **Separate function, not switch-gated** — the `Leads` tab must exist before `USE_UNIFIED_SCHEMA` flips. It was the cutover's Phase A; **whether it was actually run against the live Sheet is unconfirmed from the repo** (see *Known open defects* #6). |
| `expectedHeadersFor(tabName)` | Single definition site for "the header row a lead tab should have": `LEAD_HEADERS`, plus `Reports Enabled` on Referral Partners only. Read by `setupSpreadsheet`, `leadTabHeaderAudit`, `rewriteLeadTabHeaderRow`. **`Heard About` is already the last element of `LEAD_HEADERS`** — concatenating it again duplicates the column. |
| `setupTriggers()` | Creates the four triggers above. |
| `countMissingEaoCategoryRows()` | **Read-only.** Reports how many `Category = "Existing Asset Owner"` rows in Lifetime Leads are absent from the Existing Asset Owners tab. Writes nothing. |
| `backfillEaoCategoryRows()` | One-time (but **idempotent**) repair of the EAO rows dropped while the tab did not exist. Copies them out of Lifetime Leads. Keyed on `Lead ID`, so a second run inserts nothing; a later run picks up only genuinely-new rows. Columns are projected **by header name** (resiliently — see below), never by position, so source and destination may differ in column order, width, casing, or spacing. Throws with an actionable message if the tab does not exist yet. |
| `leadTabHeaderAudit(ss, tabName)` | **Read-only.** The analysis, separated from its rendering: returns `{ name, missing, expected, actual, dataRows, diffs, missingCritical, drift, safeToRewrite }` for one tab. All three audit renderers below read it, so a summary can never disagree with a detail. `safeToRewrite` means **drifted AND empty**, not merely empty. |
| `auditLeadTabHeadersSummary()` | **Read-only. Start here.** One line per tab (name, `rows=`, `cols=actual/expected`, drift, `rewrite=SAFE\|NO(has data)`), plus a drifted-tab footer. ~660 chars for nine tabs vs ~6.3k for the full audit, which the Apps Script log viewer truncates before the later tabs are reached. |
| `auditLeadTabHeaderDetail(tabName)` | **Read-only.** Full per-column diff for **one** tab, so a drifted tab's columns can be inspected without the other eight crowding it out of the log. Throws on an unknown tab name. (The former all-tabs full dump, `auditLeadTabHeaders()`, was removed: the Apps Script log viewer truncated it before the later tabs rendered. Use the summary + this detail.) |
| `rewriteLeadTabHeaderRow(sheet, tabName)` | The mechanical rewrite, and **the single site of the zero-data-row assert**. Clears row 1 across the full sheet width, writes `expectedHeadersFor(tabName)`, restyles from the tab's `leadTabConfigs()` colour, strips formatting off trailing cells left over from a wider old header, freezes row 1. Returns `{ before, after }`. Throws if the tab has any data rows, even though every caller has already checked, because this is the function that would do the damage. |
| `repairLeadTabHeader(tabName)` | Repairs **one** lead tab. Takes its verdict from `leadTabHeaderAudit()` rather than re-deriving it. A healthy tab is left completely untouched (no rewrite); a drifted tab holding data throws; a drifted empty tab is rewritten. Throws on an unknown tab name. This is also the entry point for repairing Lifetime Leads specifically (`repairLeadTabHeader('Lifetime Leads')`). |
| `repairAllDriftedLeadTabHeaders()` | **Bulk repair.** Same iteration as `auditLeadTabHeadersSummary()`; rewrites every tab the audit reports `rewrite=SAFE` and skips every other verdict. **The guard is `leadTabHeaderAudit().safeToRewrite` taken verbatim** (drifted AND zero data rows) — this function gets no vote of its own. Logs one line per tab: `REPAIRED`, `SKIPPED (already OK)`, `SKIPPED (unsafe: has data, needs manual review)`, or `SKIPPED (tab not found)`, then a tally. Idempotent: a second run is all-skips. |

**Why a header rewrite needs a guard at all.** `leadRow()` writes a positional
31-value array via `appendRow()` without ever reading the header, so a wrong header
does not imply wrong rows. Rewriting the header over rows written under an older
layout moves no cells, it silently relabels every column, after which name-based
readers like `eaoBackfillPlan()` copy the wrong cells while appearing healthy.
Realigning a data-bearing tab is a separate, careful task.

### Header matching is resilient, and header names are derived

A header cell typed or pasted into the live Sheet by a human is not guaranteed to
be byte-identical to its `LEAD_HEADERS` constant. `eaoBackfillPlan` originally did
`srcHeaders.indexOf('Lead ID')` — an exact, case-sensitive compare against a
hardcoded literal — and threw `No "Lead ID" header on Lifetime Leads` against the
real Sheet, because that cell differs by casing or invisible whitespace. Fixed
2026-07-09.

Two separate defects were involved, and the second was worse:

1. The **lookup** rejected the column outright, so the function refused to run.
2. The **column projection** (`dstHeaders.map(h => srcHeaders.indexOf(h))`) used the
   same exact compare. Had the lookup succeeded, any column whose two header cells
   differed only in case or spacing would have been written **blank** — including
   `Lead ID` itself. Blank keys are invisible to the `seen` set, so the next run
   would not recognize the rows and would **insert duplicates**. Idempotency, the
   whole safety property of this function, depended on an exact string match across
   two independently hand-edited header rows.

Both now go through:

| Helper | Role |
|---|---|
| `normalizeHeaderName(v)` | Deletes `U+200B..U+200D` (zero-width), collapses every whitespace run (JS `\s` already covers `U+00A0` NBSP and `U+FEFF` BOM) to one space, trims, lowercases. |
| `findHeaderIndex(headerRow, name)` | Index of `name` in an already-read header row, compared through `normalizeHeaderName`. `-1` if absent. |
| `describeHeaderRow(headerRow)` | Renders each cell with its length and character codes. |
| `headerLookupError(sheet, row, name)` | Logs **and** returns the `Error` thrown when even a resilient match fails, embedding the full `describeHeaderRow` dump. |

So `Lead ID`, `lead id`, `Lead  ID`, `Lead<NBSP>ID`, and `  LEAD ID ` all match, while
`LeadID` and `Referred By Lead ID` correctly do not. `Lead<ZWSP>ID` renders on screen
as `LeadID`, so stripping the zero-width character (rather than converting it to a
space) correctly keeps it equal to `LeadID` and distinct from `Lead ID`.

The expected names are **derived from the schema**, not re-typed:

```js
var HEARD_ABOUT_HEADER = LEAD_HEADERS[COLS.HEARD_ABOUT];   // 'Heard About'
var LEAD_ID_HEADER     = LEAD_HEADERS[COLS.LEAD_ID];       // 'Lead ID'
var CATEGORY_HEADER    = LEAD_HEADERS[COLS.CATEGORY];      // 'Category'
```

`REPORTS_ENABLED_HEADER` stays a literal because it is a per-tab extra and is
genuinely not in `LEAD_HEADERS`.

**When a resilient match still fails**, the thrown error (and the execution log)
now contains the entire live header row rendered character by character —
`col 2: "LeadID"  len=6  codes=[76,101,97,100,73,68]` — plus the expected name and
its normalized form. No separate probe function is needed to diagnose it.

**`headerIndex(sheet, name)` deliberately still matches exactly** (trim + case-
sensitive). Its one remaining caller is `reportsEnabledIndex`, which treats `-1`
as a real "column absent → leave the partner enabled" state rather than an error,
so the exact match is acceptable there. (Its other former caller,
`migrateAddHeardAboutColumn`, has been removed.) For reading the standard 31 lead
columns, use `resolveCols(sheet)` — it matches resiliently via `findHeaderIndex`
and **throws** on a genuine miss. See *`resolveCols` — the standard for live-sheet
column reads* below.

**Order of operations for the EAO repair** (both manual, from the Apps Script
editor, after `clasp push` + `clasp deploy`):

1. `setupSpreadsheet()` — creates the missing `Existing Asset Owners` tab with the
   current `LEAD_HEADERS` + `Heard About` schema. Existing tabs are untouched
   (`getLastRow() === 0` guard).
2. `countMissingEaoCategoryRows()` — optional dry run.
3. `backfillEaoCategoryRows()` — copies the dropped rows in.

Running (3) before (1) throws rather than silently doing nothing. This is the same
manual-run pattern the header repair functions require; a `clasp deploy` alone
does **not** create tabs.

Utility helpers: `tab`, `appendRow`, `escapeHtml`, `jsonResponse`, `htmlPage`,
`renderTemplate`, `templateByName`, `getProp`, `headerIndex`, `reportsEnabledIndex`,
`resolveCols`, `openCrmSpreadsheet`, `eaoBackfillPlan`, `normalizeHeaderName`,
`findHeaderIndex`, `describeHeaderRow`, `headerLookupError`.

## `resolveCols` — the name-resolution standard (LEGACY tabs)

> **Live equivalent:** on the unified `Leads` table the same contract is provided by
> **`resolveUnifiedCols(sheet)`** (→ a `UCOLS`-shaped object) — that is what every live
> reader uses, and `persistNewLeadUnified` extends it to the *write* via
> `projectLeadRowByName`. `resolveCols` below is the legacy-tab counterpart, still used
> by the `xxxLegacy` bodies (the rollback path). The principle — resolve by name, throw
> on a miss, never trust a positional constant against a live sheet — is identical for
> both.

**Any code that reads a legacy lead tab's columns from the live Sheet must resolve them
by name through `resolveCols(sheet)`, never by indexing a row with the compile-time
`COLS` constant.** `COLS` records where a column *should* be; `resolveCols(sheet)`
reads the tab's actual header row and returns a `COLS`-shaped object whose values
are the columns' *real* positions, matched by name via `findHeaderIndex` (the same
resilient, case/whitespace/zero-width-tolerant path as `eaoBackfillPlan`).

Why this is mandatory and not stylistic: fourteen functions used to read live rows
as `row[COLS.SOMETHING]` with no verification that the header matched. A drifted
header (a column inserted, deleted, reordered by hand, or a tab left un-migrated)
made every one of those reads return the wrong cell — and six of the fourteen
write, two (`moveColdLeads`, `handleStatusEdit`) delete/move rows. That is the same
class of defect as the 2026-07-08 `REPORTS_ENABLED_COL = LEAD_HEADERS.length` bug,
just spread across the file.

Contract:

- Resolves the 31 standard `LEAD_HEADERS` columns (the `COLS` keys) only. The
  Referral Partners `Reports Enabled` extra is resolved separately by
  `reportsEnabledIndex()`; the Referrals and Subscribers tabs use their own schemas
  (`REFERRAL_HEADERS` / `SCOLS`) and are **not** resolved through this.
- **Throws `headerLookupError` (never returns a silent `-1`)** when a required
  standard header is absent, so a caller that does not check cannot read a wrong
  cell. Callers sit inside `try/catch` that logs, so a drifted tab surfaces as a
  diagnosable logged error instead of corrupted data — refusing to run on a broken
  tab is the intended outcome.
- Call it **once per sheet, before any row loop**, never per row (one header read +
  31 name lookups). Read-only loops guard on `getLastRow() < 2` first, so an empty
  tab (the current state of every lead tab) and normal submissions never invoke it.

The fourteen functions now threaded through it: `existingReferralCodes`,
`findExistingLead`, `matchReferrer`/`buildReferralMatch`, `updateReferrerStats`,
`handleResubmission`, `sendDailyDigest`, `sendMonthlyReferralSummaries`,
`moveColdLeads`, `setCategoryTabStatus`, `onSheetEdit`, `handleManualReferralLink`,
`handleStatusEdit`, `handleCategoryEdit`. **New live-sheet readers must follow the
same pattern.**

Building a *fresh* row to append (e.g. `buildLeadRow`) still uses `COLS` positional
ordering — that is correct, because it is constructing the canonical layout, not
reading an existing tab whose layout may have drifted.

Known residual (out of scope for the resolveCols change): functions that copy a
whole row array between tabs (`moveColdLeads`/`handleStatusEdit` appending a
source-layout row into Cold/Clients/Archive) still write positionally into the
destination. This is safe while all lead tabs share one layout (they do, post
header-repair); a fully name-projected cross-tab copy is a separate change.

## The LIVE schema — `Leads` + `Referrals` + `Subscribers`

**This is what production uses.** `setupSpreadsheetUnified()` creates exactly these
three tabs; every lead read/write targets `Leads`.

### `Leads` — the one lead table (`UNIFIED_LEAD_HEADERS`, 25 columns)

Verified against `Code.gs` line 1316 (`UNIFIED_LEAD_HEADERS`) / `UCOLS`. `UCOLS` holds
0-based indexes; column number = index + 1. **Order carries no runtime meaning** — every
live read resolves by name via `resolveUnifiedCols`; only a freshly-constructed row is
positional (and even the append is name-projected). The eleven referral-identity columns
(8–18) are real columns because `matchReferrer` searches Referral Code / Email / Name
across rows and `onSheetEdit` must detect an edit to `Referred By Email` specifically.

| # | Column | Notes |
|---|---|---|
| 1 | Lead ID | `AXP-YYYY-XXXX`. Primary key. |
| 2 | Timestamp | ISO string. Single source of "when submitted" (digest today-filter, cold-sweep age). |
| 3 | Category | from `roleToCategory`. Watched by `onSheetEdit` (`handleCategoryEdit`). |
| 4 | Status | replaces tab membership. Seeded `New Lead`. Watched by `onSheetEdit` (`handleStatusEdit`). |
| 5 | Email | dedupe key (lowercased) + a `matchReferrer` path. |
| 6 | First Name | half of the name-match path. |
| 7 | Last Name | half of the name-match path. |
| 8 | Referral Code | person's own shareable code; collision-checked. |
| 9 | Referred By Lead ID | referral identity. |
| 10 | Referred By Name | referral identity. |
| 11 | Referred By Email | referral identity. Watched by `onSheetEdit` (`handleManualReferralLink`). |
| 12 | Referred By Code | referral identity. |
| 13 | Match Type | `code` / `email` / `name` / `manual` / `none`. |
| 14 | Referral Chain | pipe-separated Lead IDs, origin → immediate referrer. Input to `Total Downstream`. |
| 15 | Chain Depth | integer. |
| 16 | Direct Referrals | running count of **immediate** referrals; incremented by `updateReferrerStats`. |
| 17 | Total Downstream | running count of the **whole downstream subtree**; `updateReferrerStats` credits every ancestor in a new lead's chain. **Live and written now** (unlike the legacy layout, where it was permanently 0). |
| 18 | Last Referral Date | written by `updateReferrerStats`. |
| 19 | Phone | |
| 20 | Company | |
| 21 | Role | raw wire value; selects how to read `Details`. |
| 22 | Source | `leadSource(payload)` — arrival channel only (`QR` / blank), never "how did you hear". |
| 23 | Heard About | `leadHeardAbout(payload)` — the visitor's own answer. Blank for EAO (no such step). |
| 24 | Reports Enabled | seeded by the row builder from `LEAD_TYPES.seedReportsEnabled`; blank/`TRUE` = receives monthly summary, `FALSE` opts out. A normal column now (the `REPORTS_ENABLED_COL = LEAD_HEADERS.length` bug class is gone). |
| 25 | Details | **The JSON blob.** Everything role-specific, keyed per `LEAD_TYPES.detailsFields`. Includes `message`, `preferences`, `booking` (incl. `meetLink`) on every type; the derived `assetClass` label only when non-empty; `submit_referral.referred` as a structured object. Blank-field contract: an *asked* field is present (`''`/`[]`); a *never-asked* field is absent. |

**`Referrals`** (`REFERRAL_HEADERS`) and **`Subscribers`** (`SUBSCRIBER_HEADERS`) keep
their own schemas and were never part of the migration — unchanged.

---

## `LEAD_HEADERS` — full 31-column layout ⚠ LEGACY / ROLLBACK ONLY

**This layout is NOT what production writes any more.** It is the per-tab schema the
thirteen `xxxLegacy` bodies use, kept intact as the rollback path until Phase D. It
describes the nine legacy lead tabs, which still exist in the live Sheet but are no
longer read or written while `USE_UNIFIED_SCHEMA = true`. Retained here so a rollback (or
a Phase-D cleanup) has an accurate reference. `COLS` holds 0-based indexes; column
number = index + 1.

| # | Column | Notes |
|---|---|---|
| 1 | Timestamp | ISO string (`payload.timestamp` or now). **Also the single source of "when submitted"** — the digest/cold-sweep age logic reads this (see below). |
| 2 | Lead ID | `AXP-YYYY-XXXX` |
| 3 | Referral Code | person's own shareable code, `AXP-` + 6 chars |
| 4 | First Name | |
| 5 | Last Name | |
| 6 | Email | dedupe key (lowercased) |
| 7 | Phone | |
| 8 | Company | |
| 9 | Role | raw wire value (`investor` / `pro` / …) |
| 10 | Category | from `roleToCategory` |
| 11 | Asset Class | from `assetClassFromQualData(qualData.assetClasses)` |
| 12 | Message | resubmission notes + `submit_referral` referred-person block appended here |
| 13 | Preferences | comma-joined; EAO stores its JSON detail summary here |
| 14 | Booking Date | |
| 15 | Booking Time | `booking.slot || booking.time` |
| 16 | Meet Type | `meet` / `phone` |
| 17 | Booking Phone | |
| 18 | Source | `leadSource(payload)` — **real origin only**: `QR` for the QR app, blank for a direct site visit. Deliberately **not** `payload.source \|\| payload.page` any more. The visitor's "How did you hear about us?" answer arrives separately as `payload.heardAbout` and is **never** written here; it lands in column 31 — see *`source` vs `heardAbout`* above. |
| 19 | Status | seeded `New Lead` |
| 20 | Referred By Lead ID | |
| 21 | Referred By Name | |
| 22 | Referred By Email | |
| 23 | Referred By Code | |
| 24 | Match Type | `code`/`email`/`name`/`manual`/`none` |
| 25 | Referral Chain | pipe-separated Lead IDs |
| 26 | Chain Depth | integer |
| 27 | Direct Referrals | running count; incremented by `updateReferrerStats` |
| 28 | Total Downstream | **Permanently `0` on this legacy layout** — `updateReferrerStatsLegacy` writes only `Direct Referrals` and `Last Referral Date`. The multi-level implementation lives in `updateReferrerStatsUnified` and writes the live `Leads` column 17 instead. This legacy column would only ever be written again on a rollback. See `UNIFIED_SCHEMA_MIGRATION_PLAN.md` → §2c. |
| 29 | Last Referral Date | |
| 30 | Meet Link | Google Meet URL when `meetType === 'meet'` |
| 31 | Heard About | `leadHeardAbout(payload)` — the visitor's own "How did you hear about us?" answer. Blank for EAO (no such step). Distinct from **Source**. |

**Added 2026-07-08:** column 31 **Heard About**. Appended at the end so no existing
column index moves. **This is a live-Sheet schema change** on every lead tab (see the
deploy note).

**Hardened 2026-07-08 (same day, follow-up):** appending `Heard About` exposed a real
positional-coupling bug. `REPORTS_ENABLED_COL` was defined as `LEAD_HEADERS.length`,
which encodes the assumption *"Reports Enabled is whatever sits immediately after the
standard headers"*. Adding a 31st header silently slid that constant from index 30 to
31 while the live **Referral Partners** tab still had `Reports Enabled` physically at
column 31. The consequence was not cosmetic: `appendRow` would have written the
`heardAbout` string **into the `Reports Enabled` cell**, and the `TRUE` seed would
have gone to unheadered column 32.

That constant is gone. `Reports Enabled` is now resolved **by name at runtime**:

```js
var REPORTS_ENABLED_HEADER = 'Reports Enabled';
function headerIndex(sheet, headerName)   // 0-based index in the sheet's real header row, or -1
function reportsEnabledIndex(sheet)       // headerIndex(sheet, REPORTS_ENABLED_HEADER)
```

`headerIndex` reads row 1 of the actual sheet rather than trusting a compile-time
constant, so it stays correct on tabs that have not yet been migrated. Both call
sites (`handleFormSubmission`'s seed write, `sendMonthlyReferralSummaries`'s opt-out
read) go through it. A `-1` return is a real state, not an error to paper over: the
seed write is **skipped and logged** rather than aimed at a guessed cell, and the
opt-out read treats the missing column as blank, so a layout problem can never
silently mute every partner's summary.

**Consequence for future schema edits:** a new column may now be inserted *anywhere*
in `LEAD_HEADERS` without anyone having to reason about what it does to `Reports
Enabled` or any other per-tab extra column. This is the pattern to follow — see
*Architecture Decision* below.

**Migration:** `setupSpreadsheet()` only writes headers into tabs where
`getLastRow() === 0`, so tabs holding real data never received the new column. The
one-time `migrateAddHeardAboutColumn()` that originally backfilled the `Heard
About` column has since been **removed** (2026-07-10): it placed the column by
`LEAD_HEADERS` index rather than truly by name, and its `headerIndex` `-1` branch
drove a column *insert* — the shape that corrupted the Lifetime Leads header. With
every lead tab now empty, the surviving path for a drifted-empty header is
`repairAllDriftedLeadTabHeaders()` (rewrites the header row from
`expectedHeadersFor()`, guarded to refuse any tab holding data).

**Removed:** the former column 20 **Date Submitted** (`MM/dd/yyyy` CT) was
redundant with **Timestamp** and has been deleted from the schema. `sendDailyDigest`
(today filter) and `moveColdLeads` (age calc + summary line) now derive the date
from **Timestamp** (ISO), formatting to CT where a calendar-date comparison is
needed. Removing it shifted every column from index 20 onward down by one — all
callers reference columns through the `COLS` map (no hardcoded positions), so the
shift is fully absorbed. **This is a live-Sheet schema change:** see the deploy note.

The **Referral Partners** tab carries one extra column past this layout,
`Reports Enabled` (column 32 after migration): blank/`TRUE` = receives the monthly
summary, explicit `FALSE` opts out. **Never reference it by a hardcoded index** —
resolve it with `reportsEnabledIndex(sheet)`.

Two other tabs use their own schemas: **Referrals** (`REFERRAL_HEADERS`, 13
columns, IDs `REF-YYYY-XXXX`) and **Subscribers** (`SUBSCRIBER_HEADERS`, 6
columns).

## Architecture Decision: Per-Tab Schema vs. Unified Schema — ⚠ SUPERSEDED (HISTORICAL)

> **This decision was REVERSED. The unified "Details JSON" schema described below as
> "the alternative" was adopted and is LIVE in production (`USE_UNIFIED_SCHEMA = true`,
> deployed 2026-07-15). The section is kept as the historical record of why per-tab was
> chosen in July 2026 and why that reasoning did not hold — do not read it as the
> current design.** What actually happened: reason #2 (real production data) was found
> false (the Sheet was empty), which reopened the question; reason #1 (automation coupled
> to physical tabs) was addressed head-on by the migration — the cold sweep, the monthly
> summary, and the `onEdit` logic were all rewritten against the one `Leads` table rather
> than rebuilt from scratch. The empty-Sheet window this section identified as "the
> structurally cheapest time" is exactly when the migration was done. See
> `UNIFIED_SCHEMA_MIGRATION_PLAN.md` and the *live schema* section above.

**Status (historical):** decided 2026-07-08 to keep the per-role-tab schema; **reversed
and cut over to the unified schema 2026-07-15.**

The [former] design gives every role its own physical tab (Investors, Referral
Partners, RE Professionals, Existing Asset Owners, …), each sharing the wide
`LEAD_HEADERS` column layout. The alternative evaluated was a **unified "Details
JSON" schema**: one flat table of core columns (Lead ID, name, email, category,
status, timestamp) plus a single structured JSON blob column carrying everything
role-specific.

The unified schema is the better data model in the abstract. It was not adopted, for
one concrete reason (a second reason was cited originally and has since been
disproven — see the correction below):

1. **Existing automation depends on tabs physically existing as separate tabs, not
   on a category label.** The per-category Google Contact Groups sync, the weekly
   cold-lead sweep (`moveColdLeads`, which physically relocates rows between tabs),
   the monthly referral summary (which reads the Referral Partners tab directly,
   including its extra `Reports Enabled` column), and the `onEdit` row-moving logic
   (`handleStatusEdit` moving rows to Cold Leads / Clients / Archive) are all written
   against real tabs. A unified schema does not adjust this code; it requires
   rebuilding all of it.

2. ~~**By the time this was seriously evaluated, the Sheet held real production
   data.**~~ **CORRECTED 2026-07-10 — this premise is false.** It was asserted on
   2026-07-08 without being checked. On 2026-07-09 `auditLeadTabHeadersSummary()` run
   live reported **`rows=0` on eight of nine lead tabs, Lifetime Leads included**, and
   on 2026-07-10 the Lifetime Leads tab was **visually confirmed empty** (zero data
   rows below the header). The CRM holds no production lead data today. There is
   therefore **no live-data migration cost** standing in the way of a schema change,
   and the "we can only absorb a `Heard About`-sized change safely" argument does not
   apply while the tabs are empty.

   **Consequences of this correction, which the refactor should weigh:**
   - `backfillEaoCategoryRows()` recovers dropped Existing Asset Owner rows *from
     Lifetime Leads*. If Lifetime Leads is empty, there is nothing to recover — the
     EAO category rows dropped before the tab existed are **gone, not recoverable**,
     not merely un-backfilled. Run `countMissingEaoCategoryRows()` to confirm the
     count is zero before retiring that tooling.
   - The unified-schema decision was made partly on a premise that did not hold. The
     remaining reason (#1, automation coupled to physical tabs) still stands on its
     own, so the **decision does not automatically flip** — but the empty-Sheet window
     is exactly when a re-shape would be cheapest, and that window closes the moment
     real submissions land. If a unified schema is ever going to happen, now is the
     structurally cheapest time, not "once `crm.`/`api.axispoint.llc` are real work."

### What is explicitly NOT a reason

**Manual-editing usability is not a factor in this decision, in either direction.**
The Sheet is backend infrastructure that happens to have a grid UI, not a hand-edited
document. "A JSON blob would be hard to read in a cell" is **not** a valid argument
against the unified schema, and "the tabs are easy to skim" is **not** a valid
argument for the current one. This reasoning must never be cited when revisiting
this. The only human-facing edits the Sheet is designed for are the three columns
`onSheetEdit` watches (Status, Category, Referred By Email).

### What happened instead of "revisit later" (historical)

The section above said to revisit "once `crm.`/`api.axispoint.llc` become real work" and,
until then, to extend the per-tab schema with name-based lookups. **That is no longer the
guidance** — the revisit was pulled forward and executed while the Sheet was empty, and
the unified Details-JSON schema is now live. The `Details` blob delivers exactly the
benefits this section predicted (add a field to one lead type without touching a shared
layout; no per-tab extra columns; no migration per field), and the EAO "pack detail into
the shared Preferences column" workaround it mentioned as a middle ground was generalized
into the real `Details` column for all five lead types and then removed as a hack (see the
2026-07-15 EAO normalizer cleanup under *Known open defects*).

**For current guidance on adding a field or a lead type, see *Adding a lead type (live
unified schema)* above** — one registry entry with `detailsFields`, no tab creation. The
one enduring rule from this section still holds and now applies to the unified table too:
**resolve columns by name, never by position** (`resolveUnifiedCols` / `projectLeadRowByName`).

## Dead-code cleanup status — VERIFIED CLEAN

The pre-EAO role vocabulary is fully gone. `grep -in` over `Code.gs` for
`curious`, `explorer`, `'refer'`, `Referrals Made`, `Explorers` returns **zero
matches**. The only live roles are the five in the mapping table above. The
earlier cleanup stuck. Re-verified 2026-07-12.

**The `Curious` tab is orphaned.** It is referenced by **no code**: it is not in
`CONFIG.TABS`, not in `LEAD_TYPES`, not created by `setupSpreadsheet()` (which
creates 11 tabs, listed below), and not read, written, swept, or audited by any
function. If the tab still exists in the live Sheet, it is a leftover of the
pre-EAO role vocabulary and nothing in the backend will ever touch it. Deleting it
from the Sheet is safe from the code's point of view; it is left alone here only
because this repo cannot read the live Sheet to confirm its contents first.

## Known open defects, resolved items, and verification gaps

Re-audited against `Code.gs` for this update. **Three of the original five defects
(#2, #3, #4) were resolved *by* the unified-schema migration and are now live; #5 is
closed and live; #1 remains genuinely open.** Two new items (#6, #7) record the
post-cutover verification gaps and the 2026-07-15 EAO cleanup. Each is marked with its
real current status so no future task assumes the wrong one.

### 1. `createContact` fails silently for at least one confirmed case

Google Contacts creation **does not reliably work today**. At least one confirmed
test submission produced no contact. `createContact(payload)` is called from
`handleFormSubmission` inside a try/catch that logs and continues (deliberately — a
contact failure must never fail a submission), so the failure is invisible from the
frontend and produces a successful-looking response.

**Do not assume Contacts creation currently works.** Anything that depends on it
(the per-category Contact Groups sync, `moveContactToCold`, `handleCategoryEdit`'s
re-labeling) inherits the same uncertainty.

Leading suspect, **not yet confirmed**: `createContact` uses **`ContactsApp`**, the
legacy Contacts API surface, which Google has deprecated in favour of the People
API. That is a hypothesis to test first, not a diagnosis. Root-causing this is its
own task and **has still not been done** — verified 2026-07-16, `createContact` still
calls `ContactsApp.createContact` / `.addPhone` / `.addOrganization`. The migration did
not touch it. **This is the one original defect that is still fully open.**

### 2. ✅ RESOLVED (live) — all 13 `qualData` fields now persist

**Was:** `buildLeadRow` persisted exactly one `qualData` field (`assetClasses` → Asset
Class); the other twelve (`clients`, `proIntent`, `relationship`, `fit`, `timeline`,
`awareness`, `aum`, `experience`, `proRole`, `markets`, `profession`, `referralIntent`)
never reached the Sheet. **Now:** `buildLeadRowUnified` + `buildLeadDetails` write every
field a lead type collects into the `Details` blob, keyed per the registry
(`LEAD_TYPES.detailsFields`). This is live under `USE_UNIFIED_SCHEMA = true`.
`submit_referral`, whose three fields were all in the never-read group, is the biggest
beneficiary — 100% of its qualified data was discarded before, and all of it lands now.
(The full field-by-field history is in `frontend-payload-schemas.md`.)

### 3. ✅ RESOLVED (live) — `Total Downstream` is now written

**Was:** permanently `0` (`updateReferrerStatsLegacy` wrote only `Direct Referrals` and
`Last Referral Date`). **Now:** `updateReferrerStatsUnified` — the live body — credits
`Total Downstream` to **every ancestor** in a new lead's `Referral Chain`, on the `Leads`
table's column 17. It is written on every referred submission. Behavior
(`UNIFIED_SCHEMA_MIGRATION_PLAN.md` → §2c):

| Column | Increments for | John → Steven → Maria: Maria's submission credits |
|---|---|---|
| **Direct Referrals** | the immediate referrer **only** | Steven **+1**. John: unchanged. |
| **Total Downstream** | **every ancestor** in the new lead's `Referral Chain` | Steven **+1** *and* John **+1**. |
| **Last Referral Date** | the immediate referrer **only** | Steven. John: unchanged (a lead referred two levels below you is not *your* referral). |

The chain already holds exactly the ancestor list needed — origin first, immediate
referrer last, and never the new lead's own ID — so attribution is a split of one
cell (`chainAncestors`), not a walk of parent rows.

**Concurrency.** Crediting a chain read-modify-writes counters on N rows, so
`updateReferrerStatsUnified` holds `LockService.getScriptLock()` across the
**entire** read-modify-write — the sheet read included, because locking only the
writes would leave the race intact (both executions would already have read the
same stale counter). It uses `tryLock(REFERRAL_STATS_LOCK_MS)` (10s), not
`waitLock`, calls `SpreadsheetApp.flush()` before releasing, and releases in a
`finally` so a mangled header cannot leak the lock. **A refused lock does not
throw** — this runs inside `handleFormSubmission`'s try, and throwing would fail
the visitor's submission because someone else happened to submit at the same
moment. It applies **no partial credit** and logs a `MANUAL REPAIR NEEDED` line
naming the referrer and the full chain, so the credit can be replayed by hand. If
that line ever appears in the logs, the answer is to stop read-modify-writing the
counters (derive them from the Referrals tab instead), not to raise the timeout.
`updateReferrerStatsLegacy` is **not** locked — it is unchanged, and is deleted at
Phase D.

### 4. ✅ RESOLVED (live) — `submit_referral`'s referred person is now structured

**Was:** `buildLeadRow` folded the `referred` block (name/email/phone/notes) into the
Message column as prose — unqueryable. **Now:** `buildLeadDetails` writes it as a
structured `Details.referred` object (`{firstName, lastName, email, phone, notes}`), keys
always present; the prose builder was deleted, not ported
(`UNIFIED_SCHEMA_MIGRATION_PLAN.md` → §2b). Live under the unified schema.

### 5. ✅ CLOSED (live) — the cold sweep vs a human Status edit

The unified path is now **live**, so this is a closed-and-active concern, not a gated
one. Recorded in full because the Stage-2 prediction was **wrong in an instructive way**,
and the correction is a rule that still applies.

**Stage 2 predicted:** the gap closes when `handleStatusEdit` takes the same lock.

**That could never have worked.** The human's `Status` write is performed by the
**Sheets UI**, which takes no lock and cannot be made to. `handleStatusEdit` is an
`onEdit` trigger — by the time it runs, the cell is *already written*. Giving it the
lock lets it **notice** a clobber; it cannot **prevent** one.

**What actually closed it** (Stage 3) is two mechanisms, both required:

1. **The shared lock.** `updateReferrerStats`, `moveColdLeads`, and
   `handleStatusEdit` all take the one process-wide `getScriptLock()`, so their
   critical sections genuinely contend and cannot interleave. Contacts side effects
   can never be decided from a row a sweep is halfway through rewriting.
2. **A pre-write live re-read in the sweep.** `sweepStaleLeadsToCold` re-reads each
   row's `Status` immediately before stamping `'Cold'` and skips the row if it is no
   longer active. This shrinks the clobber window from "the entire sweep" to the
   microseconds between that re-read and the write. **This is the part a lock could
   not do.**

**The rule to carry forward: a lock only protects against writers that take it.** Any
race whose other party is a human in the Sheets UI, an `onEdit` trigger, or anything
else outside our code cannot be locked away — it must be handled by re-validating at
the point of write. Keep every stage on the one process-wide lock; a second lock
would serialize nothing while looking like it did.

**On conflict, `handleStatusEditUnified` acts on the LIVE status and does NOT
auto-restore** the value from the edit event. Nothing can distinguish "a sweep
stamped Cold over their Client" from "the human edited again a second later", and
auto-restoring would silently revert a deliberate human edit — trading one rare bug
for another. It logs the conflict loudly and drives Contacts off the live value, so
the Sheet and Google Contacts can never disagree.

**Honest limit (unchanged): the Node test suite cannot prove Apps Script's `LockService`
delivers real mutual exclusion** — there is no concurrency in a Node harness and a
stubbed lock is not a lock. What the tests pin is *where* the lock sits and that a held
lock refuses a second acquirer. Actual mutual exclusion is Google's guarantee, observable
only against the live system — which ties into #6.

### 6. ⚠ OPEN / UNCONFIRMED — cutover Phase A (tab creation) and Phase C (live verification)

**The code is `USE_UNIFIED_SCHEMA = true` and deployed (@25).** But two operational
cutover steps are **not verifiable from this repo**, and there is **no record that either
was completed**:

- **Phase A — `setupSpreadsheetUnified()` run by hand** to create the `Leads` tab. The
  switch comment in `Code.gs` still carries the pre-cutover warning that this "has NOT
  happened," and this repo cannot read the live Sheet (the `clasp` token lacks the Sheets
  scope). If the tab does not exist, every request throws. **Confirm against the live
  Sheet before assuming submissions are landing.**
- **Phase C — verify one live submission per lead type + the live-concurrency checks**
  (`UNIFIED_SCHEMA_MIGRATION_PLAN.md` §8). No record this was run. The concurrency behavior
  (the shared lock, the sweep re-read) is only *observable* live (see the honest limit
  above), so until Phase C is actually executed, real mutual exclusion under load is
  unproven, not just untested.

This is a **status-tracking gap, not a code defect** — but it is exactly the kind of "was
it actually done?" question this project has been burned by. Treat "the migration is live
and working" as confirmed only once Phase A and C are checked against the live system.

### 7. ✅ RESOLVED 2026-07-15 — EAO normalizer cleanups (A1, A2); `eaoDetailsSummary` now dead

Two EAO `normalizeEaoPayload` items were closed post-cutover:

- **A1** — it no longer stuffs a JSON summary into `payload.preferences`; EAO's detail
  fields persist as real `Details` keys. (Side effect: the EAO Google Contact's
  "Preferences:" note is now empty instead of carrying the raw JSON blob — the data lives
  in the Sheet's `Details`.)
- **A2** — it no longer copies `pressing_issue` onto `message`, so `Details.message` no
  longer duplicates `Details.pressing_issue`. A `leadMessageText(payload)` helper keeps
  `pressing_issue` surfacing in the internal email / booking dump / resubmission notices
  for EAO (unchanged for every other role).

**`eaoDetailsSummary` is now wired into nothing** — verified 2026-07-16, it is referenced
only in comments and its own unit test. It is retained as the reference pattern the
`Details` blob generalized from and is a **Phase D deletion candidate**, alongside the
`xxxLegacy` bodies, the header audit/repair family, the EAO backfill family,
`setCategoryTabStatus`, and `reportsEnabledIndex`/`headerIndex`.

## There are NO callable admin actions — do not assume otherwise

`doPost` routes to exactly two handlers (`handleSubscribe`, `handleFormSubmission`)
and `doGet` to exactly two (`handleUnsubscribe`, `handleAvailability`). **There is
no admin action surface of any kind.**

Specifically, `setLeadStatus`, `setReportsEnabled`, `forcePartnerSummaryNow`, and
`forceDailyDigestNow` **do not exist** — a repo-wide grep for all four returns
**zero matches** in `Code.gs`, in the frontend, and in `/docs`. They have never been
built. Verified 2026-07-12.

The only ways to drive the backend by hand are the **AxisPoint** custom Sheet menu
(`onOpen`: publish notification, cold sweep now, daily digest now) and running a
function directly from the Apps Script editor. Building callable admin actions is a
**separate, later phase** and is still not built.

**The full current surface, post-migration:**

- **Request handlers (live):** `doPost` → `handleSubscribe` / `handleFormSubmission`;
  `doGet` → `handleUnsubscribe` / `handleAvailability`. All run unified bodies.
- **Automatic (triggers, live unified):** `sendDailyDigest` (daily), `moveColdLeads`
  (weekly), `sendMonthlyReferralSummaries` (monthly), `onSheetEdit` (installable edit
  trigger). Each dispatches to its `xxxUnified` body.
- **Manual menu items (live unified):** publish notification, "Run Cold Lead Sweep Now"
  (→ `moveColdLeads`, unified), "Send daily digest now" (→ `sendDailyDigest`, unified).
- **Legacy-only tools, still runnable from the Apps Script editor but operating on the
  LEGACY tabs, not the live path:** the header audit/repair family
  (`auditLeadTabHeadersSummary`, `auditLeadTabHeaderDetail`, `repairLeadTabHeader`,
  `repairAllDriftedLeadTabHeaders`, …), the EAO backfill family
  (`countMissingEaoCategoryRows`, `backfillEaoCategoryRows`, `eaoBackfillPlan`), and
  `setupSpreadsheet()` (creates the 11 legacy tabs). These manage the nine per-role tabs
  and have no effect on the unified `Leads` table; they exist for the rollback path and
  are Phase-D removals. `setupSpreadsheetUnified()` is the unified counterpart that
  creates `Leads` + `Referrals` + `Subscribers`.

## `CONFIG` object

```js
CONFIG = {
  NOTIFY_EMAILS: ['zach@axispoint.llc', 'ethaniel@axispoint.llc'],
  FROM_EMAIL:    'zach@axispoint.llc',
  SENDER_NAME:   'AxisPoint Partners',
  TABS: {
    ACTIVE_LEADS: 'Active Leads', LIFETIME_LEADS: 'Lifetime Leads',
    COLD_LEADS: 'Cold Leads', INVESTORS: 'Investors',
    REFERRAL_PARTNERS: 'Referral Partners', RE_PROFESSIONALS: 'RE Professionals',
    ASSET_OWNER: 'Existing Asset Owners', CLIENTS: 'Clients',
    SUBSCRIBERS: 'Subscribers', ARCHIVE: 'Archive', REFERRALS: 'Referrals',
  },
  CONTACT_GROUPS: {
    LEADS: 'AxisPoint Leads', INVESTORS: 'AxisPoint Investors',
    REFERRAL_PARTNERS: 'AxisPoint Referral Partners',
    RE_PROFESSIONALS: 'AxisPoint RE Professionals',
    ASSET_OWNERS: 'AxisPoint Existing Asset Owners',   // added 2026-07-09
    CLIENTS: 'AxisPoint Clients', COLD: 'AxisPoint Cold',
  },
  COLD_LEAD_DAYS: 60,
  // getter → reads the BOOKING_CALENDAR_ID Script Property (shared "AxisPoint
  // Bookings" calendar). Kept out of the committed literal for the same
  // survives-redeploys / not-hardcoded reason as SPREADSHEET_ID.
  get BOOKING_CALENDAR_ID() { return getProp('BOOKING_CALENDAR_ID'); },
};
```

`BOOKING_SLOTS` (module-level `var`, not in `CONFIG`) holds the 16 fixed CT slot
labels used by `handleAvailability`; keep it in sync with `SLOTS` in
`packages/brand`.

**11 tabs** created by the **legacy** `setupSpreadsheet` (`CONFIG.TABS`): Active Leads,
Lifetime Leads, Cold Leads, Investors, Referral Partners, RE Professionals, Existing
Asset Owners, Clients, Archive, Referrals, Subscribers. **The live unified schema uses
only three** — `Leads` + `Referrals` + `Subscribers`, created by
`setupSpreadsheetUnified`. The nine legacy lead tabs still exist in the Sheet as the
rollback path (Phase D pending); `CONFIG.TABS` still names them because the `xxxLegacy`
bodies reference them.

`SPREADSHEET_ID`, `SCRIPT_URL`, and `BOOKING_CALENDAR_ID` live in Script Properties
(read by `getProp`) so they survive redeploys, and no *consuming* function body
hardcodes them — `CONFIG.BOOKING_CALENDAR_ID` is a getter over the property.

To be precise about what this does and does not buy: **the literal values are
committed**, inside `setProperties()` in `Code.gs`, which is how they get into
Script Properties in the first place. The property indirection exists so the values
survive redeploys and have exactly one definition site, **not** as a secrets
mechanism. None of the three is a credential (the Sheet and calendar are protected
by Google ACLs, and the `/exec` URL is intentionally public), so this is fine — but
do not treat `setProperties()` as a safe place to put anything that *is* a secret.

`CONFIG.BOOKING_CALENDAR_ID` is a **getter**, not a static value, so it re-reads the
property on every access. An unset property therefore yields `null` at call time
rather than at load time, which is why `createBookingEvent` and `handleAvailability`
each guard on `if (!calId)` individually.

## OAuth scopes (`appsscript.json`)

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/contacts
https://www.googleapis.com/auth/script.scriptapp
```

The availability endpoint's `Calendar.Freebusy.query` needs **no additional
scope** — the broad `auth/calendar` scope already covers it, so adding it did not
change `oauthScopes` and does not trigger a reauth.

Plus the advanced **Calendar API v3** service (`enabledAdvancedServices`),
`timeZone: America/Chicago`, `runtimeVersion: V8`,
`webapp: { executeAs: USER_DEPLOYING, access: ANYONE_ANONYMOUS }`.
