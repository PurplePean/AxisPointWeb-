# Branching, merging, and what "going live" actually means

This is the fuller explanation behind the workflow rules in
[`CLAUDE.md`](../CLAUDE.md). Read it if you are about to reason about whether a
merge "ships" anything.

## The corrected model

### Frontend (`apps/web`, `apps/qr`)

Normal workflow only, no exceptions:

```
feature branch -> commit -> push -> PR -> auto-merge to main
```

**Merging to `main` does not deploy anything in this repo right now.** It is not a
release, not a staging promotion, and must not be treated as equivalent to going
live. Treat a merged PR as "the code is in main", nothing more.

"Going live" for the frontend is a **separate future decision**: adding the FTP
secrets to the repository when the owner is ready to launch. That is a deliberate
configuration action, not a git action. **Do not build a deployment gate now** —
it is explicitly deferred by the owner.

> ⚠️ When the FTP secrets are eventually added, `deploy-web.yml` / `deploy-qr.yml`
> fire on **every push to `main`** with **no approval gate**. At that point,
> "merge to main" silently becomes "deploy to production." Revisit this document
> and decide whether a gate is wanted **before** adding those secrets.

### Backend (Google Apps Script)

Two distinct **manual** operations, both decoupled from git branch state and from
the meaning of "done":

| Operation | What it changes | Not changed |
|---|---|---|
| `pnpm gas:push` (was `deploy:gas`) — `clasp push` | Apps Script project **HEAD**; can affect installed triggers / scheduled functions (cold-lead sweep, daily digest, partner summary) | The pinned production `/exec` endpoint the site POSTs to |
| `clasp deploy -i <prod-id>` | The pinned production `/exec` endpoint — **the actual release** | — |

A backend coding task is **complete** when the code is written, tested, committed,
and merged. Neither `gas:push` nor `clasp deploy` is part of "done." Run them only
when you actually intend to change the running backend. See
[`deployment.md`](deployment.md) for IDs and the push-vs-deploy mechanics.

## Why this changed (prior assumption was wrong)

The repo previously operated under the assumption that **`main` = production** — that
merging shipped toward the live site. A direct audit disproved it:

- **GitHub Actions history:** `deploy-web.yml` and `deploy-qr.yml` have **failed on
  every run since April** (69/69 at time of audit). They fail at the **FTP step**
  (`Error: Input required and not supplied: server`) because the FTP secrets are not
  configured. The build step succeeds; nothing is ever uploaded. CI (`ci.yml`, build +
  type-check only, no secrets needed) passes on the same commits — which had masked the
  fact that no deploy was happening.
- **DNS / hosting:** the live `axispoint.llc` and `qr.axispoint.llc` sites are a
  **separate, older, hand-uploaded build** unrelated to this repo's git history. They
  are not produced by this pipeline. (See the hosting inventory in
  [`deployment.md`](deployment.md).)

So merging to `main` has, in fact, deployed nothing this entire time, and will keep
deploying nothing until the FTP secrets are deliberately added.

## Branch rules

- **Naming:** `type/short-kebab-description`, using the same types as commits
  (`feat/qr-partner-profile`, `docs/workflow-reconciliation`).
- **Always start from an updated `main`:** `git switch main && git pull` before branching.
- **Dirty working tree:** stop and report. Never stash, commit, or discard changes you did not
  make.
- **Short-lived:** one pass, one branch, merged in the same session where possible.
- **Long-lived integration branches are prohibited by default.** In particular, do not create a
  long-lived V2 branch. There is no technical reason for one: this repository deploys nothing,
  so `main` carries no production risk; V2 is built in staged, self-contained passes; and V1 is
  already preserved by tags, git history, and frozen Google resources. A long-lived branch
  would add continuous merge cost in exchange for a safety property that already exists.
- **Delete the branch after merge,** local and remote.
- **Expected final state:** on `main`, up to date with `origin/main`, no leftover branches.

## When a PR may auto-merge, and when it must not

Routine, self-contained, completed code merges normally once checks pass. That includes
locally tested GAS code: a passing `pnpm test:gas` is a normal completion signal, not a reason
to hold a PR.

**Hold a PR open in exactly two cases:**

1. It depends on an unresolved product or backend-contract decision. Fields, required versus
   optional data, lead schema, dedupe behavior, booking rules, email recipients, retention,
   document handling, permanent QR URLs, vCard delivery, locale rollout, meaning-changing copy.
   These are owner decisions and must never be invented to unblock a merge.
2. The task itself requires an external action that has not been authorized.

Say which case applies in the PR body.

**A merge never implies an external action.** Not `clasp push`, not `clasp deploy`, not
creating an Apps Script project, Sheet, Script Property, or trigger, not a real submission,
email, calendar event, or Contact change, not a GitHub secret, FTP, cPanel, or DNS change, and
not a frontend deployment. Every one of those is separate and separately authorized. See
[`deployment.md`](deployment.md).

## Tags

`v1-stable` remains only as a harmless historical bookmark. No special branch handling is
needed around it.

The recommended rollback anchor for the clean V2 rebuild is **`pre-v2-clean-rebuild`** at
`d194e7e`. It is deliberately **not** called `v1-pre-rebuild`, because that baseline already
contains early V2 frontend work and so is not a pure V1 marker. Creating and pushing it
requires separate authorization; see [`STATUS.md`](STATUS.md).

## Local run modes (endpoint safety)

How the frontend decides whether to talk to the real backend during development is
documented in [`CLAUDE.md`](../CLAUDE.md) under "Dev vs e2e run modes." In short:
`pnpm dev` always ignores any real endpoint and uses a simulated-success fallback;
`pnpm dev:e2e` opts in to the real backend, reading it only from the machine-local,
gitignored `.env.e2e.local`, and fails loudly if that is missing.
