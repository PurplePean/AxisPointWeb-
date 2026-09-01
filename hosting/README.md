# hosting — cPanel + Namecheap automation

A small, dependency-free library for read/write access to the hosting stack:

- **cPanel** (subdomains, redirects, file cleanup) via UAPI + API 2
- **Namecheap** (read DNS records) via the XML API

Same spirit as `scripts/gas-v2`: shared client(s) in `lib/`, thin runnable scripts
on top. Runs on plain `node` (repo requires Node >= 20) — no npm install needed.

> **Out of scope by design:** nothing here touches domain **registration,
> renewal, or transfer**. Those stay manual. Do not add scripts for them.

## NEVER MODIFY — Google email/verification DNS records

**Read this before running anything that writes.** These 8 DNS records must never
be changed, deleted, or touched under any circumstances, regardless of any other
hosting cleanup:

- 5x MX records (`ASPMX.L.GOOGLE.COM` + 4 alternates), powers `@axispoint.llc` email
- TXT `_dmarc`, DMARC policy
- TXT `google._domainkey`, DKIM signing
- TXT `@` (`v=spf1...`), SPF
- TXT `@` (`google-site-verification=...`), Search Console ownership

Nothing in this library writes DNS (Namecheap access here is read-only), so no
script can remove them by itself. The risk is a human editing the Namecheap
dashboard while cleaning up hosting records that a script has just listed.

## Hosting inventory (as of live scan via these scripts)

Server: `premium171.web-hosting.com`, IP `162.0.209.114`, cPanel account: `axisipak`

Current cPanel subdomains:

