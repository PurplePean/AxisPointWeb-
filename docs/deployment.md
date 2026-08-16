# Deployment

> **Which systems are current, retired, or external is settled in
> [`system-classification.md`](system-classification.md).** This file owns *procedures*: the
> push-versus-deploy mechanics, the provisioning checklists, the hosting inventory, and the
> gotchas. It does not own the V1/V2 boundary, and where the two disagree the classification
> wins.
>
> **V1 is retired and its source was deleted on 2026-08-15.** The V1 operating sections that
> used to sit in this file are gone with it. Their durable summary is
> [`archive/deployment-v1.md`](archive/deployment-v1.md), and the full historical text,
> including the Script ID, Deployment ID, `/exec` URL, and bound Spreadsheet ID, is at the
> `pre-v1-retirement-2026-08-14` tag: `git show pre-v1-retirement-2026-08-14:docs/deployment.md`.
> Those identifiers were deliberately not copied forward, so that reading one is a deliberate
> act rather than a lookup.

## One Apps Script backend exists in this repository

| | `scripts/gas-v2` (V2) |
|---|---|
| Apps Script project | **None.** No `.clasp.json` |
| Deployed | **No** |
| Sheet, Script Properties, triggers | **None created** |
| Frontend pointed at it | **No.** Both apps read `VITE_V2_SUBMISSION_ENDPOINT`, and a lone V1 value is rejected |
| Status | `merged` |

There were two until 2026-08-15. `scripts/gas` (V1) was an external Apps Script project,
historically deployed at production version @28, already retired as a business system, and its
source is now deleted from this repository. **The external project itself is untouched.**
Whether it is left in place, disabled, or removed is a separate owner decision and a separate
authorized operation, and nothing in this repository performs it.

**The public site at `axispoint.llc` is a separate, hand-uploaded build that was not produced
from this repository, and it is not served by the backend above.** Retiring V1 did not change
what a visitor sees, because nothing in this repository is what a visitor sees.

V2's own rules live in [`scripts/gas-v2/README.md`](../scripts/gas-v2/README.md) and its wire
contract in [`backend-v2-contract.md`](backend-v2-contract.md).

### Bringing the V2 backend up (not done, not authorized by any merge)

Each of these is a separate external mutation. None is implied by merging V2 code, and none
has been performed.

