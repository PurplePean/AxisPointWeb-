# Unified Schema Migration Plan

**Status:** IN EXECUTION. Created 2026-07-12. **Stage 1 of N shipped 2026-07-14.**
**DECISION-COMPLETE as of 2026-07-13:** all three open decisions in §2 are resolved.
Nothing in this document is waiting on an answer.

## Execution status

| Stage | Scope | State |
|---|---|---|
| **1** | The unified schema constants (`UNIFIED_LEAD_HEADERS`, `UCOLS`, `resolveUnifiedCols`, `chainAncestors`), the `USE_UNIFIED_SCHEMA` switch, and **`updateReferrerStats`** — including multi-level `Total Downstream` (§2c) | ✅ **DONE 2026-07-14.** 61/61 tests green. Not deployed; the switch is off. |
| 2…N | Every other function in §3 | ⬜ Not started |
| Cutover | Flip `USE_UNIFIED_SCHEMA`, run `setupSpreadsheet()`, deploy, delete the legacy bodies (§6) | ⬜ Not started |

### The staging pattern — Stage 2 MUST follow this exactly

The migration cannot flip in one commit, and the two schemas must never both be
live (§6). The reconciliation is **one module-level switch in `Code.gs`**:

```js
var USE_UNIFIED_SCHEMA = false;   // the single cutover switch. Off = production today.
```

Every migrated function becomes **three** things:

1. `xxxUnified(...)` — the new implementation, against the one `Leads` table.
2. `xxxLegacy(...)` — the old body, **verbatim**, marked `DELETE AT CUTOVER`.
3. `xxx(...)` — a dispatcher: `return USE_UNIFIED_SCHEMA ? xxxUnified(...) : xxxLegacy(...)`.

**Both branches get tested.** The legacy test proves production is still intact at
that commit; the unified test proves the migration is right before it ships. Tests
flip the switch by assigning `sandbox.USE_UNIFIED_SCHEMA = true` on the loaded
sandbox — see `scripts/gas/tests/referrer-stats.test.js`, which is the reference
implementation of the whole pattern.

**Why a switch and not "does the `Leads` tab exist?"** Tab-existence detection
would silently flip the entire backend the moment somebody ran `setupSpreadsheet()`
by hand, mid-migration, with half the functions still writing to the old tabs. The
switch makes the cutover a reviewed line of code instead of a side effect.

**What this buys:** every stage is independently mergeable and independently
deployable, because with the switch off, a merged stage is a **no-op in
production**. The migration can land over N PRs without ever leaving `main` in a
half-broken state.

**At cutover** (§6, after every stage is done): flip the switch, delete every
`xxxLegacy` body, delete the switch itself, delete the nine tabs and the §4 list.
Nothing is deleted before then — the legacy bodies are the rollback path.

### Stage 1 notes for whoever picks up Stage 2

- **`CONFIG.TABS.LEADS = 'Leads'`** exists now. `setupSpreadsheet()` still does
  **not** create it — that is deliberate and is part of the cutover, not Stage 1.
- **The 25-column layout is now real code** (`UNIFIED_LEAD_HEADERS` + `UCOLS`), in
  the exact order of §1's table. `buildLeadRow`'s rewrite must build against it.
- **`resolveUnifiedCols(sheet)` is the only sanctioned way to read a live `Leads`
  row.** Same contract as `resolveCols`: resolve by name, **throw** on a miss,
  never a silent `-1`. Call once per sheet, never per row.
- **One ambiguity in this document that Stage 2 must resolve, not inherit:** §1's
  column table has **no `Message` column** (the 25 columns are exactly as listed),
  and §1's `Details` table puts `message` inside the blob under *All types*. But
  §2b says "the **Message column** goes back to holding only what the submitter
  typed". Those two readings conflict. Stage 1 implemented the column list
  verbatim (no top-level Message; `message` lives in `Details`), because the
  column list is normative and §2b's phrasing is about *content*, not placement.
  **`buildLeadRow`'s author should confirm that reading before writing the row.**

---

**Scope:** the Google Sheet CRM schema, and the `Code.gs` functions that read and
write it. Nothing else. See *Explicitly out of scope* at the bottom before assuming
this covers anything more.

**Why now.** The Sheet is **empty** — zero data rows on every lead tab (confirmed
live 2026-07-09 via `auditLeadTabHeadersSummary()`, visually re-confirmed
2026-07-10). There is no data-preservation problem to solve, so the migration is
structurally as cheap as it will ever be. That window closes the moment real
submissions land. The per-tab schema's one remaining justification (automation
coupled to physical tabs; see `backend-architecture.md` → *Architecture Decision*)
is precisely what this plan rewrites.

**Every claim below was verified against `scripts/gas/Code.gs` on 2026-07-12, not
inherited from a prior summary.** Do the same when you execute it: the recurring
failure mode in this project is trusting a description of the code over the code.

---

## 1. Target schema

