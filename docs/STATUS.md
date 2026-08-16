# STATUS

Where the project actually stands right now.

**Last verified:** August 16, 2026, against commit `28fb99b` on a clean `main`.

This file is a snapshot, not a history. It was rewritten from scratch on the date above
because the previous version had grown by appending each correction underneath the paragraph
it falsified, leaving both readable and the reader to guess which was current. **Do not patch
a stale claim by adding a note below it. Replace the claim.**

Completed pass-by-pass history belongs in [`CHANGELOG.md`](CHANGELOG.md) and is not repeated
here. Where another document owns a subject in detail, this file points at it rather than
paraphrasing it: [`deployment.md`](deployment.md) for external mutations and hosting,
[`staging-provisioning.md`](staging-provisioning.md) for what standing the backend up
requires, [`backend-v2-contract.md`](backend-v2-contract.md) for the wire contract,
[`design-sources.md`](design-sources.md) for the approved design package, and
[`system-classification.md`](system-classification.md) for V1/V2/transitional boundaries.

## 1. Current deployment state

**Nothing in this repository is deployed anywhere, and nothing a visitor sees comes from it.**
The public site at `axispoint.llc` is a separate, older, hand-uploaded build that was not
produced from this git history. The V2 Apps Script backend is written, tested, and merged, but
no Apps Script project, `.clasp.json`, Sheet, Script Property, trigger, or deployment exists
for it: its status is `merged`, and no git action advances a backend past that. Both frontends
build clean and are wired to the V2 contract through `packages/submission-client`, but they
have never successfully deployed through GitHub Actions, because the FTP secrets the two
deploy workflows need are not configured. CI is green on every commit: `ci.yml` (type-check,
lint, both production builds with bundle inspection, the frontend test suite, and the rendered
route, ARIA, and 20-state intake baselines) and `test-gas.yml` (`pnpm test:gas-v2`). Neither
deploys anything. See [`deployment.md`](deployment.md).

## 2. What is built and merged

- **`apps/web`** — the approved design package implemented: seven routes (home, property
  management, asset management, investor services, partners, contact, 404), the contact intake
  with booking, and locale routing. Nine locale catalogs exist; **English alone is `reviewed`
  and `enabled`**, the other eight are `unreviewed` and `enabled: false`
  (`src/i18n/locales.ts`). Twenty intake states are pinned by a headless-browser baseline.
- **`apps/qr`** — the Contact Exchange microsite. See section 3.
- **`packages/submission-client`** — the single frontend transport boundary. Both apps go
  through it; both read `VITE_V2_SUBMISSION_ENDPOINT`, and a lone V1 value is a named error.
- **`packages/brand`** — shared brand primitives (Mark, `E2eBanner`, Tailwind preset, colors,
  fonts). Both apps mount `<E2eBanner />` in e2e mode.
- **`scripts/gas-v2`** — the backend, and the only one. `src` is organised into six folders
  (`entrypoints`, `core`, `platform`, `scheduled`, `emails`, `shared`), with one copy of each
  email template as a pure function under `src/emails/`. Storage is the six-tab model
  (`Submissions`, `Deliveries`, `Leads`, `Contacts`, `Log`, `Work`). Twenty-one test files
  run under `pnpm test:gas-v2`.

**V1 is fully retired.** It was deleted on 2026-08-15; nothing in `main` is V1, and the only
V1 artefacts are the archived documents under `docs/archive/`. The external V1 Apps Script
project is untouched by this repository, and whether it is left, disabled, or removed is a
separate owner operation that no merge performs.

## 3. QR status

**`apps/qr` retains its full Contact Exchange, and this is settled.** The form, storage, the
acknowledgement email, the daily digest, and matching all remain and are exercised by tests.
The only thing removed was the **correction and removal promise** in the QR acknowledgement,
deleted on 2026-08-15 along with the two Script Properties that gated it,
`AXP_REPLY_TO_MONITORED` and `AXP_REMOVAL_PROCEDURE_CONFIGURED`. Neither name appears in
`src/platform/Config.js` any more, neither is provisioned, and `configHealth` reports no
promise blockers.

AxisPoint does not offer correction or removal on request. That was resolved by removing the
copy, not by building the mailbox and procedure behind it. **If it is ever offered, the
procedure and a named accountable person come first and the copy second: do not restore the
copy, or a flag that switches it on.**

`apps/qr` remains transitional, a V2-integrated app on a legacy scaffold, and is still slated
for replacement by a smaller digital contact card in a separate pass. That replacement is
planned, not in progress, and it does not reduce what ships today.

## 4. Open owner decisions

**None that block current work.** The two that were open here are settled:

- **QR scope** is resolved, as stated in section 3: full functionality retained, the promise
  removed.
