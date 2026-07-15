# Backend Architecture — `scripts/gas/Code.gs`

Single-file Google Apps Script Web App that backs the contact form for both
`apps/web` and `apps/qr`. It logs leads to a Google Sheet CRM, sends
transactional email, syncs Google Contacts, creates Calendar booking events,
and runs three time-based digests plus an installable edit trigger.

All facts below are verified against `scripts/gas/Code.gs` as of this commit.

## ⚠ The unified-schema migration is IN PROGRESS (Stage 1 of N done)

`Code.gs` now contains **two lead schemas**, and exactly one of them is live.

- **Live today:** the nine per-role lead tabs and the 31-column `LEAD_HEADERS`
  layout that the rest of this document describes. **Everything below is still
  accurate for production.**
- **Being migrated in:** one `Leads` table, 25 columns + a `Details` JSON blob
  (`UNIFIED_LEAD_HEADERS` / `UCOLS` / `resolveUnifiedCols`). See
  `UNIFIED_SCHEMA_MIGRATION_PLAN.md`.

**`var USE_UNIFIED_SCHEMA = false;` is the single switch between them, and it is
off.** While it is off, production behavior is unchanged — a migrated function
runs its legacy body. Migrated functions are structured as a dispatcher over an
`xxxUnified` and an `xxxLegacy` implementation; the legacy bodies are the rollback
path and are deleted only at cutover.

**Migrated so far:**

| Stage | Function | What it does under the unified schema |
|---|---|---|
| 1 | `updateReferrerStats` | One-row lookup by Lead ID; multi-level `Total Downstream`; script-locked. |
| 2 | `moveColdLeads` | A cold lead is a `Status = 'Cold'` **write**, not a relocated row. **No `deleteRow`, no `appendRow`.** Script-locked, and (as of Stage 3) it re-reads each row's live Status immediately before stamping. |
| 3 | `handleStatusEdit` | A status edit is **just a status edit** — the human's cell write already happened, so the row moves nowhere and only the Contacts side effect remains. Script-locked, acts on the **live** status, logs conflicts. |
| 4 | `onSheetEdit` | The nine-tab membership guard becomes one string compare against `Leads`. The three watched columns still resolve **by name**. |
| 5 | `handleManualReferralLink` | The referrer lookup scans the one `Leads` table instead of Lifetime Leads. Script-locked around the row write only (the lock is **not** reentrant — see below). |
| 6 | `buildLeadRow` | Builds the 25-column row + the `Details` JSON blob. **This is where the two data-fidelity fixes shipped** — see below. |
| 7 | `findExistingLead`, `existingReferralCodes`, `matchReferrer`, `handleResubmission`, `persistNewLead` (+ `handleFormSubmission` orchestrating) | The whole submission path. Three appends become **one**. `handleResubmission` read-modify-writes `Details.message` under the shared lock. **`buildReferralMatch` needed no migration** — schema-agnostic. |
| 8 | `sendDailyDigest`, `sendMonthlyReferralSummaries` | The last two legacy-tab readers. Digest filters the one table by today's CT date; summary filters on `Category = 'Referral Partner'` and reads `Reports Enabled` as a standard column. **Read-only → no lock.** First test coverage either function has ever had. |

**As of Stage 8, every function that reads or writes lead DATA is migrated.** What
remains is setup/teardown (Stage 9: `setupSpreadsheet`, the `LEAD_TYPES` registry,
`resolveCols`/`COLS`/`LEAD_HEADERS`) and the cutover itself.

**As of Stage 3, no unified path in the file deletes a lead row.** Both of the two
row-deleting functions are migrated; their deletion logic was removed rather than
ported. The legacy bodies still delete, and still run in production, until cutover.

**The edit trigger is now fully wired (Stage 5):**

| Watched column | Handler | State under the unified schema |
|---|---|---|
| Status | `handleStatusEdit` | ✅ Migrated (Stage 3). |
| Category | `handleCategoryEdit` | ✅ Works **unchanged**. It reads no tab — only `rowData` + `EMAIL`, a key in both `COLS` and `UCOLS` — so it is schema-agnostic and needs **no migration at all**. |
| Referred By Email | `handleManualReferralLink` | ✅ Migrated (Stage 5). Scans `leadsTable()` instead of Lifetime Leads. The Stage-4 refusal branch is deleted. |

