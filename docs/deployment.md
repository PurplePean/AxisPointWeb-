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
| Apps Script project | **Staging project exists** (`AxisPoint V2 STAGING`). `.clasp.json` is gitignored, not committed |
| Deployed | **No** — web-app deployment not yet created |
| Sheet | **Created** (`AxisPoint V2 CRM STAGING`, six tabs) |
| Script Properties | **1 of 11 set** (`AXP_CALENDAR_ID`); `AXP_SHEET_ID` and 9 others pending |
| Triggers | **None installed** |
| Frontend pointed at it | **No.** Both apps read `VITE_V2_SUBMISSION_ENDPOINT`, and a lone V1 value is rejected |
| Status | `pushed to HEAD` — see [`staging-provisioning.md`](staging-provisioning.md) for remaining steps |

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

### Bringing the V2 backend up (staging underway — see [`staging-provisioning.md`](staging-provisioning.md))

Each of these is a separate external mutation. None is implied by merging V2 code.

**Staging status as of 2026-08-19:** steps 1–4 (`clasp push`) are complete. Steps 5–6 are not yet done.

1. ~~Create an Apps Script project and its `.clasp.json` (gitignored, as V1's is).~~ **Done.**
2. ~~Create the Sheet with the six tabs `Submissions`, `Deliveries`, `Leads`, `Contacts`, `Log`,
   `Work`, tab names and header rows exactly as `expectedTabLayout()` returns them in
   `src/platform/SheetRepository.js`.~~ **Done.**
3. Set the Script Properties named in `src/platform/Config.js`. **No value for any of these exists
   in this repository.** Leave `AXP_RUN_MODE` unset or `dry_run` until a live send is
   intended; an unset mode is `dry_run`, never `live`. **Partially done: `AXP_CALENDAR_ID` set;
   others pending.**

   Storage and routing: `AXP_SHEET_ID`, `AXP_CALENDAR_ID`, `AXP_PARTNER_NOTIFY_TO`,
   `AXP_PARTNER_EMAIL_MAP`, `AXP_REPLY_TO`, `AXP_FROM_NAME`, `AXP_RUN_MODE`.

   Email identity: `AXP_PARTNER_DIRECT_EMAIL_MAP`, `AXP_PARTNER_DIRECT_PHONE_MAP`,
   `AXP_FIRM_EMAIL`, `AXP_FIRM_PHONE`, `AXP_WEBSITE_URL`, `AXP_LOGO_URL`.

   **`AXP_LOGO_URL` and `apps/web/public/images/logo-email.png`:** The email
   templates embed a logo via this property. There is no code that references the
   PNG by filename — the connection is purely by deployment convention: once the
   frontend is hosted, set `AXP_LOGO_URL` to the public URL of that file
   (e.g. `https://axispoint.llc/images/logo-email.png`). The GAS backend never
   reads the file itself; it only interpolates whatever URL is stored in the
   property into the `<img src>` attribute. If the URL is absent, the email header
   degrades gracefully (no `<img>` is emitted). A future reader who notices that
   nothing in the source code imports the PNG and wonders if it is an orphan: it is
   not — its path is the configured value, not a build import.

   **There are no promise flags to set.** `AXP_REPLY_TO_MONITORED` and
   `AXP_REMOVAL_PROCEDURE_CONFIGURED` were removed on 2026-08-15 along with the QR
   acknowledgement copy they gated: correction and removal on request are not offered, so
   the email no longer promises them and there is nothing left to configure. If either
   name turns up in an older runbook or an already-provisioned project, it is stale;
   setting it does nothing.
4. ~~`cd scripts/gas-v2 && clasp push`, then verify `clasp status` lists exactly
   `appsscript.json` and the source files under `src/`. The `.claspignore` allowlist is the only thing
   keeping the Node test suite out, and pushing it would take the backend down.~~ **Done (2026-08-19).**
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
re-allows only `appsscript.json` and `src/**/*.js`. The allow rule is recursive because `src`
is grouped into `entrypoints/`, `core/`, `platform/`, `scheduled/`, `emails/`, and `shared/`;
a single-segment `src/*.js` would now match nothing and push a project with no code in it.

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
history.** `scripts/gas-v2/src/platform/GoogleServices.js` is the only file that names `CalendarApp`, and
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
`scripts/gas-v2/src/core/Booking.js` calls the calendar synchronously and returns a final status, and
`confirmed` is reachable from exactly one place: a successful `createEvent`. A permissions
problem therefore surfaces as `failed`, and a missing `calendarId` as `not_configured`, instead
of a visitor being told they are booked for a meeting that does not exist. If you see either
status in a live check, look at the sharing level and the Script Property before looking at the
code.

## Front-end — GitHub Actions → Namecheap FTP

The V1 endpoint variable defect (workflows passing `VITE_FORM_ENDPOINT`/`FORM_ENDPOINT`)
was corrected in PR #122. Both workflows now pass `VITE_V2_SUBMISSION_ENDPOINT` /
`V2_SUBMISSION_ENDPOINT`. The QR `server-dir` contradiction (incorrect path set by PR
#122) was corrected in the same PR as this document.

For the current, authoritative workflow configuration, secrets list, and full cutover
procedure, see **[GitHub issue #124](https://github.com/PurplePean/AxisPointWeb-/issues/124)**.

### Workflows

| File | Trigger | What it does | Status |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR to `main` + push to `main` | Three jobs. **build:** type-check, lint across all four packages, both production builds with `VITE_V2_SUBMISSION_ENDPOINT: ''`, and `inspect-bundle.mjs` against each `dist`. **test-frontend:** `pnpm test:frontend`. **verify-rendered:** route baseline, ARIA assertions, and the 20-state intake baseline in a headless browser. No deploy. | ✅ **passing** |
| `.github/workflows/test-gas.yml` | PR to `main` + push to `main` | One step, `pnpm test:gas-v2`. It used to run two suites; the V1 step was removed with the V1 backend at retirement | ✅ **passing** |
| `.github/workflows/deploy-web.yml` | push to `main` | build `@axispoint/web` with `VITE_V2_SUBMISSION_ENDPOINT` → FTP `./apps/web/dist/` to `./public_html/` with `dangerous-clean-slate` | ❌ **failing** (FTP secrets not configured) |
| `.github/workflows/deploy-qr.yml` | push to `main` | build `@axispoint/qr` with `VITE_V2_SUBMISSION_ENDPOINT` → FTP `./apps/qr/dist/` to `./qr.axispoint.llc/` with `dangerous-clean-slate` | ❌ **failing** (FTP secrets not configured) |

### SPA rewrite: tracked and ships with the build (PR #124)

The site is a single-page app. Deep links require the host to return `index.html` for
any path that has no matching file on disk. `apps/web/public/.htaccess` and
`apps/qr/public/.htaccess` were added in PR #124; Vite copies them verbatim into
`dist/` and the FTP deploy places them on the server. No further Apache configuration
is required.

### Why the two deploy workflows fail

The build step succeeds; the **FTP step** fails with `Error: Input required and not
supplied: server`. The FTP secrets are not configured. Populate the 7 secrets listed
in [GitHub issue #124](https://github.com/PurplePean/AxisPointWeb-/issues/124) to make deploys go
green. (Runners also emit a non-fatal Node 20 deprecation warning — informational only.)

### GitHub secrets

See [GitHub issue #124](https://github.com/PurplePean/AxisPointWeb-/issues/124) for the complete,
current secrets table (7 secrets). The table that used to live here listed `FORM_ENDPOINT` (V1,
now removed from both workflows) and is superseded.

## Hosting automation and hosting inventory

The cPanel + Namecheap automation library, its credentials, per-command usage, and
the live hosting inventory (server, cPanel account, subdomain document roots, A
records) all live in [`hosting/README.md`](../hosting/README.md).

### ⚠️ NEVER MODIFY — Google email/verification DNS records

**8 DNS records must never be changed, deleted, or touched** under any
circumstances, regardless of any other hosting cleanup: the 5 Google MX records,
TXT `_dmarc`, TXT `google._domainkey`, and the two TXT `@` records (SPF and
`google-site-verification`). Breaking any of them breaks `@axispoint.llc` email
or Search Console ownership.

The exact record list is in
[`hosting/README.md` § NEVER MODIFY](../hosting/README.md#never-modify--google-emailverification-dns-records).
This pointer is deliberately kept here as well: the constraint is the
highest-stakes fact in either document and must stay visible to anyone reading
about deployment, not only to whoever opens the hosting scripts.

## Production migration plan

**Superseded by [GitHub issue #124](https://github.com/PurplePean/AxisPointWeb-/issues/124) (2026-08-26).**
All decisions are made and documented there. Read that issue, not this section.

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
