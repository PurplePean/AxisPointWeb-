# CLAUDE.md — AxisPoint Web Monorepo

This file is read automatically by Claude Code at the start of every session in this repo. It is the standing operating standard — it applies regardless of which conversation or session invoked Claude Code.

## What is V1, what is V2, what is transitional

**[`docs/system-classification.md`](docs/system-classification.md) is the single source of truth for which systems are current V2, retired V1, transitional QR, or external.** Read it before deciding whether a file is current product code, and update it in the same PR as any change that moves a system from one category to another.

**V1 is fully retired as of 2026-08-15.** There is no V1 backend, no V1 form, and no V1 email system left in this repository. Nothing in `main` is V1 any more, and the only V1 artefacts still tracked are historical documents under `docs/archive/`, each of which says so at the top. If a task description, an old summary, or a stale comment sends you looking for `scripts/gas`, `Code.gs`, `ContactForm`, `team.ts`, `vcard.ts`, or `/share/:code`, they are gone: read them at the `v1-stable` or `pre-v1-retirement-2026-08-14` tags and do not restore them. The one deliberate exception is the `VITE_FORM_ENDPOINT` rejection guards in both apps, which are negative safety guards against obsolete configuration, not V1 runtime code.

Do not maintain a second, more detailed copy of that classification here or in any other file. Copies of a boundary drift, and the stale one is the one somebody eventually follows. The short list below is orientation only.

## Repo structure
- apps/web — main site. V2, built from the approved design package. Not deployed from this repository
- apps/qr — QR Contact Exchange microsite. **Transitional:** V2-integrated (shared submission client, V2 backend contract) on a legacy scaffold. It retains its full Contact Exchange — form, storage, acknowledgement email, daily digest, matching — and that scope is settled
- packages/brand — shared brand primitives (Mark, E2eBanner, Tailwind preset, colors, fonts). That is the whole package; the V1 form tree it used to hold was deleted on 2026-08-15
- packages/submission-client — the single frontend transport boundary for V2 submissions
- scripts/gas-v2 — the Apps Script backend, and the only one. Written and tested; no project, Sheet, trigger, endpoint, or deployment exists

## Before doing anything else

If this task touches backend logic, email templates, payload shapes, or deployment: read the relevant file(s) in /docs first. Do not assume or guess architecture — /docs is verified, current, and the single source of truth:
- /docs/backend-v2-contract.md — the backend contract: wire shapes, tokens, error codes, delivery guarantee. This is the backend document
- /docs/PARTNER_CONTACTS.md — owner-confirmed current partner email and phone values
- /docs/deployment.md — clasp push vs deploy mechanics, provisioning checklists, hosting inventory, GitHub Actions status, and every other external mutation. **It does not hold deployment identifiers.** V1's Script ID, Deployment ID, `/exec` URL, and bound Spreadsheet ID were deliberately not carried forward when V1 was retired and exist only at the `pre-v1-retirement-2026-08-14` tag (`git show pre-v1-retirement-2026-08-14:docs/deployment.md`). V2 has none to hold: no Apps Script project, `.clasp.json`, or deployment exists yet
- /docs/branching.md — the full branching/merging model and what "going live" actually means
- /docs/design-sources.md — the approved V2 design package: authoritative files, required dependencies, corrections to the exported Design Index, and the photography licence ledger
- /docs/STATUS.md — current pass, open owner decisions, deployment state, rollback anchors
- /docs/CHANGELOG.md — dated log of architecture-level changes
- /docs/system-classification.md — V1 / V2 / transitional QR / external boundaries

**V2 implementation work is built from the approved design package.** Before writing new V2 frontend, intake, or QR code, read /docs/design-sources.md and cite the file and section you built from.

**That rebuild has happened.** The instruction above used to be followed by a claim that the current `apps/web`, `apps/qr`, and `packages/brand` code predated the approved design and was still being rebuilt from it. That was true when it was written and stopped being true through PR #78: the site chrome, the five marketing pages, the contact intake, booking, the submission states, and locale routing are all implemented from the approved package across nine locale catalogs, with English reviewed and enabled. Treat current `apps/web` as the approved implementation, not as a superseded draft. The retired V1 surfaces that used to sit alongside it were deleted on 2026-08-15 and are not reference material for anything new.

