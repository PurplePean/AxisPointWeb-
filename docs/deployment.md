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

## One-time GAS setup (from `Code.gs` header)

1. Create the Sheet, create the Apps Script project, paste `Code.gs`.
2. Set project time zone to `America/Chicago`.
3. Run `setProperties()` once (stores `SPREADSHEET_ID` + `SCRIPT_URL`).
4. Run `setupSpreadsheet()` (creates the 11 tabs).
5. Deploy → Web App, **Execute as: Me**, **Access: Anyone (anonymous)**.
6. Run `setupTriggers()` (daily digest, weekly cold sweep, monthly summary, onEdit).
