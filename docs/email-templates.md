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

## ⚠️ Current drift — ALL 7 mirrors are ahead of the embedded constants

Checked line-by-line right now (embedded array joined on `\n` vs the `.html`
file). **Every one of the seven** standalone mirrors contains one extra footer
line that the embedded constant does **not** have:

```html
<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>
```

It sits immediately after the existing `AxisPoint Partners LLC · Houston,
Texas · …` footer line in each `.html`. The embedded `TEMPLATE_*` constants stop
at that existing line.

**Consequence:** because the embedded constants are what send, this street-
address line does **not** appear in any live email today. The mirrors were
edited (address looks like a placeholder — `9999 Bellaire Blvd, Ste 999`) but
the change was never carried into `Code.gs`. No other differences exist — the
seven templates are otherwise identical to their mirrors.

To resolve: either add the line to all seven `TEMPLATE_*` arrays (with a real
address) so it ships, or drop it from the mirrors. Do not leave it half-applied.

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

## Resolved: is there a generic dynamic-content mechanism on the visitor side?

**Open question:** does `sendVisitorConfirmation` have a generic dynamic-content
slot equivalent to `partner-notification`'s `messageBlock` — and if so, does
`normalizeEaoPayload` feed it from `pressing_issue`?

**Answer: No.** There is no such mechanism on the visitor side.

`sendPartnerNotification` builds a `messageBlock` from `payload.message` and
injects it via a `{{messageBlock}}` placeholder in `TEMPLATE_PARTNER_NOTIFICATION`:

```js
var messageBlock = '';
if (payload.message) {
  messageBlock = '<table ...>...' + escapeHtml(payload.message) + '...</table>';
}
// ...
var html = renderTemplate(TEMPLATE_PARTNER_NOTIFICATION, {
  ..., messageBlock: messageBlock, ...
});
```

`sendVisitorConfirmation` has **no equivalent**. The complete variable set it
ever passes is:

```js
// booking branch
{ firstName, bookingMonth, bookingDay, bookingDayOfWeek, bookingTime,
  referralCode, referralLink, meetLink | bookingPhone }
// no-booking branch
{ firstName, referralCode, referralLink }
```

None of the three visitor templates (`TEMPLATE_VISITOR_PHONE`, `_MEET`,
`_NO_BOOKING`) contains a `{{message}}` / `{{messageBlock}}` placeholder — grep
confirms `messageBlock` appears only in the partner template and its builder.

`normalizeEaoPayload` **does** populate `payload.message`:

```js
payload.message = payload.pressing_issue || payload.message || '';
```

…but that value only ever surfaces in **(a)** the Message column of the sheet
(`buildLeadRow`) and **(b)** the internal `partner-notification` email. It is
**never echoed back to the visitor**, because no visitor template reads it. So
an Existing Asset Owner's `pressing_issue` is captured internally but is not
shown in their confirmation email.