### The two data-fidelity fixes are now CODE (Stage 6), not just decisions

`buildLeadRowUnified` + `buildLeadDetails` implement both. **They still do not run in
production** (the switch is off), but they exist and are tested:

- **§2a — all 13 `qualData` fields persist.** Legacy writes exactly **one**
  (`assetClasses` → the Asset Class column) and silently discards the other twelve.
  Every field a lead type collects now lands in `Details`, keyed per the **registry**
  (`LEAD_TYPES.detailsFields`), never re-derived from field names.
- **§2b — `submit_referral.referred` is a structured object**
  (`{firstName, lastName, email, phone, notes}`), not a prose block prepended to the
  message. The prose builder is **deleted, not ported**.

**The `Details` contract:** a field the lead type **asks** is always **present** (`''`
or `[]` when blank); a field it does **not** ask is **absent**. So "asked and not
answered" is distinguishable from "never asked". `message`, `preferences`, and
`booking` (incl. `meetLink`) are on every type. **`Reports Enabled` is seeded by the
row builder** from `LEAD_TYPES.seedReportsEnabled`.

### ✅ The unified path is now FED — a complete submission works end to end (Stage 7)

**Payload in → dedupe → collision-checked referral code → referrer match → 25-column
row + `Details` blob → ONE append → referral stats credited up the whole chain →
Referrals row → Contacts → visitor + partner emails → JSON response.** All five lead
types, driven for real in `submission-path.test.js`. This is the first stage where any
of that was true: every earlier one read or edited a table nothing ever wrote to.

**It still does not run in production** — the switch is off, and the `Leads` tab does
not exist in the Sheet.

**Where the switch boundary sits.** `handleFormSubmission` is **not** duplicated. Only
one block of it is schema-dependent (the three appends + category-tab check +
`seedReportsEnabled` seed), so that block was extracted as **`persistNewLead`** and
*that* is the Unified/Legacy dispatcher. The normalizer, booking, Contacts, emails and
response are identical under both schemas. Duplicating the whole function would have
meant two copies of the booking/email orchestration to hand-sync until cutover —
this project's most-documented failure mode.

**Genuinely left before cutover:** `sendDailyDigest`, `sendMonthlyReferralSummaries`,
`setupSpreadsheet` (**must be run by hand from the Apps Script editor** — `clasp
deploy` does not create tabs), the `LEAD_TYPES` registry (`.tab`/`.tabColor`), and
`resolveCols`/`COLS`/`LEAD_HEADERS`. Then §4's delete-outright list — the header
audit/repair family and the EAO backfill family, both of which exist *solely* to manage
nine parallel tabs and are now obsolete, but are deleted **at cutover, not before**.

### ✅ The append is name-projected too — reader/writer asymmetry CLOSED (2026-07-14)

**Every read AND every write on the unified table now resolves columns by name.**

Readers always did (`resolveUnifiedCols`). The writer did not: `persistNewLead`
appended `buildLeadRow`'s canonical array **positionally**, assuming the live header
still matched. A human reordering or inserting a column in the live `Leads` header
would have left every reader working while the writer silently put the Timestamp under
**Email**, the Match Type under **Category**, the company under **Phone**, and the
`Details` blob under whatever landed at index 24 — on every subsequent lead, with
nothing to catch it. **The readers' tolerance is exactly what would have hidden it.**

`persistNewLeadUnified` now resolves the live header and projects the row onto the
sheet's real columns (`projectLeadRowByName`) before appending:

| Live header | Behavior |
|---|---|
| Canonical order | **Exact no-op** — byte-for-byte identical to before (verified). |
| Reordered / columns inserted | Every value still lands under its own column. |
| Extra columns past the 25 | Preserved as blanks, not clipped. |
| **Missing a required column** | **Throws `headerLookupError` and refuses the write** — never guesses a cell. Same contract every reader has. |

**`buildLeadRow` remains positional, and that is still right:** it *constructs* the
canonical layout. Knowing where the columns actually are is the **append's** job.

### The script lock is NOT reentrant — a constraint every later stage inherits

`updateReferrerStats` takes the script lock itself, and `nextLeadSequence` /
`nextReferralSequence` call **`waitLock()` on the same lock**. Apps Script does not
document the script lock as reentrant, so **a function must release the lock before
calling any of those three.** `handleManualReferralLinkUnified` is scoped exactly this
way: the lock covers its own row read-modify-write and nothing else. Widening it would
be a production-only deadlock. The suite's lock stub throws on a reentrant `waitLock`,
so this fails a test rather than shipping.

