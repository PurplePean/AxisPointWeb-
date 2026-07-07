# scripts/hosting — cPanel + Namecheap automation

A small, dependency-free library for read/write access to the hosting stack:

- **cPanel** (subdomains, redirects, file cleanup) via UAPI + API 2
- **Namecheap** (read DNS records) via the XML API

Same spirit as `scripts/gas`: shared client(s) in `lib/`, thin runnable scripts
on top. Runs on plain `node` (repo requires Node >= 20) — no npm install needed.

> **Out of scope by design:** nothing here touches domain **registration,
> renewal, or transfer**. Those stay manual. Do not add scripts for them.

## Setup

1. Copy the template and fill in real values:

   ```bash
   cp scripts/hosting/.env.example scripts/hosting/.env
   ```

2. `scripts/hosting/.env` is **gitignored** (root `.gitignore`) and must never be
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
[`/docs/deployment.md`](../../docs/deployment.md).

## First thing to run

Verify real access before trusting any write script:

```bash
node scripts/hosting/list-subdomains.js
```

If that prints your subdomains, your cPanel host/token/TLS are good.

## Scripts

### Read-only

| Command | What it does |
|---|---|
| `node scripts/hosting/list-subdomains.js` | Lists subdomains + document roots (cPanel API 2 `SubDomain::listsubdomains` — no UAPI equivalent). |
| `node scripts/hosting/list-dns.js [domain]` | Lists DNS records — type, host, value, TTL (Namecheap `domains.dns.getHosts`). Defaults to `axispoint.llc`. |

```bash
node scripts/hosting/list-dns.js
node scripts/hosting/list-dns.js example.com
```

### Write actions (require confirmation)

Every write prints exactly what it will do and then waits for confirmation:
pass `--yes` (or `-y`) to skip the prompt, otherwise type `yes` interactively.
With no TTY and no `--yes`, they fail closed and change nothing.

**`add-subdomain.js`** — create a subdomain (UAPI `SubDomain::addsubdomain`).

```bash
node scripts/hosting/add-subdomain.js <subdomain> [document-root] [--domain=axispoint.llc] [--yes]

# examples
node scripts/hosting/add-subdomain.js book
node scripts/hosting/add-subdomain.js book public_html/book --yes
```

**`add-redirect.js`** — create a redirect (UAPI `Redirects::add_redirect`).

```bash
node scripts/hosting/add-redirect.js <source-path> <destination-url> \
     [--domain=axispoint.llc] [--type=permanent|temporary] [--wildcard] [--yes]

# examples
node scripts/hosting/add-redirect.js /old-page https://axispoint.llc/new-page
node scripts/hosting/add-redirect.js / https://qr.axispoint.llc --type=temporary --yes
```

`type` maps to `permanent` (301) or `temporary` (302); default `permanent`.

**`clean-directory.js`** — delete the contents of a directory. **Always lists
what it found first**, then requires confirmation before deleting anything.

```bash
node scripts/hosting/clean-directory.js <target-path> [--yes]

# examples
node scripts/hosting/clean-directory.js public_html/staging
node scripts/hosting/clean-directory.js public_html/old-deploy --yes
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
  e.g. `DEBUG=namecheap node scripts/hosting/list-dns.js`.
- **Namecheap IP whitelist:** a valid-looking request can still fail if the IP in
  `NAMECHEAP_CLIENT_IP` doesn't exactly match a whitelisted IP under
  Namecheap > Profile > Tools > API Access. Confirm your current public IP
  (`curl ifconfig.me`) matches both `NAMECHEAP_CLIENT_IP` and the dashboard whitelist.
- **Live testing is manual:** these scripts were verified by code review against
  the cPanel UAPI / Namecheap XML API docs. Run `list-subdomains.js` and
  `list-dns.js` against a filled-in `.env` to confirm live access.
