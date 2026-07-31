# STATUS

The concise state record for the V2 transition. Update it as part of each pass. If a line has
not changed, leave it alone. This replaces re-auditing; it is not a project-management board.

_Last updated: 2026-07-30 (Code Pass 2)_

## Where things stand

| | |
|---|---|
| **Approved design version** | `design@2026-07-30` (QR Frontend export). See [`design-sources.md`](design-sources.md) |
| **Current code pass** | Pass 2 — shared frontend foundations, complete |
| **Completed passes** | Code Pass 1 audit (read-only). Pass 0, workflow reconciliation. Pass 2, shared frontend foundations |
| **Next pass** | Pass 3 — public pages and the six approved routes |

## Temporarily unresolved routes

The shared navigation and footer built in Pass 2 link to the approved routes. Four of them do
not exist yet and resolve to the 404 page until Pass 3 creates them. This is deliberate: no
placeholder page or redirect was created to hide the staged dependency.

| Destination | Status |
|---|---|
| `/property-management` | **Arrives in Pass 3** |
| `/asset-management` | **Arrives in Pass 3** |
| `/investor-services` | **Arrives in Pass 3** |
| `/partners` | **Arrives in Pass 3** |
| `/contact?intent=property-management` | Resolves today. The existing contact page still renders the V1 intake, which Pass 5 replaces |
| `/` | Resolves today. The existing homepage body is untouched and is rebuilt in Pass 3 |

The current `/services` and `/team` routes still exist and still render their V1 bodies. They
are removed in Pass 3 when the approved routes replace them.

## Deployment state

| | |
|---|---|
| **V1 GAS backend** | **Deployed, production version @28.** Live and serving the current sites |
| **V2 GAS backend** | Does not exist. No Apps Script project, Sheet, Script Properties, or triggers created |
| **This repository's frontend** | **Has never successfully deployed through GitHub Actions.** The two FTP workflows fail at the FTP step because FTP secrets are not configured |
| **Live public sites** | A separate, older, hand-uploaded build unrelated to this repository's git history |
| **Going live** | A future configuration decision (adding FTP secrets), not a git action. Merging to `main` deploys nothing |

Note the distinction: the **V1 GAS backend is deployed**; the **frontend in this repository is
not**. Those are independent facts and should not be collapsed into a single "deployed" claim.

## Deferred

- Referral Partner and Submit a Referral pathway expansion (discoverability preserved)
- AppFolio integration
- Pass 2B letterhead and Management Proposal documents (approved, not required for launch)
- Learn / content publishing

## Open owner decisions

Only decisions that genuinely block work. Settled positioning, CTA wording, the language
system, partner titles, referral deferral, AppFolio deferral, QR scope, the repository
decision, and the clean-rebuild decision are **not** reopened here.

**QR, blocks production completion and physical-card cutover (not frontend implementation):**
the seven unresolved values in [`design-sources.md`](design-sources.md) — partner phones,
partner email behaviour, whether a firm phone will exist, **the permanent profile URL**,
contact-file delivery, organization-note wording, and whether a mailing address appears.

**Photography, blocks public launch:** confirm the licence records for Adobe #158947695,
#196537616, and #110458363.

**Intake, blocks Pass 5 completion:** required-vs-optional per field; booking availability
rules; the launch locale list and per-language order; document-request storage, retention, and
link expiry.

**Backend, blocks Pass 7:** V2 dedupe and merge semantics; email recipients; whether historical
V1 leads are migrated (default: no); retention policy.

## Known risks

- The permanent QR profile URL is printed on physical cards and cannot be revised after printing
- `qr.axispoint.llc` has document root `/home/axisipak/public_html/qr`, but `deploy-qr.yml`
  targets `./qr.axispoint.llc/`. These do not match and must be reconciled at launch
- FTP deploy workflows currently add and overwrite but never delete, so stale files would
  persist after a deploy. See [`deployment.md`](deployment.md)
- Once FTP secrets exist, every push to `main` deploys immediately with no approval gate.
  Decide on a gate **before** adding the secrets
- Deleting a live Google Sheet tab is not git-revertible

## Rollback anchors

| Anchor | Commit | Meaning |
|---|---|---|
| `v1-stable` | `c237a09` | Historical bookmark, harmless, retained |
| `pre-v2-clean-rebuild` | `d194e7e` | **Created and pushed 2026-07-30.** Annotated, present on `origin`. The baseline immediately before the clean V2 rebuild. Named this way rather than `v1-pre-rebuild` because the baseline already contains early V2 work, so it is not a pure V1 marker |

To roll the frontend back to the pre-rebuild baseline, reset to `pre-v2-clean-rebuild`. Nothing
is deployed from this repository, so a rollback here changes no running system.
