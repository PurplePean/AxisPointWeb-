# Deployment

## Google Apps Script backend

| Identifier | Value |
|---|---|
| **Script ID** | `1JmdCmGCrvHv5LHAxb8Vptq0jRWWuTkO3wQ0djEyeRvwNzXuJGPja6h7V` (from `scripts/gas/.clasp.json`, which is **gitignored**) |
| **Bound Spreadsheet ID** | `1Z5Eyn9F4SoOYg4dJ0cDDorfnvqVbn_uYsUxDkPn12wY` (set by `setProperties()`, read via `getProp('SPREADSHEET_ID')`) |
| **Deployment ID** | `AKfycbzfFHPUSP4bUc-Xu1Ma9179bk_dsprrqswaKljeV8ZUmB5Q0gOl9UVtPTqKt4IXeZgBqg` |
| **Live `/exec` URL** | `https://script.google.com/macros/s/AKfycbzfFHPUSP4bUc-Xu1Ma9179bk_dsprrqswaKljeV8ZUmB5Q0gOl9UVtPTqKt4IXeZgBqg/exec` |

The `/exec` URL embeds the deployment ID. It's stored in Script Properties as
`SCRIPT_URL` and must also be set as the `FORM_ENDPOINT` GitHub secret so both
front-ends POST to it.

### `clasp push` vs `clasp deploy -i` — the critical distinction

```bash
pnpm gas:push     # == cd scripts/gas && clasp push
```

- **`clasp push`** (`pnpm gas:push`) uploads local `Code.gs` / `appsscript.json`
  to the Apps Script project's **HEAD** (the editor content). It updates what you
  see in the script editor and can immediately affect **installed triggers and
  scheduled functions** (cold-lead sweep, daily digest, partner summary) — but it
  **does NOT change what the live `/exec` URL serves.**
- The live `/exec` URL is pinned to a **specific deployed version**. To make a
  push go live you must **redeploy that deployment**:

  ```bash
  cd scripts/gas
  clasp deploy -i AKfycbzfFHPUSP4bUc-Xu1Ma9179bk_dsprrqswaKljeV8ZUmB5Q0gOl9UVtPTqKt4IXeZgBqg
  ```

  Re-using the deployment ID (`-i`) keeps the same `/exec` URL while pointing it
  at a fresh version. Creating a *new* deployment would mint a *new* URL and
  require updating `SCRIPT_URL` + the `FORM_ENDPOINT` secret.

#### Completion and deployment are separate, deliberate decisions

A backend task can be **fully complete** — written, tested, committed, merged —
**without either `clasp push` or `clasp deploy` having run.** Neither command is
part of the definition of "done"; both are explicit, intentional operations you
run only when you actually decide to change the running backend:

- `pnpm gas:push` changes the project HEAD (and can move triggers/scheduled jobs).
- `clasp deploy -i <deploymentId>` changes the pinned production `/exec` endpoint.

Do **not** treat "I made a backend change" as automatically implying either step.
Push when you intend to update HEAD/triggers; deploy when you intend to release the
endpoint. A `clasp push` on its own leaves the pinned `/exec` version on old code —
that is expected, not a bug, and going live is a subsequent deliberate `clasp deploy`.

### `.claspignore` controls what is allowed to reach Apps Script

`scripts/gas/.claspignore` is an **allowlist**: only `appsscript.json`,
`Code.gs`, and `emails/**` are pushed. Everything else under `scripts/gas/` is
excluded by default.

This is load-bearing, not tidiness. `.clasp.json` sets
`skipSubdirectories: false` and lists `.js` in `scriptExtensions`, so without
the allowlist clasp sweeps up **every** `.js` under `scripts/gas/` — including
the Node test suite in `scripts/gas/tests/`. Apps Script runs every pushed
file's top-level statements in one shared global scope on every invocation, and
those tests open with `require('node:test')`; GAS has no `require`, so pushing
them throws `ReferenceError: require is not defined` on **every** `doPost` and
**every** trigger. That is a full backend outage caused entirely by files that
are not `Code.gs`.

Before any push that adds files under `scripts/gas/`, run `clasp status` and
confirm the tracked list is exactly those 9 files. If new Node-only tooling is
added there, it stays excluded automatically — do not convert `.claspignore`
into a blocklist.

### Gotcha: the deploying account needs *edit* access to `BOOKING_CALENDAR_ID`