**One table, `Leads`,** replacing the nine lead tabs (Active Leads, Lifetime Leads,
Cold Leads, Investors, Referral Partners, RE Professionals, Existing Asset Owners,
Clients, Archive). A lead becomes **one row, in one place, forever.** Status and
Category become the values they always were, instead of being encoded in *which tab
the row was copied to*.

The `Referrals` and `Subscribers` tabs keep their own schemas
(`REFERRAL_HEADERS`, `SUBSCRIBER_HEADERS`) and are **not** part of this migration.

### Real top-level columns

These stay real, searchable columns. **The rule: a field is a column if code must
search on it, or if `onSheetEdit` must detect an edit to that specific column.** A
JSON blob satisfies neither — you cannot `indexOf` into it across rows, and an edit
to a key inside it is indistinguishable from an edit to any other key.

| # | Column | Why it must be top-level |
|---|---|---|
| 1 | Lead ID | Primary key. Every lookup, `updateReferrerStats`, the referral chain. |
| 2 | Timestamp | The single source of "when submitted" — `sendDailyDigest`'s today-filter and `moveColdLeads`' age calc both read it. |
| 3 | Category | Drives Contact Groups; **`onSheetEdit` watches this column** (`handleCategoryEdit`). |
| 4 | Status | Replaces tab membership entirely; **`onSheetEdit` watches this column** (`handleStatusEdit`). |
| 5 | Email | Dedupe key (`findExistingLead`, lowercased) and a `matchReferrer` match path. |
| 6 | First Name | Half of the `matchReferrer` name path. |
| 7 | Last Name | Half of the `matchReferrer` name path. |
| 8 | Referral Code | The person's own shareable code. `matchReferrer`'s highest-priority path; `generateReferralCode` collision-checks against it. |
| 9 | Referred By Lead ID | Referral identity. `updateReferrerStats` resolves the referrer by it. |
| 10 | Referred By Name | Referral identity. Written by `matchReferrer`/`handleManualReferralLink`. |
| 11 | Referred By Email | Referral identity. **`onSheetEdit` watches this column** (`handleManualReferralLink`) — a human types into it to link a referral by hand. |
| 12 | Referred By Code | Referral identity. |
| 13 | Match Type | `code` / `email` / `name` / `manual` / `none`. |
| 14 | Referral Chain | Pipe-separated Lead IDs, origin → immediate referrer. **The input to multi-level `Total Downstream` attribution** (§2c) — it already holds every ancestor, so it must be readable per row. |
| 15 | Chain Depth | Integer. |
| 16 | Direct Referrals | Running count of **immediate** referrals only. Incremented by `updateReferrerStats`. |
| 17 | Total Downstream | Running count of the **whole downstream subtree** — every lead referred by anyone in this person's downstream, at any depth. Incremented by `updateReferrerStats` for every ancestor in a new lead's Referral Chain (§2c). **Must be a real column, not a `Details` key:** it is a counter that gets read-modify-written on rows *other than* the row being inserted. |
| 18 | Last Referral Date | Written by `updateReferrerStats`. |
| 19 | Phone | Contact identity; cheap, universal, and read by `createContact`. |
| 20 | Company | Same. |
| 21 | Role | The raw wire value; the key that selects how to interpret **Details**. |
| 22 | Source | Arrival channel (`QR` / blank). **Never** the visitor's "how did you hear" answer. |
| 23 | Heard About | The visitor's own answer. Distinct from Source — conflating them corrupted the Source column once already. |
| 24 | Reports Enabled | The Referral Partners per-tab extra becomes a normal column on the one table. Blank/`TRUE` = receives the monthly summary, `FALSE` opts out. Its whole bug class (`REPORTS_ENABLED_COL = LEAD_HEADERS.length`) dies with the per-tab extra. |
| 25 | Details | **The JSON blob.** Everything type-specific. See below. |

The **eleven referral-identity columns (8-18) are non-negotiable as real columns.**
`matchReferrer` searches Referral Code, Email, and Name across all leads, and
`onSheetEdit`'s dispatch must be able to tell that *the Referred By Email cell
specifically* was the one edited. Both requirements die the moment those fields
move into a blob. This is the single most important constraint in the target schema.

### What goes in `Details` (JSON)

Everything role-specific, keyed by the field names the payload already uses.
**Every field listed here is written — including the twelve that are silently
dropped today** (§2a, resolved). The blob is what ends that data loss.

The per-role mapping below was **re-verified against the form source on 2026-07-13**
(`Step2Context.tsx` role gates, `Step3AssetClass.tsx`, and `ContactForm.tsx:159`) —
an earlier draft of this document guessed it and got **four of thirteen assignments
wrong**. Do not re-derive it from the field *names*; they do not tell you which role
asks the question.