- **The deployment gate stays deferred.** The team is two people and nothing has changed the
  original reasoning, so no approval gate is to be built. This is a standing decision, not a
  pending question.

The only genuinely undecided values left in the project are the **six unresolved QR values**
listed in [`design-sources.md`](design-sources.md). They block production completion and
physical-card cutover; they do not block frontend implementation or anything currently in
flight. They are not re-listed here, so that the list has one home.

Provisioning is likewise unblocked: [`staging-provisioning.md`](staging-provisioning.md)
records that nothing stands in its way.

## 5. Known risks and launch blockers

Each of these was verified against code or an authoritative document on the date above.

| Risk | State |
|---|---|
| **FTP secrets are not configured** | Both deploy workflows fail at the FTP step with `Input required and not supplied: server`. Nothing has ever deployed from this repository |
| **Both deploy workflows still pass `VITE_FORM_ENDPOINT`** | That is the retired V1 variable name. A deploy today would compile in **no endpoint** and ship a build that fails closed on every submission while looking correct. Must be corrected in the same change that adds the FTP secrets |
| **No SPA rewrite is configured, and none is tracked here** | Deep links depend on the host returning `index.html`. All routing evidence comes from the dev server, which supplies the fallback automatically; that is not evidence about Apache. **Verifying and configuring the host's rewrite is a prerequisite for activating any non-English locale** |
| **No V2 Apps Script project exists** | The backend cannot run until a project, Sheet, Script Properties, calendar, and triggers are created. Nothing blocks doing it; it simply has not been done |
| **The QR subdomain's document root does not match the deploy target** | `qr.axispoint.llc` serves `/home/axisipak/public_html/qr`, while `deploy-qr.yml` targets `./qr.axispoint.llc/`. These must be reconciled at launch or the first deploy lands in the wrong place |
| **Deploys add and overwrite but never delete** | `dangerous-clean-slate` is not passed, so stale files from the current hand-uploaded site would persist alongside a new build. The strategy is a cutover-time choice, recorded in [`deployment.md`](deployment.md) |
| **The header overflows 390px by 3px on all seven routes** | Re-measured in a headless browser at 390x844 on 2026-08-16: `scrollWidth` 393 against `clientWidth` 390 on every route. The culprit is the mobile control cluster in `apps/web/src/components/Nav.tsx:193`. Every page therefore scrolls horizontally on a small phone |
| **No `og:image` is emitted** | Deliberate. `src/lib/meta.ts` omits it until the 1200x630 social image exists, rather than pointing at a missing file |
| **Eight locale catalogs are unreviewed** | They are model-generated candidates. Each needs fluent review of copy, visitor emails, and meaning-sensitive legal language before it can be enabled |
| **Deleting a live Google Sheet tab is not git-revertible** | Reverting the commit that removed the code does not bring the tab or its rows back. Treat any such task as irreversible regardless of the git workflow around it |

## 6. Recovery anchors

All three are present on `origin`. Nothing is deployed from this repository, so resetting to
any of them changes no running system.

| Anchor | Commit | What it preserves |
|---|---|---|
| `v1-stable` | `c237a09` | The historical final V1 state, where V1 source is read from now that it has left `main` |
| `pre-v2-clean-rebuild` | `d194e7e` | The baseline immediately before the clean V2 rebuild. Not a pure V1 marker: it already contains early V2 work |
| `pre-v1-retirement-2026-08-14` | `8a6aef1` | The complete pre-deletion repository state: the V1 backend, the V1 form tree, `team.ts`, `SharePage.tsx`, and the pre-edit `deployment.md` with V1's deployment identifiers, which exist nowhere else |

Current partner contact values are in [`PARTNER_CONTACTS.md`](PARTNER_CONTACTS.md), confirmed
directly by the owner. The historical values preserved at the retirement tag are **superseded,
not a fallback**: read the tracked document, never the tag.

## 7. Next planned work

Pointers, not plans. The detailed scope belongs in the task that does the work.

- **Stand up the V2 backend in staging**, following
  [`staging-provisioning.md`](staging-provisioning.md). Nothing blocks it. It is a sequence of
  authorized external operations, none of them a merge.
- **Fix the deploy path as one change**: correct both workflows to
  `VITE_V2_SUBMISSION_ENDPOINT`, add the FTP secrets, settle the mirror-delete strategy, and
  reconcile the QR document root. Doing any one of these alone ships a broken deploy.
- **Verify and configure the host's SPA rewrite**, before any non-English locale is activated.
- **Fluent review of the eight unreviewed locale catalogs**, one language at a time.
- **The QR replacement card**, a separate pass, once its unresolved values are decided.
- **Fix the 3px mobile overflow** in the header's mobile control cluster.