- `qr.axispoint.llc`, document root `/home/axisipak/qr.axispoint.llc` (correct final
  path, updated at cutover — see [GitHub issue #124](https://github.com/PurplePean/AxisPointWeb-/issues/124))
- `crm.axispoint.llc`, document root `/home/axisipak/crm.axispoint.llc`, OLD/STALE
  project, safe to wipe when reset

DNS records for `axispoint.llc`: 7 A records tied to hosting (all safe to
repoint/reuse during migration, no DNS changes needed, only file content
changes): `@`, `api`, `crm`, `qr`, `staging`, `www`, `www.crm`, all currently
point to `162.0.209.114`. Note: `api` and `staging` already have DNS A records
but **NO** corresponding cPanel subdomain/folder yet, DNS is pre-provisioned,
hosting is not.

## Setup

1. Copy the template and fill in real values:

   ```bash
   cp hosting/.env.example hosting/.env
   ```

2. `hosting/.env` is **gitignored** (root `.gitignore`) and must never be
   committed. No credentials are hardcoded anywhere in this library — every value
   is read from the environment at runtime.

### Getting the credentials

**cPanel** (`CPANEL_HOST`, `CPANEL_USERNAME`, `CPANEL_API_TOKEN`)
- `CPANEL_HOST` — your cPanel server hostname, no scheme/port (scripts add
  `:2083`). e.g. `serverXXX.web-hosting.com`.
- `CPANEL_API_TOKEN` — create in cPanel → **Security → Manage API Tokens**. Grant
  only the privileges these scripts use.
- Auth header sent on every call: `Authorization: cpanel {username}:{token}`.

**Namecheap** (`NAMECHEAP_API_USER`, `NAMECHEAP_API_KEY`, `NAMECHEAP_CLIENT_IP`)
- Enable at Namecheap → **Profile → Tools → Namecheap API Access**.
- Whitelist the IP you'll call from and set it as `NAMECHEAP_CLIENT_IP`
  (find it with `curl ifconfig.me`).
- `NAMECHEAP_USERNAME` is optional and defaults to `NAMECHEAP_API_USER`.

Related infra facts (GAS backend, FTP deploy secrets) live in
[`/docs/deployment.md`](../docs/deployment.md).

## First thing to run

Verify real access before trusting any write script:

```bash
node hosting/list-subdomains.js
```

If that prints your subdomains, your cPanel host/token/TLS are good.

## Scripts

### Read-only

| Command | What it does |
|---|---|
| `node hosting/list-subdomains.js` | Lists subdomains + document roots (cPanel API 2 `SubDomain::listsubdomains` — no UAPI equivalent). |
| `node hosting/list-dns.js [domain]` | Lists DNS records — type, host, value, TTL (Namecheap `domains.dns.getHosts`). Defaults to `axispoint.llc`. |

```bash
node hosting/list-dns.js
node hosting/list-dns.js example.com
```

### Write actions (require confirmation)

Every write prints exactly what it will do and then waits for confirmation:
pass `--yes` (or `-y`) to skip the prompt, otherwise type `yes` interactively.
With no TTY and no `--yes`, they fail closed and change nothing.

**`add-subdomain.js`** — create a subdomain (UAPI `SubDomain::addsubdomain`).

```bash
node hosting/add-subdomain.js <subdomain> [document-root] [--domain=axispoint.llc] [--yes]

# examples
node hosting/add-subdomain.js book
node hosting/add-subdomain.js book public_html/book --yes
```

**`add-redirect.js`** — create a redirect (UAPI `Redirects::add_redirect`).

```bash
node hosting/add-redirect.js <source-path> <destination-url> \
     [--domain=axispoint.llc] [--type=permanent|temporary] [--wildcard] [--yes]

# examples
node hosting/add-redirect.js /old-page https://axispoint.llc/new-page
node hosting/add-redirect.js / https://qr.axispoint.llc --type=temporary --yes
```

`type` maps to `permanent` (301) or `temporary` (302); default `permanent`.

**`clean-directory.js`** — delete the contents of a directory. **Always lists
what it found first**, then requires confirmation before deleting anything.

```bash
node hosting/clean-directory.js <target-path> [--yes]

# examples
node hosting/clean-directory.js public_html/staging
node hosting/clean-directory.js public_html/old-deploy --yes
```

Listing uses UAPI `Fileman::list_files`; deletion uses cPanel **API 2**
`Fileman::fileop` with `op=unlink` (there is no UAPI equivalent for deleting
files). `<target-path>` is relative to the account home, matching how the cPanel
File Manager shows paths.

## Library (`lib/`)

| File | Purpose |
|---|---|
| `lib/cpanel.js` | `uapi(module, func, params)` and `api2(module, func, params)` — build the `:2083` URL, attach the token header, parse JSON, throw clearly on error. |
| `lib/namecheap.js` | `call(command, params)` — attach the required auth/routing params, parse the XML, throw on `Status != OK`; plus `splitDomain()`. |
| `lib/env.js` | Loads `.env` (no `dotenv` dependency); `getEnv(name)` throws a clear message when a required var is missing. |
| `lib/table.js` | `printTable()` — aligned plain-text tables for the read commands. |
| `lib/confirm.js` | `confirm()` — the `--yes` / interactive `yes` gate used by every write script. |

## Notes / troubleshooting

- **TLS on port 2083:** if your cPanel server presents a self-signed cert you may
  see a TLS error. As a last resort you can prefix a command with
  `NODE_TLS_REJECT_UNAUTHORIZED=0` (disables cert verification for that run —
  understand the risk before using it).
- **`fileop`/`unlink` version differences:** deleting files is a cPanel API 2
  operation. If a future cPanel version changes this, adjust `clean-directory.js`
  and `lib/cpanel.js` together.
- **cPanel API 2 vs UAPI:** not every operation exists in UAPI. `SubDomain::listsubdomains`
  and `Fileman::fileop` are API 2 only and use the `api2()` helper; everything else
  uses `uapi()`. Don't assume a function exists in UAPI just because the module does.
- **Namecheap endpoint / debugging:** the Namecheap API path is `xml.response`
  (production), not `xml.api` or a sandbox host. A wrong path returns a generic
  HTML 404 instead of the usual XML error envelope. To see the exact request URL
  a Namecheap script builds (API key redacted), run it with `DEBUG=namecheap`,
  e.g. `DEBUG=namecheap node hosting/list-dns.js`.
- **Namecheap IP whitelist:** a valid-looking request can still fail if the IP in
  `NAMECHEAP_CLIENT_IP` doesn't exactly match a whitelisted IP under
  Namecheap > Profile > Tools > API Access. Confirm your current public IP
  (`curl ifconfig.me`) matches both `NAMECHEAP_CLIENT_IP` and the dashboard whitelist.
- **Live testing is manual:** these scripts were verified by code review against
  the cPanel UAPI / Namecheap XML API docs. Run `list-subdomains.js` and
  `list-dns.js` against a filled-in `.env` to confirm live access.