| Lead type | `Details` keys (all persisted) | Collected by |
|---|---|---|
| **Investor** (`investor`) | `aum`, `experience`, `assetClasses`, `timeline` | `Step2Context` (aum, experience) + `Step3AssetClass` (assetClasses, timeline) — the `prefs` step, which **only the investor flow reaches** (`ContactForm.tsx:159`) |
| **Referral Partner** (`referral`) | `profession`, `clients`, `referralIntent` | `Step2Context` |
| **RE Professional** (`pro`) | `proRole`, `markets`, `proIntent` | `Step2Context` |
| **submit_referral** | `relationship`, `fit`, `awareness`, **plus `referred`** (§2b) | `Step2Context` + the referred-person fields |
| **Existing Asset Owner** (`existing_asset_owner`) | `portfolio_type`, `portfolio_composition`, `property_type`, `units`, `sqft`, `asset_breakdown`, `current_situation`, `pressing_issue` | its own flow (`buildEAOPayload`) |
| **All types** | `preferences` (comms opt-ins), `booking` (`date`, `slot`, `meetType`, `phone`, `meetLink`), `message` | shared steps |

That is **all 13 `qualData` fields**, each under exactly one lead type. Note that
**every one of `submit_referral`'s three fields is currently read by nothing at
all** — today that lead type's entire qualified data is discarded. It is the biggest
single beneficiary of §2a.

`submit_referral`'s `referred` object (§2b):

```jsonc
"referred": { "firstName": …, "lastName": …, "email": …, "phone": …, "notes": … }
```

**The proven model is already in the codebase.** `eaoDetailsSummary(payload)`
(`Code.gs:1859`) JSON-stringifies every EAO-specific field into the shared
**Preferences** column, precisely because EAO has no dedicated columns.
`normalizeEaoPayload` then sets `payload.preferences = [eaoDetailsSummary(payload)]`.
That pattern works, is in production, and is what this migration generalizes to all
five lead types. Read those two functions before designing `Details` — do not invent
a new convention.

**Asset Class** (currently col 11, the only persisted `qualData` field) is a
judgment call left to the implementer: it is derived (`assetClassFromQualData`), not
collected, and nothing searches on it. Recommend it moves into `Details`, with the
one-line human-readable label kept as a top-level column **only if** someone wants
to eyeball it in the grid — which, per the standing rule, is **not** a valid reason
(see *What is explicitly NOT a reason* in `backend-architecture.md`).

---

## 2. Decisions — ALL THREE RESOLVED. This plan is decision-complete.

Three real questions were left open when this plan was written. **All three are now
answered.** Nothing in this document is waiting on a decision; it is ready to
execute.

| # | Decision | Resolved | Outcome |
|---|---|---|---|
| **2a** | The 12 under-persisted `qualData` fields | 2026-07-13 | ✅ **FIX during the migration.** All 13 fields persist into `Details`. |
| **2b** | `submit_referral`'s referred-person data | 2026-07-13 | ✅ **Structured JSON** under `Details.referred`. Not prose, not a top-level column. |
| **2c** | `Total Downstream` | 2026-07-13 | ✅ **Implement** as real multi-level attribution. Not retired. |

Read all three as **requirements**, not questions. Each is recorded in
`/docs/CHANGELOG.md`.

### 2a. The 12 under-persisted `qualData` fields — ✅ RESOLVED 2026-07-13: fix them

**Decision: the twelve dropped fields get FIXED as part of the migration. They are
NOT ported as-is.** Every `qualData` field a lead type collects is written into that
lead type's `Details` JSON blob going forward.

**Current state (the bug being ended):** `buildPayload` collects 13 `qualData`
fields and **`buildLeadRow` persists exactly one** (`assetClasses` → the Asset Class
column). Six more are read only to render a sentence in an email and are then
discarded (`aum`, `experience`, `proRole`, `markets`, `profession`,
`referralIntent`); six are read by **nothing at all** (`clients`, `proIntent`,
`relationship`, `fit`, `timeline`, `awareness`). Verified 2026-07-12; full table in
`frontend-payload-schemas.md`.

**This is a pre-existing silent data-loss bug, not something the migration
introduces.** The visitor answers the question, the browser sends the answer, and
the backend throws it away. The migration is where it stops — carrying it forward
into a brand-new schema would mean deliberately re-implementing a known bug in code
being written from scratch.

The per-lead-type field mapping is in §1 (*What goes in `Details`*), re-verified
against the form source on 2026-07-13. **Use that table, not the field names** — the
names do not tell you which role asks the question, and an earlier draft of this
plan guessed and got four of thirteen assignments wrong.

Two consequences worth naming:

- **`submit_referral` is the biggest beneficiary.** All three of its `qualData`
  fields (`relationship`, `fit`, `awareness`) are in the never-read-at-all group, so
  today **100% of that lead type's qualified data is discarded.** After the
  migration, all of it lands.
- **Emails are unaffected.** The six email-only fields keep rendering exactly as they
  do now. Persisting a field does not change what the email says. `buildLeadRow`
  gains writes; `buildVisitorPersonalNote` and `sendPartnerNotification` are untouched
  by this decision.

### 2b. `submit_referral`'s referred-person data — ✅ RESOLVED 2026-07-13: structured JSON