If your task makes any documented fact stale, update the relevant /docs file in the same task, and add a one-line dated entry to /docs/CHANGELOG.md if the change is architecture-level (not routine content edits).

If /docs doesn't cover something you need to know, investigate the real current source before proceeding — never carry forward an assumption from an old conversation summary or a prior task's description without verifying it against actual code first. This codebase has drifted from documentation and from stated assumptions multiple times; verify, don't inherit.

## Engineering principles
- Root cause over patch: when something's broken, understand why before fixing the symptom.
- Extend existing working architecture rather than rebuilding it, unless there's a concrete reason the existing design can't support the new requirement. `scripts/gas-v2`'s six-tab storage model, its ports boundary, and the shared submission client are load-bearing and have tests pinning their shape — don't restructure them casually.
- If a task's real scope turns out bigger than what was asked (e.g. a requested small fix reveals a deeper architectural mismatch), stop and flag it rather than silently expanding the task to "fix everything" or silently doing only the narrow thing while ignoring the deeper issue.

## Git workflow

Every task: create a feature branch (never commit directly to main), stage changes, commit with message format "type(scope): short description" where type is feat, fix, refactor, chore, or docs, and scope is the area actually touched (brand, web, qr, gas, gas-v2, infra, docs) — match to what really changed, not what the task description said, if they differ.

Branch names use the same shape: `type/short-kebab-description`. Start every branch from an updated `main`. If the working tree is dirty with changes you did not make, stop and report rather than stashing, committing, or discarding them.

**Branch-first is a HARD rule, not a preference — create the branch BEFORE the first commit, not after.** Real incident, recorded so it is not repeated: during the unified-schema migration, a stage's commit was made **directly to `main`** because the feature branch had not been created first, and it was then pushed to `origin/main`. It was caught immediately; the fix was to (1) create the intended feature branch pointing at the new commit so the work was preserved, (2) `git reset --hard` `main` back to the previous commit, (3) `git push --force-with-lease origin main` to restore the remote, then (4) proceed with the normal branch → PR flow. No work was lost — but for a brief window `main` carried an unreviewed commit and shared remote history had to be force-rewritten, which is exactly the outcome branch-first exists to prevent. **If this rule is ever violated: preserve the work on a branch, reset the shared branch, force-push to restore it, and disclose the whole sequence immediately — never quietly paper over it.** The cost of the recovery is precisely why you create the branch first.

Push the branch, open a PR (title matches the commit format, description uses sections "What changed", "Why", "Testing").

**Auto-merge is the default.** Routine, self-contained, completed code merges normally once checks pass. After opening the PR, merge it yourself (squash merge, delete the branch), then switch the local repo back to main and pull, leaving no local/remote branches behind. This includes locally tested GAS code: a passing `pnpm test:gas-v2` run is a normal completion signal, not a reason to hold.

**Merging never implies an external action.** A merge does not perform `clasp push`, `clasp deploy`, resource creation, a frontend deployment, or any other mutation of a system outside this repository. Those are separate, separately authorized operations (see below and [`docs/deployment.md`](docs/deployment.md)).

**Hold a PR open in exactly two cases:**

1. It depends on an unresolved product or backend-contract decision (fields, schema, permanent QR URLs, vCard delivery, dedupe rules, email recipients, retention, locale rollout, meaning-changing copy).
2. The task itself requires an external action that has not been authorized.

Absent one of those, leaving a PR open for manual merge is wrong. When you do hold one, say why in the PR body.

### What merging to `main` does and does not do

**Merging to `main` deploys nothing in this repository.** It is not a release and not a
staging promotion. Treat a merged PR as "the code is in main", nothing more.

- **Frontend (`apps/web`, `apps/qr`).** This repository's frontend has never successfully
  deployed through GitHub Actions. Going live is a separate future configuration decision
  (adding the FTP secrets), not a git action. **Do not build a deployment gate now** —
  explicitly deferred by the owner.
- **Backend (Google Apps Script).** Two distinct manual operations, neither implied by a
  merge and neither part of "done": `clasp push` updates the project **HEAD** (and can
  affect installed triggers), `clasp deploy -i <prod-id>` updates the pinned production
  `/exec` endpoint and is the actual release. A backend task is complete when written,
  tested, committed, and merged.

[`docs/branching.md`](docs/branching.md) is the single full explanation of this model,
including the audit evidence behind it. [`docs/deployment.md`](docs/deployment.md) owns the
IDs, the push-vs-deploy mechanics, and every other external mutation. Do not restate either
here; keep this section terse and let those two files carry the detail.