The `Leads` tab **does not exist in the live Sheet** — `setupSpreadsheet()` still
creates the eleven legacy tabs, and creating `Leads` is part of the cutover, not of
any single stage. Do not flip the switch, and do not create the tab by hand, until
every function in the plan's §3 list is migrated.

## Entry points

| Function | Kind | Behavior |
|---|---|---|
| `doPost(e)` | Web App POST | `JSON.parse(e.postData.contents)`. Routes to `handleSubscribe` when `payload.type === 'subscribe'` **or** (`!payload.role && payload.email`); otherwise `handleFormSubmission`. Errors return `{ success:false, error }`. |
| `doGet(e)` | Web App GET | `?unsubscribe=<email>` → `handleUnsubscribe`. `?action=availability&date=<"June 27, 2026">` → `handleAvailability` (free/busy JSON for the shared booking calendar, see below). Otherwise returns plain text `"AxisPoint Partners API"`. |

## Form-submission path

`handleFormSubmission(payload)`:

1. `leadTypeFor(payload.role).normalizer` — if the role's registry entry names one (today only `existing_asset_owner` → `normalizeEaoPayload`), it reshapes the flat wire payload **in place** into the generic `{ person, message, qualData, preferences }` shape so no role branching is needed downstream. Normalizers **add** the generic fields; they never strip the role-specific ones, so `payload.role` and e.g. `payload.current_situation` remain readable afterwards (`bookingEventInternalDescription` relies on this).
2. Dedupe: `findExistingLead(email)` scans **Lifetime Leads** by lowercased email. On match → `handleResubmission` (updates empty fields, appends a resubmission note to Message, notifies partners, returns original Lead ID; **no new row / no new contact**).
3. New lead: `nextLeadSequence()` → `buildLeadId()` (`AXP-YYYY-XXXX`), `generateReferralCode()` (`AXP-` + 6 unambiguous chars, collision-checked against Lifetime Leads).
4. `matchReferrer(payload)` — priority **code → email → name** against Lifetime Leads.
5. If `payload.booking.date` → `createBookingEvent(payload, leadId)` first, to capture the Google Meet link **and** the event's calendar `htmlLink`. **All booking events (Meet and phone) are written to the dedicated shared "AxisPoint Bookings" calendar** identified by `CONFIG.BOOKING_CALENDAR_ID`, not the deploying account's personal default calendar. If that property is unset or the account lacks edit access, the event is skipped and logged (the call is try/caught upstream, so submission still succeeds without a booking).
6. `buildLeadRow(...)` → `appendRow` to **Lifetime Leads** and **Active Leads**, then to the role's category tab via `categoryTabForRole`. The tab's existence is checked first and a missing tab is logged loudly (a submission is never failed by it, but it is never silent either). Rows on a tab whose registry entry sets `seedReportsEnabled` get `Reports Enabled = TRUE`.
7. If referral matched → `updateReferrerStats`, `logReferralEntry` (Referrals tab), `sendReferrerNotification`.
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

`handleFormSubmission` now also **checks the category tab exists before appending**
and logs loudly when it does not, instead of relying on `appendRow`'s quiet
`Logger.log`. A missing tab still never fails the submission (Lifetime/Active
already hold the row) but it no longer disappears.

### Adding a lead type

1. Add one entry to `LEAD_TYPES` with all six fields.
2. Add its tab name to `CONFIG.TABS` and its group to `CONFIG.CONTACT_GROUPS`.
3. Run `setupSpreadsheet()` once from the Apps Script editor to create the tab.

Step 3 is not optional and is not covered by `clasp deploy`. Skipping it is exactly
what broke EAO.

## Time-based triggers

Created by `setupTriggers()` (deletes all existing project triggers first):

