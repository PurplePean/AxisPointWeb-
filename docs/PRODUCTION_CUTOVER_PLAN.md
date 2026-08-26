# Production Cutover Plan

**Created:** 2026-08-26  
**Status:** authoritative — supersedes fragmented planning content listed in §7

This is the single source of truth for the production hosting cutover from the current
hand-uploaded site to the V2 build. All prior fragmented hosting-planning content is
superseded (§7). When this document and any other file disagree on a hosting decision,
this document wins.

---

## 1. Current-state inventory

### Hosting account

| Item | Value |
|---|---|
| Server hostname | `premium171.web-hosting.com` |
| Server IP | `162.0.209.114` |
| cPanel account | `axisipak` |
| Account home | `/home/axisipak/` |

### Current cPanel structure

| Path | Served at | State |
|---|---|---|
| `public_html/` | `axispoint.llc`, `www.axispoint.llc` | Current production — hand-uploaded, not from this repo |
| `public_html/qr/` (nested) | `qr.axispoint.llc` (cPanel doc root: `/home/axisipak/public_html/qr`) | Old QR placement. Causes side-door at `axispoint.llc/qr`. Must move at cutover |
| `crm.axispoint.llc/` | `crm.axispoint.llc` (cPanel doc root: `/home/axisipak/crm.axispoint.llc`) | Stale project. Safe to wipe |
| (none) | `api.axispoint.llc` | DNS A record exists, no cPanel subdomain or folder yet |
| (none) | `staging.axispoint.llc` | DNS A record exists, no cPanel subdomain or folder yet |

### DNS records for `axispoint.llc` (Namecheap)

7 A records all currently point to `162.0.209.114`:

| Host | Type | Value |
|---|---|---|
| `@` | A | `162.0.209.114` |
| `www` | A | `162.0.209.114` |
| `qr` | A | `162.0.209.114` |
| `crm` | A | `162.0.209.114` |
| `api` | A | `162.0.209.114` |
| `staging` | A | `162.0.209.114` |
| `www.crm` | A | `162.0.209.114` |

**8 Google email/verification records must never be changed under any circumstances:**
5 MX records (`ASPMX.L.GOOGLE.COM` + 4 alternates), TXT `_dmarc`, TXT `google._domainkey`,
TXT `@` SPF (`v=spf1…`), TXT `@` `google-site-verification`. See `hosting/README.md`.

### Current deploy pipeline state

