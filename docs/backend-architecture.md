# Backend Architecture — `scripts/gas/Code.gs`

Single-file Google Apps Script Web App that backs the contact form for both
`apps/web` and `apps/qr`. It logs leads to a Google Sheet CRM, sends
transactional email, syncs Google Contacts, creates Calendar booking events,
and runs three time-based digests plus an installable edit trigger.

All facts below are verified against `scripts/gas/Code.gs` as of this commit.

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
- `computeSlotAvailability(dateStr, busyPeriods, slots)` — pure overlap logic (no GAS globals beyond the pure `parseBookingDateTime`), so it **can** be exercised in Node against a stubbed Freebusy response. **No committed test suite exists** — `scripts/gas/` contains only `Code.gs`, `appsscript.json`, and `emails/`. The verification runs described in the changelog were throwaway Node harnesses, not checked in. The docstring on this function pointing at "scripts/gas tests" is aspirational; treat it as such.
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
| `migrateAddHeardAboutColumn()` | the same `leadTabConfigs()` |
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
| `sendDailyDigest` | daily, `atHour(18)` (6 pm CT) | Plain-text digest of leads whose **Timestamp** falls on today's CT calendar date (ISO parsed, formatted to CT `MM/dd/yyyy`), to `NOTIFY_EMAILS`. Silent if none. |
| `moveColdLeads` | weekly, Monday `atHour(8)` | Sweeps Active-Leads rows with status in `[New Lead, Contacted, Active]` whose **Timestamp** is older than `COLD_LEAD_DAYS` (60) → Cold Leads tab, updates category tab status, moves Google Contact to Cold group, emails a summary. |
| `sendMonthlyReferralSummaries` | `onMonthDay(1)` `atHour(9)` | Tallies per-referrer totals from the Referrals tab, emails each Referral Partner (skips `Cold`/`Archive` status, skips `Reports Enabled = FALSE`, skips zero-referral partners). |

## `onEdit` trigger

`onSheetEdit(e)` — installable trigger (`forSpreadsheet(...).onEdit()`), created by `setupTriggers`. Watches three columns on any lead tab and ignores the header row:

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
| `setupSpreadsheet()` | Creates the 11 tabs with headers (Referral Partners gets an extra `Reports Enabled` column). Its lead-tab list is now derived from `leadTabConfigs()` (registry-driven), not a literal array. **Only touches tabs where `getLastRow() === 0`** — it will never repair a tab that already holds data. |
| `setupTriggers()` | Creates the four triggers above. |
| `migrateAddHeardAboutColumn()` | One-time, manually run from the editor. Adds `Heard About` to the nine existing lead tabs that `setupSpreadsheet` skips. Reads the same `leadTabConfigs()`. Idempotent; name-based placement. Returns/logs a per-tab `ADDED`/`SKIP` report. |
| `countMissingEaoCategoryRows()` | **Read-only.** Reports how many `Category = "Existing Asset Owner"` rows in Lifetime Leads are absent from the Existing Asset Owners tab. Writes nothing. |
| `backfillEaoCategoryRows()` | One-time (but **idempotent**) repair of the EAO rows dropped while the tab did not exist. Copies them out of Lifetime Leads. Keyed on `Lead ID`, so a second run inserts nothing; a later run picks up only genuinely-new rows. Columns are projected **by header name**, never by position, so source and destination may differ in column order/width. Throws with an actionable message if the tab does not exist yet. |

**Order of operations for the EAO repair** (both manual, from the Apps Script
editor, after `clasp push` + `clasp deploy`):

1. `setupSpreadsheet()` — creates the missing `Existing Asset Owners` tab with the
   current `LEAD_HEADERS` + `Heard About` schema. Existing tabs are untouched
   (`getLastRow() === 0` guard).
2. `countMissingEaoCategoryRows()` — optional dry run.
3. `backfillEaoCategoryRows()` — copies the dropped rows in.

Running (3) before (1) throws rather than silently doing nothing. This is the same
manual-run pattern `migrateAddHeardAboutColumn()` required; a `clasp deploy` alone
does **not** create tabs.

Utility helpers: `tab`, `appendRow`, `escapeHtml`, `jsonResponse`, `htmlPage`,
`renderTemplate`, `templateByName`, `getProp`, `headerIndex`, `reportsEnabledIndex`,
`openCrmSpreadsheet`, `eaoBackfillPlan`.

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
| 27 | Direct Referrals | running count |
| 28 | Total Downstream | running count (reserved; seeded 0) |
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
`getLastRow() === 0`, so tabs holding real data never received the new column.
`migrateAddHeardAboutColumn()` backfills all nine lead tabs. It is **idempotent**
(each tab is skipped when the header is already present) and it places the column at
its canonical `LEAD_HEADERS` index by name: if that header cell is already occupied
(on Referral Partners it holds `Reports Enabled`), the column is **inserted before**
the occupant, shifting that tab's extra column *and its data* right together, rather
than being appended after it.

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
two concrete reasons:

1. **Existing automation depends on tabs physically existing as separate tabs, not
   on a category label.** The per-category Google Contact Groups sync, the weekly
   cold-lead sweep (`moveColdLeads`, which physically relocates rows between tabs),
   the monthly referral summary (which reads the Referral Partners tab directly,
   including its extra `Reports Enabled` column), and the `onEdit` row-moving logic
   (`handleStatusEdit` moving rows to Cold Leads / Clients / Archive) are all written
   against real tabs. A unified schema does not adjust this code; it requires
   rebuilding all of it.

2. **By the time this was seriously evaluated, the Sheet held real production data.**
   Migrating would mean repacking live rows into a new shape, not making a free
   greenfield choice. The `Heard About` column added on 2026-07-08 is the scale of
   schema change this system can absorb safely; a full re-shape is not.

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
earlier cleanup stuck.

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