**Decision: lift it into structured JSON under `Details.referred`. It does NOT stay
prose, and it does NOT become a top-level column.**

**Current state:** `buildLeadRow` (`Code.gs:1715-1728`) flattens `payload.referred`
(`firstName`, `lastName`, `email`, `phone`, `notes`) into a newline-joined prose
block and **prepends it to the Message column**:

```
Referred person:
  Name: Jane Doe
  Email: jane@example.com
  Phone: 555-0100
  Notes: interested in multifamily
```

It is unparseable, unqueryable, and interleaved with the submitter's own free-text
message. Getting Jane's email back out means regex-ing a human-readable paragraph.

**After:** a real object inside the submitting lead's `Details` blob:

```jsonc
"referred": { "firstName": "Jane", "lastName": "Doe", "email": "jane@example.com",
              "phone": "555-0100", "notes": "interested in multifamily" }
```

The **Message** column goes back to holding only what the submitter actually typed.

#### Why `Details`, and explicitly NOT a top-level column

This follows the plan's established rule (§1): **a field is a top-level column if
code must search on it across rows, or if `onSheetEdit` must detect an edit to that
specific column.** The referred-person data satisfies **neither**:

- **Nothing ever searches other leads' rows for it.** `matchReferrer` searches for a
  *referrer* — by Referral Code, Email, or Name — against the **referrer's own lead
  row**, which is a real, separately-created lead with its own identity columns. It
  never scans for a referred-person block buried in some other lead's submission.
  `findExistingLead` dedupes on the submitter's Email column. No lookup, present or
  planned in this migration, needs this data to be searchable across rows.
- **It is scoped to exactly one row** — the submitting lead's own. It describes a
  person the submitter told us about, on the submitter's row. That is the textbook
  definition of type-specific payload detail, which is what `Details` is for.
- **It appears on one lead type out of five.** Promoting it to a top-level column
  would add five always-blank columns to every Investor, Referral Partner, RE
  Professional, and EAO row — reintroducing exactly the per-type-columns-on-a-shared-
  layout problem this migration exists to delete.

This is the same reasoning that keeps the referral-*identity* fields (Referral Code,
Referred By *, Match Type, Referral Chain, Chain Depth, Direct Referrals, Total
Downstream) as real columns while everything type-specific goes in the blob. The
distinction is **searchability and edit-detection, not importance.** The referred
person's details are important; they are simply never searched.

**Note the asymmetry, because it is easy to misread:** if the referred person later
submits their own form, they become their **own lead row** with their own real
identity columns, and `matchReferrer` links them to the submitter through the normal
referral path. The `Details.referred` block is a record of *what the submitter told
us*, not a stand-in for a lead. It never needed to be searchable, which is exactly
why it can live in the blob.

### 2c. `Total Downstream` — ✅ RESOLVED 2026-07-13: implement it

**Decision: implement real multi-level referral attribution. The field is NOT
retired.**

**The intent, stated plainly:** if John refers Steven, and Steven later refers
Maria, then Maria counts toward **both** Steven's *and* John's Total Downstream. The
**entire upstream chain** gets credited, not just the immediate referrer. Credit
propagates all the way to the origin of the chain, however deep it goes.

**Current state:** the column is seeded `0` by `buildLeadRow` and **written by
nothing** — `updateReferrerStats` only ever touches `Direct Referrals` and `Last
Referral Date`. It has been permanently `0` on every row since it was created.
Verified 2026-07-12.

#### This is a computation fix, not a data-collection gap

**No new data collection is required. The `Referral Chain` field already stores
exactly what is needed.** Verified against `Code.gs:1582-1601` on 2026-07-13:
`buildReferralMatch` builds the new lead's chain as

```js
var chain = referrerChain ? referrerChain + '|' + referrerLeadId : referrerLeadId;
```

That is: **the referrer's own chain, plus the referrer's Lead ID appended.** Two
properties of this fall out, and the implementation depends on both:

1. **The chain is precisely the list of ancestors**, ordered origin → immediate
   referrer, with the **immediate referrer last**.
2. **The chain does NOT contain the new lead's own Lead ID.** It is appended to the
   *next* lead's chain, not its own.

So for Maria (referred by Steven, who was referred by John), Maria's Referral Chain
is `AXP-2026-0001|AXP-2026-0002` (John, then Steven). Every ancestor who should be
credited is already sitting in that one cell, and nobody who should *not* be credited
is in it. **No walking of parent rows, no recursive lookups, no new field.**

#### The fix

When a new referred lead is created, **walk its entire Referral Chain and increment
`Total Downstream` by 1 for every ancestor Lead ID in it** — not just the last entry.
Because the chain contains ancestors only, this is a plain split-and-loop with no
filtering:

```js
// Total Downstream: EVERY ancestor in the chain, not just the immediate referrer.
chain.split('|').filter(Boolean).forEach(function(ancestorLeadId) {
  incrementTotalDownstream(ancestorLeadId, 1);
});
```

