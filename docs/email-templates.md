# Email Templates

All transactional email is sent from `scripts/gas/Code.gs` via `GmailApp`.
Verified against source as of this commit.

## Two storage forms — embedded constant vs standalone `.html` mirror

Each HTML template exists **twice**:

1. **Embedded constant** in `Code.gs` — a `var TEMPLATE_* = [ '...', ... ].join('\n')`
   array of single-quoted lines. **This is what actually ships.** Apps Script
   can't read repo files at runtime, so `GmailApp.sendEmail(..., { htmlBody })`
   is always fed the embedded string (via `renderTemplate` / `templateByName`).
2. **Standalone mirror** in `scripts/gas/emails/*.html` — a plain, editable/
   previewable copy of the same markup.

There is **no build step** linking the two. They must be kept in sync **by
hand**: edit the `.html`, then re-transcribe into the matching `TEMPLATE_*`
array (or vice-versa). Nothing enforces parity.

| Embedded constant | Standalone mirror |
|---|---|
| `TEMPLATE_VISITOR_PHONE` | `visitor-confirmation-phone.html` |
| `TEMPLATE_VISITOR_MEET` | `visitor-confirmation-meet.html` |
| `TEMPLATE_VISITOR_NO_BOOKING` | `visitor-confirmation-no-booking.html` |
| `TEMPLATE_REFERRER_NOTIFICATION` | `referrer-notification.html` |
| `TEMPLATE_REFERRER_MONTHLY` | `referrer-monthly-summary.html` |
| `TEMPLATE_PARTNER_NOTIFICATION` | `partner-notification.html` |
| `TEMPLATE_WELCOME_SUBSCRIBER` | `welcome-subscriber.html` |

`renderTemplate(template, vars)` replaces every `{{key}}`; unfilled placeholders
render as empty string.

## Sync status — embedded ↔ mirror: IN SYNC ✅

