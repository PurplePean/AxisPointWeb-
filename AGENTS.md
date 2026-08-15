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
| **What is V1, V2, transitional QR, or external** | [`docs/system-classification.md`](docs/system-classification.md) |
| Operating standard: git workflow, auto-merge, verification, copy and brand standards, known gotchas | [`CLAUDE.md`](CLAUDE.md) |
| Branching, merging, and what "going live" actually means | [`docs/branching.md`](docs/branching.md) |
| Deployment IDs, `clasp push` vs `clasp deploy`, hosting, and every external mutation | [`docs/deployment.md`](docs/deployment.md) |
| Approved V2 design package and its authoritative source files | [`docs/design-sources.md`](docs/design-sources.md) |
| Current pass, open owner decisions, deployment state, rollback anchors | [`docs/STATUS.md`](docs/STATUS.md) |
| Backend function map, payload shapes, wire contract | [`docs/backend-v2-contract.md`](docs/backend-v2-contract.md) |
| Verified current partner contact values | [`docs/PARTNER_CONTACTS.md`](docs/PARTNER_CONTACTS.md) |

V1 was fully retired on 2026-08-15. The V1 backend, the V1 form tree, and the V1 email system
are gone from this repository, and the documents that described them (`backend-architecture.md`,
`email-templates.md`, `frontend-payload-schemas.md`, `UNIFIED_SCHEMA_MIGRATION_PLAN.md`) moved to
[`docs/archive/`](docs/archive/) with a banner saying so. Do not read any of them as current
behaviour, and do not build anything from them.

If you are about to add a workflow rule, add it to the file that owns that topic above. Do not
add it here.

The same reasoning applies to the system classification. Before treating a file as current
product code or as retired V1, read
[`docs/system-classification.md`](docs/system-classification.md) rather than any summary of it,
including the short orientation list in `CLAUDE.md`. Several documents in this repository
carried their own version of that boundary and disagreed with each other for a whole pass.