**`Direct Referrals` is unchanged and must stay unchanged.** It continues to
increment **only** for the immediate referrer (`referralMatch.referrerLeadId`, the
last chain entry). That distinction is correct and deliberate, and it is the whole
reason both columns exist:

| Column | Increments for | Maria's submission credits |
|---|---|---|
| **Direct Referrals** | the **immediate referrer only** | Steven (+1). John: **no change.** |
| **Total Downstream** | **every ancestor** in the Referral Chain | Steven (+1) **and** John (+1). |

Total Downstream is a **new, additional, multi-level count layered alongside** Direct
Referrals. It does not replace it and does not change its semantics.

#### Where it belongs: inside the `updateReferrerStats` rewrite

**This is part of the `updateReferrerStats` rewrite (§3), not a separate follow-up
task.** That function is already flagged as the **highest-risk, highest-priority**
rewrite in the function-by-function list, and multi-level counting belongs there for
a structural reason, not a scheduling one:

- Multi-level counting means **updating potentially many ancestor rows** from a single
  submission, not one. Under the **current** per-tab schema, each of those ancestors
  is duplicated across up to nine tabs, so crediting a 4-deep chain could mean finding
  and writing **dozens** of rows across nine sheets, each with its own
  `resolveCols` + full-range read, each able to partially fail and leave counts
  inconsistent *across tabs for the same person*. That is precisely the mess the
  current function's per-tab loop exists to manage.
- **Under the unified schema it collapses to what it actually is:** N single-row
  lookups by Lead ID against one table, where N is the chain depth. One place per
  ancestor to write, one place to be correct.

So the operation only becomes safe and simple **once the unified schema removes row
duplication** — which is exactly why it ships *with* that rewrite. Implementing
multi-level counting against the current nine-tab schema would be building the
hardest version of this feature immediately before deleting the reason it was hard.

**Signature change both call sites must carry:** `updateReferrerStats(referrerLeadId)`
needs the **chain** as well, e.g. `updateReferrerStats(referrerLeadId, chain)`. Both
existing callers already have it in hand — `handleFormSubmission` (`Code.gs:1447`,
via `referralMatch.chain`) and `handleManualReferralLink` (`Code.gs:2599`, which
computes `chain` immediately above the call). **The manual-link path must credit the
full chain too**; a hand-linked referral is not a second-class one.

**Backfill is a non-issue:** the Sheet is empty, so there are no historical chains to
recompute. Total Downstream starts correct rather than starting wrong and needing a
repair tool.

---

## 3. Function-by-function rewrite list

Every function below reads or writes the lead tabs and therefore changes. Risk is
"what happens if this is wrong", not "how hard is it to type".

