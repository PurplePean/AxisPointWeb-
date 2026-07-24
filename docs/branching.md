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

## `v1-stable` tag

Remains only as a harmless historical bookmark. No special branch handling is needed
around it going forward.

## Local run modes (endpoint safety)

How the frontend decides whether to talk to the real backend during development is
documented in [`CLAUDE.md`](../CLAUDE.md) under "Dev vs e2e run modes." In short:
`pnpm dev` always ignores any real endpoint and uses a simulated-success fallback;
`pnpm dev:e2e` opts in to the real backend, reading it only from the machine-local,
gitignored `.env.e2e.local`, and fails loudly if that is missing.