**Caveat — one class of change is NOT git-revertible, and merging does not undo it: destructive edits to the live Google Sheet.** Deleting a Sheet tab (or its data) is an action taken by hand in the Sheet or by a GAS function run against it, not a commit — so reverting the PR that removed the *code* does not bring the tab or its rows back. This matters for the unified-schema migration's **Phase D** (deleting the nine legacy lead tabs and the `xxxLegacy` bodies): the code deletion is revertible, but once the legacy tabs themselves are removed from the live Sheet, the rollback path they provide is gone for good. Treat any task that deletes a live Sheet tab as irreversible regardless of the git workflow around it, and confirm before doing so.

## Dev server hygiene

Never run the web or qr dev servers in the same terminal tab as a Claude Code session — starting Claude Code requires interrupting whatever's running in that tab, which kills the dev server. If you need to verify something live, ask the user to confirm a dev server is running in its own tab first, or check before assuming one is up.

## Dev vs e2e run modes (form endpoint safety)

The frontend talks to a real backend only when you deliberately opt in. This is enforced
in each app's `vite.config.ts` (mode-driven) and consumed via an injected `__FORM_ENDPOINT__`
define, so a stray endpoint in the shell or a generic `.env` file can never leak
into a dev build.

| Command | Apps | Guarantee |
|---|---|---|
| `pnpm dev` | web + qr | **Real endpoint is IGNORED** from every source (`.env.local`, shell, any generic env). The shared submission client runs its simulator. No request ever reaches a real backend. |
| `pnpm dev:web` / `pnpm dev:qr` | one app | Same guarantee as `pnpm dev`, single app. |
| `pnpm dev:e2e` | web + qr | Loads the real production endpoint **only** from `.env.e2e.local`. Missing file/value = **hard failure**, never a silent fall back to simulated success. Prints a loud terminal warning and shows a fixed in-app red banner. |
| `pnpm dev:e2e:web` / `pnpm dev:e2e:qr` | one app | Same as `pnpm dev:e2e`, single app, for isolated testing. |

- `.env.e2e.local` is **machine-local and gitignored** — each dev computer (Mac or Windows)
  needs its own copy, created from the tracked `.env.e2e.example` placeholder. Its real value
  is never committed or printed.
- Production builds (`pnpm build`, CI) take the endpoint from the build environment, unchanged
  by the above; a build with no endpoint supplied compiles in no endpoint, it does not inherit
  a cached one. **A `apps/web` production build with no endpoint fails closed** (an honest
  "nothing was sent"), it does not simulate success; only a dev build can simulate.