| Function | What changes | Risk |
|---|---|---|
| ✅ **`updateReferrerStats`** — **MIGRATED 2026-07-14 (Stage 1).** Now a dispatcher over `updateReferrerStatsUnified` (new) and `updateReferrerStatsLegacy` (the old body, verbatim, delete at cutover). The unified path indexes the one table by Lead ID once, credits `Total Downstream` to every ancestor from `chainAncestors(chain)`, and credits `Direct Referrals` + `Last Referral Date` to the immediate referrer **only**. Both call sites now pass the chain. Covered by `scripts/gas/tests/referrer-stats.test.js` (11 tests: 4-deep chain, the Direct-Referrals regression, 1-deep and no-referrer boundaries, a duplicated chain entry, a chain naming a missing row, a header miss, and the legacy branch). | *Original entry, for the record:* **Loops every lead tab** and updates the referrer's row on each, because the same lead is duplicated across up to 9 tabs. Collapses to a **single-row lookup by Lead ID** on one table. The whole per-tab loop, the per-tab `try`/`resolveCols`, and the `break`-after-first-match all vanish. **Also gains multi-level `Total Downstream` attribution in this same rewrite** (§2c, resolved): takes the chain as a second argument, increments `Direct Referrals` for the immediate referrer **only**, and increments `Total Downstream` for **every ancestor** in the Referral Chain. Becomes N single-row lookups, N = chain depth. | 🔴 **HIGHEST.** This function *only exists in its current form because of row duplication.* It is also the least-tested write path in the file: it does a read-modify-write of a counter with no transaction, and today a partial failure leaves counts inconsistent *across tabs*. **Multi-level counting raises the stakes further — one submission now writes to many ancestor rows** — which is exactly why it lands here, where each ancestor is one row instead of nine. Rewrite it first, test it hardest. Get this wrong and referral stats — the thing the whole referral product is measured by — are silently wrong. |
| **`moveColdLeads`** (2416) | Stops **physically relocating rows** between tabs. Becomes: find rows whose Status ∈ {New Lead, Contacted, Active} and whose Timestamp is older than `COLD_LEAD_DAYS`, then **set Status = `Cold`**. One field write; no append, no `deleteRow`. | 🔴 High. It is one of only two functions that **delete rows** today. The rewrite removes the deletion entirely, which is a large net safety win — but the transitional version is the single most dangerous code in the migration. |
| **`handleStatusEdit`** (2623) | Stops moving rows to Cold Leads / Clients / Archive. A status edit becomes **just a status edit** (plus its Contact-group side effects). Most of the function disappears. | 🔴 High. The other row-deleting function. Deletion logic must be *removed*, not ported. |
| **`setCategoryTabStatus`** (2492) | **Deleted.** Its only job is keeping a duplicated row's Status in sync on the category tab. With one row, there is nothing to sync. | 🟢 Low (it stops existing). |
| **`sendMonthlyReferralSummaries`** (2324) | Reads the **Referral Partners tab** and its extra `Reports Enabled` column. Becomes: filter the one table on `Category = 'Referral Partner'`, read `Reports Enabled` as a normal column, keep the existing skips (`Cold`/`Archive` status, `FALSE` opt-out, zero-referral partners). | 🟠 Medium. Currently untested, and a filter bug silently emails the wrong people — or nobody. |
| **`onSheetEdit`** (2524) | Its **lead-tab guard** (`leadTabConfigs()` membership) becomes a single `sheet.getName() === 'Leads'` check. The three watched columns must still be resolved **by name** (`resolveCols`) so the dispatch detects *which* column changed. | 🟠 Medium. If the dispatch guard is wrong, edits are routed to the wrong handler or dropped silently. |
| **`handleFormSubmission`** (1357) | Appends to **three tabs** (Lifetime + Active + category tab). Becomes **one append**. The category-tab-exists check, the `seedReportsEnabled` per-tab seed, and the missing-tab logging all collapse. | 🟠 Medium. Highest-traffic path in the file; end-to-end untested today (see §5). |
| **`buildLeadRow`** (1707) | Builds a positional 31-value array from `COLS`. Becomes a 25-column array + a serialized `Details` blob. Still correctly positional — it *constructs* the canonical layout rather than reading a possibly-drifted one. **Implements both §2a and §2b in this same rewrite:** it now writes **all 13 `qualData` fields** into `Details` (per the §1 per-lead-type table) instead of dropping twelve of them, and it writes `submit_referral`'s `referred` block as a **structured `Details.referred` object** instead of flattening it into prose on the Message column. **The prose-building code at `Code.gs:1715-1728` is deleted, not ported** — and Message goes back to holding only what the submitter typed. | 🟠 Medium-high. Every column's meaning changes at once, **and** this is the function where the two data-fidelity fixes actually land — if `Details` is built wrong here, the data loss the migration exists to end simply continues in a new format. |
| **`findExistingLead`** (1517) / **`existingReferralCodes`** (1278) / **`matchReferrer`** + **`buildReferralMatch`** (1533/1582) / **`handleResubmission`** (1469) | All currently scan **Lifetime Leads**. Retarget to the one table. Logic is otherwise unchanged — this is the cheapest group. | 🟢 Low-medium, but `matchReferrer` is the reason the referral-identity fields must stay real columns. |
| **`sendDailyDigest`** (2260) | Reads Active Leads. Retarget to the one table, filtered on Status. | 🟢 Low. |
| **`handleCategoryEdit`** (2667) / **`handleManualReferralLink`** (2564) / **`moveContactToCold`** (2508) | Retarget from a tab to the table. Contact-group side effects unchanged. | 🟢 Low. **But see the `createContact` defect** in `backend-architecture.md` — do not assume the Contacts side of these works today. |
| **`setupSpreadsheet`** (3462) | Creates 11 tabs from `leadTabConfigs()`. Becomes: create **`Leads` + `Referrals` + `Subscribers`** (3 tabs). Keep the `getLastRow() === 0` guard. | 🟠 Medium. **This is the function that must be run manually from the Apps Script editor** to create the new tab. `clasp deploy` does not create tabs — skipping this step is exactly what broke EAO. |
| **`LEAD_TYPES` / `leadTabConfigs` / `categoryTabForRole` / `leadTypeTabConfigs`** (146-254) | `.tab` and `.tabColor` become meaningless and come out of the registry. `.category`, `.contactGroup`, `.normalizer`, `.seedReportsEnabled` all stay. The registry itself **survives and stays the single definition site.** | 🟢 Low. |
| **`resolveCols`** (1175) + `COLS` + `LEAD_HEADERS` | Rewritten against the new 25-column layout. **The function's contract does not change and must not be weakened:** resolve by name, **throw `headerLookupError` on a miss, never return a silent `-1`.** | 🟠 Medium. It is the safety floor the entire rewrite stands on. |
| **`reportsEnabledIndex`** (1138) / **`headerIndex`** (1124) | `Reports Enabled` becomes a standard column resolved by `resolveCols` like any other. Both helpers likely **delete outright** — `headerIndex`'s only remaining caller is `reportsEnabledIndex`. | 🟢 Low. |
| **`scripts/gas/tests/resolve-cols.test.js`** | Rewritten against the new layout. **Keep the mangled-header fixture technique.** | 🟢 Low. |
| **`scripts/gas/tests/live-sheet-functions.test.js`** | Substantially rewritten: its fake-sheet world is nine tabs. Becomes one table — and grows the new coverage demanded in §5. | 🟠 Medium. |

