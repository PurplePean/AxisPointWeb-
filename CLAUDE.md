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
- /docs/deployment.md — GAS script/deployment IDs, clasp push vs deploy distinction, GitHub Actions status
- /docs/CHANGELOG.md — dated log of architecture-level changes

If your task makes any documented fact stale, update the relevant /docs file in the same task, and add a one-line dated entry to /docs/CHANGELOG.md if the change is architecture-level (not routine content edits).

If /docs doesn't cover something you need to know, investigate the real current source before proceeding — never carry forward an assumption from an old conversation summary or a prior task's description without verifying it against actual code first. This codebase has drifted from documentation and from stated assumptions multiple times; verify, don't inherit.

## Engineering principles
- Root cause over patch: when something's broken, understand why before fixing the symptom.
- Extend existing working architecture rather than rebuilding it, unless there's a concrete reason the existing design can't support the new requirement. This project has working automation (Contact Groups, cold-lead sweep, referral summary) that depends on the current tab structure — don't restructure it casually.
- If a task's real scope turns out bigger than what was asked (e.g. a requested small fix reveals a deeper architectural mismatch), stop and flag it rather than silently expanding the task to "fix everything" or silently doing only the narrow thing while ignoring the deeper issue.

## Git workflow

Every task: create a feature branch (never commit directly to main), stage changes, commit with message format "type(scope): short description" where type is feat, fix, refactor, chore, or docs, and scope is the area actually touched (brand, web, qr, gas, infra) — match to what really changed, not what the task description said, if they differ.

**Branch-first is a HARD rule, not a preference — create the branch BEFORE the first commit, not after.** Real incident, recorded so it is not repeated: during the unified-schema migration, a stage's commit was made **directly to `main`** because the feature branch had not been created first, and it was then pushed to `origin/main`. It was caught immediately; the fix was to (1) create the intended feature branch pointing at the new commit so the work was preserved, (2) `git reset --hard` `main` back to the previous commit, (3) `git push --force-with-lease origin main` to restore the remote, then (4) proceed with the normal branch → PR flow. No work was lost — but for a brief window `main` carried an unreviewed commit and shared remote history had to be force-rewritten, which is exactly the outcome branch-first exists to prevent. **If this rule is ever violated: preserve the work on a branch, reset the shared branch, force-push to restore it, and disclose the whole sequence immediately — never quietly paper over it.** The cost of the recovery is precisely why you create the branch first.

Push the branch, open a PR (title matches the commit format, description uses sections "What changed", "Why", "Testing").

**Auto-merge is the default for EVERY task, with no carve-out exceptions.** After opening the PR, merge it yourself directly to main (squash merge, delete the branch), then switch the local repo back to main and pull, leaving no local/remote branches behind. This is not limited to "safe" or "small" changes — there is no category of change that is exempted from the default. **The only time you do not auto-merge is when a task explicitly asks you to leave the PR open** (as the EAO-cleanup tasks did, for a human review of live-affecting backend code). Absent that explicit instruction, leaving a PR open for manual merge is wrong.

### What merging to `main` does and does not do (corrected model)

This replaces the earlier "every merge ships toward production" assumption, which a direct
audit (GitHub Actions history, DNS, and hosting) proved wrong. See
[`docs/branching.md`](docs/branching.md) for the full explanation and evidence.

- **Frontend (`apps/web`, `apps/qr`) — normal workflow only, no exceptions.** Feature branch
  → commit → push → PR → auto-merge to main. **Merging to `main` does not deploy anything in
  this repo right now** and must not be treated as equivalent to going live: the two FTP
  deploy workflows have never succeeded (they fail at the FTP step because FTP secrets are
  not configured), and the live sites are a separate, older, hand-uploaded build unrelated to
  this repo's git history.
- **Backend (Google Apps Script) has two distinct manual operations, decoupled from git
  branch state.** Neither is implied by a merge, and neither is part of "done":
  - `pnpm gas:push` (formerly `deploy:gas`) updates the Apps Script project's **HEAD** code
    immediately. It can affect installed triggers and scheduled functions (cold-lead sweep,
    daily digest, partner summary) even though the pinned production web-app `/exec` endpoint
    is unaffected until a separate deploy runs.
  - `clasp deploy -i <prod-id>` updates that pinned production `/exec` endpoint. **This is the
    actual release operation.**
  A backend coding task can be fully complete — written, tested, committed, merged — without
  being pushed or deployed. Deployment of either kind is always separate and deliberate, never
  the definition of "done."
- **"Going live" for the frontend is a distinct future decision** — adding the FTP secrets when
  ready to launch — **not a git action.** Once those secrets exist, every push to `main` will
  deploy immediately with **no approval gate** as the workflows are currently configured. Flag
  this as something to revisit at that point; **do not build a deployment gate now** (explicitly
  deferred by the owner).
- The **`v1-stable` tag** remains only as a harmless historical bookmark; no other special
  branch handling is required going forward.

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

## GAS deployment — critical distinction

Pushing to Apps Script via clasp (`pnpm gas:push`, formerly `deploy:gas`) updates the project's HEAD only. It does NOT update the live production endpoint the actual website hits. Making a change live requires pushing, then explicitly deploying to the specific production deployment ID (documented in /docs/deployment.md) — these are two separate steps, not one.

Neither step is part of "done." A backend task is complete when its code is written, tested, and committed; `gas:push` and `clasp deploy -i <prod-id>` are separate deliberate operations run only when you actually intend to change the running backend (see the corrected workflow model above).

Any task that edits scripts/gas/Code.gs or the embedded email template constants must say so explicitly in its summary and flag that this manual deploy step is still required — never claim something is "live" based on a merge alone.

If clasp commands fail with an invalid_grant or invalid_rapt error, this is a Google reauth requirement (common after OAuth scope changes), not a real error — the fix is logging in again via clasp, not debugging the script.

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