| Function | Schedule | Purpose |
|---|---|---|
| `sendDailyDigest` | daily, `atHour(18)` (6 pm CT) | Plain-text digest of leads whose **Timestamp** falls on today's CT calendar date (ISO parsed, formatted to CT `MM/dd/yyyy`), to `NOTIFY_EMAILS`. Silent if none. **Reads Lifetime Leads** (not Active Leads — an earlier version of this doc misstated that). Migrated Stage 8; the unified path reads the one table and pulls Asset Class + Booking out of `Details`. |
| `moveColdLeads` | weekly, Monday `atHour(8)` **+ the "Run Cold Lead Sweep Now" menu item** | **Legacy (live today):** sweeps Active-Leads rows with status in `[New Lead, Contacted, Active]` whose **Timestamp** is older than `COLD_LEAD_DAYS` (60) → **appends the row to Cold Leads and deletes it from Active**, updates category tab status, moves the Google Contact to the Cold group, emails a summary. **Unified (migrated Stage 2, gated off):** identical selection, but sets `Status = 'Cold'` in place — **no append, no `deleteRow`, no category-tab sync** — then does the Contact move and summary email outside the script lock. |
| `sendMonthlyReferralSummaries` | `onMonthDay(1)` `atHour(9)` | Tallies per-referrer totals from the Referrals tab, emails each Referral Partner (skips `Cold`/`Archive` status, skips `Reports Enabled = FALSE`, skips zero-referral partners). Migrated Stage 8; the unified path filters the one table on `Category = 'Referral Partner'` and reads `Reports Enabled` as a standard column (no `reportsEnabledIndex`). |

## `onEdit` trigger

`onSheetEdit(e)` — installable trigger (`forSpreadsheet(...).onEdit()`), created by `setupTriggers`. **Migrated in Stage 4** (`onSheetEditUnified` / `onSheetEditLegacy` / dispatcher). Under the **unified** schema its tab guard is a single `sheet.getName() === 'Leads'` check and columns resolve through `resolveUnifiedCols`; the `Referred By Email` route is refused loudly pending Stage 5 (see the migration banner above). **Legacy — what production runs — watches three columns on any of the nine lead tabs and ignores the header row:**

- **Status** (`handleStatusEdit`): `Cold`/`Archive` move a row out of Active; `Client` appends to Clients + labels the contact; `New Lead`/`Active`/`Contacted` restore a Cold row to Active.
- **Category** (`handleCategoryEdit`): re-labels the Google Contact's category group.
- **Referred By Email** (`handleManualReferralLink`): looks up the referrer in Lifetime Leads, back-fills all referral columns with `Match Type = manual`, updates referrer stats, logs a Referrals-tab entry, and sends the referrer notification.

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
| `setupSpreadsheet()` | Creates the 11 tabs with headers (Referral Partners gets an extra `Reports Enabled` column, via `expectedHeadersFor()`). Its lead-tab list is now derived from `leadTabConfigs()` (registry-driven), not a literal array. **Only touches tabs where `getLastRow() === 0`** — it will never repair a tab that already holds data. |
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

## `resolveCols` — the standard for live-sheet column reads

**Any code that reads a lead tab's columns from the live Sheet must resolve them by
name through `resolveCols(sheet)`, never by indexing a row with the compile-time
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

## `LEAD_HEADERS` — full 31-column layout

Shared by every lead tab. `COLS` holds 0-based indexes; column number = index + 1.
Re-verified against `Code.gs` on 2026-07-08: the array below is the literal current
contents — `Date Submitted` is **gone**, and `Heard About` has been **appended** as
column 31.

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
| 28 | Total Downstream | **Still permanently `0` on this (legacy) layout.** Seeded `0` by `buildLeadRow`; `updateReferrerStatsLegacy` — the body production runs — writes only `Direct Referrals` and `Last Referral Date`. The multi-level implementation was **built 2026-07-14** but targets the unified `Leads` table and is gated off (`USE_UNIFIED_SCHEMA`). Treat this column as meaningless until cutover. See *Known open defects* §3 and `UNIFIED_SCHEMA_MIGRATION_PLAN.md` → §2c. |
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

## Architecture Decision: Per-Tab Schema vs. Unified Schema

**Status:** decided 2026-07-08. Keep the current per-role-tab schema. Revisit only
when `crm.axispoint.llc` or `api.axispoint.llc` become real active work.