---

## 4. Deleted outright

These are not "rewritten". They exist **solely** to manage the consequences of having
nine parallel copies of one schema. With one table they have no reason to exist, and
carrying them forward would be carrying forward the problem.

**The header audit / repair family** — every one of these exists because nine tabs
could each drift independently:

- `expectedHeadersFor` (1036) — "the header a *given tab* should have". One table, one header.
- `leadTabHeaderAudit` (3674)
- `renderLeadTabHeaderDetail` (3718)
- `auditLeadTabHeadersSummary` (3758) — a per-tab summary of one tab is a table with one row.
- `auditLeadTabHeaderDetail` (3813)
- `headerRewriteRefusal` (3845)
- `rewriteLeadTabHeaderRow` (3861)
- `formatHeaderRowForLog` (3900)
- `repairLeadTabHeader` (3915)
- `repairAllDriftedLeadTabHeaders` (3963)

**The EAO backfill family** — exists solely because the EAO *category tab* did not
exist and rows were dropped into the gap between Lifetime Leads and a tab. With no
category tabs, there is no gap and nothing to back-fill:

- `eaoBackfillPlan` (3542)
- `countMissingEaoCategoryRows` (3626)
- `backfillEaoCategoryRows` (3641)
- `openCrmSpreadsheet` (3533) — a helper for the above; delete only if it has no
  other caller **at the time you delete it** (grep, do not assume).

**Also deleted:** `setCategoryTabStatus` (2492), and `headerIndex` /
`reportsEnabledIndex` (see §3).

**Keep** the resilient-matching helpers — `normalizeHeaderName`, `findHeaderIndex`,
`describeHeaderRow`, `headerLookupError` (1069-1103). `resolveCols` still depends on
them, and a single header row can still be hand-mangled in the live Sheet. One table
does not mean a trusted header.

**Order matters:** delete these *last*. See §6. Two of them (`auditLeadTabHeadersSummary`,
`countMissingEaoCategoryRows`) are read-only diagnostics that may be worth running one
final time against the old tabs before they go.

---

## 5. Test strategy — coverage lands *with* the rewrite, not after

The suite is at `scripts/gas/tests/` (`pnpm test:gas`, CI via
`.github/workflows/test-gas.yml`; 50 tests passing as of 2026-07-12). It covers the
pure functions, `resolveCols`, template parity, and the slots sync. **It does not
meaningfully cover the functions this migration rewrites.**

That overlap is not a coincidence — it is the risk. **The riskiest, least-tested
functions in the file are exactly the ones being rewritten.** Writing them a second
time with no test is how a silent data bug ships into a brand-new schema and gets
blamed on the schema.

**These get real coverage as part of the migration, in the same PRs that rewrite them
— not in a follow-up that never comes:**

| Function | What the test must actually prove |
|---|---|
| `handleFormSubmission` | **End-to-end, per lead type** (all five roles): a payload in → the exact row out, `Details` blob included. Today this has **zero** end-to-end coverage. |
| **`buildLeadRow` — `qualData` persistence** (§2a) | **The previously-dropped fields now land in `Details`, proven on at least two different lead types.** Recommended pair: **Investor** (`aum`, `experience`, `assetClasses`, `timeline`) and **submit_referral** (`relationship`, `fit`, `awareness` — the type where *all* qualData is discarded today, so it proves the fix hardest). Assert the **parsed** blob field-by-field against the input payload; asserting the blob is merely non-empty proves nothing. Include a field left blank by the visitor, to pin down whether it round-trips as `''`/`null` or is omitted — decide that once and lock it in a test. |
| **`buildLeadRow` — `submit_referral.referred` round-trip** (§2b) | The referred-person block **round-trips as structured JSON and is retrievable**: build the row from a payload, `JSON.parse` the `Details` cell, and read back `referred.firstName` / `lastName` / `email` / `phone` / `notes` as **discrete values** — not a prose string that happens to contain them. **Assert the negative too:** the **Message column no longer contains the `Referred person:` prose block**, so a regression that keeps the old flattening alongside the new object is caught rather than silently double-writing. |
| `matchReferrer` + `updateReferrerStats` | All four match paths (code → email → name → none) and the manual path; `Direct Referrals` increments **once**, on **one** row. This is the highest-risk rewrite (§3); test it accordingly. **Plus the two multi-level `Total Downstream` tests below — they are not optional.** |
| ✅ **`updateReferrerStats` — multi-level chain** (§2c) — **DONE, Stage 1.** Implemented with a **4**-deep chain (`referrer-stats.test.js`), seeded with non-zero, all-different starting counters so an assertion cannot pass by setting `1` instead of incrementing. Both boundaries covered. | A chain **at least 3 levels deep** (John → Steven → Maria, ideally 4 to prove it is not hardcoded to one hop): when Maria is created, **every** ancestor's `Total Downstream` increments by exactly 1 — Steven **and** John. Assert the exact counter value on **each** ancestor row, not just that "something incremented". Cover a 1-deep chain (single ancestor) and a no-referrer submission (nothing increments) as the boundaries. |
| ✅ **`updateReferrerStats` — `Direct Referrals` regression** — **DONE, Stage 1.** | The distinction that makes the two columns mean different things: on that same 3-deep chain, `Direct Referrals` increments **only for the immediate referrer** (Steven **+1**; **John unchanged**). This test exists specifically to catch the obvious implementation slip of crediting Direct Referrals to the whole chain along with Total Downstream. |
| `sendMonthlyReferralSummaries` | The filter and every skip: `Cold`/`Archive` status, `Reports Enabled = FALSE`, zero-referral partners. Currently untested. |
| `sendDailyDigest` | The today-filter against a CT calendar date boundary. Currently untested. |
| `createContact` | Behavior under a **failing** `ContactsApp` — the confirmed pre-existing bug (see `backend-architecture.md`). At minimum: a contact failure must not fail the submission. Do not "fix" this bug inside the migration; that is a separate task. |
| `createBookingEvent` | **All three** outcomes — healthy, degraded (event exists, no link), failed (no event) — and the correct banner in the partner email for each. The three-state design exists precisely because a two-state one was silently wrong. |

