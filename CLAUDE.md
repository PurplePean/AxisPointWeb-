# CLAUDE.md — AxisPoint Web Monorepo

This file is read automatically by Claude Code at the start of every session in this repo. It is the standing operating standard — it applies regardless of which conversation or session invoked Claude Code.

## Repo structure
- apps/web — main site (axispoint.llc)
- apps/qr — QR/digital-card microsite (qr.axispoint.llc), imports ContactForm from packages/brand directly — not a duplicate
- packages/brand — shared components, including the Contact form and its full step logic
- scripts/gas — Apps Script backend source (Code.gs) + email template mirrors

## Before doing anything else

If this task touches backend logic, email templates, payload shapes, or deployment: read the relevant file(s) in /docs first. Do not assume or guess architecture — /docs is verified, current, and the single source of truth:
- /docs/backend-architecture.md — Code.gs function map, lead types, tab/category mapping, CONFIG, OAuth scopes
- /docs/email-templates.md — template inventory, trigger conditions, the embedded-constant-vs-mirror-file pattern (read this before touching ANY email template — see "Known gotchas" below)
- /docs/frontend-payload-schemas.md — exact payload shape per lead type
- /docs/deployment.md — GAS script/deployment IDs, clasp push vs deploy distinction, GitHub Actions status, and every other external mutation
- /docs/branching.md — the full branching/merging model and what "going live" actually means
- /docs/design-sources.md — the approved V2 design package: authoritative files, required dependencies, corrections to the exported Design Index, and the photography licence ledger
- /docs/STATUS.md — current pass, open owner decisions, deployment state, rollback anchors
- /docs/CHANGELOG.md — dated log of architecture-level changes

**V2 implementation work is built from the approved design package, not from existing repository code.** Before writing any V2 frontend, intake, or QR code, read /docs/design-sources.md and cite the file and section you built from. Existing V1 code is reference material; it does not become approved by already existing.

If your task makes any documented fact stale, update the relevant /docs file in the same task, and add a one-line dated entry to /docs/CHANGELOG.md if the change is architecture-level (not routine content edits).

If /docs doesn't cover something you need to know, investigate the real current source before proceeding — never carry forward an assumption from an old conversation summary or a prior task's description without verifying it against actual code first. This codebase has drifted from documentation and from stated assumptions multiple times; verify, don't inherit.

## Engineering principles
- Root cause over patch: when something's broken, understand why before fixing the symptom.
- Extend existing working architecture rather than rebuilding it, unless there's a concrete reason the existing design can't support the new requirement. This project has working automation (Contact Groups, cold-lead sweep, referral summary) that depends on the current tab structure — don't restructure it casually.
- If a task's real scope turns out bigger than what was asked (e.g. a requested small fix reveals a deeper architectural mismatch), stop and flag it rather than silently expanding the task to "fix everything" or silently doing only the narrow thing while ignoring the deeper issue.

## Git workflow

Every task: create a feature branch (never commit directly to main), stage changes, commit with message format "type(scope): short description" where type is feat, fix, refactor, chore, or docs, and scope is the area actually touched (brand, web, qr, gas, gas-v2, infra, docs) — match to what really changed, not what the task description said, if they differ.

Branch names use the same shape: `type/short-kebab-description`. Start every branch from an updated `main`. If the working tree is dirty with changes you did not make, stop and report rather than stashing, committing, or discarding them.

**Branch-first is a HARD rule, not a preference — create the branch BEFORE the first commit, not after.** Real incident, recorded so it is not repeated: during the unified-schema migration, a stage's commit was made **directly to `main`** because the feature branch had not been created first, and it was then pushed to `origin/main`. It was caught immediately; the fix was to (1) create the intended feature branch pointing at the new commit so the work was preserved, (2) `git reset --hard` `main` back to the previous commit, (3) `git push --force-with-lease origin main` to restore the remote, then (4) proceed with the normal branch → PR flow. No work was lost — but for a brief window `main` carried an unreviewed commit and shared remote history had to be force-rewritten, which is exactly the outcome branch-first exists to prevent. **If this rule is ever violated: preserve the work on a branch, reset the shared branch, force-push to restore it, and disclose the whole sequence immediately — never quietly paper over it.** The cost of the recovery is precisely why you create the branch first.

Push the branch, open a PR (title matches the commit format, description uses sections "What changed", "Why", "Testing").

