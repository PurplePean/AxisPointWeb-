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
pnpm deploy:gas     # == cd scripts/gas && clasp push
```

- **`clasp push`** uploads local `Code.gs` / `appsscript.json` to the Apps
  Script project's **HEAD** (the editor content). It updates what you see in the
  script editor — **it does NOT change what the live `/exec` URL serves.**
- The live `/exec` URL is pinned to a **specific deployed version**. To make a
  push go live you must **redeploy that deployment**:

  ```bash
  cd scripts/gas
  clasp deploy -i AKfycbzfFHPUSP4bUc-Xu1Ma9179bk_dsprrqswaKljeV8ZUmB5Q0gOl9UVtPTqKt4IXeZgBqg
  ```

  Re-using the deployment ID (`-i`) keeps the same `/exec` URL while pointing it
  at a fresh version. Creating a *new* deployment would mint a *new* URL and
  require updating `SCRIPT_URL` + the `FORM_ENDPOINT` secret.

**A `clasp push` alone will silently leave production on old code.** Always
follow a backend change with `clasp deploy -i <deploymentId>`.

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
5. **OPEN QUESTION, not yet investigated:** whether the FTP deploy workflows
   (`deploy-web.yml`/`deploy-qr.yml`, using `SamKirkland/FTP-Deploy-Action`) have
   "clean slate"/mirror-delete behavior configured. Without it, a deploy only
   adds/overwrites files — it does **NOT** remove old site files that aren't part
   of the new build. This must be checked and likely enabled before the
   migration, or old site cruft will sit alongside the new deploy indefinitely.

## One-time GAS setup (from `Code.gs` header)

1. Create the Sheet, create the Apps Script project, paste `Code.gs`.
2. Set project time zone to `America/Chicago`.
3. Run `setProperties()` once (stores `SPREADSHEET_ID` + `SCRIPT_URL`).
4. Run `setupSpreadsheet()` (creates the 11 tabs).
5. Deploy → Web App, **Execute as: Me**, **Access: Anyone (anonymous)**.
6. Run `setupTriggers()` (daily digest, weekly cold sweep, monthly summary, onEdit).
