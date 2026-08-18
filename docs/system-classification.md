# AxisPoint System Classification

**Last verified:** August 16, 2026  
**Verified repository commit:** `68e830325043bbb57c4dd7c479a04f039d7cb4bb`, the head of `main` after PRs #81 through #87  
**Safety checkpoint:** `pre-v1-retirement-2026-08-14`  
**Repository state when verified:** clean `main`

**V1 retirement has been executed.** The section that used to list V1 as "confirmed present and
scheduled for retirement" is now the retirement record below. Nothing in this repository is V1
any more.

## Purpose

This document answers one question: what is current AxisPoint product code, what is historical V1 code, what is transitional QR code, and what exists only outside the repository?

It is a current-state document, not a history of every project decision. Historical details belong in `docs/CHANGELOG.md` and the preserved git tags.

When this document disagrees with a general description elsewhere, inspect the current source and tests before changing anything. Update this document in the same pull request as any change that moves a system from one category to another.

## Business facts that govern this classification

- The website currently visible at `axispoint.llc` is a separate, hand-uploaded build. It was not built from this repository.
- V1 is permanently retired as a business system, and as of August 15, 2026 its source is deleted from this repository. It does not need compatibility support in current `main`.
- The external V1 Apps Script project still exists and is untouched. Whether it is left in place, disabled, or removed is a separate owner decision and a separate authorized operation. No repository change performs it.
- The nine-language product scope is confirmed: English, Spanish, Simplified Chinese, Traditional Chinese, Vietnamese, Hindi, Urdu, Gujarati and Punjabi.
- English is the only reviewed and enabled language today. The other eight are disabled because fluent review is outstanding, not because their inclusion is undecided.
- The QR Contact Exchange keeps its full functionality, and that is settled. See [`STATUS.md` §3](STATUS.md).
- Repository changes do not deploy, provision or modify any external system.

## Current V2 core

These systems describe the current website product and must remain during V1 retirement.

### Website

- `apps/web` in full. The historical `SharePage.tsx` route that this line used to carve out is deleted
- Marketing pages and site navigation
- Contact intake and validation
- Booking selection and booking requests
- Submission, failure and confirmation states
- Locale-aware routing
- Canonical addresses and language metadata for search engines
- Script-specific font handling
- English content and the eight disabled review catalogs

The website is built and tested but has not been deployed from this repository.

### Shared submission contract

- `packages/submission-client`
- Website inquiry request and response shapes
- Booking request and response shapes
- QR exchange request and response shapes
- `refToken`, which remains an intentionally inert attribution value carried through the website and backend. **It survived V1 retirement deliberately.** Its original producer, the `/share/:code` landing page, is gone, but the intake reads `?ref=` straight off the query string, so the wire field, the intake field, and the backend handling are all unchanged

### V2 backend

- `scripts/gas-v2`
- Website submission handling
- Booking handling
- Website acknowledgement email
- Booking confirmation email
- Internal website notification email
- Delivery tracking and retry behavior
- QR-specific handling, storage, acknowledgement, digest and matching
- Audit-only visitor email translations outside the deployable source allowlist

The V2 backend is written and tested. It has not been provisioned as a Google Apps Script project, connected to a production Sheet, given production settings, assigned triggers or deployed to a public submission address.

### Required supporting infrastructure

- `scripts/test`
- Web route baselines
- Intake-state baselines
- Accessibility assertions
- Locale preview and review artifacts
- Production bundle inspection
- `hosting`
- `scripts/generate-logos.py`
- Current brand primitives, including `Mark`, `E2eBanner`, the Tailwind preset, `colors.ts` and `fonts.ts`

These are support systems for current V2 work. Their age or location does not make them V1.

## Retired V1: removed from this repository

**Retired and deleted August 15, 2026,** on branch `chore/v1-retirement` from base commit
`71d345d`. Everything below was present in `main` before that pass and is not present now.

