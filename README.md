# AxisPoint Partners Website

AxisPoint is a commercial property management firm in Texas. Property management is the
primary service and the primary intake pathway. Asset management is an optional layer above it,
and investor services is a separate, smaller pathway.

## Positioning and pathway model (V2)

The approved V2 design is the product and visual source of truth. Its shape:

- **Property Management is primary.** It leads the site, and "Request a Management Proposal" is
  the primary call to action. Its wording is locked, and it is the only filled element in the
  navigation.
- **Asset Management is an optional PM plus AM scope,** not a separate service line, role, or
  intake system. Selecting it enters the Management Proposal pathway with asset management
  interest recorded. It is engaged when the property calls for it, not sold as a default.
- **Investor Services is a separate, smaller pathway,** for capital ready clients entering
  Texas commercial real estate who want an operating team in place before the purchase rather
  than after it.

### Approved intake pathways

| Pathway | Shape | First interaction collects |
|---|---|---|
| Request a Management Proposal | Three short steps | Property type, scope, market, approximate scale, situation, timing, then name and email |
| Asset Management | One screen, PM plus AM intent variant | Topic, name, email, optional note. Continues down the Management Proposal pathway |
| Investor Services | One screen | Stage in the process, name, email, optional note |
| General inquiry | One screen | Subject, name, email, message |
| Referral Partner | One screen, existing | Carried forward untouched. **Deferred** |
| Submit a Referral | One screen, existing | Carried forward untouched. **Deferred** |

Booking is optional and is reached only after the inquiry has been sent, so an abandoned
calendar still leaves a lead. No pathway asks for documents; the secure document request is a
separate post qualification step, not a step of the form.

The site is designed for global localization across nine approved languages. Final translations
and per language launch approval are separate from design system approval, and languages can
launch independently.

### Status of the code against that model

**The current `apps/web`, `apps/qr`, and `packages/brand` code predates the approved V2 design.**
It contains V1 behavior plus an early, now superseded V2 frontend attempt. The V2 public
frontend, intake, and QR surfaces are being rebuilt from the approved design package rather
than evolved from what is here. Existing code is reference material and is not approved merely
because it exists.

Start at [`docs/design-sources.md`](docs/design-sources.md) for the authoritative design files,
and [`docs/STATUS.md`](docs/STATUS.md) for what pass the work is on.

## Project structure

This is a pnpm monorepo:

