# Frontend Payload Schemas

The exact JSON POSTed to the GAS endpoint for each lead type. Verified against
`packages/brand/src/components/form/utils.ts` and `types.ts`.

Both apps render the **same** shared `<ContactForm>` from `@axispoint/brand`,
which reads `VITE_FORM_ENDPOINT` and `fetch`-POSTs the payload:

- `apps/web` → `<ContactForm />` (defaults: `page: 'axispoint.llc'`, `source: ''` — a direct visit has no channel).
- `apps/qr` → `<ContactForm source="qr" page="qr.axispoint.llc" />`.

`source` is the **arrival channel**, never the visitor's "how did you hear about us?"
answer — that is a separate field, `heardAbout`. Conflating them corrupted the CRM's
Source column (stamping e.g. `LinkedIn` as the submission origin) until it was fixed;
see `backend-architecture.md` → *`source` vs `heardAbout`*.

Four roles build their payload with `buildPayload`; `existing_asset_owner` uses
`buildEAOPayload`.

## Shared booking object

Used by every flow. Emitted only when the user chose to book and picked a day +
slot; otherwise `null`.

```ts
booking: {
  date: string;      // "June 27, 2026"  (MONTHS[m] D, YYYY)
  slot: string;      // "2:30 PM"
  meetType: 'meet' | 'phone' | null;
  phone: string;     // requested call-back number when meetType==='phone', else ''
} | null
```

The real Google Meet URL is **not** in the payload — the backend creates it when
it books the Calendar event.

### Availability check (GET, before slot render)

When a day is selected in the shared `BookingCalendar`, `ContactForm` first GETs
the backend for that day's real availability, then renders slots. Identical for
all three booking lead types (Investor, RE Professional, Existing Asset Owner) —
no role branching.

```
GET  {VITE_FORM_ENDPOINT}?action=availability&date=<"June 27, 2026">
→ 200  { "success": true,
         "date": "June 27, 2026",
         "slots": { "8:00 AM": true, "9:00 AM": false, … } }   // true = free
→ 200  { "success": false, "error": "…" }
```

Booked slots (`false`) render visibly disabled (struck through), not hidden; a
loading state shows while the check is in flight. **Fallback:** if the request
fails, returns `success:false`, or no endpoint is configured (local dev), the
frontend treats every slot as available — i.e. a failed check silently reverts to
the pre-availability behavior. Slots are queried against the same shared
`BOOKING_CALENDAR_ID` the backend books onto. (This replaced the old static
`TAKEN` set in `packages/brand`.)

## `buildPayload` roles — `investor`, `referral`, `pro`, `submit_referral`

```jsonc
{
  "role": "investor" | "referral" | "pro" | "submit_referral",
  "qualData": {
    "experience": string[],        // expSel
    "aum": string | null,
    "profession": string | null,
    "clients": string[],
    "referralIntent": string | null,
    "proRole": string | null,
    "markets": string[],
    "proIntent": string | null,
    "relationship": string | null,
    "fit": string[],
    "assetClasses": string[],      // → sheet "Asset Class" column
    "timeline": string | null,
    "awareness": string | null
  },
  "person": {                      // ContactFields
    "firstName": string, "lastName": string,
    "email": string, "phone": string, "company": string
  },
  "preferences": string[],         // comms opt-ins
  "booking": Booking | null,       // shared object above
  "message": string,               // msgField
  "source": string,                // opts.source ?? ''   — arrival channel ONLY ('qr' | '')
  "heardAbout": string,            // s.sourceSel ?? ''   — "how did you hear about us?" answer
  "timestamp": string,             // new Date().toISOString()
  "page": string,                  // opts.page ?? 'axispoint.llc'
  "referralCode": string | null,
  "referredByEmail": string | null,
  "referredByName": string | null

  // conditionally present:
  // "referred": ReferredFields     // ONLY when role === 'submit_referral'
}
```

`qualData` always carries **all** keys; irrelevant ones are just empty/`null`
for the given role (e.g. an investor leaves `proRole` null). `referred` is the only
conditional key.