1. Create an Apps Script project and its `.clasp.json` (gitignored, as V1's is).
2. Create the Sheet with the four tabs `Leads`, `Contacts`, `Log`, `Work`, header rows per
   `expectedTabLayout()` in `src/SheetRepository.js`.
3. Set the Script Properties named in `src/Config.js`. **No value for any of these exists
   in this repository.** Leave `AXP_RUN_MODE` unset or `dry_run` until a live send is
   intended; an unset mode is `dry_run`, never `live`.

   Storage and routing: `AXP_SHEET_ID`, `AXP_CALENDAR_ID`, `AXP_PARTNER_NOTIFY_TO`,
   `AXP_PARTNER_EMAIL_MAP`, `AXP_REPLY_TO`, `AXP_FROM_NAME`, `AXP_RUN_MODE`.

   Email identity: `AXP_PARTNER_DIRECT_EMAIL_MAP`, `AXP_PARTNER_DIRECT_PHONE_MAP`,
   `AXP_FIRM_EMAIL`, `AXP_FIRM_PHONE`, `AXP_WEBSITE_URL`, `AXP_LOGO_URL`.

   **There are no promise flags to set.** `AXP_REPLY_TO_MONITORED` and
   `AXP_REMOVAL_PROCEDURE_CONFIGURED` were removed on 2026-08-15 along with the QR
   acknowledgement copy they gated: correction and removal on request are not offered, so
   the email no longer promises them and there is nothing left to configure. If either
   name turns up in an older runbook or an already-provisioned project, it is stale;
   setting it does nothing.
4. `cd scripts/gas-v2 && clasp push`, then verify `clasp status` lists exactly
   `appsscript.json` and the `src/*.js` files. The `.claspignore` allowlist is the only thing
   keeping the Node test suite out, and pushing it would take the backend down.
5. Install the time-driven triggers. **This repository installs none of them**, and none
   of the handlers has ever run:
   - `runWorkerTrigger`, every 5 minutes, for the delivery queue.
   - `runDailyQrDigestTrigger`, daily at 8:00 AM `America/Chicago`, for the internal QR
     Contact digest.
   - `runRetentionMaintenanceTrigger`, for operational-record retention. Run it once by
     hand with `{ dryRun: true }` against real data first: it reports what it would remove
     without removing anything. It never selects a business record.
6. `clasp deploy` to create the web app, then point a frontend at it. That is a separate
   decision again, and the calendar-access gotcha below applies identically.

The same `push` vs `deploy -i` distinction, and the same reauth friction, apply to V2.

## `push` vs `deploy -i`, and why neither is part of "done"

```bash
cd scripts/gas-v2 && clasp push                  # updates project HEAD
cd scripts/gas-v2 && clasp deploy -i <deploy-id> # repoints the live /exec URL. THIS releases
```

- **`clasp push`** uploads local source to the Apps Script project's **HEAD**, which is what the
  script editor shows and what **installed triggers and scheduled functions execute**. It does
  **not** change what the live `/exec` URL serves.
- The live `/exec` URL is pinned to a **specific deployed version**. Making a push go live means
  redeploying that deployment with `-i`. Re-using the deployment ID keeps the same `/exec` URL
  while pointing it at a fresh version; creating a *new* deployment mints a *new* URL and
  requires updating the `SCRIPT_URL` Script Property and the endpoint the frontend builds with.

A backend task can be **fully complete** — written, tested, committed, merged — **without either
command having run.** Neither is part of the definition of "done". Both are explicit operations
you run only when you actually decide to change a running backend. Push when you intend to
update HEAD and triggers; deploy when you intend to release the endpoint. A `clasp push` on its
own leaves the pinned `/exec` version on old code: expected, not a bug.

Neither command is runnable today, because no V2 Apps Script project exists yet. The V2 bring-up
checklist is above.

### `.claspignore` controls what is allowed to reach Apps Script

`scripts/gas-v2/.claspignore` is an **allowlist**, not a blocklist. It denies `**/**` and
re-allows only `appsscript.json` and `src/*.js`.

This is load-bearing, not tidiness. Apps Script runs **every pushed file's top-level statements
in one shared global scope on every invocation**. A Node test file opening with
`require('node:test')` therefore throws `ReferenceError: require is not defined` on every
`doPost` and every trigger: a full backend outage caused entirely by files that are not backend
source. V1 learned this the expensive way, which is why the V2 allowlist was written **before**
any Node-only file existed in that directory.

`scripts/gas-v2/tests/deployability.test.js` asserts that shape on every CI run, so the
allowlist cannot quietly become a blocklist. Do not convert it into one by hand.

### Gotcha: the deploying account needs *edit* access to the bookings calendar

**This gotcha survived V1 retirement because V2 inherits the mechanism, not because it is
history.** `scripts/gas-v2/src/GoogleServices.js` is the only file that names `CalendarApp`, and
it reads and writes the calendar named by the `calendarId` config value.

A Web App deployed with `executeAs: USER_DEPLOYING` runs every calendar read and every event
creation as the account that created the deployment, **not** as the visitor, and not as the
calendar's owner unless they are the same account.

The bookings calendar is a dedicated shared secondary calendar, not anyone's primary. Whether
the deploying account can write to it depends on how it got access:

- **The deploying account owns the calendar** → edit access is implicit, nothing to configure.
- **The deploying account is not the owner** → ownership does *not* propagate. The owner must
  share the calendar with that account at the **"Make changes to events"** level (Calendar →
  *Settings and sharing* → *Share with specific people*). **"See all event details" is not
  sufficient:** availability reads succeed while every event creation fails.

This matters the moment the deploying account changes, because a redeploy from a different
Google account silently re-binds execution identity.

The V2 booking command is built so that this failure is visible rather than silent.
`scripts/gas-v2/src/Booking.js` calls the calendar synchronously and returns a final status, and
`confirmed` is reachable from exactly one place: a successful `createEvent`. A permissions
problem therefore surfaces as `failed`, and a missing `calendarId` as `not_configured`, instead
of a visitor being told they are booked for a meeting that does not exist. If you see either
status in a live check, look at the sharing level and the Script Property before looking at the
code.

## Front-end — GitHub Actions → Namecheap FTP

**The two deploy workflows still pass the V1 variable, and that is now a defect.** They set
`VITE_FORM_ENDPOINT: ${{ secrets.FORM_ENDPOINT }}`, which described the world when there was
one V1 endpoint and a single shared form component reading it. Neither is true now: the form is gone,
both apps read `VITE_V2_SUBMISSION_ENDPOINT`, and a build given only the V1 name compiles in no
endpoint at all. It would deploy a site that fails closed on every submission while looking
correct.

It has not broken anything, because neither workflow has ever succeeded past its FTP step. **It
must be corrected in the same change that adds the FTP secrets**, together with the deployment
gate and the mirror-delete question below. It was deliberately not corrected in the 2026-08-15
safety pass, which touched CI but left deployment configuration alone.

### Workflows

| File | Trigger | What it does | Status |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR to `main` + push to `main` | Three jobs. **build:** type-check, lint across all four packages, both production builds with `VITE_V2_SUBMISSION_ENDPOINT: ''`, and `inspect-bundle.mjs` against each `dist`. **test-frontend:** `pnpm test:frontend`. **verify-rendered:** route baseline, ARIA assertions, and the 20-state intake baseline in a headless browser. No deploy. | ✅ **passing** |
| `.github/workflows/test-gas.yml` | PR to `main` + push to `main` | Both Apps Script suites, as separate steps | ✅ **passing** |
| `.github/workflows/deploy-web.yml` | push to `main` | build `@axispoint/web` with the **wrong (V1) variable** → FTP `./apps/web/dist/` to `./public_html/` | ❌ **failing** |
| `.github/workflows/deploy-qr.yml` | push to `main` | build `@axispoint/qr` with the **wrong (V1) variable** → FTP `./apps/qr/dist/` to `./qr.axispoint.llc/` | ❌ **failing** |

### SPA rewrite: not configured, and required before any locale is activated

The site is a single-page app whose routes are client-side. Deep links only work if the host
returns `index.html` for a path that has no matching file on disk.

**This repository contains no rewrite configuration of any kind.** There is no `.htaccess`, no
`_redirects`, no `vercel.json`, no `netlify.toml`, and no `web.config` anywhere in the tree.
The deploy target is FTP into Apache `public_html/`, so whatever rewrite exists (or does not)
lives on the host and is not tracked here.

This has not mattered so far, because the existing English routes are reached by in-app
navigation from `/`. It starts mattering with locale prefixes: `/es/contact` typed directly, or
hard-refreshed, is exactly the case that needs the fallback. All routing evidence gathered
during the Multilingual Content Rollout comes from the **dev server**, where Vite supplies the
SPA fallback automatically. That is not evidence about Apache.

No rewrite file was invented to close this gap, because guessing at the host's configuration is
how a 404 reaches production. **Verifying the host's rewrite behaviour, and configuring it if
absent, is a prerequisite for activating any non-English locale.** It is owner work on the
hosting account, not a code change, and no merge performs it.

### Why the two deploy workflows fail

The build step succeeds; the **FTP step** fails with:

```
Error: Input required and not supplied: server
```

i.e. the FTP secrets (`FTP_SERVER` / `FTP_SERVER_QR` and their username/password
counterparts) are **not configured** in the repository, so
`SamKirkland/FTP-Deploy-Action` receives an empty `server`. CI (which needs no
secrets) passes on the same commits. Populate the FTP secrets to make deploys go
green. (Runners also emit a non-fatal Node 20 deprecation warning — informational
only.)

### GitHub secrets (names only)

| Secret | Used by | Purpose |
|---|---|---|
| `FORM_ENDPOINT` | both deploy workflows | The **V1** GAS Web App `/exec` URL, piped into the V1 variable name. Both apps ignore it. See the defect noted above |
| `FTP_SERVER` | deploy-web | main-site FTP host |
| `FTP_USERNAME` | deploy-web | main-site FTP user |
| `FTP_PASSWORD` | deploy-web | main-site FTP password |
| `FTP_SERVER_QR` | deploy-qr | QR-subdomain FTP host |
| `FTP_USERNAME_QR` | deploy-qr | QR FTP user |
| `FTP_PASSWORD_QR` | deploy-qr | QR FTP password |

## Hosting automation — `scripts/hosting`

A dependency-free Node library for read/write access to the hosting stack that
sits *underneath* the front-end deploys documented above:

- **cPanel** (UAPI + API 2): list subdomains, add subdomains, add redirects, and
  clean directories.
- **Namecheap** (XML API): read current DNS records.

It mirrors the `scripts/gas-v2` pattern (shared clients in `lib/`, thin runnable
scripts on top) and reads all credentials from a gitignored `scripts/hosting/.env`
(template: `scripts/hosting/.env.example`) — nothing is hardcoded. Write actions
(`add-subdomain`, `add-redirect`, `clean-directory`) require explicit confirmation.

By design it does **not** touch domain registration, renewal, or transfer — those
stay manual. See [`scripts/hosting/README.md`](../scripts/hosting/README.md) for
credentials and per-command usage.

## Hosting inventory (as of live scan via `scripts/hosting`)

Server: `premium171.web-hosting.com`, IP `162.0.209.114`, cPanel account: `axisipak`

Current cPanel subdomains:

- `qr.axispoint.llc` — document root: `/home/axisipak/public_html/qr` (nested inside `public_html` — this is a known issue, see Migration Plan below)
- `crm.axispoint.llc` — document root: `/home/axisipak/crm.axispoint.llc` — OLD/STALE project, safe to wipe when reset

DNS records for `axispoint.llc` — 7 A records tied to hosting (all safe to
repoint/reuse during migration, no DNS changes needed, only file content
changes): `@`, `api`, `crm`, `qr`, `staging`, `www`, `www.crm` — all currently
point to `162.0.209.114`. Note: `api` and `staging` already have DNS A records
but **NO** corresponding cPanel subdomain/folder yet — DNS is pre-provisioned,
hosting is not.

### NEVER MODIFY — Google email/verification records

These 8 DNS records must never be changed, deleted, or touched under any
circumstances, regardless of any other hosting cleanup:

- 5x MX records (`ASPMX.L.GOOGLE.COM` + 4 alternates) — powers `@axispoint.llc` email
- TXT `_dmarc` — DMARC policy
- TXT `google._domainkey` — DKIM signing
- TXT `@` (`v=spf1...`) — SPF
- TXT `@` (`google-site-verification=...`) — Search Console ownership

## Production migration plan (not yet executed — current site is still in active use)

When the new monorepo project actually goes live (explicit go-ahead required, not
yet given):

1. **Standardize subdomain structure:** each subdomain gets its own top-level
   sibling folder under `/home/axisipak/` (e.g. `qr.axispoint.llc/`,
   `crm.axispoint.llc/`) rather than nesting inside `public_html`. Main site
   (`axispoint.llc`) stays in `public_html` since it's the account's primary
   domain root.
2. **Migrate qr specifically:** move files from `public_html/qr` to a new
   top-level `qr.axispoint.llc/` folder, update the cPanel subdomain's document
   root to match, and update `deploy-qr.yml`'s FTP target path accordingly —
   otherwise the next auto-deploy uploads to the old, now-wrong path. (Nested
   placement inside `public_html` also means qr's files may currently be
   unintentionally reachable at `axispoint.llc/qr` as an unplanned side door.)
3. **Wipe `crm.axispoint.llc` clean** (confirmed old/stale, not needed) — ready
   to receive the real dashboard whenever that gets built later.
4. **`api` and `staging`:** leave un-provisioned (no folder created) until those
   are actually being built — DNS is already pointed and ready whenever needed.
5. **RESOLVED 2026-07-30 — mirror-delete is NOT configured.** Neither
   `deploy-web.yml` nor `deploy-qr.yml` passes `dangerous-clean-slate` to
   `SamKirkland/FTP-Deploy-Action`, and the action does not mirror-delete by
   default. **Current behavior: a deploy adds and overwrites files, and never
   removes stale ones.** Old site files that are not part of the new build would
   sit alongside it indefinitely.

   This is not a bug to fix today — nothing deploys at all yet — but it must be
   decided before the migration, alongside the FTP secrets and the deployment-gate
   question. Two options when that time comes: enable `dangerous-clean-slate` for a
   true mirror (destructive, and it wipes anything hand-uploaded to the same
   directory), or wipe the target directory once manually at cutover and rely on
   add/overwrite afterwards. The second is safer given that the live sites are
   currently a separate hand-uploaded build.

## One-time GAS setup

The V1 one-time setup checklist that used to sit here described the V1 backend source, which no
longer exists. The equivalent for the current backend is **Bringing the V2 backend up** near the
top of this file. The historical V1 checklist is summarised in
[`archive/deployment-v1.md`](archive/deployment-v1.md) and preserved in full at the
`pre-v1-retirement-2026-08-14` tag.

### Gotcha: `clasp` reauth is routine, not a failure

`clasp push`, `clasp deploy`, and other `clasp` subcommands each independently
trigger `invalid_grant` / `invalid_rapt` OAuth errors, and can do so **repeatedly
within one session even after a successful `clasp login`**. A successful login does
not immunize the next command. Re-run `clasp login`, then re-run the command.

This is Google reauth friction (especially after OAuth scope changes), **not** a
broken script and not a code bug. Do not start debugging backend source because a
`clasp` command failed this way.