| Removed | Detail |
|---|---|
| The V1 Apps Script backend | All 29 tracked files under `scripts/gas`: `Code.gs`, `appsscript.json`, `.claspignore`, the eight email template mirrors under `emails/`, and the 18 files under `tests/` (15 `.test.js` suites, two helpers, one README). The task brief said sixteen test files; the tracked count is 15 suites, verified with `git ls-tree -r HEAD` before deletion |
| The V1 package scripts | `test:gas` and `gas:push` removed from the root `package.json` |
| The V1 CI step | Removed from `.github/workflows/test-gas.yml`. **The workflow file itself was kept**, because it also runs the V2 suite, which was verified before the edit |
| The V1 form tree | All 19 tracked files under `packages/brand/src/components/form`: the form itself, eleven step components, the progress and success components, the booking calendar, the market location input, the primitives, the types, and the utils |
| `packages/brand/src/utils/vcard.ts` | The V1 vCard helper. Its directory is now empty and gone |
| `packages/brand/src/team.ts` | Partner contact literals. **See the partner contact record below** |
| `packages/brand/src/types.ts` | `ArticleMeta` / `ParsedArticle`, from the abandoned articles feature |
| `apps/web/src/pages/SharePage.tsx` | The V1 referral landing page |
| The `/share/:code` route | Removed from `App.tsx` along with the comments describing it. **Deleted outright, with no redirect**, deliberately: it was never a published address of this build |
| `content/articles`, `content/publications` | Empty placeholder directories from the abandoned articles idea |
| `gray-matter`, `remark`, `remark-html` | Removed from `apps/web/package.json` and from `pnpm-lock.yaml` |
| The brand barrel | `packages/brand/src/index.ts` reduced to `Mark` and `E2eBanner`, which is what `apps/web` and `apps/qr` actually import. The `./team` and `./types` subpath exports were removed from `packages/brand/package.json`; `./colors`, `./fonts` and `./tailwind-preset` remain |
| V1-only operating documents | `backend-architecture.md`, `email-templates.md`, `frontend-payload-schemas.md` and `UNIFIED_SCHEMA_MIGRATION_PLAN.md` moved to `docs/archive/`, each with a banner stating that it describes a deleted system. `docs/deployment.md` lost its V1 operating sections, including the V1 Script ID, Deployment ID, `/exec` URL and bound Spreadsheet ID, which now live only at the tags |

### Where the historical state lives

- `v1-stable` — V1's final state. This is where V1 source is read from.
- `pre-v1-retirement-2026-08-14` — the complete pre-deletion repository, including `team.ts` and the full pre-edit `deployment.md`.

Both tags are on `origin`. Reading a V1 identifier is now a deliberate act against a tag rather
than a lookup in the working tree, which is the intended outcome and not an accident.

### What was deliberately NOT removed

- **`refToken`**, on the wire, in the intake, and in the backend. Its producer is gone; the field is not.
- **The `VITE_FORM_ENDPOINT` rejection guards** in `apps/web/vite.endpoint.ts` and `apps/qr/vite.endpoint.ts`. These are negative safety guards that reject obsolete V1 configuration, not V1 runtime code. Keep them until the production deploy workflows are corrected and verified.
- **`apps/qr` and everything QR-specific.** The retain, retire, or rebuild decision for QR was explicitly out of scope for this pass.
- **`scripts/gas-v2`.** Untouched.
- **The external V1 Apps Script project**, which no repository change can reach.

### The machine-local V1 clasp config: relocated August 16, 2026

This list previously ended with the gitignored `scripts/gas/.clasp.json`, described as
deliberately not removed because it was a machine-local file rather than repository content.
That is no longer where it lives. Because it was gitignored, `git rm` never touched it during
V1 retirement, so it survived on disk in an otherwise empty `scripts/gas/` directory, still
carrying the live Script ID of the retired V1 project. A clasp command run from that directory
would still have resolved it.

**On August 16, 2026 it was moved out of the repository tree to
`~/Desktop/axispoint-v1-clasp-quarantine/` and renamed
`clasp.json.v1-retired-DO-NOT-USE`**, since clasp only recognises a file named exactly
`.clasp.json`. `scripts/gas/` no longer exists on disk. The file is not deleted, because the
external V1 Apps Script project it points at was retired rather than deleted; it should be
deleted once that project is gone. It must not be copied back into the repository.

The `scripts/gas/.clasp.json` line stays in `.gitignore` regardless, so that the path cannot be
committed by accident if a copy reappears on any machine.

### Partner contact values: resolved

`packages/brand/src/team.ts` held two email literals and two phone literals that this document
previously flagged as historical rather than verified. **The owner confirmed the current values
directly on August 15, 2026**, and they are recorded in
[`PARTNER_CONTACTS.md`](PARTNER_CONTACTS.md). That file, not `team.ts` and not the tag, is the
reference for any future work needing partner contact information. The tagged historical values
are superseded, not a fallback.

## Abandoned non-V1 residue: also removed

The articles and publications residue listed here previously (`types.ts`, `content/articles`,
`content/publications`, `gray-matter`, `remark`, `remark-html`, and their lockfile entries) was
removed in the same pull request, as planned. It had no current consumers. It is recorded
separately from V1 above because it was never part of the V1 backend or the V1 form, and
describing it as such would have been wrong.

## Transitional QR system

The current QR Contact Exchange is a V2-integrated evolution built on a legacy application scaffold. It is V2 for deletion and dependency purposes, but it is not a clean-slate V2 rebuild.

Its current behavior was substantially rewritten during the V2 passes. It uses the shared V2 submission client and V2 backend contract. Therefore it must not be deleted or simplified as part of V1 retirement.

**`apps/qr` retains its full Contact Exchange.** The form, storage, the acknowledgement email,
the daily digest, and matching all remain and are exercised by tests. This was settled on
2026-08-15 and is recorded in [`STATUS.md` §3](STATUS.md), which is the operative statement of
current QR scope. This document previously described the current product as larger than AxisPoint
intends to operate and treated its behavior as provisional, which read as though a reduction was
pending. It is not. The only thing removed in that pass was the correction and removal promise in
the QR acknowledgement, along with the two Script Properties that gated it.