**`heardAbout` is always sent** by all four `buildPayload` roles (it is `''` when the
visitor skipped the question), not conditionally on `source` as this document
previously stated.

**It IS persisted.** `Code.gs` reads it through `leadHeardAbout(payload)` and
`buildLeadRow` writes it to **`Heard About`, column 31** (the last entry in
`LEAD_HEADERS`, `COLS.HEARD_ABOUT === 30`), on every lead tab. It also gets its own
row in the internal `partner-notification` email. Verified against
`scripts/gas/Code.gs:1761` on 2026-07-12.

> **Corrected 2026-07-12.** This document previously claimed "the backend currently
> discards it — there is no `Heard About` column in `LEAD_HEADERS`", which directly
> contradicted `backend-architecture.md` (which correctly documented column 31). The
> claim was stale: it described the state before 2026-07-08, when the column was
> added. `backend-architecture.md` was right. The two documents now agree.

`buildEAOPayload` sends no `heardAbout`, so EAO rows carry a blank `Heard About`
cell. That is structural (the EAO step order never asks the question), not an
oversight — see the comment block above `buildEAOPayload` and
`backend-architecture.md` → *`source` vs `heardAbout`*.

## What `qualData` persists

**Current behavior: all 13 `qualData` fields are persisted.** The unified schema is live
(`USE_UNIFIED_SCHEMA = true`, `scripts/gas/Code.gs:1348`, flipped at the Phase B cutover in
PR #47). `buildLeadDetails()` writes the collected fields into the unified table's `Details`
JSON blob, per lead type, driven by the field registry's `detailsFrom: 'qualData' | 'payload'`
mapping. The single-column `Asset Class` write still happens as well.

So the historical gap below is **closed**. Do not read the table that follows as a description
of how the backend behaves today.

---

> ### ⚠️ HISTORICAL — describes behavior before the unified-schema cutover
>
> **Retained for context only. Superseded 2026-07-30.** Everything from here to the end of
> this section documents the pre-cutover legacy write path. It is accurate about that path,
> and it is reachable today only if `USE_UNIFIED_SCHEMA` is set back to `false`. It is not a
> description of current behavior, and nothing should be built on it.

`buildPayload` collects **13** `qualData` fields. Under the **legacy** write path, exactly one
of them reached the Sheet. This was verified against source on 2026-07-12 (it was **not**
caused by, and did not depend on, any migration):

| `qualData` field | Persisted to Sheet? | Read anywhere in `Code.gs`? |
|---|---|---|
| `assetClasses` | ✅ **Asset Class** (col 11), via `assetClassFromQualData(q)` | ✅ |
| `aum` | ❌ | Emails only (`buildVisitorPersonalNote`, `sendPartnerNotification`) |
| `experience` | ❌ | Emails only (`buildVisitorPersonalNote`) |
| `proRole` | ❌ | Emails only (`buildVisitorPersonalNote`) |
| `markets` | ❌ | Emails only (`buildVisitorPersonalNote`) |
| `profession` | ❌ | Emails only (`buildVisitorPersonalNote`) |
| `referralIntent` | ❌ | Emails only (`referralIntentClause`) |
| `clients` | ❌ | ❌ **never read at all** |
| `proIntent` | ❌ | ❌ **never read at all** |
| `relationship` | ❌ | ❌ **never read at all** |
| `fit` | ❌ | ❌ **never read at all** |
| `timeline` | ❌ | ❌ **never read at all** |
| `awareness` | ❌ | ❌ **never read at all** |

So under the legacy path **12 of 13 fields were collected from the visitor and never stored**.
Six survived only long enough to render a sentence in an email; six were asked for,
transmitted, and read by nothing.

Verification method for the legacy path: `buildLeadRow` was the **only** function that wrote a
lead row, and the only `qualData` value in it was `assetClassFromQualData(q)`. A grep for the
other twelve names found hits only inside email-copy strings and comments.

**This gap closed at the unified-schema cutover.** All 13 fields now persist into the
`Details` JSON blob per lead type, including the twelve the legacy path dropped. The
per-lead-type field mapping lives in `UNIFIED_SCHEMA_MIGRATION_PLAN.md` §2a; field names alone
do not tell you which role asks which question.

> Documentation note, 2026-07-30: this section previously carried its warning in the present
> tense ("12 of 13 fields are collected and never stored", "do not build anything that assumes
> these fields are recoverable") together with a forward-looking "resolved by the migration"
> paragraph. The migration had already shipped, so the section read as current when it was
> historical. Marked historical rather than deleted, because the legacy branch still exists in
> `Code.gs` behind the flag.

### Referral field resolution

- If a `?ref=` URL param is present (`urlRef`) → `referralCode = urlRef`, and the "were you referred?" toggle is hidden.
- Else, for non-`submit_referral` roles that answered "yes" and typed something, `parseReferralInput()` classifies the free-text input:
  - contains `@` → `referredByEmail`
  - matches `/^AXP-[A-Z0-9]{6}$/i` → `referralCode` (uppercased) — **6-char code**, matching the backend's `AXP-` + 6-char generator
  - otherwise → `referredByName`

### `submit_referral` — the extra `referred` block

```jsonc
"referred": {                      // ReferredFields
  "firstName": string, "lastName": string,
  "email": string, "phone": string, "notes": string
}
```

The backend folds this into the Message column of the submitter's own lead row;
`submit_referral` gets no dedicated category tab (see backend-architecture.md).

## `buildEAOPayload` — `existing_asset_owner`

Flat shape (spreads the assembled `property` object at the top level), not the
`qualData`/`person` shape. The backend's `normalizeEaoPayload` converts it.

```jsonc
{
  "role": "existing_asset_owner",

  // ...property (one of three discriminated shapes) spread at top level:
  //  single:
  "portfolio_type": "single",
  "property_type": string,
  "units"?: number,            // plain count
  "sqft"?: string,             // tier token

  //  portfolio, single asset class:
  //   "portfolio_type": "portfolio",
  //   "portfolio_composition": "single_asset_class",
  //   "property_type": string, "units"?: number, "sqft"?: string

  //  portfolio, mixed asset classes:
  //   "portfolio_type": "portfolio",
  //   "portfolio_composition": "mixed_asset_classes",
  //   "asset_breakdown": Array<{
  //       property_type: string | string[];  // commercial row collapses Retail/Office/Industrial into an array
  //       asset_count: number;
  //       units?: number; sqft?: string;
  //   }>

  "current_situation": string | null,
  "pressing_issue": string,        // → Details.pressing_issue + the internal partner email
                                   //   (via leadMessageText). NOT echoed to the visitor.
  "name": string,                  // single field; backend splits into first/last
  "email": string,
  "phone": string,
  "booking": Booking | null,       // same shared object
  "schema_version": 1
}
```

Note the EAO payload has **no** `person` object, `message`, `source`, `heardAbout`,
`page`, `timestamp`, or referral fields. `normalizeEaoPayload` synthesizes `person`
and `qualData.assetClasses` (a one-line asset label) server-side. Because it sends
no `source`, `leadSource()` returns `''` and EAO rows land with a blank Source
column even when submitted from the QR microsite.

**Corrected 2026-07-16 — this paragraph described two behaviors that the
2026-07-15 A1/A2 cleanup had already removed.** `normalizeEaoPayload` no longer
synthesizes `message` from `pressing_issue` (so `Details.message` is `''` for EAO
and the free text lives once, in `Details.pressing_issue`), and no longer stuffs
`preferences` with a JSON dump of every EAO field (those fields have real `Details`
keys via the registry, `detailsFrom: 'payload'`).

The normalizer still **adds** the generic fields without deleting the top-level
`pressing_issue` / `current_situation`. What now reads them:

| Reader | Reads `pressing_issue`? |
|---|---|
| `buildLeadDetails` → `Details.pressing_issue` | ✅ |
| `leadMessageText` → partner notification, internal booking dump, resubmission notices | ✅ (EAO fallback) |
| `buildVisitorPersonalNote` → the visitor's confirmation email | ❌ **not since 2026-07-16** — the EAO "What you told us" callout was removed, so EAO confirmations carry no note at all. |