- **apps/web** — main website (axispoint.llc)
- **apps/qr** — QR digital card microsite (qr.axispoint.llc)
- **packages/brand** — shared brand tokens, team data, types, and the shared contact form
- **content/** — markdown scaffold, currently empty
- **scripts/gas/** — V1 Google Apps Script backend (`Code.gs`) and email template mirrors. **Deployed**
- **scripts/gas-v2/** — V2 Apps Script backend, written and tested but connected to nothing: no project, Sheet, trigger, or deployment
- **scripts/hosting/** — cPanel and Namecheap automation for the hosting stack
- **docs/** — verified source of truth documentation

## Documentation map

| File | Owns |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The operating standard: git workflow, auto-merge, verification, copy and brand standards |
| [`AGENTS.md`](AGENTS.md) | A pointer to CLAUDE.md. Deliberately not a second rulebook |
| [`docs/design-sources.md`](docs/design-sources.md) | Approved design package, authoritative files, photography licence ledger |
| [`docs/STATUS.md`](docs/STATUS.md) | Current pass, open owner decisions, deployment state, rollback anchors |
| [`docs/branching.md`](docs/branching.md) | Branching, merging, and what "going live" actually means |
| [`docs/deployment.md`](docs/deployment.md) | Deployment IDs, `clasp push` vs `clasp deploy`, hosting inventory |
| [`docs/backend-architecture.md`](docs/backend-architecture.md) | V1 `Code.gs` function map, lead model, schema |
| [`docs/backend-v2-contract.md`](docs/backend-v2-contract.md) | V2 wire contract (`schemaVersion` 1), tokens, error codes, delivery guarantee |
| [`docs/frontend-payload-schemas.md`](docs/frontend-payload-schemas.md) | Exact payload shape per lead type |
| [`docs/email-templates.md`](docs/email-templates.md) | Template inventory and the embedded constant vs mirror file pattern |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Dated log of architecture level changes |

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0

```bash
npm install -g pnpm
pnpm install
```

## Development

The frontend talks to a real backend only when you deliberately opt in. This is enforced in
each app's `vite.config.ts` and consumed through an injected `__FORM_ENDPOINT__` define, so a
stray endpoint in your shell or a generic `.env` file cannot leak into a dev build.

The two apps read different variables on purpose: `apps/web` reads
`VITE_V2_SUBMISSION_ENDPOINT` (V2), `apps/qr` reads `VITE_FORM_ENDPOINT` (V1). They speak
different payload shapes, so the V2 intake never falls back to the V1 name.

| Command | Apps | Guarantee |
|---|---|---|
| `pnpm dev` | web + qr | **The real endpoint is ignored from every source.** The contact form runs its simulated success fallback. No request reaches the real backend |
| `pnpm dev:web` / `pnpm dev:qr` | one app | Same guarantee, single app |
| `pnpm dev:e2e` | web + qr | Loads the real production endpoint **only** from `.env.e2e.local`. A missing file or value is a **hard failure**, never a silent fallback. Prints a loud terminal warning and shows a fixed in app red banner |
| `pnpm dev:e2e:web` / `pnpm dev:e2e:qr` | one app | Same as `dev:e2e`, single app |

`.env.e2e.local` is machine local and gitignored. Each machine needs its own copy, created from
the tracked `.env.e2e.example` placeholder. Its real value is never committed or printed.

Do not run a dev server in the same terminal tab as an agent session; starting the session
interrupts whatever is running there.

## Scripts reference

| Command | Description |
|---|---|
| `pnpm dev` | All apps, simulated submissions only |
| `pnpm dev:web` / `pnpm dev:qr` | One app, simulated submissions only |
| `pnpm dev:e2e` | All apps against the **real** backend |
| `pnpm dev:e2e:web` / `pnpm dev:e2e:qr` | One app against the **real** backend |
| `pnpm build` | Build all apps |
| `pnpm build:web` / `pnpm build:qr` | Build one app |
| `pnpm type-check` | TypeScript across the workspace |
| `pnpm lint` | ESLint. Currently only `apps/web` defines a lint script |
| `pnpm format` | Prettier |
| `pnpm test:gas` | Run the V1 Apps Script backend test suite (Node's built in runner, no install step) |
| `pnpm test:gas-v2` | Run the V2 Apps Script backend test suite |
| `pnpm gas:push` | `clasp push`. Updates the Apps Script project HEAD. **Not a deployment** |

## Testing

`pnpm test:gas` runs the committed backend suite under `scripts/gas/tests/`. Apps Script cannot
run outside its own runtime, but the pure logic (routing, payload transforms, template
rendering, Sheet writes against a fake Sheets harness) is tested in Node with GAS globals
stubbed out. Prefer this over reasoning about backend changes abstractly.

The suite also enforces template parity: every embedded `TEMPLATE_*` constant in `Code.gs` must
match its mirror file under `scripts/gas/emails/`. Those two copies must be edited together, and
this test is what catches it when they are not.

`pnpm test:gas-v2` runs the V2 suite under `scripts/gas-v2/tests/`. It loads every `src/*.js`
file into one VM context supplied with only the globals Apps Script provides, reproducing the
single shared global scope of the real runtime. A Node dependency creeping into V2 source fails
there rather than after a push.

CI runs type-check, lint, both app builds, and both GAS suites as separate steps, so a failure
names which backend broke.

## Deployment status

**Read this before claiming anything is live.**

| Surface | Status |
|---|---|
| **Google Apps Script backend (V1)** | **Deployed.** Production version @28, serving the current live sites |
| **This repository's frontend** | **Has never successfully deployed through GitHub Actions.** The two FTP workflows fail at the FTP step because the FTP secrets are not configured |
| **Live public sites** | A separate, older, hand uploaded build, unrelated to this repository's git history |
| **V2 backend** | Does not exist yet |

**Merging to `main` deploys nothing.** It is not a release and not a staging promotion.
Going live for the frontend is a future configuration decision (adding the FTP secrets), not a
git action. Note that once those secrets exist, every push to `main` would deploy immediately
with no approval gate, so the gate question has to be settled first. See
[`docs/branching.md`](docs/branching.md).

### Apps Script: push and deploy are two different things

```bash
pnpm gas:push                              # updates project HEAD, can affect installed triggers
cd scripts/gas && clasp deploy -i <prod-id>  # repoints the live /exec endpoint. THIS is the release
```

A backend task is **done** when the code is written, tested, committed, and merged. Neither
command is part of "done". Run them only when you actually intend to change the running
backend. The deployment ID and the full mechanics are in
[`docs/deployment.md`](docs/deployment.md).

If a `clasp` command fails with `invalid_grant` or `invalid_rapt`, that is routine Google
reauth friction, not a broken script. Re-run `clasp login`, then re-run the command.

## Backend overview

The form backend is `scripts/gas/Code.gs`, deployed as a Web App (execute as: me, access:
anyone). It runs on a unified lead schema (`USE_UNIFIED_SCHEMA = true`), which persists the full
collected detail set per lead type into a `Details` JSON blob.

Key behaviors, documented in full in
[`docs/backend-architecture.md`](docs/backend-architecture.md):

- **Lead IDs** — `AXP-YYYY-XXXX`, sequential, incremented atomically under a script lock
- **Referral codes** — `AXP-` plus 6 unambiguous characters, collision checked
- **Deduplication** — by email, case insensitive. A match updates the existing row, appends a
  resubmission note, notifies partners, and returns the original lead ID. No duplicate row is
  created
- **Concurrency** — `LockService` guards the submission path, resubmissions, and ID generation.
  A resubmission racing the cold sweep is refused rather than writing partially
- **Header safe writes** — rows are appended by column name, so a reordered live header still
  receives correct values, extra human added columns are preserved, and a header missing a
  required column refuses the write rather than guessing
- **Scheduled triggers** — daily digest, weekly cold lead sweep, monthly referral summaries,
  and an onEdit sync

## Brand standards

- Both partners are titled **Partner** only
- **No LinkedIn or social links** anywhere
- **No headshots**
- No em dashes in user facing copy
- Tone is direct, confident, and specific. Concrete claims over generic marketing language
- Brand colors, fonts, and visual patterns live in `packages/brand`. Read the source rather than
  guessing at values

## License

Private. All rights reserved by AxisPoint Partners LLC.
