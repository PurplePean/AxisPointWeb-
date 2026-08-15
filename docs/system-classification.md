# AxisPoint System Classification

**Last verified:** August 15, 2026  
**Verified repository commit:** `8a6aef1a4e8dee8f01dee11e98a387b7ec9918c8`  
**Safety checkpoint:** `pre-v1-retirement-2026-08-14`  
**Repository state when verified:** clean `main`, identical to the safety checkpoint and live GitHub `main`

## Purpose

This document answers one question: what is current AxisPoint product code, what is historical V1 code, what is transitional QR code, and what exists only outside the repository?

It is a current-state document, not a history of every project decision. Historical details belong in `docs/CHANGELOG.md` and the preserved git tags.

When this document disagrees with a general description elsewhere, inspect the current source and tests before changing anything. Update this document in the same pull request as any change that moves a system from one category to another.

## Business facts that govern this classification

- The website currently visible at `axispoint.llc` is a separate, hand-uploaded build. It was not built from this repository.
- The tracked V1 Apps Script backend under `scripts/gas` is not serving current business traffic.
- V1 is permanently retired as a business system. It does not need compatibility support in current `main`.
- The nine-language product scope is confirmed: English, Spanish, Simplified Chinese, Traditional Chinese, Vietnamese, Hindi, Urdu, Gujarati and Punjabi.
- English is the only reviewed and enabled language today. The other eight are disabled because fluent review is outstanding, not because their inclusion is undecided.
- The current QR Contact Exchange is not the long-term QR product AxisPoint intends to operate. A smaller replacement will be scoped separately.
- Repository changes do not deploy, provision or modify any external system.

## Current V2 core

These systems describe the current website product and must remain during V1 retirement.

### Website

- `apps/web`, except the historical `SharePage.tsx` route
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
- Current QR exchange request and response shapes, until the separate QR replacement pass
- `refToken`, which remains an intentionally inert attribution value carried through the website and backend

### V2 backend

- `scripts/gas-v2`
- Website submission handling
- Booking handling
- Website acknowledgement email
- Booking confirmation email
- Internal website notification email
- Delivery tracking and retry behavior
- Current QR-specific handling, storage, acknowledgement, digest and matching, until the separate QR replacement pass
- Audit-only visitor email translations outside the deployable source allowlist

The V2 backend is written and tested. It has not been provisioned as a Google Apps Script project, connected to a production Sheet, given production settings, assigned triggers or deployed to a public submission address.

### Required supporting infrastructure

- `scripts/test`
- Web route baselines
- Intake-state baselines
- Accessibility assertions
- Locale preview and review artifacts
- Production bundle inspection
- `scripts/hosting`
- `scripts/generate-logos.py`
- Current brand primitives, including `Mark`, `E2eBanner`, the Tailwind preset, `colors.ts` and `fonts.ts`

These are support systems for current V2 work. Their age or location does not make them V1.

## Confirmed V1 scheduled for retirement

These files describe the retired V1 form and backend system. They may be removed after the verification and documentation safety pass is merged.

- All tracked files under `scripts/gas`
- V1 `Code.gs`
- V1 `appsscript.json`
- V1 email template mirror files
- V1 backend tests
- The `test:gas` and `gas:push` package scripts
- The V1 step in the GAS GitHub workflow
- All 19 currently tracked files under `packages/brand/src/components/form`
- `packages/brand/src/utils/vcard.ts`
- `packages/brand/src/team.ts`, subject to the special handling below
- `apps/web/src/pages/SharePage.tsx`
- The `/share/:code` route and comments that describe it
- V1-only operating documents after their historical state has been safely preserved

The deliberate `V1_ENDPOINT_VAR = 'VITE_FORM_ENDPOINT'` checks in the current V2 applications are not V1 runtime code. They are negative safety guards that reject obsolete V1 configuration. Keep them until the production workflow is corrected and verified.

## Abandoned non-V1 residue scheduled for retirement

These items belong to an unfinished articles and publications idea. They are dead, but they should not be described as the V1 backend or V1 form.