- **BOTH apps read `VITE_V2_SUBMISSION_ENDPOINT`.** `apps/web` since Pass 10A, `apps/qr` since
  Pass 10B (PR #70). This paragraph used to say `apps/qr` "still uses `VITE_FORM_ENDPOINT`",
  which had been wrong since that pass: the Contact Exchange submits a V2 `contact_exchange`
  envelope, so pointing it at the V1 deployment would fail in a way that reads as a backend bug
  rather than a configuration mistake. Verify against `apps/qr/vite.endpoint.ts`, not against
  this file.
- **`VITE_FORM_ENDPOINT` is now recognised only in order to be REJECTED.** It names the retired
  V1 deployment. Each app's endpoint resolver detects a lone V1 value in e2e mode and throws
  with a message naming the problem, rather than silently defaulting. Those `V1_ENDPOINT_VAR`
  checks are **negative safety guards, not V1 runtime code**: keep them until the production
  deploy workflows are corrected and verified. See
  [`docs/backend-v2-contract.md` §19](docs/backend-v2-contract.md) and
  [`docs/system-classification.md`](docs/system-classification.md).
- **Both apps render the shared `<E2eBanner />` in e2e mode.** The banner is a visible warning
  on top of the fail-closed resolver above; it does not replace it. `apps/qr` computed
  `__E2E_MODE__` and printed the terminal warning without ever mounting the banner until the
  2026-08-15 safety pass.

## Mobile verification

Any UI change must be checked at a real mobile viewport (about 390px wide), not just desktop. Assume nothing about how flexbox/grid layouts degrade until actually seen at mobile width.

## GAS deployment — the operative rule

`clasp push` updates the Apps Script project's HEAD. `clasp deploy -i <prod-id>` updates the live `/exec` endpoint. They are two separate steps and neither is part of "done."
[`docs/deployment.md`](docs/deployment.md) is the authoritative home for the mechanics, the `.claspignore` allowlist rationale, the calendar-access gotcha, and the clasp reauth behaviour. Read it before any backend or deployment task. **It is not the home for the IDs, and no tracked file is:** V1's were stripped out at retirement and survive only at the `pre-v1-retirement-2026-08-14` tag, and V2 has no project or deployment to have IDs for. `<prod-id>` above is a placeholder, not a value you can look up in this repository.

The rule that belongs here: **any task that edits `scripts/gas-v2` source or its email templates must say so explicitly in its summary and flag that the manual push and deploy steps are still required. Never claim something is "live" based on a merge alone.**

There is only one backend to be in now. V1's source was deleted on 2026-08-15; [`docs/archive/deployment-v1.md`](docs/archive/deployment-v1.md) records what its deployment was, and nothing in this repository can push or deploy it.

### Backend status vocabulary

State which of these a GAS change has reached, and do not imply a later one:

`coded` → `locally tested` (`pnpm test:gas-v2`) → `committed` → `merged` → `pushed to HEAD` (`clasp push`) → `deployed` (`clasp deploy -i`) → `verified` (one authorized, labelled E2E submission)

A GAS task may be code-complete at `merged`. No git action advances a change past `merged`.

## Testing GAS logic locally

Apps Script can't run outside its own runtime, but pure logic (routing, payload transforms, template rendering) can be tested in a Node script with GAS globals stubbed out. This has been used successfully to verify fixes and generate real rendered email previews without needing a live deploy — prefer this over reasoning about code changes abstractly when a task can be verified this way.

## Known gotchas (learned the hard way this project)

- **Historical, and deliberately not repeated:** V1's email templates existed in two copies that had to be hand-synced, a standalone HTML mirror and an embedded string constant that was what actually rendered. Editing one copy silently broke production. `scripts/gas-v2` has exactly one copy of each template, as a pure function in its own file under `src/emails/`. If you are ever tempted to add a "readable mirror" of a template, this is the reason not to.
- Display labels and wire values can differ. A frontend card or button's visible text (e.g. "RE Professional") is not necessarily the value sent in the payload (e.g. "pro"). Always verify the actual submitted value in code, don't infer it from UI copy.
- No user-facing copy should contain em dashes. Replace with commas, periods, or rephrasing. This applies sitewide, not just to any one page — check for this as part of any content-editing task even if not explicitly asked.
- clasp commands (push, deploy, and others) can each independently trigger invalid_grant / invalid_rapt reauth errors, and can do so multiple times in a single session even right after a successful clasp login. A successful login does not immunize the next command. This is expected Google reauth friction, not a one-off and not a broken script: re-run clasp login, then re-run the command. Never start debugging backend source because a clasp command failed this way.
- The gh CLI must be authenticated for the PR and merge steps above to work — if it isn't, say so rather than silently failing partway through the git workflow.

## Verification standard

Type-checks passing is necessary but not sufficient. For any task touching user-facing behavior (frontend flow, email content, payload shape), verify by actually driving the real flow (browser click-through, or a rendered output like a generated email preview) — not just reasoning about the code. If something can't be verified end-to-end (e.g. no live server available), say so explicitly rather than implying it was checked.

**CI runs these gates, and a green PR means all of them passed:** workspace type-check; lint across all four packages; both production builds, each inspected by `scripts/test/inspect-bundle.mjs`; the frontend test suite (`pnpm test:frontend`); the seven-route rendered English baseline; the rendered ARIA assertions; the 20-state intake baseline driven in a real headless browser; and the Apps Script suite in `test-gas.yml`. A gate that exists as a local script but is not in a workflow proves nothing about anybody else's commit, which is exactly how the frontend suite and the bundle inspector sat unrun for several passes. If you add a gate, add it to `.github/workflows/ci.yml` in the same PR.

## Copy and brand standards

No em dashes anywhere (see above). Tone is direct, confident, specific — avoid generic marketing language in favor of concrete claims a knowledgeable reader would recognize as real. Brand colors, fonts, and visual patterns are implemented in packages/brand — don't guess at brand values, read the source.
