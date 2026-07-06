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
| `doGet(e)` | Web App GET | If `?unsubscribe=<email>` present → `handleUnsubscribe`. Otherwise returns plain text `"AxisPoint Partners API"`. |

## Form-submission path

`handleFormSubmission(payload)`:

1. If `payload.role === 'existing_asset_owner'` → `normalizeEaoPayload(payload)` reshapes the flat EAO payload into the generic `{ person, message, qualData, preferences }` shape so no role branching is needed downstream.
2. Dedupe: `findExistingLead(email)` scans **Lifetime Leads** by lowercased email. On match → `handleResubmission` (updates empty fields, appends a resubmission note to Message, notifies partners, returns original Lead ID; **no new row / no new contact**).
3. New lead: `nextLeadSequence()` → `buildLeadId()` (`AXP-YYYY-XXXX`), `generateReferralCode()` (`AXP-` + 6 unambiguous chars, collision-checked against Lifetime Leads).
4. `matchReferrer(payload)` — priority **code → email → name** against Lifetime Leads.
5. If `payload.booking.date` → `createBookingEvent(payload)` first, to capture the Google Meet link.
6. `buildLeadRow(...)` → `appendRow` to **Lifetime Leads** and **Active Leads**, then to the role's category tab via `categoryTabForRole` (new Referral Partners rows get `Reports Enabled = TRUE`).
7. If referral matched → `updateReferrerStats`, `logReferralEntry` (Referrals tab), `sendReferrerNotification`.
8. `createContact(payload)`, `sendVisitorConfirmation(...)`, `sendPartnerNotification(...)` — each wrapped in try/catch so one failure can't abort the response.
9. Returns `{ success:true, leadId, referralCode }`.

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
| `sendDailyDigest` | daily, `atHour(18)` (6 pm CT) | Plain-text digest of leads whose `Date Submitted === today` to `NOTIFY_EMAILS`. Silent if none. |
| `moveColdLeads` | weekly, Monday `atHour(8)` | Sweeps Active-Leads rows with status in `[New Lead, Contacted, Active]` older than `COLD_LEAD_DAYS` (60) → Cold Leads tab, updates category tab status, moves Google Contact to Cold group, emails a summary. |
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
| `setProperties()` | One-time: stores `SPREADSHEET_ID` and `SCRIPT_URL` in Script Properties. |
| `setupSpreadsheet()` | Creates the 11 tabs with headers (Referral Partners gets an extra `Reports Enabled` column). |
| `setupTriggers()` | Creates the four triggers above. |

Utility helpers: `tab`, `appendRow`, `escapeHtml`, `jsonResponse`, `htmlPage`,
`renderTemplate`, `templateByName`, `getProp`.

## `LEAD_HEADERS` — full 31-column layout

Shared by every lead tab. `COLS` holds 0-based indexes; column number = index + 1.

| # | Column | Notes |
|---|---|---|
| 1 | Timestamp | ISO string (`payload.timestamp` or now) |
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
| 18 | Source | `payload.source || payload.page` |
| 19 | Status | seeded `New Lead` |
| 20 | Date Submitted | `MM/dd/yyyy` CT |
| 21 | Referred By Lead ID | |
| 22 | Referred By Name | |
| 23 | Referred By Email | |
| 24 | Referred By Code | |
| 25 | Match Type | `code`/`email`/`name`/`manual`/`none` |
| 26 | Referral Chain | pipe-separated Lead IDs |
| 27 | Chain Depth | integer |
| 28 | Direct Referrals | running count |
| 29 | Total Downstream | running count (reserved; seeded 0) |
| 30 | Last Referral Date | |
| 31 | Meet Link | Google Meet URL when `meetType === 'meet'` |

The **Referral Partners** tab carries one extra column past this layout,
`Reports Enabled` (index 31, `REPORTS_ENABLED_COL`): blank/`TRUE` = receives the
monthly summary, explicit `FALSE` opts out.

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
};
```

**11 tabs** created by `setupSpreadsheet`: Active Leads, Lifetime Leads, Cold
Leads, Investors, Referral Partners, RE Professionals, Existing Asset Owners,
Clients, Archive, Referrals, Subscribers.

`SPREADSHEET_ID` and `SCRIPT_URL` are **not** in `CONFIG` — they live in Script
Properties (set by `setProperties`, read by `getProp`) so they survive redeploys.

## OAuth scopes (`appsscript.json`)

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/contacts
https://www.googleapis.com/auth/script.scriptapp
```

Plus the advanced **Calendar API v3** service (`enabledAdvancedServices`),
`timeZone: America/Chicago`, `runtimeVersion: V8`,
`webapp: { executeAs: USER_DEPLOYING, access: ANYONE_ANONYMOUS }`.
