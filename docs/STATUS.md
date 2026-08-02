# STATUS

The concise state record for the V2 transition. Update it as part of each pass. If a line has
not changed, leave it alone. This replaces re-auditing; it is not a project-management board.

_Last updated: 2026-08-02 (Code Pass 8)_

## Where things stand

| | |
|---|---|
| **Approved design versions** | `design@2026-07-30` (site, intake, QR) and `design@2026-07-31` (language selector). See [`design-sources.md`](design-sources.md) |
| **Current code pass** | Pass 8 — clean V2 backend scaffold and contract implementation, complete (code only, nothing connected) |
| **Completed passes** | Code Pass 1 audit (read-only). Pass 0, workflow reconciliation. Pass 2, shared frontend foundations. Pass 3, public pages and routes. Pass 4, V2 intake frontend. Pass 5, V2 QR frontend. Pass 6, language-selector component. Pass 7, backend contract audit (read-only). Pass 8, backend scaffold and contract |
| **Next pass** | Email-template implementation (Pass 2A), then frontend endpoint wiring. Both are blocked on the open backend decisions below |

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

**The language selector is a real control, but the site is still English-only.** The approved
two-slot selector replaced the static English label in the header. Selecting a language changes
the control alone: nothing is translated, no route changes, no choice is persisted, and no
locale is stored with a submission.

**Production shows English only, and the trigger is static.** English is the one locale that is
both enabled and translation-reviewed, and the approved rule is that the trigger does not cycle
with fewer than two available locales. The other eight sit in the registry as
`enabled: false, review: 'unreviewed'`, so they are never advertised.

**Remaining dependencies before any second locale launches:**

1. A professional translation pass per locale. Nothing here is reviewed copy.
2. Native-reader verification of the CJK and Indic words, which the approved board requires
   explicitly, including whether the 1.5s hold reads as a flicker in any script.
3. A decision on which locales launch and in what order.
4. Adding that script's font family to the production document, and recording its weight. No
   script font ships today; the development preview loads them on demand.
5. Locale routing, persistence, `hreflang`, and storing the locale with a submission. All out
   of scope for the component pass.

Enabling a locale is then a two-field change in `apps/web/src/i18n/locales.ts`.

**Legal copy review is a prelaunch check.** The footer disclaimer is carried forward unchanged.

## The V2 backend: written, tested, connected to nothing

`scripts/gas-v2` now holds a complete V2 backend implementing `schemaVersion` 1. The full
contract is [`backend-v2-contract.md`](backend-v2-contract.md); the project's own rules are in
[`scripts/gas-v2/README.md`](../scripts/gas-v2/README.md).

**Backend status: `merged`.** Nothing beyond that. There is **no** `.clasp.json`, Apps Script
project, Sheet, Script Property, trigger, or deployment, and neither frontend points at it. No
`clasp push` or `clasp deploy` has been run and none is implied by the merge. V1
(`scripts/gas/Code.gs`) is untouched and remains the deployed backend.

The suite is `pnpm test:gas-v2` (238 tests), running in CI alongside the unchanged V1 suite.

**What Pass 8 settled, in code:** the discriminated envelope and its versioning, the stable
snake_case token vocabulary with display strings rejected outright, server-owned field
rejection, the Lead/Contact split, suggestion-only identity matching, business-hours SLA
arithmetic, flag-never-discard spam screening, notification routing (a QR scan identifies a
card, not an owner), booking as a post-submission command, and a bounded at-least-once work
queue whose duplicate-delivery limit is asserted by a test rather than papered over.

**What Pass 8 deliberately did not do:** email templates (the port fails permanently and says
so), Google People sync (`contactSyncStatus: not_configured`, no contacts scope requested),
frontend wiring, referral resolution (`refToken` is inert by contract), and origin enforcement
(an Apps Script web app cannot read the `Origin` header, so it is documented rather than faked).

### Open backend decisions still outstanding

The contract now states a defensible position for each of these, so they are decisions to
**confirm or change**, not blanks. They are the reason the frontend is not yet wired.

| Decision | Position taken in code |
|---|---|
| Required vs optional fields | `fullName` and `email` required on an inquiry; Contact Exchange needs one of email or phone |
| Booking availability rules | Mon–Fri 09:00–17:00 project time, 60 minutes to 60 days ahead, both ends inside one day |
| Whether the referral code is transmitted | Accepted and stored verbatim, resolved to nothing |
| Dedupe and merge semantics | Exact email or phone links; everything weaker is a suggestion for a human |
| Retention | Not implemented. No purge job exists |
| V1 lead migration | Not implemented (documented default: no) |
| Email recipients | Read from Script Properties by name; no address exists in the repository |
| SLA targets | 4 / 8 / 24 business hours by pathway; Contact Exchange has none |

## Deployment state

| | |
|---|---|
| **V1 GAS backend** | **Deployed, production version @28.** Live and serving the current sites |
| **V2 GAS backend** | **Code exists and is tested; nothing external does.** `scripts/gas-v2` is at status `merged`. No Apps Script project, `.clasp.json`, Sheet, Script Properties, triggers, or deployment |
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

**Backend, blocks bringing the V2 project up (no longer blocks writing it):** confirm or change
the positions in the table above, and decide the Sheet, calendar, and notification addresses
that the Script Properties will hold. Retention has no implementation at all and needs a real
answer before production data accumulates.

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
