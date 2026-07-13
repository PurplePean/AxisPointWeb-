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

## What `qualData` actually persists — a known, pre-existing gap

`buildPayload` collects **13** `qualData` fields. **Exactly one of them reaches the
Sheet.** This is a pre-existing gap, verified against source on 2026-07-12 (it is
**not** caused by, and does not depend on, any migration):

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

So **12 of 13 fields are collected from the visitor and never stored**. Six of those
survive only long enough to render a sentence in an email and are then gone; six are
asked for, transmitted, and read by nothing.

Verification method (repeat it rather than trusting this table): `buildLeadRow`
(`Code.gs:1707-1763`) is the **only** function that writes a lead row, and the only
`qualData` value in it is `assetClassFromQualData(q)`. A grep for the other twelve
names finds hits only inside email-copy strings and comments. Do not infer
persistence from a field appearing in `Code.gs` — grep for `q.<field>`.

**Resolved 2026-07-13: the schema migration FIXES this.** All 13 `qualData` fields
will be persisted into the new unified table's `Details` JSON blob, per lead type —
the twelve currently-dropped fields included. This gap is therefore **live until the
migration ships, and closed by it.** Until then, do not build anything that assumes
these fields are recoverable from the Sheet. See
`UNIFIED_SCHEMA_MIGRATION_PLAN.md` → §2a, which also carries the **verified**
per-lead-type field mapping (the field names alone do not tell you which role asks
which question).

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
  "pressing_issue": string,        // → Message column + partner email, AND echoed back to the
                                   //   visitor in {{personalNote}} (falls back to
                                   //   current_situation when empty)
  "name": string,                  // single field; backend splits into first/last
  "email": string,
  "phone": string,
  "booking": Booking | null,       // same shared object
  "schema_version": 1
}
```

Note the EAO payload has **no** `person` object, `message`, `source`, `heardAbout`,
`page`, `timestamp`, or referral fields — `normalizeEaoPayload` synthesizes `person`,
`message` (from `pressing_issue`), `qualData.assetClasses` (a one-line asset
label), and `preferences` (a JSON dump of every EAO field) server-side. Because it
sends no `source`, `leadSource()` returns `''` and EAO rows land with a blank Source
column even when submitted from the QR microsite.

`normalizeEaoPayload` copies `pressing_issue` into `message` but does **not** delete
the top-level `pressing_issue` / `current_situation`, which is what lets
`buildVisitorPersonalNote` echo them back to the visitor.