Re-verified 2026-07-08 (independently, not inherited from the prior task's claim):
all seven embedded `TEMPLATE_*` constants match their `.html` mirrors byte-for-byte.
Method: `eval` each `var TEMPLATE_* = [...].join('\n')` array out of `Code.gs`,
`rstrip` one trailing newline off the mirror, compare exactly. All seven pass.
The three visitor openers were re-synced on both sides in the same pass that warmed
the copy. The prior address-line drift is **resolved**: the footer address line

```html
<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>
```

now exists in **both** forms across all seven templates, so it ships in live
email. (The address itself is still a placeholder — `9999 Bellaire Blvd, Ste 999`
— swap it for the real suite when known; change both forms.)

The 3 visitor templates additionally carry a `{{personalNote}}` placeholder
(see below); it too is present in both the embedded constant and the mirror.

> Re-run the parity check any time you touch a template — join the embedded
> array on `\n`, `rstrip` a trailing newline, and diff against the `.html`.

## Template inventory

### Visitor-facing (recipient = the person who submitted)

| Template | Sent by | Trigger / cadence |
|---|---|---|
| `visitor-phone` | `sendVisitorConfirmation` | New submission **with booking** and `meetType !== 'meet'` (phone call-back). Subject: *Your call with AxisPoint is set*. **Carries a `.ics` attachment** (see below). |
| `visitor-meet` | `sendVisitorConfirmation` | New submission **with booking** and `meetType === 'meet'` (Google Meet). Same subject. **Carries a `.ics` attachment** (see below). |
| `visitor-no-booking` | `sendVisitorConfirmation` | New submission **without** a booking. Subject: *We received your message*. |
| `welcome-subscriber` | `sendWelcomeEmail` | New newsletter subscribe (`handleSubscribe`). Renders `{{preferenceList}}` + `{{unsubscribeUrl}}`. |

### Referrer-facing (recipient = the matched referrer)

| Template | Sent by | Trigger / cadence |
|---|---|---|
| `referrer-notification` | `sendReferrerNotification` | Fires when a submission matches a referrer (code/email/name at submit time, or `manual` via the onEdit trigger). Identity of the referred person is never revealed. |
| `referrer-monthly` | `sendMonthlyReferralSummaries` | Monthly cron (1st, 9 am CT) to each Referral Partner with ≥1 referral, not `Cold`/`Archive`, not `Reports Enabled = FALSE`. |

### Internal (recipient = `CONFIG.NOTIFY_EMAILS`)

| Template | Sent by | Trigger |
|---|---|---|
| `partner-notification` | `sendPartnerNotification` | Every new lead. Subject: *New lead: {name} ({category}), {leadId}*. |

### `.ics` calendar attachment (visitor booking confirmations)

The `visitor-phone` and `visitor-meet` emails ship with an iCalendar attachment
(`axispoint-call.ics`, `text/calendar`) built by `buildBookingIcs` in `Code.gs` —
**not** a template file. **It is delivered straight to the visitor, so it carries
only client-facing content** (`bookingEventTitle` + `bookingEventClientDescription`
— warm, minimal, no CRM internals; `leadId` appears only in the opaque `UID`).
It uses America/Chicago wall-clock times with a `VTIMEZONE` block, and sets
`LOCATION` to the Meet link (video) or phone number (phone). It is a deliberate
backup to Google's native attendee invite: the `.ics` works even if the native
invite is delayed, filtered, or the visitor has no Google account. See
[`backend-architecture.md`](backend-architecture.md) → *Calendar booking* for the
full detail. No mirror file exists for it; the only source of truth is
`buildBookingIcs`.

**Do not put CRM data in the `.ics` or the Calendar event.** The visitor is an
attendee on the real event, so both surfaces are visitor-facing. The full detail
dump (`bookingEventInternalDescription`) belongs **only** in the internal
`partner-notification` email.

### Internal booking detail + calendar warnings (`partner-notification`)

When a submission includes a booking, `sendPartnerNotification` appends three extra
pieces to its booking block (all internal-only, sent to `NOTIFY_EMAILS`):

1. A **"Booking details (internal only)"** block rendering
   `bookingEventInternalDescription(payload, leadId)` — the full dump (lead ID,
   email, phone, callback number, asset class, source, EAO current situation,
   message). This is the CRM detail that was **removed** from the client-facing
   Calendar event / `.ics`.
2. A loud red **"⚠ Calendar event was NOT created"** banner, shown only when a
   booking was requested but `createBookingEvent` returned `created: false`
   (with the underlying `error` and a pointer to `BOOKING_CALENDAR_ID` / calendar
   edit access). This makes a silent booking-creation failure visible.
3. An amber **"⚠ Calendar event created, but no link captured"** notice, shown when
   an event **does** exist but `calendarLink` is empty (the `CalendarApp` fallback,
   or an insert with no `htmlLink`). Deliberately distinct from (2): nothing needs
   to be created by hand, so the copy says so. See the calendar-link section below.

All three are built in JS and concatenated onto the `{{bookingBlock}}` variable, so
no new template placeholder or mirror-file change is required for them.

### `{{heardAboutRow}}` — self-reported attribution (internal only)

`partner-notification` carries one placeholder the other templates do not:
`{{heardAboutRow}}`, sitting directly below the `Source` row in the detail table.
`sendPartnerNotification` fills it with a `Heard about us` row when
`leadHeardAbout(payload)` is non-empty, and with `''` otherwise (EAO submissions send
no `heardAbout`, so the row simply disappears). It follows the same
`{{capitalRangeRow}}` / `{{referredByRow}}` conditional-row pattern.

This **is** a template change, so it exists in both the embedded
`TEMPLATE_PARTNER_NOTIFICATION` constant **and** `emails/partner-notification.html`.
Parity re-verified after the edit.

`Source` and `Heard about us` are two separate, separately-labeled rows on purpose:
Source is the technical channel the submission arrived through, Heard About is what
the person said brought them. They must never be merged. `heardAbout` appears on no
client-facing surface.

### Status of the missing "View in calendar" link — one real bug found and fixed; live test still required

Re-investigated clean-room on 2026-07-08 against the then-current `Code.gs`, trusting
neither prior PR's explanation. Result: **the chain was *not* internally consistent.
There was a third code path neither `#19` nor `#20` accounted for**, and it has been
fixed. Separately, which cause produced the *originally observed* symptom still
cannot be settled without one live booking.

**The bug that was found (now fixed).** `createBookingEvent`'s `CalendarApp`
fallback — the path taken when the advanced `Calendar.Events.insert` throws — did
this:

```js
cal.createEvent(title, start, end, {...});
result.created = true;
result.error   = '';       // ← wiped the reason we ended up here
return result;             // ← calendarLink never set, still ''
```

So it returned `created: true`, `calendarLink: ''`, `error: ''`. The `#20` warning
banner fires on `bookingRequested && !calendarCreated`, which is **false** here. The
outcome: an event genuinely exists, no "View in calendar" link renders, **and no
warning appears** — indistinguishable from a healthy booking. That is exactly the
reported symptom, reachable with `BOOKING_CALENDAR_ID` correctly set and the
deployment fully current. `#20`'s fix did not cover it, because `#20` only
distinguished *created* from *not created*.

Two further defects in the same path:

- For a **Meet** booking, `CalendarApp.createEvent` provisions no conference, so
  `meetLink` stayed `''` and the partner email rendered
  `<a href="">Join Google Meet &nbsp;→</a>` — a live-looking button with an empty
  `href`.
- A successful advanced `insert` that returned no `htmlLink` hit the same silent
  no-link/no-warning state.

**The fix.** `createBookingEvent` now returns a third flag, `degraded`, set whenever
an event exists but no `calendarLink` could be captured, and it **preserves** the
error explaining why. `sendPartnerNotification` renders an amber
**"⚠ Calendar event created, but no link captured"** notice for that state (distinct
from the red "NOT created" banner, because nothing needs to be booked by hand), and
the empty-`href` anchor is replaced by a plain "No Google Meet link was created"
marker. See `backend-architecture.md` → *Booking failure is fail-visible*.

**What is now confirmed by code inspection**, verified in a Node harness that drives
the real functions with stubbed GAS globals across all six outcomes (healthy insert,
unset `BOOKING_CALENDAR_ID`, unparseable date, insert-throws → fallback, fallback
with no calendar access, insert without `htmlLink`):

- ✅ `createBookingEvent` returns a non-empty `calendarLink` **whenever the advanced
  insert genuinely creates an event and returns an `htmlLink`** — and now flags
  `degraded` in the two cases where an event is created without one.
- ✅ `sendPartnerNotification` renders the red banner on every path where no event
  exists, the amber notice on every path where one exists without a link, and the
  "View in calendar" link exactly when a link is present.
- ✅ No path can now produce a missing link with no explanation.

**What still cannot be confirmed by inspection, per the audit's own finding:** whether
a real booking through the deployed `/exec` endpoint delivers the link. **This
requires one live test** and nothing else will settle it: after `clasp push` +
`clasp deploy -i <deploymentId>`, book a real slot and read the received partner
email. The three states are now mutually exclusive and self-identifying:

| What you see in the email | What it means |
|---|---|
| "View in calendar" link | Healthy. The chain works end to end. |
| Amber "created, but no link captured" | The advanced insert is failing; the fallback is carrying bookings. The preserved error says why. |
| Red "Calendar event was NOT created" | No event exists. Check `BOOKING_CALENDAR_ID` and the deploying account's edit access. |

The two prior PRs' explanations can finally be adjudicated by that test: a red banner
means `#20`'s fail-silent-creation theory; a working link on the first live booking
after redeploy means `#19`'s stale-deployment theory; an amber notice means neither,
and the bug fixed here was the real one.

### Plain-text emails (no HTML template)

Built inline as text, not through `renderTemplate`:

- **Resubmission notice** (`sendResubmissionNotification`) → `NOTIFY_EMAILS`, on a dedupe hit.
- **Daily digest** (`sendDailyDigest`) → `NOTIFY_EMAILS`, 6 pm CT.
- **Cold-move summary** (`moveColdLeads`) → `NOTIFY_EMAILS`, Monday 8 am CT.

## Visitor-facing opener copy (warmed 2026-07-08)

The opening paragraph of each visitor confirmation — the first line under the logo,
before `{{personalNote}}` — was rewritten from flat acknowledgement to
solutions-oriented copy. The old opener (`We received your message. See you at the
time below.`) confirmed receipt and said nothing about what happens next.

Current openers, verified literal in both the embedded constant and the mirror:

| Template | Opener |
|---|---|
| `visitor-phone`, `visitor-meet` | *Thanks for reaching out. Your call is set. We will review your details ahead of time and come ready to talk specifics about your situation.* |
| `visitor-no-booking` | *Thanks for reaching out. We are reviewing your details now, and one of us will follow up personally within one business day.* |

The booking pair share an identical opener by design — the meet/phone difference is
already carried by the booking block below it, not the greeting. `{{personalNote}}`
personalization is unchanged and still does the per-role reflection.

**Em dashes: cleared 2026-07-08.** `Code.gs` now contains **zero em dashes in any
runtime string** (verified by stripping comments and grepping the remaining code, and
by asserting on every rendered subject and body in the Node harness). The audit's
count of "4 in `buildVisitorPersonalNote` + 2 subject lines" undercounted: seven
subject lines carried them (visitor no-booking, partner notification, daily digest,
cold-move summary, welcome subscriber, publish notification, unsubscribe), along with
the resubmission note written into the Sheet's Message column, the `'—'` empty-value
placeholders in two internal emails (now `n/a`), and one `Logger.log` string. All
were replaced with commas, colons, periods, or rephrasing. Em dashes remain only in
code **comments**, which are not copy.

## Visitor-facing personalized content — `{{personalNote}}` (all 5 roles)

**History:** originally the visitor confirmation had **no** content-echo
mechanism at all — unlike `partner-notification`, which builds a `messageBlock`
from `payload.message`. As of 2026-07-06 that gap is closed for **every** lead
type via a per-role `{{personalNote}}` block.

**How it works.** All three visitor templates (`TEMPLATE_VISITOR_PHONE`,
`_MEET`, `_NO_BOOKING`) carry a `{{personalNote}}` placeholder, positioned right
after the intro divider and before the booking/prompt block.
`sendVisitorConfirmation` computes it **once** — independent of the
booking/no-booking branch — and passes it into whichever template it renders:

```js
var personalNote = buildVisitorPersonalNote(payload);
// ...added to both the booking `vars` object and the no-booking object...
```

`buildVisitorPersonalNote(payload)` returns a ready styled callout (magenta
left-border, `#9F328C`) or `''` when there's nothing substantive to echo (in
which case `renderTemplate` strips the placeholder to empty — clean output).
Helpers: `humanList()` (prose list joiner) and `referralIntentClause()`.

