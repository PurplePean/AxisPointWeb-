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

1. If `payload.role === 'existing_asset_owner'` → `normalizeEaoPayload(payload)` reshapes the flat EAO payload into the generic `{ person, message, qualData, preferences }` shape so no role branching is needed downstream.
2. Dedupe: `findExistingLead(email)` scans **Lifetime Leads** by lowercased email. On match → `handleResubmission` (updates empty fields, appends a resubmission note to Message, notifies partners, returns original Lead ID; **no new row / no new contact**).
3. New lead: `nextLeadSequence()` → `buildLeadId()` (`AXP-YYYY-XXXX`), `generateReferralCode()` (`AXP-` + 6 unambiguous chars, collision-checked against Lifetime Leads).
4. `matchReferrer(payload)` — priority **code → email → name** against Lifetime Leads.
5. If `payload.booking.date` → `createBookingEvent(payload, leadId)` first, to capture the Google Meet link **and** the event's calendar `htmlLink`. **All booking events (Meet and phone) are written to the dedicated shared "AxisPoint Bookings" calendar** identified by `CONFIG.BOOKING_CALENDAR_ID`, not the deploying account's personal default calendar. If that property is unset or the account lacks edit access, the event is skipped and logged (the call is try/caught upstream, so submission still succeeds without a booking).
6. `buildLeadRow(...)` → `appendRow` to **Lifetime Leads** and **Active Leads**, then to the role's category tab via `categoryTabForRole` (new Referral Partners rows get `Reports Enabled = TRUE`).
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
- `buildEAOPayload` does **not** send it (the EAO flow has no "how did you hear"
  step), so EAO rows carry a blank **Heard About** cell.
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

## Lead types → Category + tab mapping

Five wire `role` values. `roleToCategory()` sets the **Category** column;
`categoryTabForRole()` picks the per-role tab. **Every** role additionally lands
in Lifetime Leads + Active Leads.

| Wire `role` | Category | Category tab |
|---|---|---|
| `investor` | `Investor` | `Investors` |
| `existing_asset_owner` | `Existing Asset Owner` | `Existing Asset Owners` |
| `pro` | `RE Professional` | `RE Professionals` |
| `referral` | `Referral Partner` | `Referral Partners` |
| `submit_referral` | `Referral` | **none** — `categoryTabForRole` returns `null` by design. The submitter's lead lives in Active/Lifetime only; the referral relationship is logged to the **Referrals** tab. |

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
| `setupSpreadsheet()` | Creates the 11 tabs with headers (Referral Partners gets an extra `Reports Enabled` column). |
| `setupTriggers()` | Creates the four triggers above. |

Utility helpers: `tab`, `appendRow`, `escapeHtml`, `jsonResponse`, `htmlPage`,
`renderTemplate`, `templateByName`, `getProp`.

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
deploy note), and it has one non-obvious consequence: `REPORTS_ENABLED_COL` is
defined as `LEAD_HEADERS.length`, so the **Referral Partners** tab's `Reports
Enabled` column shifts from column 31 to **column 32**. That tab needs `Heard About`
*inserted before* `Reports Enabled`, not appended after it, or `handleFormSubmission`
will write its `Reports Enabled = TRUE` seed into the wrong cell.

**Removed:** the former column 20 **Date Submitted** (`MM/dd/yyyy` CT) was
redundant with **Timestamp** and has been deleted from the schema. `sendDailyDigest`
(today filter) and `moveColdLeads` (age calc + summary line) now derive the date
from **Timestamp** (ISO), formatting to CT where a calendar-date comparison is
needed. Removing it shifted every column from index 20 onward down by one — all
callers reference columns through the `COLS` map (no hardcoded positions), so the
shift is fully absorbed. **This is a live-Sheet schema change:** see the deploy note.

The **Referral Partners** tab carries one extra column past this layout,
`Reports Enabled` (index 31, `REPORTS_ENABLED_COL` = `LEAD_HEADERS.length`):
blank/`TRUE` = receives the monthly summary, explicit `FALSE` opts out.

Two other tabs use their own schemas: **Referrals** (`REFERRAL_HEADERS`, 13
columns, IDs `REF-YYYY-XXXX`) and **Subscribers** (`SUBSCRIBER_HEADERS`, 6
columns).

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
