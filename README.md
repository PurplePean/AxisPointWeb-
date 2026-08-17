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

**The V2 rebuild is implemented.** Site chrome, the five marketing pages, the contact intake,
validation, submission states, booking, and locale routing are all built from the approved
design package, across nine locale catalogs, through PR #78. English is the only reviewed and
enabled language; the other eight are complete as review candidates and are disabled until a
fluent reader signs each one off.

This section previously said the opposite: that the current code predated the approved design
and was still being rebuilt from it. That was accurate when it was written and went stale
without being updated, which is precisely the drift
[`docs/system-classification.md`](docs/system-classification.md) now exists to prevent.

What is built is not the same as what is launched. Nothing here is deployed, and the V2 backend
has not been provisioned. See **Deployment status** below.

Start at [`docs/system-classification.md`](docs/system-classification.md) for what is current,
retired, transitional, or external; [`docs/design-sources.md`](docs/design-sources.md) for the
authoritative design files; and [`docs/STATUS.md`](docs/STATUS.md) for what pass the work is on.

## Project structure

This is a pnpm monorepo. **[`docs/system-classification.md`](docs/system-classification.md) is
the source of truth for what each of these is;** the notes here are orientation only and must
not be extended into a competing copy of that classification.

- **apps/web** — main website. Current V2, built from the approved design package
- **apps/qr** — QR Contact Exchange microsite. **Transitional:** rewritten during the V2 passes
  onto the shared submission client and the V2 backend contract, but on a legacy scaffold, and
  larger than the digital contact card AxisPoint intends to operate long term. It is not part
  of V1 retirement and is not deleted with it
- **packages/brand** — shared brand primitives: `Mark`, `E2eBanner`, the Tailwind preset,
  `colors.ts`, `fonts.ts`. That is now the whole package; the V1 form tree it used to hold was
  deleted on 2026-08-15
