# AGENTS.md — AxisPoint Web Monorepo

**[`CLAUDE.md`](CLAUDE.md) is the canonical operating standard for this repository.** Read it
first, and follow it, whichever agent or tool you are.

This file is deliberately a pointer, not a second rulebook. It used to be a full copy of the
workflow rules and it drifted: it went on asserting that "every merge currently ships toward
production" after a direct audit had disproved that and `CLAUDE.md` had been corrected. Two
complete copies of the same rules will always drift, and the stale one will eventually be the
one somebody follows. So there is exactly one copy now.

## Where each rule lives

| Topic | Authoritative file |
|---|---|
| Operating standard: git workflow, auto-merge, verification, copy and brand standards, known gotchas | [`CLAUDE.md`](CLAUDE.md) |
| Branching, merging, and what "going live" actually means | [`docs/branching.md`](docs/branching.md) |
| Deployment IDs, `clasp push` vs `clasp deploy`, hosting, and every external mutation | [`docs/deployment.md`](docs/deployment.md) |
| Approved V2 design package and its authoritative source files | [`docs/design-sources.md`](docs/design-sources.md) |
| Current pass, open owner decisions, deployment state, rollback anchors | [`docs/STATUS.md`](docs/STATUS.md) |
| Backend function map, lead model, schema | [`docs/backend-architecture.md`](docs/backend-architecture.md) |
| Payload shapes | [`docs/frontend-payload-schemas.md`](docs/frontend-payload-schemas.md) |
| Email templates and the embedded-constant vs mirror-file pattern | [`docs/email-templates.md`](docs/email-templates.md) |

If you are about to add a workflow rule, add it to the file that owns that topic above. Do not
add it here.
