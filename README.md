# AxisPoint Partners Website

Institutional-grade commercial real estate asset management for owners and advisors across Texas.

## Project Structure

This is a pnpm monorepo containing:

- **apps/web** — Main website (axispoint.llc)
- **apps/qr** — Mobile QR digital card (qr.axispoint.llc)
- **packages/brand** — Shared brand assets, colors, fonts, team data, and types
- **content/** — Markdown articles and publications
- **scripts/gas/** — Google Apps Script backend (Code.gs)
- **docs/** — Verified source-of-truth documentation (backend, email templates, payload schemas, deployment, changelog)

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
2. Run `pnpm deploy:gas` (`clasp push`) — this updates the script editor's HEAD **only**
3. Redeploy the live version so `/exec` serves the new code:
   `cd scripts/gas && clasp deploy -i <deploymentId>`

> `clasp push` alone does **not** update the live endpoint. See
> [`docs/deployment.md`](docs/deployment.md) for the deployment ID and the full
> push-vs-deploy distinction.

### Lead ID format

Every submission gets a unique Lead ID: **`AXP-YYYY-XXXX`**

- `YYYY` — four-digit year of submission
- `XXXX` — zero-padded sequential number scoped across all submissions (e.g. `AXP-2026-0001`)

Each lead also gets a personal shareable **Referral Code**: **`AXP-` + 6 unambiguous
characters** (e.g. `AXP-K7M4PQ`), collision-checked against Lifetime Leads.

The Lead ID sequence is stored in Script Properties under `LAST_LEAD_ID` and incremented atomically using `LockService.getScriptLock()`.

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

The spreadsheet has **11 tabs**: Active Leads, Lifetime Leads, Cold Leads,
Investors, Referral Partners, RE Professionals, Existing Asset Owners, Clients,
Archive, Referrals, and Subscribers. All lead tabs share a **31-column** schema
(the Referral Partners tab adds a 32nd `Reports Enabled` column).

The full column layout, tab purposes, deduplication logic, referral matching,
and the `onEdit` sync are documented in
[`docs/backend-architecture.md`](docs/backend-architecture.md) — the verified
source of truth for the backend.

## Contact form

Both `apps/web` (`ContactPage.tsx`) and `apps/qr` (`App.tsx`) render the **same**
shared `<ContactForm>` from `packages/brand`, which POSTs to the single GAS
endpoint (`VITE_FORM_ENDPOINT`).

There are **five lead types**: Investor, Referral Partner (`referral`), RE
Professional (`pro`), Existing Asset Owner (`existing_asset_owner`), and Making a
Referral (`submit_referral`). Investor / Referral / Pro / submit_referral run a
step wizard; Existing Asset Owner has its own dedicated step flow (personal →
property → situation → issue → schedule).

Referral capture: a `?ref=AXP-XXXXXX` URL param pre-fills the code silently;
otherwise a "Were you referred?" toggle accepts a code
(`/^AXP-[A-Z0-9]{6}$/i`), an email (`@`), or a name.

The exact payload shape for every lead type is documented in
[`docs/frontend-payload-schemas.md`](docs/frontend-payload-schemas.md), and the
email templates in [`docs/email-templates.md`](docs/email-templates.md).

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