- **packages/submission-client** — the single frontend transport boundary for V2 submissions
- **hosting/** — cPanel and Namecheap automation for the hosting stack, plus the live hosting
  inventory and the never-modify DNS records
- **scripts/gas-v2/** — V2 Apps Script backend, written and tested but connected to nothing: no
  project, Sheet, trigger, or deployment
- **scripts/test/** — shared test harnesses, including the production-bundle inspector
- **docs/** — verified source of truth documentation

## Documentation map

| File | Owns |
|---|---|
| [`docs/system-classification.md`](docs/system-classification.md) | **What is current V2, retired V1, transitional QR, or an external system.** Every other file points here rather than keeping its own copy |
| [`CLAUDE.md`](CLAUDE.md) | The operating standard: git workflow, auto-merge, verification, copy and brand standards |
| [`AGENTS.md`](AGENTS.md) | A pointer to CLAUDE.md. Deliberately not a second rulebook |
| [`docs/design-sources.md`](docs/design-sources.md) | Approved design package, authoritative files, photography licence ledger |
| [`docs/STATUS.md`](docs/STATUS.md) | Current pass, open owner decisions, deployment state, rollback anchors |
| [`docs/branching.md`](docs/branching.md) | Branching, merging, and what "going live" actually means |
| [`docs/deployment.md`](docs/deployment.md) | `clasp push` vs `clasp deploy`, provisioning checklists, hosting inventory. **Not deployment identifiers** — V1's exist only at the `pre-v1-retirement-2026-08-14` tag, and V2 has none |
| [`docs/backend-v2-contract.md`](docs/backend-v2-contract.md) | V2 wire contract (`schemaVersion` 1), tokens, error codes, delivery guarantee. **This is the backend document** |
| [`docs/PARTNER_CONTACTS.md`](docs/PARTNER_CONTACTS.md) | Owner confirmed current partner email and phone values |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Dated log of architecture level changes |
| [`docs/archive/`](docs/archive/) | V1 documents, kept as history only. Every file there carries a banner saying so |

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

**Both apps read `VITE_V2_SUBMISSION_ENDPOINT`.** `apps/qr` has done so since PR #70, when the
Contact Exchange moved onto the V2 `contact_exchange` envelope. This section used to claim that
`apps/qr` read the V1 `VITE_FORM_ENDPOINT`; it does not, and
[`apps/qr/vite.endpoint.ts`](apps/qr/vite.endpoint.ts) is the file that settles it.

`VITE_FORM_ENDPOINT` names the retired V1 deployment, which speaks a different payload shape. It
is still recognised by both resolvers for one reason: so a lone V1 value in e2e mode produces a
hard error that names the mistake, instead of a silent default that would post V2 envelopes at a
V1 backend and read as a backend bug.

| Command | Apps | Guarantee |
|---|---|---|
| `pnpm dev` | web + qr | **The real endpoint is ignored from every source.** The shared submission client runs its simulator. No request reaches a real backend |
| `pnpm dev:web` / `pnpm dev:qr` | one app | Same guarantee, single app |
| `pnpm dev:e2e` | web + qr | Loads the real production endpoint **only** from `.env.e2e.local`. A missing file or value is a **hard failure**, never a silent fallback. Prints a loud terminal warning and shows a fixed in app red banner in **both** apps |
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
| `pnpm lint` | ESLint across all four packages |
| `pnpm format` | Prettier |
| `pnpm test:frontend` | The full frontend suite: submission client, web, QR |
| `pnpm test:client` / `pnpm test:web` / `pnpm test:qr` | One suite at a time |
| `pnpm test:gas-v2` | Run the Apps Script backend test suite (Node's built in runner, no install step) |
| `pnpm verify:baseline` | Compare every route's rendered English against the committed snapshot |
| `pnpm verify:aria` | Assert the chrome's translated `aria-label`s off a real render |
| `pnpm verify:intake-states` | Drive 20 intake, submission, and booking states in a headless browser. Starts and stops its own dev server; set `CHROME_PATH` to choose a binary |
| `pnpm verify:bundle` | Inspect `apps/web/dist` after a build. For QR: `node scripts/test/inspect-bundle.mjs apps/qr/dist` |
| `pnpm baseline:write` | Rewrite the route baseline. Review the diff |

## Testing

`pnpm test:frontend` runs the 246 frontend tests: the shared submission client's wire contract
and transport, the web app's catalog, routing, intake, booking, and unicode coverage, and the QR
app's endpoint resolution, exchange mapping, and e2e banner. They run under Node's built in
runner with `--experimental-strip-types`, which needs Node 22.6 or newer.

Node's type stripping erases types but does not transform JSX, so a `.tsx` file cannot be
imported by a test directly. Anything that has to render a component uses Vite's programmatic
SSR API instead, compiled through the same `@vitejs/plugin-react` pipeline the apps build with.
`apps/web/tests/render-baseline.mjs` and `apps/qr/tests/e2eBanner.test.ts` are the two examples
to copy from.

`pnpm test:gas-v2` runs the backend suite under `scripts/gas-v2/tests/`. Apps Script cannot run
outside its own runtime, but the pure logic (routing, payload transforms, template rendering,
Sheet writes against a fake Sheets harness) is tested in Node with GAS globals stubbed out.
Prefer this over reasoning about backend changes abstractly.

It walks `scripts/gas-v2/src` recursively and loads every `.js` file into one VM context supplied
with only the globals Apps Script provides, reproducing the single shared global scope of the
real runtime. A Node dependency
creeping into backend source fails there rather than after a push.

There was a second suite covering the V1 backend. It was deleted with V1 on 2026-08-15 and is
at the `v1-stable` tag.

### What CI actually runs

`ci.yml` has three jobs, so a failure names what broke:

| Job | Gates |
|---|---|
| **Type-check, lint & build** | `pnpm type-check`, `pnpm lint` across four packages, both production builds, and `inspect-bundle.mjs` against each `dist` |
| **Frontend tests** | `pnpm test:frontend` |
| **Rendered baselines and assertions** | `verify:baseline`, `verify:aria`, `verify:intake-states` |

`test-gas.yml` runs the Apps Script suite. It ran two until V1 retirement removed the first.

Several of these gates existed as local scripts for passes before any workflow ran them: the
frontend suite, the bundle inspector, the rendered baselines, and the intake-state harness were
all committed and green on somebody's laptop while CI checked only type-check, lint on one
package, and two builds. A gate that is not in a workflow proves nothing about anybody else's
commit. If you add one, add it to `.github/workflows/ci.yml` in the same PR.

## Deployment status

**Read this before claiming anything is live.**

| Surface | Status |
|---|---|
| **Google Apps Script backend (V1)** | **Retired, and deleted from this repository on 2026-08-15.** Historically deployed at production version @28; it was already not serving current business traffic when its source was removed. The external Apps Script project is untouched by anything in this repository. Record: [`docs/archive/deployment-v1.md`](docs/archive/deployment-v1.md) |
| **This repository's frontend** | **Has never successfully deployed through GitHub Actions.** The two FTP workflows fail at the FTP step because the FTP secrets are not configured |
| **Live public sites** | A separate, older, hand uploaded build, unrelated to this repository's git history |
| **V2 backend** | Written and tested. No Apps Script project, Sheet, Script Properties, triggers, or deployment exist |

**Merging to `main` deploys nothing.** It is not a release and not a staging promotion.
Going live for the frontend is a future configuration decision (adding the FTP secrets), not a
git action. Note that once those secrets exist, every push to `main` would deploy immediately
with no approval gate, so the gate question has to be settled first. See
[`docs/branching.md`](docs/branching.md).

### Apps Script: push and deploy are two different things

```bash
cd scripts/gas-v2 && clasp push              # updates project HEAD, can affect installed triggers
cd scripts/gas-v2 && clasp deploy -i <prod-id>  # repoints the live /exec endpoint. THIS is the release
```

Neither is runnable today: the V2 Apps Script project does not exist yet. The root-level push
shortcut that used to sit here pointed at V1 and was removed with it.

A backend task is **done** when the code is written, tested, committed, and merged. Neither
command is part of "done". Run them only when you actually intend to change the running
backend. The full mechanics are in [`docs/deployment.md`](docs/deployment.md); the
identifiers are not, in that file or any other tracked file. `<prod-id>` above is a
placeholder. V1's Script ID, Deployment ID, `/exec` URL, and bound Spreadsheet ID were
deliberately not carried forward at retirement and exist only at the
`pre-v1-retirement-2026-08-14` tag
(`git show pre-v1-retirement-2026-08-14:docs/deployment.md`), and V2 has no project or
deployment to have any.

If a `clasp` command fails with `invalid_grant` or `invalid_rapt`, that is routine Google
reauth friction, not a broken script. Re-run `clasp login`, then re-run the command.

## Backend overview

The backend is `scripts/gas-v2`, and its contract is
[`docs/backend-v2-contract.md`](docs/backend-v2-contract.md). It is written and tested but
connected to nothing: no Apps Script project, no Sheet, no Script Properties, no triggers, no
deployment. Read the contract for the wire shapes, tokens, error codes, and the delivery
guarantee, rather than a summary here.

This section used to describe V1 instead: its single-file backend, unified lead schema, lead
IDs, referral codes, deduplication, and its four scheduled triggers. V1 was retired and its
source deleted on 2026-08-15. That description now lives, banner and all, in
[`docs/archive/backend-architecture.md`](docs/archive/backend-architecture.md), and the code
itself is at the `v1-stable` tag.

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