**Auto-merge is the default.** Routine, self-contained, completed code merges normally once checks pass. After opening the PR, merge it yourself (squash merge, delete the branch), then switch the local repo back to main and pull, leaving no local/remote branches behind. This includes locally tested GAS code: a passing `pnpm test:gas` run is a normal completion signal, not a reason to hold.

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
  merge and neither part of "done": `pnpm gas:push` updates the project **HEAD** (and can
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

The frontend talks to the real GAS backend only when you deliberately opt in. This is enforced
in each app's `vite.config.ts` (mode-driven) and consumed via an injected `__FORM_ENDPOINT__`
define, so a stray `VITE_FORM_ENDPOINT` in the shell or a generic `.env` file can never leak
into a dev build.

| Command | Apps | Guarantee |
|---|---|---|
| `pnpm dev` | web + qr | **Real endpoint is IGNORED** from every source (`.env.local`, shell, any generic env). The ContactForm runs its simulated-success fallback. No request ever reaches the real backend. |
| `pnpm dev:web` / `pnpm dev:qr` | one app | Same guarantee as `pnpm dev`, single app. |
| `pnpm dev:e2e` | web + qr | Loads the real production endpoint **only** from `.env.e2e.local`. Missing file/value = **hard failure**, never a silent fall back to simulated success. Prints a loud terminal warning and shows a fixed in-app red banner. |
| `pnpm dev:e2e:web` / `pnpm dev:e2e:qr` | one app | Same as `pnpm dev:e2e`, single app, for isolated testing. |

- `.env.e2e.local` is **machine-local and gitignored** — each dev computer (Mac or Windows)
  needs its own copy, created from the tracked `.env.e2e.example` placeholder. Its real value
  is never committed or printed.
- Production builds (`pnpm build`, CI) take the endpoint from the build environment
  (`VITE_FORM_ENDPOINT`), unchanged by the above; a build with no endpoint supplied compiles in
  no endpoint (simulated-success), it does not inherit a cached one.

## Mobile verification

Any UI change must be checked at a real mobile viewport (about 390px wide), not just desktop. Assume nothing about how flexbox/grid layouts degrade until actually seen at mobile width.

## GAS deployment — the operative rule

`clasp push` updates the Apps Script project's HEAD. `clasp deploy -i <prod-id>` updates the live `/exec` endpoint. They are two separate steps and neither is part of "done."
[`docs/deployment.md`](docs/deployment.md) is the authoritative home for the IDs, the mechanics, the `.claspignore` allowlist rationale, the calendar-access gotcha, and the clasp reauth behaviour. Read it before any backend or deployment task.

The rule that belongs here: **any task that edits `scripts/gas/Code.gs` or the embedded email template constants must say so explicitly in its summary and flag that the manual push and deploy steps are still required. Never claim something is "live" based on a merge alone.**

### Backend status vocabulary

State which of these a GAS change has reached, and do not imply a later one:

`coded` → `locally tested` (`pnpm test:gas`) → `committed` → `merged` → `pushed to HEAD` (`clasp push`) → `deployed` (`clasp deploy -i`) → `verified` (one authorized, labelled E2E submission)

A GAS task may be code-complete at `merged`. No git action advances a change past `merged`.

## Testing GAS logic locally

Apps Script can't run outside its own runtime, but pure logic (routing, payload transforms, template rendering) can be tested in a Node script with GAS globals stubbed out. This has been used successfully to verify fixes and generate real rendered email previews without needing a live deploy — prefer this over reasoning about code changes abstractly when a task can be verified this way.

## Known gotchas (learned the hard way this project)

- Email templates have two copies that must be kept in sync manually: the standalone HTML files under scripts/gas/emails/ are a source-of-truth mirror only — Apps Script actually renders the embedded template string constants inside Code.gs at runtime. Editing only one copy silently breaks production. Check both.
- Display labels and wire values can differ. A frontend card or button's visible text (e.g. "RE Professional") is not necessarily the value sent in the payload (e.g. "pro"). Always verify the actual submitted value in code, don't infer it from UI copy.
- No user-facing copy should contain em dashes. Replace with commas, periods, or rephrasing. This applies sitewide, not just to any one page — check for this as part of any content-editing task even if not explicitly asked.
- clasp commands (push, deploy, and others) can each independently trigger invalid_grant / invalid_rapt reauth errors, and can do so multiple times in a single session even right after a successful clasp login. A successful login does not immunize the next command. This is expected Google reauth friction, not a one-off and not a broken script: re-run clasp login, then re-run the command. Never start debugging Code.gs because a clasp command failed this way.
- The gh CLI must be authenticated for the PR and merge steps above to work — if it isn't, say so rather than silently failing partway through the git workflow.

## Verification standard

Type-checks passing is necessary but not sufficient. For any task touching user-facing behavior (frontend flow, email content, payload shape), verify by actually driving the real flow (browser click-through, or a rendered output like a generated email preview) — not just reasoning about the code. If something can't be verified end-to-end (e.g. no live server available), say so explicitly rather than implying it was checked.

## Copy and brand standards

No em dashes anywhere (see above). Tone is direct, confident, specific — avoid generic marketing language in favor of concrete claims a knowledgeable reader would recognize as real. Brand colors, fonts, and visual patterns are implemented in packages/brand — don't guess at brand values, read the source.
