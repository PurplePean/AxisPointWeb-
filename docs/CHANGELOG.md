# Architecture Changelog

Architecture-level changes only — one line each. Routine copy/content edits do
**not** belong here. Dates are the merge/commit date.

## 2026-07-08

- **feat(gas):** Booking calendar events now carry real context and invite all three parties. `createBookingEvent(payload, leadId)` adds attendees (zach@, ethaniel@, and the visitor) with `sendUpdates:'all'`/`sendInvites:true` so Google actually emails invites and the event lands on the partners' personal calendars; sets a descriptive title (`AxisPoint Call: <name> (<category>)`) and a plain-text description (lead ID, email, phone, asset class, source, per-type free-text field, phone-callback number); routes the phone path through the advanced `Calendar.Events.insert` too so the event `htmlLink` can be captured; and returns `{ meetLink, calendarLink }`. `sendPartnerNotification` renders the `calendarLink` ("View in calendar") in the booking block. Ships live only after `clasp push` + `clasp deploy -i`.

## 2026-07-07

- **feat(gas):** **Booking calendar migration — behavior change for ALL bookings.** `createBookingEvent` now writes every event (Meet and phone) to a dedicated shared "AxisPoint Bookings" calendar (`CONFIG.BOOKING_CALENDAR_ID`, read from the new `BOOKING_CALENDAR_ID` Script Property) instead of the deploying account's personal `CalendarApp.getDefaultCalendar()` / the `'primary'` calendar. Requires running `setProperties()` with the real calendar ID, then `clasp push` + `clasp deploy -i`.
- **feat(gas):** New read-only availability endpoint — `doGet ?action=availability&date=<…>` runs `Calendar.Freebusy.query` against the same `BOOKING_CALENDAR_ID` and returns which fixed `BOOKING_SLOTS` are free. Frontend `BookingCalendar` now fetches this on day-select and disables booked slots; on any failure it falls back to showing all slots available. No OAuth scope change (existing `auth/calendar` already covers Freebusy). Replaces the old static `TAKEN` set in `packages/brand`.
- **infra:** Hosting automation scripts built and verified live (`scripts/hosting`), full DNS/subdomain inventory captured, production migration plan documented (not yet executed). See deployment.md.

## 2026-07-06

- **docs:** Established `/docs` as the verified source of truth (backend architecture, email templates, frontend payload schemas, deployment) and corrected the stale root `README.md` against current source.
- **audit:** Confirmed pre-EAO dead code (`curious` / `Explorers` / `'refer'` / `Referrals Made`) is fully removed from `Code.gs`.
- **audit:** Found template drift — all 7 `scripts/gas/emails/*.html` mirrors carry a footer street-address line the embedded `TEMPLATE_*` constants lack, so it does not ship in live email (see email-templates.md).
- **fix(gas):** Added per-role `{{personalNote}}` to visitor confirmation emails — all 5 lead types now reflect back what they actually submitted (investor capital/experience, pro role/markets, referral profession/intent, EAO `pressing_issue`→`current_situation`, submit_referral referred-person name). New helpers `buildVisitorPersonalNote`/`humanList`/`referralIntentClause`; works across meet/phone/no-booking.
- **fix(gas):** Resolved the email-template drift — the footer address line is now embedded in all 7 `TEMPLATE_*` constants; embedded ↔ mirror verified byte-for-byte in sync.

## 2026-07-05 — `fix(gas)` (#10)

- Wired the `existing_asset_owner` (EAO) lead type end-to-end: `normalizeEaoPayload` reshapes the flat EAO payload into the generic lead shape; added `Existing Asset Owners` tab + `Existing Asset Owner` category mapping.
- Fixed `submit_referral` routing: it correctly resolves to the `Referral` category with **no** per-role tab (`categoryTabForRole` returns `null` by design), logging the relationship to the Referrals tab.
- Dead-code removal of the old role vocabulary.
- Config groundwork: `COLD_LEAD_DAYS` centralized in `CONFIG`; `Reports Enabled` opt-out column on the Referral Partners tab (`REPORTS_ENABLED_COL`) driving `sendMonthlyReferralSummaries`.
- OAuth scopes pinned in `appsscript.json` (calendar, gmail.send, spreadsheets, contacts, script.scriptapp) + advanced Calendar v3 service.

## Notes

- Backend deploys are two-step: `clasp push` updates HEAD only; the live `/exec` URL requires `clasp deploy -i <deploymentId>` (see deployment.md).
