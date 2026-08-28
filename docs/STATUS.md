# STATUS

Where the project actually stands right now.

**Last verified:** August 27, 2026.

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
produced from this git history. The V2 Apps Script backend is written, tested, and merged through PR #110 (2026-08-24). The
Apps Script project (`AxisPoint V2 PRODUCTION`, renamed from STAGING 2026-08-26), spreadsheet
(`AxisPoint V2 CRM PRODUCTION`), and booking calendar (`AxisPoint Booking PRODUCTION`) all
exist and are production-named. The web-app deployment exists and is at version @5 (deployed
2026-08-24 after PR #110 merge). All 11 required Script Properties are set; `AXP_RUN_MODE`
is `dry_run` (confirmed by direct read 2026-08-26). Triggers have not been created.
**`AXP_FROM_NAME` is still `AxisPoint Partners [STAGING]` — must be updated to
`AxisPoint Partners` before `AXP_RUN_MODE` is flipped to `live`.** Booking confirmations
include a Google Meet link (`video_meeting`), RFC 5545 .ics attachment (both modes), and
partner attendees on calendar events. Current backend status: `pushed to HEAD`, `deployed`
(production @5, `AXP_RUN_MODE: dry_run`). Both frontends
build clean and are wired to the V2 contract through `packages/submission-client`. All 7
GitHub secrets are now configured; the first production deploy triggered on 2026-08-26 when
this PR merged to `main`. CI is green on every commit: `ci.yml` (type-check, lint, both
production builds with bundle inspection, the frontend test suite, and the rendered route,
ARIA, and 20-state intake baselines) and `test-gas.yml` (`pnpm test:gas-v2`). See
[`deployment.md`](deployment.md).

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
  (`Submissions`, `Deliveries`, `Leads`, `Contacts`, `Log`, `Work`). Twenty-two test files
  run under `pnpm test:gas-v2` (520 tests). PR #108 (merged 2026-08-24) adds a Google Meet
  link to `video_meeting` confirmations and a RFC 5545 .ics attachment to both booking modes,
  and fixes a pre-existing `item.leadId` vs `item.subjectId` bug that caused every
  confirmation send to return `lead_not_found`. PR #110 (merged 2026-08-24) adds both partners
  as attendees on every booking calendar event with `sendUpdates: "all"` so they receive real
  Google Calendar invitations.

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

`apps/qr` remains transitional, a V2-integrated app on a legacy scaffold. That is a statement
about how it was built, not a signal that its scope is provisional.

**The card is one page showing both partners, as of 2026-08-17.** The `?profile=` three-state
template (Zachary, Ethaniel, firm fallback) was collapsed into a single combined page carrying
both partners' owner-confirmed direct numbers and addresses. This was an owner-directed deviation from the approved board
and is recorded as such in [`design-sources.md`](design-sources.md), which holds the full
before/after and the reasoning. Two consequences were accepted explicitly and are not defects:
**per-partner digest attribution is gone** (every exchange now sends the firm slug and lands
in the digest's shared section, delivered to both partners), and **the firm fallback state and
its copy are gone with it**. No backend, digest, or contract change was made or needed; the
shared-section routing path already existed and was already tested.

**Save is two actions, one per partner, as of 2026-08-18.** For one day the page had a single
action delivering one file holding both records. Real-device testing established that this
cannot produce iOS Safari's "Add All 2 Contacts" import flow — Safari ignores the `download`
attribute on a `blob:` URL, so it never treats the payload as a named `.vcf` and previews a
single card instead. That is a platform limitation with no fix inside the blob-delivery
approach, so the card now offers **two clearly labelled actions, each delivering a file with
exactly one record**, which is the delivery shape this project shipped for its whole life
before the collapse. Each record's content is unchanged. Recorded in full in
[`design-sources.md`](design-sources.md).

**The two-action save flow has not been walked end to end on a real device.** See section 5.

## 4. Open owner decisions

**None that block current work.** The two that were open here are settled:

- **QR scope** is resolved, as stated in section 3: full functionality retained, the promise
  removed.
- **The deployment gate stays deferred.** The team is two people and nothing has changed the
  original reasoning, so no approval gate is to be built. This is a standing decision, not a
  pending question.

The only genuinely undecided values left in the project are the **three unresolved QR values**
listed in [`design-sources.md`](design-sources.md), down from six: the 2026-08-17 single-page
collapse settled verified partner email behaviour, and left one page needing one address
rather than a permanent per-partner URL to choose; the owner approved the organization note's
wording on 2026-08-18, and it is now written into both partners' contact records. They block production completion and
physical-card cutover; they do not block frontend implementation or anything currently in
flight. They are not re-listed here, so that the list has one home.

The V2 backend environment was promoted from staging to production 2026-08-26 by evidence-based
rename. [`staging-provisioning.md`](staging-provisioning.md) is the authoritative record of
the production environment's configuration, E2E history, and remaining steps before live.

## 5. Known risks and launch blockers

Each of these was verified against code or an authoritative document on the date above.

| Risk | State |
|---|---|
| **FTP secrets are not configured** | **Resolved 2026-08-26.** All 7 GitHub secrets now configured. First production deploy triggered by PR merge to `main` today; both `deploy-web.yml` and `deploy-qr.yml` ran for the first time with real credentials. |
| **SPA rewrite is now tracked** — `.htaccess` added to both `public/` dirs | **Resolved 2026-08-26.** `apps/web/public/.htaccess` and `apps/qr/public/.htaccess` ship with the build (PR #124). Apache will serve `index.html` for unmatched paths; hard refreshes and locale-prefixed routes will work once the first deploy completes. |
| **V2 backend triggers not yet installed** | All three Google resources created 2026-08-19, full E2E matrix passed 2026-08-21–2026-08-24, environment promoted to production 2026-08-26. Version @5 deployed; all 11 required Script Properties set; `AXP_RUN_MODE: dry_run`. Remaining before live: (1) update `AXP_FROM_NAME` to remove `[STAGING]` suffix, (2) install 3 time-driven triggers, (3) flip `AXP_RUN_MODE` to `live` (separate authorized step). See [`staging-provisioning.md`](staging-provisioning.md) |
| **The QR Save-contact file has never been opened on a real phone** | **Launch blocker, and the only one on this feature.** **Narrowed on 2026-08-18, not closed.** Real-device testing that day established what does NOT work: a single action delivering one file with both records cannot reach iOS Safari's "Add All 2 Contacts" flow, because Safari ignores the `download` attribute on a `blob:` URL and previews one card instead. The card was changed to **two actions, each delivering a single-record file** — the shape that worked for this project's whole life before 2026-08-17 — but **the two-action flow itself has not been walked end to end** on a real iPhone (Safari, Contacts) or a real Android handset (Chrome, Contacts), because it did not exist until that change. `apps/qr/tests/vcard.test.ts` pins the bytes of the file, which is everything automated testing can establish here; it proves nothing about the device. **Manual verification by the owner on both platforms is required before this ships.** The expected result is that each button, pressed on its own, saves exactly that one partner with the right name, title, direct number, direct address, and note — and that pressing both saves both people |
| **QR FTP jail mismatch — deploy landing wrong directory** | **Code fix merged 2026-08-27** (this PR). Investigation confirmed `Deploy@axispoint.llc` FTP account is jailed at `/home/axisipak/public_html`; `qr.axispoint.llc/` is a sibling of `public_html/`, not inside it, so `server-dir: ./qr.axispoint.llc/` from that jail placed files at `public_html/qr.axispoint.llc/` — confirmed by the misplaced build artifacts there. `server-dir` changed to `/` (jail root), matching the web deploy's pattern. **Pending cPanel action before the QR deploy is added as a GitHub secret:** create a dedicated FTP account (or repurpose a suitable one) jailed at `/home/axisipak/qr.axispoint.llc/` and use its credentials as `FTP_USERNAME_QR` / `FTP_PASSWORD_QR`. The cPanel doc root change (from `public_html/qr` to `qr.axispoint.llc`) was already completed. |
| **Deploys add and overwrite but never delete** | **Resolved 2026-08-26/27.** Both deploy workflows now gate `dangerous-clean-slate` behind a manual `workflow_dispatch` with `dangerous_clean_slate: true` explicitly checked (PR #131). Push-to-main deploys are non-destructive. The cutover wipe requires deliberate manual dispatch. |
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

- **Complete production go-live steps**: update `AXP_FROM_NAME` (remove `[STAGING]` suffix), install the three time-driven triggers, then flip `AXP_RUN_MODE` to `live` as a separately authorized step. See [`staging-provisioning.md`](staging-provisioning.md).
- **Add FTP secrets and execute cutover** — full procedure in
  [GitHub issue #124](https://github.com/PurplePean/AxisPointWeb-/issues/124). All pre-cutover code changes are complete; only the 7 GitHub secrets remain before the cutover can proceed.
- **Test the QR contact file on a real iPhone and a real Android handset**, per the launch
  blocker in section 5. It needs a person and two phones, not a commit.
- **Fluent review of the eight unreviewed locale catalogs**, one language at a time.
- **Fix the 3px mobile overflow** in the header's mobile control cluster.