### The suite's core rule, restated because it is the one that matters

**Never build a header/schema fixture from the same constants the code under test
reads.** A fixture built from `LEAD_HEADERS` proves only that `LEAD_HEADERS ===
LEAD_HEADERS`. That tautology is exactly what let the 2026-07-08
`REPORTS_ENABLED_COL` bug through a "passing" harness.

Header fixtures must be **deliberately mangled away** from the constants —
reordered, re-cased, whitespace-padded, rotated — as
`scripts/gas/tests/resolve-cols.test.js` already does. This rule survives the
migration intact and applies to every new fixture written under it.

---

## 6. Rollout sequence

The Sheet is empty, so **no data can be lost.** Follow this order anyway. The point
is not the data — it is that this is the sequence a real migration requires, and the
next one may not be so lucky. Rehearse it while it is free.

**Do not run both schemas simultaneously. Do not delete the old code before the new
code is proven.** Those two failure modes account for most botched migrations, and
they pull in opposite directions, which is why the order below is not negotiable.

1. **Build the new schema behind the test suite.** New `LEAD_HEADERS` / `COLS` /
   `resolveCols`, new `buildLeadRow`, rewritten readers/writers. **Green suite,
   including the new §5 coverage, before anything is deployed.** No live Sheet, no
   `clasp` — this stage is entirely local and entirely verifiable.
2. **Create the new tab.** `clasp push`, then run **`setupSpreadsheet()` manually from
   the Apps Script editor** to create `Leads`. A deploy does **not** create tabs.
   Skipping this step is the exact mistake that broke EAO.
3. **Deploy to the live endpoint.** `clasp push` **then** `clasp deploy -i <prod id>`.
   Pushing alone updates HEAD only — the live `/exec` URL the site actually hits is a
   pinned version, and a merge ships nothing. Two steps, always.
4. **One real live submission per lead type — all five.** Investor, Referral Partner,
   RE Professional, Existing Asset Owner, submit_referral. Confirm the real row, in
   the real Sheet, with a readable `Details` blob, the referral fields populated, and
   the emails sent. **This is the same technique that verified `resolveCols` this
   session, and it is the only step that proves the thing actually works.** A green
   suite is necessary and not sufficient.
5. **Only then, delete the old code.** The nine lead tabs, the header audit/repair
   family, the EAO backfill family (§4). Nothing is deleted until step 4 has passed
   for **every** lead type.

Between steps 3 and 5 the old tabs still physically exist — untouched, and no longer
written to. That is deliberate: it is a rollback path, not a second live system.

---

## 7. Explicitly out of scope for this migration

Stated plainly, because scope creep here is the likeliest way this plan fails:

**This plan covers ONLY the Sheet schema migration.** It does not include, and must
not grow to include:

- **`apps/api`** — no API layer, no service, no backend app.
- **Any dashboard or CRM front-end** (`crm.axispoint.llc`, `api.axispoint.llc`).
- **Callable admin actions.** `setLeadStatus`, `setReportsEnabled`,
  `forcePartnerSummaryNow`, `forceDailyDigestNow` **do not exist** — a repo-wide grep
  returns zero matches. They have never been built. Building them is a **separate,
  later phase**. Do not treat them as existing, and do not build them here.
- **Fixing the `createContact` bug** (see `backend-architecture.md`). Cover it with a
  test (§5), root-cause it separately.

Those are later phases with their own plans. **This file is schema-migration-specific
and stays that way.**