- `packages/brand/src/types.ts`
- `content/articles`
- `content/publications`
- `gray-matter`
- `remark`
- `remark-html`
- Their generated lockfile entries

They may be removed in the same cleanup pull request as V1 because they have no current consumers.

## Transitional QR system

The current QR Contact Exchange is a V2-integrated evolution built on a legacy application scaffold. It is V2 for deletion and dependency purposes, but it is not a clean-slate V2 rebuild.

Its current behavior was substantially rewritten during the V2 passes. It uses the shared V2 submission client and V2 backend contract. Therefore it must not be deleted or simplified as part of V1 retirement.

At the same time, the current product is larger than AxisPoint intends to operate long term. It collects visitor information, stores Contact records, sends acknowledgement emails, performs matching, prepares digests and runs scheduled backend work.

The confirmed future direction is a separate minimal digital contact card with:

- A verified partner profile
- Verified contact information
- A downloadable vCard
- Links to the main website
- One permanent address suitable for printed QR codes and email signatures

The replacement will not collect visitor information, submit to the backend, send acknowledgement emails, create Contact records, perform matching, produce digests or require scheduled processing.

Until that replacement is designed, built and approved:

- Keep `apps/qr`
- Keep QR-specific branches in `packages/submission-client`
- Keep QR-specific branches in `scripts/gas-v2`
- Keep current QR tests
- Restore only the missing E2E warning banner during the verification safety pass
- Do not make QR retirement part of V1 retirement

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

## Special handling before deletion

### Historical partner contact values

`packages/brand/src/team.ts` currently contains two email literals and two phone literals. They are historical values, not verified current partner data.

The exact file is preserved by `pre-v1-retirement-2026-08-14`. Do not print the values into logs, prompts or pull request descriptions. Do not copy them into current V2 runtime code or a tracked contact document without owner verification.

Before the future QR replacement is built, obtain current partner contact details directly from the owner and record only the verified values in the replacement's intended data source.

### Historical deployment record

`docs/deployment.md` currently contains mixed V1 and V2 operating information. Its exact pre-retirement contents are preserved by `pre-v1-retirement-2026-08-14` and repository history.

There is no separate `docs/archive` copy as of this verification. Before deleting V1-only deployment instructions, keep a concise dated retirement record in the current documentation that points to:

- `v1-stable` for the historical final V1 state
- `pre-v1-retirement-2026-08-14` for the complete pre-deletion repository state

Do not copy secrets or ignored `.clasp.json` contents into the archive record.

## Current launch boundary

Retiring V1 cleans the repository, but it does not launch V2.

The remaining production work is:

1. Merge the verification and documentation safety pass.
2. Retire confirmed V1 and abandoned residue.
3. Provision the V2 backend.
4. Create a staging website.
5. Configure the V2 submission address in the build and hosting process.
6. Verify server routing for direct page loads.
7. Run one authorized end-to-end website submission and booking test.
8. Review the final English website on desktop and mobile.
9. Review and activate the other eight languages individually.

The simple QR replacement is a separate product pass and should not delay the main website unless printed cards or email signatures are required for the same launch date.

## Documentation authority

Use this hierarchy for current decisions:

1. Current source and passing tests define actual behavior.
2. This document defines the V1, V2, QR and external-system boundaries.
3. `docs/backend-v2-contract.md` defines the intended V2 backend contract.
4. `docs/design-sources.md` defines approved visual and content sources.
5. `docs/STATUS.md` records current blockers and owner decisions.
6. `docs/deployment.md` records current deployment and external-system procedures.
7. `docs/CHANGELOG.md` records history and must not be treated as current state.

`CLAUDE.md`, `README.md` and the documentation map must point to this document. They should not maintain independent, detailed copies of this classification because those copies will drift.

## Update rule

Any pull request that changes one of these boundaries must update this document in the same pull request. Examples include:

- Removing V1 from current `main`
- Replacing the QR Contact Exchange
- Provisioning the V2 backend
- Changing which languages are enabled
- Replacing the hand-uploaded public website
- Changing which external system is authoritative

Do not leave a classification change to a later documentation cleanup.