The Web App runs as `executeAs: USER_DEPLOYING`, so every `Calendar.Events.insert`
and `Calendar.Freebusy.query` executes as the account that created the deployment —
**not** as the visitor, and not as the calendar's owner unless they are the same
account.

`BOOKING_CALENDAR_ID` points at the dedicated shared **AxisPoint Bookings**
calendar, which is a secondary calendar, not anyone's primary. Whether the deploying
account can write to it depends on how it got access:

- **The deploying account owns the calendar** → edit access is implicit. Nothing to
  configure. This is the current arrangement.
- **The deploying account is not the owner** → ownership does *not* propagate.
  The owner must explicitly share the calendar with that account at the
  **"Make changes to events"** permission level (Calendar → *Settings and sharing* →
  *Share with specific people* ). "See all event details" is **not** sufficient —
  free/busy reads will succeed while every event insert fails, which presents as
  bookings that produce a confirmation email and no calendar event.

This matters the moment the deploying account changes (a redeploy from a different
Google account silently re-binds execution identity). Symptoms of getting it wrong:

| Symptom | Meaning |
|---|---|
| Partner email shows **"⚠ Calendar event was NOT created"** | Insert failed. Check the error line in the banner, then the sharing level. |
| Availability always shows every slot free | `Freebusy.query` is failing or the property is unset; the frontend falls back to all-available on any error. |
| Both of the above, with `BOOKING_CALENDAR_ID Script Property is not set` | `setProperties()` has not been re-run on this script. |

`setProperties()` stores `SPREADSHEET_ID`, `SCRIPT_URL`, **and**
`BOOKING_CALENDAR_ID`. Re-run it in the Apps Script editor after any change to those
values; `clasp push` uploads the function, it does not execute it.

## Front-end — GitHub Actions → Namecheap FTP

Both apps share the **same** GAS endpoint: each deploy workflow passes
`VITE_FORM_ENDPOINT: ${{ secrets.FORM_ENDPOINT }}` into the build, and the shared
`<ContactForm>` reads that single env var. Confirmed — there is one endpoint for
`apps/web` and `apps/qr`.

### Workflows

| File | Trigger | What it does | Status |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR to `main` + push to `main` | pnpm install, build web app and QR app with `VITE_FORM_ENDPOINT: ''`. Type-check + build only, no deploy. | ✅ **passing** |
| `.github/workflows/deploy-web.yml` | push to `main` | build `@axispoint/web` with `FORM_ENDPOINT` → FTP `./apps/web/dist/` to `./public_html/` | ❌ **failing** |
| `.github/workflows/deploy-qr.yml` | push to `main` | build `@axispoint/qr` with `FORM_ENDPOINT` → FTP `./apps/qr/dist/` to `./qr.axispoint.llc/` | ❌ **failing** |

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
| `FORM_ENDPOINT` | both deploy workflows | GAS Web App `/exec` URL → `VITE_FORM_ENDPOINT` |
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

It mirrors the `scripts/gas` pattern (shared clients in `lib/`, thin runnable
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

## One-time GAS setup (from `Code.gs` header)

1. Create the Sheet, create the Apps Script project, paste `Code.gs`.
2. Set project time zone to `America/Chicago`.
3. Create the shared **AxisPoint Bookings** calendar and give the deploying account
   edit access (see the gotcha above).
4. Run `setProperties()` once (stores `SPREADSHEET_ID`, `SCRIPT_URL`, and
   `BOOKING_CALENDAR_ID`).
5. Run `setupSpreadsheet()` (creates the 11 tabs).
6. Enable the advanced **Calendar API v3** service (already declared in
   `appsscript.json` under `enabledAdvancedServices`).
7. Deploy → Web App, **Execute as: Me**, **Access: Anyone (anonymous)**.
8. Run `setupTriggers()` (daily digest, weekly cold sweep, monthly summary, onEdit).

### Gotcha: `clasp` reauth is routine, not a failure

`clasp push`, `clasp deploy`, and other `clasp` subcommands each independently
trigger `invalid_grant` / `invalid_rapt` OAuth errors, and can do so **repeatedly
within one session even after a successful `clasp login`**. A successful login does
not immunize the next command. Re-run `clasp login`, then re-run the command.

This is Google reauth friction (especially after OAuth scope changes), **not** a
broken script and not a code bug. Do not start debugging `Code.gs` because a
`clasp` command failed this way.
