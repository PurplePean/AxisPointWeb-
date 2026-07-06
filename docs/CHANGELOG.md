# Architecture Changelog

Architecture-level changes only — one line each. Routine copy/content edits do
**not** belong here. Dates are the merge/commit date.

## 2026-07-06

- **docs:** Established `/docs` as the verified source of truth (backend architecture, email templates, frontend payload schemas, deployment) and corrected the stale root `README.md` against current source.
- **audit:** Confirmed pre-EAO dead code (`curious` / `Explorers` / `'refer'` / `Referrals Made`) is fully removed from `Code.gs`.
- **audit:** Found template drift — all 7 `scripts/gas/emails/*.html` mirrors carry a footer street-address line the embedded `TEMPLATE_*` constants lack, so it does not ship in live email (see email-templates.md).

## 2026-07-05 — `fix(gas)` (#10)

- Wired the `existing_asset_owner` (EAO) lead type end-to-end: `normalizeEaoPayload` reshapes the flat EAO payload into the generic lead shape; added `Existing Asset Owners` tab + `Existing Asset Owner` category mapping.
- Fixed `submit_referral` routing: it correctly resolves to the `Referral` category with **no** per-role tab (`categoryTabForRole` returns `null` by design), logging the relationship to the Referrals tab.
- Dead-code removal of the old role vocabulary.
- Config groundwork: `COLD_LEAD_DAYS` centralized in `CONFIG`; `Reports Enabled` opt-out column on the Referral Partners tab (`REPORTS_ENABLED_COL`) driving `sendMonthlyReferralSummaries`.
- OAuth scopes pinned in `appsscript.json` (calendar, gmail.send, spreadsheets, contacts, script.scriptapp) + advanced Calendar v3 service.

## Notes

- Backend deploys are two-step: `clasp push` updates HEAD only; the live `/exec` URL requires `clasp deploy -i <deploymentId>` (see deployment.md).
