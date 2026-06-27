# AxisPoint Partners Website

Institutional-grade commercial real estate asset management for owners and advisors across Texas.

## Project Structure

This is a pnpm monorepo containing:

- **apps/web** — Main website (axispoint.llc)
- **apps/qr** — Mobile QR digital card (qr.axispoint.llc)
- **packages/brand** — Shared brand assets, colors, fonts, team data, and types
- **content/** — Markdown articles and publications
- **scripts/gas/** — Google Apps Script backend (Code.gs)

## Tech Stack

- **React 18** — UI library
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Tailwind CSS** — Styling (with custom brand preset)
- **React Router v6** — Client-side routing
- **gray-matter + remark** — Markdown parsing
- **pnpm** — Package manager (required)
- **Google Apps Script** — Form backend, email notifications, Sheets logging

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0

Install pnpm if you haven't already:
```bash
npm install -g pnpm
```

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   # Edit with your VITE_FORM_ENDPOINT value
   ```

3. **Start development server:**
   ```bash
   pnpm dev      # all apps
   pnpm dev:web  # web only
   ```

4. **Build for production:**
   ```bash
   pnpm build      # all apps
   pnpm build:web  # web only
   ```

## Backend — Google Apps Script

The form backend lives in `scripts/gas/Code.gs`. Deploy it as a Web App:
- **Execute as:** Me
- **Who has access:** Anyone

### Deploying Apps Script changes

Pushes are handled by [clasp](https://github.com/google/clasp). One-time setup:

```bash
npm install -g @google/clasp
clasp login
```

`scripts/gas/.clasp.json` (gitignored — it holds the script ID) wires the local
files to the Apps Script project. To deploy:

1. Make changes to `scripts/gas/Code.gs`
2. Run: `pnpm deploy:gas`
3. Go to [script.google.com](https://script.google.com) and deploy a new version

### Lead ID format

Every submission gets a unique Lead ID: **`AXP-YYYY-XXXX`**

- `YYYY` — four-digit year of submission
- `XXXX` — zero-padded sequential number scoped across all submissions (e.g. `AXP-2026-0001`)

A matching **Referral Code** is also generated in shorter form: **`AXP-XXXX`** (e.g. `AXP-0001`).

The sequence is stored in Script Properties under `LAST_LEAD_ID` and incremented atomically using `LockService.getScriptLock()`.

### Deduplication

On every form submission the backend searches the Lifetime Leads tab for an existing row with the same email address (case-insensitive):

- **Match found:** Updates the existing row with any new contact info, appends a resubmission note to the Message column (`Resubmission on [date] — [original Lead ID]`), sends a resubmission notification to partners, and returns the original Lead ID and Referral Code. No duplicate row is created and no new Google Contact is created.
- **No match:** Creates a new row, generates a new Lead ID and Referral Code, creates a Google Contact, and sends the standard new-lead notification.

### Referral tracking

The system supports multi-level referral tracking with three match priority levels:

1. **Code match** — `referralCode` field matches an existing referral code exactly
2. **Email match** — `referredByEmail` field matches an existing lead's email
3. **Name match** — `referredByName` field is compared against existing first/last names

When a referrer is matched the submission records:

| Field | Description |
|---|---|
| `Referred By Lead ID` | Lead ID of the referrer |
| `Referred By Name` | Referrer's full name |
| `Referred By Email` | Referrer's email |
| `Referred By Code` | Referrer's referral code |
| `Match Type` | `code`, `email`, or `name` |
| `Referral Chain` | Pipe-separated chain of Lead IDs (e.g. `AXP-2026-0001\|AXP-2026-0007`) |
| `Chain Depth` | Number of hops (pipe count + 1) |

The referrer's `Direct Referrals` count and `Last Referral Date` are updated on their existing row. Every matched referral is also logged to the **Referrals** tab with a `REF-YYYY-XXXX` ID.

The referrer receives a notification email confirming that someone used their code without revealing the referred person's identity.

#### onEdit trigger

When a partner manually types an email into the `Referred By Email` column of any lead tab, the `onSheetEdit()` trigger auto-populates all referral fields and logs the match to the Referrals tab with `Match Type = manual`.

### Google Sheet structure

The spreadsheet has 11 tabs. All lead tabs share the same 30-column schema:

| # | Column | Notes |
|---|---|---|
| 1 | Timestamp | ISO string |
| 2 | Lead ID | `AXP-YYYY-XXXX` |
| 3 | Referral Code | `AXP-XXXX` |
| 4 | First Name | |
| 5 | Last Name | |
| 6 | Email | Deduplication key |
| 7 | Phone | |
| 8 | Company | |
| 9 | Role | investor / referral / pro / curious / refer |
| 10 | Category | Derived from qual data |
| 11 | Asset Class | |
| 12 | Message | |
| 13 | Preferences | Comma-separated |
| 14 | Booking Date | |
| 15 | Booking Time | |
| 16 | Meet Type | meet / phone |
| 17 | Booking Phone | |
| 18 | Source | How they found us |
| 19 | Status | |
| 20 | Date Submitted | |
| 21 | Referred By Lead ID | |
| 22 | Referred By Name | |
| 23 | Referred By Email | |
| 24 | Referred By Code | |
| 25 | Match Type | code / email / name / manual |
| 26 | Referral Chain | Pipe-separated |
| 27 | Chain Depth | Integer |
| 28 | Direct Referrals | Running count |
| 29 | Total Downstream | Running count |
| 30 | Last Referral Date | |

**Tabs:**

| Tab | Purpose |
|---|---|
| Lifetime Leads | All submissions combined; deduplication source |
| Investor Leads | Role = investor |
| Referral Partners | Role = referral |
| RE Professionals | Role = pro |
| Explorers | Role = curious |
| Referrals Made | Role = refer |
| Bookings | Leads with confirmed booking slots |
| Referrals | One row per matched referral event (`REF-YYYY-XXXX`) |
| Daily Digest | Auto-populated summary |
| Contacts Mirror | Google Contacts sync log |
| Setup Log | Schema initialization record |

## Form flow

Both `apps/web` (ContactPage.tsx) and `apps/qr` (App.tsx) share the same 6-step wizard pattern.

### Steps

| # | Step | Description |
|---|---|---|
| 1 | Role | Who are you? Five tiles: Investor, Referral Partner, RE Professional, Exploring CRE, Making a Referral |
| 2 | Context | Background questions tailored to role |
| 3 | Preferences | Investment prefs (Investor only) |
| 4 | Contact | Name, email, phone, company. For "Making a Referral": two sections — Person you are referring (optional) then Your information |
| 5 | Booking | Optional 30-minute call scheduling (weekdays, 8am–5pm CT) |
| 6 | Comms | Optional update preferences; Submit button |

### Referral capture in the form

**Making a Referral path:**
- Step 2 context asks about the relationship, fit signals, and whether the referred person is aware
- Step 4 contact step has two sections: referred person fields first (all optional), then submitter's own info

**All other paths:**
- A "Were you referred to us?" Yes/No toggle appears at the bottom of the contact step
- If Yes, a single text input accepts any of:
  - A referral code (`AXP-XXXX`) — detected by regex `/^AXP-\d{4}$/i`
  - An email address — detected by presence of `@`
  - A name — everything else
- The field maps to `referralCode`, `referredByEmail`, or `referredByName` in the payload accordingly

### URL parameter referral capture

Visiting `/contact?ref=AXP-0042` (or `qr.axispoint.llc?ref=AXP-0042`) pre-populates the referral code silently:

- The `?ref=` value is read from `URLSearchParams` on mount and stored in state
- The "Were you referred to us?" toggle is **not shown** when a URL ref is present
- The captured code is sent as `referralCode` in the payload
- Partners can share their personal link `https://axispoint.llc/contact?ref=AXP-XXXX` to automatically credit themselves on any submission

### API response and success screen

The Apps Script endpoint returns:
```json
{ "success": true, "leadId": "AXP-2026-0042", "referralCode": "AXP-0042" }
```

The success screen displays the referral code, a shareable link, and a copy-to-clipboard button. If no `referralCode` is returned (e.g. dev mode without endpoint), the message falls back to "Check your confirmation email for your referral code."

### Error handling

If the fetch throws or the response contains `success: false`, an inline error banner is shown in the comms step:

> Something went wrong on our end. Please email us directly at zach@axispoint.llc or call (832) 580-2815.

The form is not cleared and the user can retry.

## Brand guidelines

- **Team members:** Both titled "Partner" only
- **No LinkedIn links** anywhere
- **No headshots** — initials avatars only (ZR teal, EV purple)
- **Zachary Russell:** zach@axispoint.llc, (832) 580-2815, teal
- **Ethaniel Vu:** ethaniel@axispoint.llc, (832) 499-8389, purple
- **NO NNN or Net Lease** in asset class options
- Calendar: weekdays only, 8am–5pm CT
- Success screen: no routing attribution, no name reveal

## Deployment

Automated via GitHub Actions to Namecheap FTP.

### Environment Variables (GitHub Secrets)

| Secret | Purpose |
|---|---|
| `FORM_ENDPOINT` | Google Apps Script Web App URL |
| `FTP_SERVER` | Main site FTP host |
| `FTP_USERNAME` | FTP username |
| `FTP_PASSWORD` | FTP password |
| `FTP_SERVER_QR` | QR subdomain FTP host |
| `FTP_USERNAME_QR` | QR FTP username |
| `FTP_PASSWORD_QR` | QR FTP password |

## Scripts Reference

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:qr` | Start QR app only |
| `pnpm build` | Build all apps for production |
| `pnpm build:web` | Build web app only |
| `pnpm build:qr` | Build QR app only |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |

## License

Private — All rights reserved by AxisPoint Partners LLC