Each role reflects back only fields it **actually** captures (see
[`frontend-payload-schemas.md`](frontend-payload-schemas.md)):

| Role | Fields echoed | Fallback when absent |
|---|---|---|
| `investor` | `qualData.aum` (capital range, unless "Prefer not to say") + `qualData.experience[]` (minus "Never invested in CRE") | warm generic |
| `pro` | `qualData.proRole` + `qualData.markets[]` | warm generic |
| `referral` | `qualData.profession` + a closer keyed off `qualData.referralIntent` | warm generic |
| `existing_asset_owner` | `payload.pressing_issue`, else `payload.current_situation` (quoted) | generic "we reviewed your details" |
| `submit_referral` | referred person's name (`payload.referred.firstName/lastName`) — this email goes to the **submitter**, acknowledging we'll reach out to their referral | generic "the person you introduced" |

All interpolated values pass through `escapeHtml`. Fixed option-list strings are
escaped too, defensively.

### Note on `normalizeEaoPayload` and `pressing_issue`

`normalizeEaoPayload` sets `payload.message = payload.pressing_issue || …` (which
feeds the sheet Message column + the internal `partner-notification`). It does
**not** delete the original top-level `pressing_issue` / `current_situation`, so
`buildVisitorPersonalNote` reads those directly for the EAO note — the visitor
now *does* see their pressing issue reflected back, which previously was not the
case.

`partner-notification` still uses its own separate `messageBlock` from
`payload.message`; the two mechanisms are independent.