Both workflows now pass `VITE_V2_SUBMISSION_ENDPOINT` (fixed in PR #122). Neither has
ever successfully deployed — the FTP secrets are not configured in the repository.
`dangerous-clean-slate` is now set in both workflows (added in this PR). Details in §4.

---

## 2. Target structure — final clean-slate state

**This is a full replacement.** The current hand-uploaded site is retired entirely.
No hybrid, no coexistence with what currently exists.

| Location (on server) | Served at | Purpose | Action at cutover |
|---|---|---|---|
| `public_html/` | `axispoint.llc`, `www.axispoint.llc` | V2 main site (`apps/web` build) | `dangerous-clean-slate` deploy wipes old content and writes V2 build |
| `qr.axispoint.llc/` (top-level sibling) | `qr.axispoint.llc` | V2 QR Contact Exchange (`apps/qr` build) | Create folder; update cPanel doc root; deploy V2 build |
| `crm.axispoint.llc/` | `crm.axispoint.llc` | Empty — reserved for future dashboard | Wipe content; leave empty |
| (not created) | `api.axispoint.llc` | Future system; DNS pre-pointed | No action — do not provision until system exists |
| (not created) | `staging.axispoint.llc` | Future system; DNS pre-pointed | No action — do not provision until system exists |

### QR path decision — resolved definitively

**The final QR server path is `./qr.axispoint.llc/`, mapping to
`/home/axisipak/qr.axispoint.llc/` on disk. `deploy-qr.yml` targets this path.
The cPanel subdomain document root must be updated to match at cutover.**

This was a deliberate decision, not a default. Reasoning:

1. **Side-door closed.** When the document root is nested at
   `/home/axisipak/public_html/qr`, the QR app's files are reachable at
   `axispoint.llc/qr` — an unintentional path into a separate app, served by the
   wrong host with the wrong `<title>`, canonical, and meta tags. Moving to a
   top-level sibling closes it permanently.

2. **Architecture is consistent.** The correct cPanel model for subdomains is one
   top-level sibling per subdomain (e.g. `crm.axispoint.llc/` already lives at
   `/home/axisipak/crm.axispoint.llc/`). Standardizing here means every subdomain
   has the same predictable layout.

3. **The workflow targets the destination, not the current state.** The FTP workflow
   should reflect where files should end up, not where they happen to sit right now.
   Changing the workflow path to match cPanel's current (wrong) layout would mean
   changing it again when cPanel is updated — two changes for one decision. One
   change to cPanel's document root setting at cutover aligns everything permanently.

The prior commit on this branch (PR #122) set `server-dir: ./public_html/qr/` with
the stated reason "to match the actual cPanel document root." That reasoning was
wrong: it matched today's state, not the final target. This PR reverts that change
and documents the decision here so it is not relitigated again.

---

## 3. Vite build output and deploy mapping

Both apps use `build.outDir: 'dist'`. A production build produces a flat SPA output:

| App | Build command | Output dir | FTP `local-dir` | FTP `server-dir` |
|---|---|---|---|---|
| `apps/web` | `pnpm --filter @axispoint/web run build` | `apps/web/dist/` | `./apps/web/dist/` | `./public_html/` |
| `apps/qr` | `pnpm --filter @axispoint/qr run build` | `apps/qr/dist/` | `./apps/qr/dist/` | `./qr.axispoint.llc/` |

Each `dist/` contains:
- `index.html` — SPA entry point
- `assets/` — Vite-hashed JS/CSS chunks
- `favicon.svg`
- `apps/web` only: `images/` (including `logo-email.png` and `logo-signature.svg`)

### SPA rewrite (.htaccess) — required before first deploy

Neither app ships an `.htaccess` file. Without one, Apache returns 404 for any URL
that doesn't correspond to a physical file — this breaks hard refresh, direct links,
and every locale-prefixed route in `apps/web` (`/es/contact`, etc.).

**Action required before the first deploy:** add a `.htaccess` to
`apps/web/public/` and `apps/qr/public/` with the standard Apache SPA fallback:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

Files in `public/` are copied verbatim into `dist/` by Vite and deployed by the FTP
action. This is a tracked code change; no host-side action is required once it lands.

### Locale routing

`apps/web` has locale-prefixed routes (`/es/`, `/zh/`, etc.) handled entirely by
React Router. Once `.htaccess` is in place, Apache returns `index.html` for all
paths, and React Router reads the path and renders the correct locale. No additional
Apache configuration is needed. Eight of nine locale catalogs remain disabled pending
fluent review; the SPA rewrite does not change that boundary.

---

## 4. CI/CD configuration — final state

### Workflow file status after this PR

| File | Build env variable | FTP `server-dir` | `dangerous-clean-slate` |
|---|---|---|---|
| `deploy-web.yml` | `VITE_V2_SUBMISSION_ENDPOINT` ✓ | `./public_html/` ✓ | `true` ✓ |
| `deploy-qr.yml` | `VITE_V2_SUBMISSION_ENDPOINT` ✓ | `./qr.axispoint.llc/` ✓ | `true` ✓ |

Both workflows are now correctly configured for the final clean-slate target. No further
workflow edits are required. The only remaining blocker is adding the GitHub secrets.

### `dangerous-clean-slate: true` — why this is the right call

This option makes each FTP deploy a true mirror: files present on the server but absent
from the build output are deleted. For a clean-slate cutover, this means the current
hand-uploaded site's files are removed automatically on first deploy — no separate
manual wipe step needed. For all subsequent deploys, the server always matches the build
output exactly, with no stale files accumulating.

This is a deliberate architectural choice. Without it, files from the current site
would sit alongside the V2 build indefinitely. With it, the first deploy completes the
cutover and every future deploy maintains a clean mirror state.

### Complete, final GitHub secrets

These 7 secrets are the complete set required. Nothing beyond this list needs to be
added.

| Secret name | Used by | Purpose |
|---|---|---|
| `V2_SUBMISSION_ENDPOINT` | both workflows | The V2 GAS Web App `/exec` URL. Set this when the V2 backend is deployed to production. In the meantime it can be set to the staging endpoint for a verified end-to-end test before launch. |
| `FTP_SERVER` | `deploy-web.yml` | FTP hostname for the cPanel account (same physical server as `FTP_SERVER_QR`) |
| `FTP_USERNAME` | `deploy-web.yml` | FTP username for the cPanel account |
| `FTP_PASSWORD` | `deploy-web.yml` | FTP password for the cPanel account |
| `FTP_SERVER_QR` | `deploy-qr.yml` | FTP hostname (same server; a separate secret slot for future flexibility) |
| `FTP_USERNAME_QR` | `deploy-qr.yml` | FTP username (likely same credentials as the main site — one cPanel account, all paths reachable) |
| `FTP_PASSWORD_QR` | `deploy-qr.yml` | FTP password (likely same as main site) |

The legacy `FORM_ENDPOINT` secret (V1, now unused since PR #122) should be removed
from the repository secrets. It is no longer referenced by any workflow.

**No other owner action is required beyond adding these secrets.**

---

## 5. Complete cutover procedure

Execute steps in order. Do not start step 6 until steps 1–5 are complete.

### Pre-cutover code changes (before adding secrets)

These tracked changes must land in `main` before the FTP secrets are added:

- [x] **Fix both deploy workflows** — `VITE_V2_SUBMISSION_ENDPOINT` variable and
      `V2_SUBMISSION_ENDPOINT` secret (done, PR #122). QR `server-dir` corrected to
      `./qr.axispoint.llc/` and `dangerous-clean-slate: true` added (done, this PR).
- [ ] **Add `.htaccess` to both `public/` directories** — `apps/web/public/.htaccess`
      and `apps/qr/public/.htaccess` with the SPA rewrite content above. This is a
      separate PR.

### Owner actions at cutover

**Step 1 — Verify code readiness.**
Confirm both workflow pre-cutover items above are merged. Confirm CI is green on the
tip of `main`.

**Step 2 — Back up the current live site.**
Download the full `public_html/` directory via cPanel File Manager or FTP. This is the
only copy of the current hand-uploaded site. Keep it locally until the V2 site is
verified live.

**Step 3 — Update the QR subdomain document root.**
In cPanel → Domains → Subdomains, edit `qr.axispoint.llc`'s document root from
`/home/axisipak/public_html/qr` to `/home/axisipak/qr.axispoint.llc`. cPanel creates
the folder automatically if it does not exist. Alternatively, use the hosting scripts:

```bash
node hosting/add-subdomain.js qr /home/axisipak/qr.axispoint.llc --yes
```

Verify with `node hosting/list-subdomains.js` that the document root has changed.

**Step 4 — Wipe `crm.axispoint.llc` content.**

```bash
node hosting/clean-directory.js crm.axispoint.llc
```

Review what it reports before confirming.

**Step 5 — Add GitHub secrets.**
In GitHub → repository Settings → Secrets and variables → Actions, add the 7 secrets
from the table in §4. Remove the legacy `FORM_ENDPOINT` secret.

**Step 6 — Trigger the deploy.**
Push a commit to `main` (or manually trigger both workflows via Actions → Run workflow).
Both `deploy-web.yml` and `deploy-qr.yml` fire on every push to `main`.

**Step 7 — Verify the pipeline in GitHub Actions.**
Confirm both workflow runs complete with all steps green:
- Build step must succeed (the endpoint variable will be present in the build log).
- FTP step must show files uploaded, not the `Input required and not supplied: server`
  error. With `dangerous-clean-slate: true`, it will also log files being removed from
  the server — the old hand-uploaded site files being deleted.

**Step 8 — Verify the live sites.**

| Check | Expected result |
|---|---|
| `https://axispoint.llc` | V2 main site loads |
| `https://www.axispoint.llc` | Same as above |
| `https://axispoint.llc/contact` (hard refresh) | App loads (not 404), confirming `.htaccess` is active |
| `https://qr.axispoint.llc` | V2 QR Contact Exchange loads |
| Submit a contact form | Submission reaches the V2 backend; confirmation email delivered |
| Save contact on QR page | Both Save buttons deliver a single-record `.vcf` |

**Step 9 — Complete staging provisioning.**
Set the remaining 10 Script Properties (`AXP_SHEET_ID`, `AXP_PARTNER_NOTIFY_TO`, etc.)
and install the three time-driven triggers. See `docs/staging-provisioning.md`.
Set `AXP_LOGO_URL` to `https://axispoint.llc/images/logo-email.png` once the main
site is live, so the email header logo resolves.

---

## 6. DNS confirmation

**No DNS record changes are required anywhere in this plan.**

All A records (`@`, `www`, `qr`, `crm`, `api`, `staging`, `www.crm`) point to
`162.0.209.114` — the same server that will serve V2. Changing cPanel document roots
and uploading files via FTP takes effect immediately without touching DNS.

The 8 Google email/verification records must never be changed under any circumstances.
See §1 and `hosting/README.md` for the exact record list.

---

## 7. Superseded documents

This plan supersedes the following. Do not consult them for hosting decisions after
this document exists.

| Superseded content | Location | Status |
|---|---|---|
| "Production migration plan" section | `docs/deployment.md` | Superseded in full. That section's five-step list, the mirror-delete open question, and the placeholder "go live" language are all resolved here. |
| GitHub secrets table | `docs/deployment.md` § "GitHub secrets (names only)" | Superseded by §4 above. The `FORM_ENDPOINT` row is removed; `V2_SUBMISSION_ENDPOINT` is the correct name. |
| QR document root risk item | `docs/STATUS.md` § 5 | Resolved and documented in §2 above. Remove from the STATUS.md risk table. |
| "Fix the deploy path as one change" next-work item | `docs/STATUS.md` § 7 | Completed by PRs #122 and this PR. Remove from next-planned-work. |

No file named `docs/hosting-migration-plan.md` exists in this repository.

---

## Appendix: what does NOT change

- No DNS records change.
- No Google email records are touched.
- `api.axispoint.llc` and `staging.axispoint.llc` get no cPanel subdomains or folders.
- The V1 external Apps Script project is not touched; its disposition is a separate
  owner decision.
- No `.clasp.json` or GAS deployment changes are part of this cutover.
- Merging this plan to `main` deploys nothing. The FTP secrets trigger the actual deploy.