**The card surface is one combined page as of 2026-08-17.** The `?profile=` three-state
template (Zachary, Ethaniel, firm fallback) was collapsed by owner direction into a single
page showing both partners with their confirmed direct numbers and addresses, and its Save
action produces two contact records. This is a **frontend-only** change:
`scripts/gas-v2` was not touched, `SLUG_TO_PARTNER` still resolves both partner slugs, and the
per-partner attribution the frontend no longer sends is an accepted loss rather than a
regression. [`design-sources.md`](design-sources.md) records the full deviation and
[`STATUS.md` §3](STATUS.md) the current state. This does not reduce QR functionality; it
changes which of it is reachable from one scan.

So there is no provisional qualifier on anything below. These are current, supported
V2 surfaces:

- `apps/qr`
- QR-specific branches in `packages/submission-client`
- QR-specific branches in `scripts/gas-v2`
- The current QR tests
- `apps/qr` mounts the shared `<E2eBanner />` in `src/Root.tsx`, as `apps/web` already did. Done in the 2026-08-15 safety pass, nothing further is required

Do not make QR retirement part of V1 retirement, and do not reduce QR functionality.

## Confirmed language scope

AxisPoint intends to support all nine registered languages. This is a settled product requirement, not an optional wishlist.

The technical infrastructure is substantially complete. Editorial approval is not.

- English is reviewed and enabled.
- The other eight catalogs remain model-generated review candidates.
- Each non-English language requires fluent review of website copy, visitor emails and meaning-sensitive legal language before activation.
- Languages may be activated individually after review.
- Future meaning-changing copy must be maintained across all nine languages.

The disabled catalogs must not block an English production launch, but their eventual support remains part of the product plan.

## Systems outside the repository

These systems are not classified as repository V1 or V2 source. They require separate authorization and separate operational work.

- The hand-uploaded website currently served at `axispoint.llc`
- cPanel and its document roots
- Namecheap DNS
- Google Workspace MX, SPF, DKIM, DMARC and verification records
- The current `qr.axispoint.llc` hosting files
- The obsolete CRM and its hosting files
- Google Sheets and their data
- Existing Google Apps Script projects and deployments
- GitHub secrets and environments
- FTP credentials
- Machine-local `.env` files
- Ignored `.clasp.json` files
- Netlify, which the owner already removed
- Google Contacts creation, which the owner intentionally abandoned

A git merge does not change any of these systems.

## Special handling: closed

Both items that stood here have been carried out and are recorded above.

- **Partner contact values.** Resolved by owner confirmation and recorded in [`PARTNER_CONTACTS.md`](PARTNER_CONTACTS.md). See *Partner contact values: resolved*.
- **The historical deployment record.** [`archive/deployment-v1.md`](archive/deployment-v1.md) exists, `docs/deployment.md` has had its V1 operating sections removed, and both tags are named in the retirement record above. No secret and no ignored `.clasp.json` content was copied into the archive.

## Current launch boundary

Retiring V1 cleans the repository, but it does not launch V2.

Steps 1 and 2 are done. The remaining production work is:

1. ~~Merge the verification and documentation safety pass.~~ Done, PR #79.
2. ~~Retire confirmed V1 and abandoned residue.~~ Done, August 15, 2026.
3. Provision the V2 backend.
4. Create a staging website.
5. Configure the V2 submission address in the build and hosting process.
6. Verify server routing for direct page loads.
7. Run one authorized end-to-end website submission and booking test.
8. Review the final English website on desktop and mobile.
9. Review and activate the other eight languages individually.

The existing QR Contact Exchange ships as it is and does not gate any step above.

## Documentation authority

Use this hierarchy for current decisions:

1. Current source and passing tests define actual behavior.
2. This document defines the V1, V2, QR and external-system boundaries.
3. `docs/backend-v2-contract.md` defines the intended V2 backend contract. It is now the only backend contract in the repository.
4. `docs/design-sources.md` defines approved visual and content sources.
5. `docs/STATUS.md` records current blockers and owner decisions.
6. `docs/deployment.md` records current deployment and external-system procedures.
7. `docs/CHANGELOG.md` records history and must not be treated as current state.

`CLAUDE.md`, `README.md` and the documentation map must point to this document. They should not maintain independent, detailed copies of this classification because those copies will drift.

## Update rule

Any pull request that changes one of these boundaries must update this document in the same pull request. Examples include:

- ~~Removing V1 from current `main`~~ (done August 15, 2026)
- Replacing the QR Contact Exchange
- Provisioning the V2 backend
- Changing which languages are enabled
- Replacing the hand-uploaded public website
- Changing which external system is authoritative

Do not leave a classification change to a later documentation cleanup.
