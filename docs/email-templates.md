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

As of 2026-07-06 all seven embedded `TEMPLATE_*` constants match their `.html`
mirrors byte-for-byte (verified by joining each embedded array on `\n` and
diffing against the file). The prior address-line drift is **resolved**: the
footer address line

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
| `visitor-phone` | `sendVisitorConfirmation` | New submission **with booking** and `meetType !== 'meet'` (phone call-back). Subject: *Your call with AxisPoint is set*. |
| `visitor-meet` | `sendVisitorConfirmation` | New submission **with booking** and `meetType === 'meet'` (Google Meet). Same subject. |
| `visitor-no-booking` | `sendVisitorConfirmation` | New submission **without** a booking. Subject: *We received your message — AxisPoint Partners*. |
| `welcome-subscriber` | `sendWelcomeEmail` | New newsletter subscribe (`handleSubscribe`). Renders `{{preferenceList}}` + `{{unsubscribeUrl}}`. |

### Referrer-facing (recipient = the matched referrer)

| Template | Sent by | Trigger / cadence |
|---|---|---|
| `referrer-notification` | `sendReferrerNotification` | Fires when a submission matches a referrer (code/email/name at submit time, or `manual` via the onEdit trigger). Identity of the referred person is never revealed. |
| `referrer-monthly` | `sendMonthlyReferralSummaries` | Monthly cron (1st, 9 am CT) to each Referral Partner with ≥1 referral, not `Cold`/`Archive`, not `Reports Enabled = FALSE`. |

### Internal (recipient = `CONFIG.NOTIFY_EMAILS`)

| Template | Sent by | Trigger |
|---|---|---|
| `partner-notification` | `sendPartnerNotification` | Every new lead. Subject: *New lead: {name} ({category}) — {leadId}*. |

### Plain-text emails (no HTML template)

Built inline as text, not through `renderTemplate`:

- **Resubmission notice** (`sendResubmissionNotification`) → `NOTIFY_EMAILS`, on a dedupe hit.
- **Daily digest** (`sendDailyDigest`) → `NOTIFY_EMAILS`, 6 pm CT.
- **Cold-move summary** (`moveColdLeads`) → `NOTIFY_EMAILS`, Monday 8 am CT.

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
