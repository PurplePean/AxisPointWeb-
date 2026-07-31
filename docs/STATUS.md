# STATUS

The concise state record for the V2 transition. Update it as part of each pass. If a line has
not changed, leave it alone. This replaces re-auditing; it is not a project-management board.

_Last updated: 2026-07-31 (Code Pass 5)_

## Where things stand

| | |
|---|---|
| **Approved design version** | `design@2026-07-30` (QR Frontend export). See [`design-sources.md`](design-sources.md) |
| **Current code pass** | Pass 5 — approved V2 QR frontend, complete |
| **Completed passes** | Code Pass 1 audit (read-only). Pass 0, workflow reconciliation. Pass 2, shared frontend foundations. Pass 3, public pages and routes. Pass 4, V2 intake frontend. Pass 5, V2 QR frontend |
| **Next pass** | Localization foundation, then the V2 backend contract and GAS project |

## Routes

All six approved routes resolve. The Pass 2 missing-route warning is closed.

| Route | Source | Status |
|---|---|---|
| `/` | `AxisPointPage.dc.html` | Live |
| `/property-management` | `AxisPoint Property Management.dc.html` | Live |
| `/asset-management` | `AxisPoint System Studies.dc.html` | Live |
| `/investor-services` | `AxisPoint System Studies.dc.html` | Live |
| `/partners` | `AxisPoint System Studies.dc.html` | Live |
| `/contact` | `AxisPoint System Studies.dc.html` | Shell live, intake still V1, see below |
| `/share/:code` | V1 | Retained untouched, outside the site chrome |

`/services` and `/team` were removed. No redirect was added: nothing in this repository is
deployed and no external link depends on them. If that changes before launch, redirects belong
to the hosting configuration rather than to client-side routing.

## Temporary, until later passes

**The visible frontend is now entirely V2.** The V1 `ContactForm` is no longer mounted in
`apps/web`. The approved intake lives in `apps/web/src/intake`.

**Submission is simulated and local.** The intake makes no network request of any kind:
no GAS, Sheets, Calendar, Contacts, or email. Booking uses clearly labelled local fixture
availability and a simulated confirmation. The real submission contract arrives with the
backend pass.

**Two of the six inventoried pathways are deferred for launch scope.** Referral Partner and
Submit a Referral are not exposed as gateway choices, their forms are not built, and none of
their V1 role values were inherited. This is a deliberate deviation from the six-pathway
inventory in the approved board, not an omission.

**Asset Management is a scope, not a pathway.** `?intent=asset-management` enters the
Management Proposal flow with the PM plus AM involvement answer preselected. The frontend
model records `pathway: 'management-proposal'` with `scope: 'pm-plus-am'`. No backend role
was added.

**`?ref=` is held in local draft state only** and is never transmitted. Referral attribution
remains deferred.

**The V1 form code stays in `packages/brand`** because `apps/qr` still imports `ContactForm`.
Its retirement waits on the QR pass.

**`/share/:code` is untouched and isolated.** Note for future verification: it hard-redirects
to `https://axispoint.llc` via `window.location`, so it must not be navigated during local
browser testing. Verify it by diff instead. Its retirement decision remains separate.

**The QR app is now the approved V2 card.** `apps/qr` was rebuilt from
`AxisPoint QR Frontend.dc.html`. It no longer imports the V1 `ContactForm`, embeds no intake,
generates no QR code, and consumes no form endpoint. Save Contact is simulated and local, and
the Management Proposal action links into the shared website intake.

**The QR profile URL is still an open decision, so no routing contract was shipped.** Profile
selection uses a local, development-only preview key (`?profile=`), explicitly not presented as
the permanent public URL. In production an unknown or absent key resolves to the approved firm
fallback.

**Partner phone numbers and direct email addresses remain unconfigured in the QR app.**
`packages/brand/src/team.ts`, `packages/brand/src/utils/vcard.ts`, and the README all carry
values, but the approved contact-record ledger marks partner phone and partner email as
"Needs verification" and they are still listed below as open owner decisions. The QR fixtures
hold `null` and the UI follows the approved missing-data rules until the owner confirms them.
Filling in two fields per partner is the only change required afterwards.

**Dead code recorded, not removed.** With the QR rebuild, no application imports the V1
`ContactForm`, its step components, or `utils/vcard.ts` any more; the only remaining references
are inside `packages/brand` itself. The code is retained deliberately: deleting it was not
required for this pass, and it is the reference for behaviours the V2 backend contract has not
yet replaced. Retire it in a dedicated cleanup once the backend work is settled.

**Legal copy review is a prelaunch check.** The footer disclaimer is carried forward unchanged.

## Open backend decisions carried into the contract work

Listed in `apps/web/src/intake/model.ts` rather than invented: which fields the backend
requires, how service scope is stored, how the follow-up language is used, real booking
availability rules, whether the referral code is transmitted, dedupe and merge semantics, and
the V2 lead identifier format.

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

**Photography: resolved 2026-07-30.** The owner confirmed Adobe #158947695, #196537616, and
#110458363 are licensed. #04 is the cleared Juan Nino Unsplash asset. See
[`asset-catalog.md`](asset-catalog.md). The 1200x630 Open Graph image remains a later launch
deliverable, and no `og:image` tag is emitted until it exists.

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