The current design gives every role its own physical tab (Investors, Referral
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

### When to revisit

Once `crm.axispoint.llc` or `api.axispoint.llc` become real active work, **a unified
Details-JSON schema is the more natural fit at that point** — not a fallback, the
actual right answer. A real CRM front-end reads through an API layer, so the one
genuine friction against a JSON blob (human readability in a grid) does not apply,
while its benefits (adding a field to one lead type without touching a shared
31-column layout, no per-tab extra columns, no migration per field) all still do.
Revisit **then**, not before. Do not pre-build for it.

### Until then

Extend the existing per-tab schema for new fields and new lead types, and do it with
**name-based column lookups, never positional or index-derived ones**. The concrete
cautionary example is in this document: `REPORTS_ENABLED_COL = LEAD_HEADERS.length`
quietly aimed one cell to the right the moment a 31st header was appended, because it
inferred a column's position from an array's length. It is now
`reportsEnabledIndex(sheet)`, a lookup of the literal string `'Reports Enabled'` in
the sheet's actual header row. Any future per-tab extra column gets the same
treatment. See *Hardened 2026-07-08* above.

**Middle ground, if partial flexibility is ever needed sooner than a real API:** add
a single additional `Details JSON` overflow column to the existing tabs and let
role-specific fields accumulate there, leaving the core columns and all the tab-based
automation untouched. The EAO flow already follows this pattern informally — it packs
its structured detail summary into the shared **Preferences** column (13) rather than
claiming new columns. Formalizing that into one named overflow column is a cheap,
reversible step. It is **not** a substitute for the unified schema, and reaching for
it is a signal that the revisit condition above may be arriving.

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

## Known open defects and gaps (pre-existing — verified 2026-07-12)

These are **current, real, unfixed** states of the backend. They are recorded so no
future task assumes the opposite. None of them was introduced by, or is blocked on,
the schema migration.

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
own task and has not been done.

### 2. Twelve of thirteen `qualData` fields are collected but never persisted

`buildLeadRow` (the only writer of a lead row) persists exactly one `qualData`
field: `assetClasses` → **Asset Class** (col 11). The other twelve never reach the
Sheet:

| Fate | Fields |
|---|---|
| **Never read at all** — asked, transmitted, read by nothing | `clients`, `proIntent`, `relationship`, `fit`, `timeline`, `awareness` |
| **Email-only** — render a sentence in `buildVisitorPersonalNote` / `sendPartnerNotification`, then discarded | `aum`, `experience`, `proRole`, `markets`, `profession`, `referralIntent` |

This is a **known, pre-existing gap, not a migration artifact.** It predates any
schema work. The full field-by-field table and the verification method live in
`frontend-payload-schemas.md` → *What `qualData` actually persists*. Whether the
migration should start persisting these into a Details JSON blob is an **open
decision** — see `UNIFIED_SCHEMA_MIGRATION_PLAN.md`.

### 3. `Total Downstream` (col 28) is never written — **BUILT, not yet live**

**Still zero in production**, because production still runs the legacy schema.

The multi-level implementation **exists as of 2026-07-14** (Stage 1), inside
`updateReferrerStatsUnified`, and is fully tested — but it only runs when
`USE_UNIFIED_SCHEMA` is on, and it writes to the `Leads` table, which does not exist
yet. The **legacy** `updateReferrerStatsLegacy` still writes only `Direct Referrals`
and `Last Referral Date`, exactly as before, so the live column 28 is unchanged:
permanently `0`. **Do not read it or report from it until cutover.**

How it behaves once live (`UNIFIED_SCHEMA_MIGRATION_PLAN.md` → §2c):

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
cutover.

### 4. `submit_referral`'s referred-person data is prose, not structured

`buildLeadRow` folds the `referred` block (name/email/phone/notes) into the
**Message** column as a newline-joined text block. It is not machine-readable and
cannot be queried. **Resolved 2026-07-13: the migration lifts it into a structured
`Details.referred` object** (`UNIFIED_SCHEMA_MIGRATION_PLAN.md` → §2b). Prose until
then.

### 5. The cold sweep vs a human Status edit — CLOSED in Stage 3, and the fix is not what was predicted

**Scope: the unified path only** (gated off today). Recorded in full because the
Stage-2 prediction was **wrong in an instructive way**, and the correction is a rule
that applies to every future stage.

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
**separate, later phase** and is explicitly out of scope for the schema migration.

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

**11 tabs** created by `setupSpreadsheet`: Active Leads, Lifetime Leads, Cold
Leads, Investors, Referral Partners, RE Professionals, Existing Asset Owners,
Clients, Archive, Referrals, Subscribers.

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
