# Unified Schema Migration Plan

**Status:** IN EXECUTION. Created 2026-07-12. **Stage 1 of N shipped 2026-07-14.**
**DECISION-COMPLETE as of 2026-07-13:** all three open decisions in §2 are resolved.
Nothing in this document is waiting on an answer.

## Execution status

| Stage | Scope | State |
|---|---|---|
| **1** | The unified schema constants (`UNIFIED_LEAD_HEADERS`, `UCOLS`, `resolveUnifiedCols`, `chainAncestors`), the `USE_UNIFIED_SCHEMA` switch, and **`updateReferrerStats`** — including multi-level `Total Downstream` (§2c) and a script lock over the counter read-modify-write | ✅ **DONE 2026-07-14.** 64/64 tests green. Not deployed; the switch is off. |
| **2** | **`moveColdLeads`** — stops physically relocating rows; a cold lead is now a `Status = 'Cold'` write. **Row deletion is removed, not ported.** Takes the script lock (two entry points can sweep concurrently) | ✅ **DONE 2026-07-14.** 75/75 tests green. Not deployed; the switch is off. |
| **3** | **`handleStatusEdit`** — the *other* row-deleting function. A status edit is now **just a status edit** plus its Contact side effects. **No unified path in the file deletes a lead row any more.** Takes the same script lock; **plus a pre-write re-read in `sweepStaleLeadsToCold`**, which is what actually closes the Stage-2 clobber gap | ✅ **DONE 2026-07-14.** 87/87 tests green. Not deployed; the switch is off. |
| **4** | **`onSheetEdit`** — the nine-tab membership guard collapses to `sheet.getName() === 'Leads'`; the three watched columns still resolve **by name**, now via `resolveUnifiedCols`. Makes `handleStatusEditUnified` reachable. **Wires up 2 of the 3 handlers; refuses the third loudly** (see Stage-4 notes) | ✅ **DONE 2026-07-14.** 96/96 tests green. Not deployed; the switch is off. |
| **5** | **`handleManualReferralLink`** — the referrer lookup moves from a Lifetime Leads scan to a `leadsTable()` scan. **The Stage-4 refusal branch in `onSheetEditUnified` is deleted and the handler is wired in for real**, so all three edit routes are now live. Script-locked (scoped tight — see the Stage-5 notes) | ✅ **DONE 2026-07-14.** 105/105 tests green. Not deployed; the switch is off. |
| **6** | **`buildLeadRow`** — the 25-column layout + the serialized `Details` blob. **§2a AND §2b SHIPPED IN CODE HERE** (they had been decisions in this document and nothing more): all 13 `qualData` fields persist per lead type, and `submit_referral.referred` is structured JSON with the prose builder **deleted, not ported**. The per-role field lists live in `LEAD_TYPES.detailsFields` — the registry, so there is no second list to drift | ✅ **DONE 2026-07-14.** 124/124 tests green. Not deployed; the switch is off. |
| **7** | **The submission path** — `findExistingLead`, `existingReferralCodes`, `matchReferrer`, `handleResubmission`, `persistNewLead` (the extracted append block), with `handleFormSubmission` orchestrating. **The unified path can now handle a COMPLETE REAL SUBMISSION end to end for all five lead types** — the first stage where that is true. `buildReferralMatch` needed no migration (schema-agnostic: row + column map, and every key it uses is in both `COLS` and `UCOLS`) | ✅ **DONE 2026-07-14.** 145/145 tests green. Not deployed; the switch is off. |
| **8 — NEXT** | **`sendDailyDigest` + `sendMonthlyReferralSummaries`** — the last two readers of the legacy tabs. The digest reads Active Leads → filter the one table on Status. The summary reads the Referral Partners tab and its per-tab `Reports Enabled` extra → filter on `Category = 'Referral Partner'` and read `Reports Enabled` as an ordinary column (`buildLeadRowUnified` already seeds it). Both are currently **untested**, and a filter bug silently emails the wrong people — or nobody. | ⬜ Not started |
| 9 | **`setupSpreadsheet`** (creates `Leads` + `Referrals` + `Subscribers` instead of 11 tabs), the **`LEAD_TYPES` registry** (`.tab`/`.tabColor` come out), and **`resolveCols`/`COLS`/`LEAD_HEADERS`**. `setupSpreadsheet` is the one that **must be run by hand from the Apps Script editor** — `clasp deploy` does not create tabs, and skipping it is exactly what broke EAO. | ⬜ Not started |
| — | **`setCategoryTabStatus` is NOT a stage.** It is a §4 delete-outright, and it cannot be deleted before the cutover removes `moveColdLeadsLegacy`, which still calls it. Skip it in the sequence; do not "migrate" it. | ⬜ At cutover |
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
- **There is NO top-level `Message` column. Settled 2026-07-14 — do not reopen.**
  §1's 25-column list is normative and has never had one; `message` is a `Details`
  key (§1's *All types* row). §2b's old phrasing ("the Message column goes back
  to holding only what the submitter typed") read as if a Message column survived,
  and has been rewritten — it was always about the *content*, not the placement.
  Message fails both halves of the top-level rule: nothing searches it across rows,
  and `onSheetEdit` does not watch it. **Two consequences for Stage 2:**
  `buildLeadRow` writes the submitter's text to `Details.message`, and
  `handleResubmission` — which today appends its resubmission note to the Message
  **cell** — becomes a read-modify-write of `Details.message` (parse, append,
  re-serialize). It must not be left writing to a column that no longer exists.
- **`updateReferrerStatsUnified` holds a script lock across its whole
  read-modify-write** (`REFERRAL_STATS_LOCK_MS`, 10s, `tryLock`). Any later stage
  that read-modify-writes a counter or a `Details` blob on a row it did not just
  create has the same race and should take the same lock — and must take it
  **before the read**, not just before the writes.

### Stage 3 notes — and a CORRECTION to what Stage 2 predicted

**Stage 2 said the sweep-vs-human-edit gap would close when `handleStatusEdit` took
the lock. That was half right, and the half it got wrong matters.**

**A lock could never have closed it.** The human's `Status` write is performed by
the **Sheets UI**, which takes no lock and cannot be made to. `handleStatusEdit` is
an `onEdit` trigger: by the time it runs, the cell is *already* written. So giving
it the lock lets it *notice* a clobber — it cannot *prevent* one.

**What actually closed the gap** was a second, separate mechanism, added in Stage 3
inside `sweepStaleLeadsToCold`: the sweep now **re-reads each row's live `Status`
immediately before stamping `'Cold'`**, and skips the row if it is no longer an
active status. That shrinks the clobber window from "the entire sweep" (a full table
read plus a write per stale lead) to the microseconds between that re-read and the
write. **The lock and the re-read are both required; neither alone is sufficient.**

The general lesson, which the remaining stages should carry: **a lock only protects
against writers that take it.** Any race whose other party is a human in the Sheets
UI, an Apps Script `onEdit`, or anything else outside our code cannot be locked away
— it has to be handled by re-validating at the point of write.

- **Every locked path shares ONE lock.** `getScriptLock()` is process-wide, so
  `updateReferrerStats`, `moveColdLeads`, and `handleStatusEdit` all genuinely
  contend. Keep every future stage on that same lock. Two locks would serialize
  nothing while looking like they did.
- **On a status conflict, act on the LIVE value and do NOT auto-restore.**
  `handleStatusEditUnified` drives its Contacts side effects off the status it reads
  under the lock, not off the (possibly stale) edit event, so Contacts can never
  disagree with the Sheet. It deliberately does **not** write the event's value
  back: nothing can distinguish "a sweep stamped Cold over their Client" from "the
  human edited again a second later", and auto-restoring would silently revert a
  deliberate human edit. That is trading one rare bug for another, not fixing one.
- **Slow side effects belong OUTSIDE the lock** (Contacts, email). Both migrated
  handlers follow this.
- **The GAS script lock is process-wide.** `getScriptLock()` returns *the* lock, so
  the cold sweep and the referral-credit critical section already serialize against
  each other for free. Keep every stage on that one lock rather than inventing a
  second one — two locks would reintroduce exactly the race they are meant to
  remove, plus deadlock potential.
- **Row deletion is now half-gone.** `moveColdLeadsUnified` no longer deletes;
  `handleStatusEditLegacy` still does. After Stage 3, no unified path deletes a
  lead row anywhere, which is the single largest safety win in this migration.
  **Delete the logic, do not port it** — the plan says this explicitly and it is
  the whole point of the stage.
- **`setCategoryTabStatus` is still alive** and still called by
  `moveColdLeadsLegacy`. It is on the §4 delete-outright list, but it cannot be
  removed until the cutover removes the legacy bodies that call it. Do not delete
  it in Stage 3.
- **Slow side effects belong OUTSIDE the lock.** `moveColdLeadsUnified` does its
  sheet writes under the lock, then releases it *before* the Contacts calls and the
  summary email. Holding a process-wide lock across a Contacts API round-trip would
  stall every submission's referral credit for as long as Google takes to answer.
  Follow the same split.

### Stage 4 notes — TWO places where this plan is wrong about the dependency graph

Tracing `onSheetEdit`'s three handlers turned up two facts §3 gets wrong. Both are
recorded here rather than silently worked around, because §3's table is what the next
stage will read.

**1. `handleCategoryEdit` needs NO migration. §3 is wrong to list it.**

§3 files it under *"Retarget from a tab to the table"*. It has nothing to retarget:
it **reads no tab at all**. Its inputs are `rowData` and a column map, its only
column is `EMAIL` — a key present in **both** `COLS` and `UCOLS` — and its entire
body is `ContactsApp` calls. It is already schema-agnostic and works unchanged under
both schemas. Verified by driving it through `onSheetEditUnified` against a unified
`Leads` sheet (`on-sheet-edit.test.js`). **Do not write a `handleCategoryEditUnified`.
There is nothing for it to do.** At cutover it simply stays as it is.

**2. `handleManualReferralLink` must be Stage 5 — a dependency, not a risk ranking.**

It scans **Lifetime Leads** (`tab(CONFIG.TABS.LIFETIME_LEADS)` + `resolveCols`),
which does not exist under the unified schema. Its own guard —
`if (!lifetimeSheet || lifetimeSheet.getLastRow() < 2) return;` — then returns
**silently**. Wired up as-is, it would be a handler that *looks* connected and does
nothing: a human types a referrer's email into the cell, the edit is accepted, and no
referral is ever linked, no stats updated, no notification sent, no error anywhere.

So `onSheetEditUnified` **deliberately does not call it.** It logs a loud refusal
naming the row, the value, and everything that did not happen. That is honest, but it
is also **a live hole in the unified path** — `Referred By Email` edits do nothing
until Stage 5 — which makes it a **cutover blocker** and puts it next, ahead of
`sendMonthlyReferralSummaries`.

**Stage 5's job:** give `handleManualReferralLink` the same three-part treatment
(scan `leadsTable()` via `resolveUnifiedCols` instead of Lifetime Leads), then delete
the refusal branch in `onSheetEditUnified` and call it. Its downstream calls already
work: `updateReferrerStats` is migrated (Stage 1) and already takes the chain, and
`logReferralEntry` / `sendReferrerNotification` touch the Referrals tab and Gmail,
neither of which this migration changes.

**The pattern worth noticing:** this is the *second* time the real dependency graph
has overruled §3's risk order (Stage 4 itself was the first). §3 ranks by *blast
radius if wrong*, which is the right way to rank **risk** but not to rank **order**.
Order is set by *what is unreachable or broken until X lands*. Keep using §3 for the
first question and the dependency graph for the second.

### Stage 5 notes — what is and is NOT resolved, and the lock-scoping trap

**RESOLVED: the Stage-4 hole.** `onSheetEditUnified`'s refusal branch is gone; all
three edit routes (Status, Category, Referred By Email) are live under the unified
schema. **That was the only *dependency-driven* blocker the migration had created for
itself.**

**NOT RESOLVED: the cutover.** It would be easy to read "the last blocker is gone" as
"we can flip the switch". **We cannot, and it is not close.** The most important thing
still missing:

> **Nothing writes to the `Leads` table yet.** `buildLeadRow` and
> `handleFormSubmission` are unmigrated, and they are the *only* creators of a lead
> row. **Every migrated function today reads and writes a table that is permanently
> empty.** The unified path is fully wired and completely unfed.

Still unmigrated, verified by grep against `Code.gs` (not inherited from this list):
`buildLeadRow`, `handleFormSubmission`, `findExistingLead`, `existingReferralCodes`,
`matchReferrer`/`buildReferralMatch`, `handleResubmission`, `sendDailyDigest`,
`sendMonthlyReferralSummaries`, `setupSpreadsheet`, the `LEAD_TYPES` registry, and
`resolveCols`/`COLS`/`LEAD_HEADERS`. Plus the §4 delete-outright families. **The
cutover checklist in §6 is unchanged and every step of it still stands.**

**THE LOCK-SCOPING TRAP — do not "tidy this up".**

`handleManualReferralLinkUnified` holds the script lock around **only** the
read-modify-write of the edited row. Its downstream calls run **outside** it, and
that is not laziness:

- `updateReferrerStats()` takes the script lock **itself** (Stage 1).
- The Referrals append calls `nextReferralSequence()`, which calls **`waitLock()` on
  the same script lock**.

**Apps Script does not document the script lock as reentrant.** Widening the lock to
wrap the whole function would be a second acquisition of a lock the execution already
holds — a deadlock or a spurious refusal, and one that would surface **only in
production**. The suite guards this: the lock stub's `waitLock()` **throws** if the
lock is already held, so a refactor that widens the scope fails the test rather than
shipping.

**Every future stage that calls `updateReferrerStats`, `nextLeadSequence`, or
`nextReferralSequence` inherits this constraint.** Take the lock for your own
read-modify-write; release it before calling anything that locks on its own.

**One more thing not routed through `logReferralEntry`, deliberately.**
`handleManualReferralLink` writes its Referrals row inline. It looks like duplication
and it is not: `logReferralEntry` derives the row's Status as
`matchType === 'name' ? 'pending' : 'linked'`, so routing a manual link through it
would silently rewrite the Referrals **Status** column from `'manual'` to `'linked'`
on every hand-linked referral. It also takes a `payload`, which an edit trigger does
not have. The inline row is byte-for-byte what legacy writes.

**Pre-existing quirk, unchanged (not introduced here):** nothing stops a human typing
a lead's *own* email into their *own* `Referred By Email` cell, self-linking them.
Legacy has the same behavior (Lifetime Leads contains that lead too), so this
migration preserves it rather than quietly changing it. Worth a guard someday; it is
not this migration's business.

### Stage 6 notes — §2a and §2b are now CODE, and the `Details` contract is fixed

**These two stopped being decisions and became behavior.** Everything below is now
implemented in `buildLeadRowUnified` / `buildLeadDetails` and pinned by tests.

**The per-role mapping lives in the REGISTRY, not in the row builder.**
`LEAD_TYPES.detailsFields` (+ `detailsFrom`) is the single definition site, per this
project's own rule. **Do not re-derive the mapping from field names** — that is how an
earlier draft of this plan got four of thirteen wrong (`awareness` and `fit` are
`submit_referral`'s, not the investor's; `profession` is the referral partner's, not
the RE pro's). EAO is the one type whose fields sit on the payload's **top level**
rather than in `qualData` (`detailsFrom: 'payload'`), because its flow never had a
`qualData` step.

**The `Details` contract, decided once and locked by a test:**

- A field the lead type **asks** is **always present** as a key, holding `''` (or `[]`
  for a list) when the visitor left it blank.
- A field the lead type **does not ask** is **absent** entirely.
- So *"asked and not answered"* is distinguishable from *"never asked"*. That
  distinction is the entire reason this is a queryable blob instead of a paragraph.
- `message`, `preferences`, and `booking` (incl. `meetLink`) are on **every** type.
- The derived `assetClass` label is written **only when non-empty** — it is derived,
  not collected, and nothing searches it, so it gets no column.

**`Reports Enabled` is now seeded by the row builder** from
`LEAD_TYPES.seedReportsEnabled`, as a normal column. The whole
`REPORTS_ENABLED_COL = LEAD_HEADERS.length` bug class dies with the per-tab extra.

**A normalizer hack is now obsolete — remove it in Stage 7.** `normalizeEaoPayload`
**overwrites** `payload.preferences` with `[eaoDetailsSummary(payload)]` — a JSON
*string*, not a list of opt-ins — purely because the legacy schema gave EAO nowhere
else to put its detail fields. Under the unified schema those fields have real
`Details` keys, so `buildLeadDetails` **filters that synthetic entry out by exact
value** (never by sniffing the string, so a real preference can never be eaten).
Verified against the form source: `buildEAOPayload` sends **no** `preferences` at all
today, so nothing real is dropped. **`normalizeEaoPayload` should stop doing this when
`handleFormSubmission` is migrated** — the normalizer is applied there, and the hack
now has no purpose.

**One faithful oddity, left alone:** EAO's `Details.message` duplicates
`Details.pressing_issue`, because `normalizeEaoPayload` sets
`payload.message = payload.pressing_issue`. That is the normalizer's existing
behavior, preserved rather than quietly changed. Worth revisiting with the normalizer
in Stage 7.

### Stage 7 notes — the unified path is now FED, and what is genuinely left

**YES: the unified path can handle a complete real submission, end to end, for all
five lead types.** Payload in → dedupe → referral code (collision-checked) → referrer
match → 25-column row + `Details` blob → **one** append → referral stats credited up
the whole chain → Referrals row → Contacts → visitor + partner emails → JSON response.
Driven for real in `submission-path.test.js`, not reasoned about. That was not true of
any previous stage: every one of them read or edited a table nothing ever wrote to.

**Genuinely left before cutover** (nothing else — verified by grep, not inherited):

1. **`sendDailyDigest`** — reads Active Leads. Retarget to the one table, filter on Status.
2. **`sendMonthlyReferralSummaries`** — reads the Referral Partners tab + its per-tab
   `Reports Enabled` extra. Filter on `Category = 'Referral Partner'`; `Reports
   Enabled` is now an ordinary column that `buildLeadRowUnified` already seeds.
3. **`setupSpreadsheet`** — creates 11 tabs; must create `Leads` + `Referrals` +
   `Subscribers`. **This is the one that must be RUN BY HAND from the Apps Script
   editor.** `clasp deploy` does not create tabs. Skipping it is exactly what broke EAO.
4. **The registry + `resolveCols`/`COLS`/`LEAD_HEADERS`** — `.tab`/`.tabColor` come out.
5. **Then §4's delete-outright list**, which is now *fully obsolete but not yet deleted*:
   the **header audit/repair family** existed because nine tabs could each drift
   independently (one table, one header), and the **EAO backfill family** existed
   because rows fell into the gap between Lifetime Leads and a missing category tab
   (no category tabs, no gap). Both die at cutover, per §6 — **not before.**

**Where the switch boundary went, and why it is not where the task described.**
`handleFormSubmission` was **not** duplicated into Unified/Legacy. Only **one block of
it is schema-dependent** (the three appends + category-tab check + `seedReportsEnabled`
seed); the normalizer, booking, Contacts, both emails and the response are identical
under both schemas, and its other schema-dependent calls are already dispatchers. So
the block was extracted as **`persistNewLead`** and *that* got the three-part
treatment. Duplicating the whole function would have meant **two copies of the booking
and email orchestration to hand-sync until cutover** — which is this project's single
most-documented failure mode (the email-template mirrors). Every schema-dependent line
is still behind the switch; there is just no duplicated orchestration.

**`buildReferralMatch` needed no migration.** It takes a row plus a **column map**, and
every key it touches (`LEAD_ID`, `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `REFERRAL_CODE`,
`REFERRAL_CHAIN`) exists in **both** `COLS` and `UCOLS`. It is schema-agnostic already;
both `matchReferrer` branches call the same one. (Third time the plan's "retarget this"
list has turned out to include a function with nothing to retarget — see also
`handleCategoryEdit` and `moveContactToCold`.)

**✅ CLOSED 2026-07-14 — the reader/writer asymmetry is gone.** *(This section used to
describe it as an accepted risk. It is now fixed; the history is kept because the
reasoning matters.)*

Every reader resolves columns **by name** (`resolveUnifiedCols`) and survives a drifted
header. The writer used to be **positional**: `buildLeadRow` constructs the canonical
layout and `persistNewLead` appended that array straight down, assuming the live header
still matched. This plan explicitly sanctioned that ("it constructs the canonical
layout rather than reading a possibly-drifted one") — and it was wrong to.

**The bug it left open:** a human reorders or inserts a column in the live `Leads`
header. Every reader keeps working. The writer silently puts the Timestamp under
**Email**, the Match Type under **Category**, the company under **Phone**, and the
`Details` blob under whatever now sits at index 24 — on every subsequent lead, with
nothing anywhere to catch it. **The readers' own tolerance is what would have hidden
it:** the sheet looks healthy and the code never complains.

**The fix:** `persistNewLeadUnified` now resolves the live header and projects the
canonical row onto the sheet's REAL columns by name (`projectLeadRowByName`) before
appending. A reordered header is handled exactly as every reader handles it; a header
missing a required column **throws `headerLookupError` and refuses the write** rather
than guessing at a cell. A human's extra columns beyond the 25 are preserved as blanks
rather than clipped. On a canonical header the projection is a **verified exact no-op**
— this is a safety fix, not a behavior change.

**`buildLeadRow` is unchanged and still positional, which is still correct:** it
*constructs* the canonical layout. Knowing where the columns really are is the
**append's** job, not the row builder's. That is where the boundary belongs.

**Lock discipline held.** `handleResubmissionUnified` read-modify-writes the `Details`
blob on a row it did not create, so it takes the shared script lock **before the read**
and releases it in a `finally` — a lost blob write is a lost paragraph the visitor
actually typed. The lock stays **out** of the path that calls `nextLeadSequence()`
(`waitLock` on the same lock) and `updateReferrerStats()` (`tryLock`), per the Stage-5
reentrancy rule. A test models `waitLock` as throwing when the lock is already held, so
a future refactor that widens the scope fails a test instead of deadlocking in prod.

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
| **2a** | The 12 under-persisted `qualData` fields | 2026-07-13 | ✅ **FIX during the migration.** All 13 fields persist into `Details`. **✅ SHIPPED in code — Stage 6, `buildLeadDetails`.** |
| **2b** | `submit_referral`'s referred-person data | 2026-07-13 | ✅ **Structured JSON** under `Details.referred`. Not prose, not a top-level column. **✅ SHIPPED in code — Stage 6; the prose builder is deleted.** |
| **2c** | `Total Downstream` | 2026-07-13 | ✅ **Implement** as real multi-level attribution. Not retired. **✅ SHIPPED in code — Stage 1, `updateReferrerStatsUnified`.** |

Read all three as **requirements**, not questions. Each is recorded in
`/docs/CHANGELOG.md`.

### 2a. The 12 under-persisted `qualData` fields — ✅ RESOLVED 2026-07-13 · ✅ **SHIPPED IN CODE 2026-07-14 (Stage 6)**

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

### 2b. `submit_referral`'s referred-person data — ✅ RESOLVED 2026-07-13 · ✅ **SHIPPED IN CODE 2026-07-14 (Stage 6)**

**Decision: lift it into structured JSON under `Details.referred`. It does NOT stay
prose, and it does NOT become a top-level column.**

**Current state:** `buildLeadRow` (`Code.gs:1715-1728`) flattens `payload.referred`
(`firstName`, `lastName`, `email`, `phone`, `notes`) into a newline-joined prose
block and **prepends it to the legacy Message column** (col 12 of the 31-column
per-tab layout — a column the unified schema does **not** carry; see the note
below):

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

…and **`Details.message` holds only what the submitter actually typed**, with the
referred-person prose gone from it entirely.

#### `message` is NOT a top-level column either — RESOLVED 2026-07-14

An earlier draft of this section said "the **Message column** goes back to holding
only what the submitter typed", which read as if the unified schema kept a
top-level **Message** column. **It does not, and §1's 25-column list — which has
no Message column — is correct and normative.** `message` is a `Details` key,
listed under *All types* in §1's `Details` table. The two statements are now
reconciled: the fix in this section was always about the *content* (structured
`referred` object instead of prose glued onto free text), never about which
physical column that content lands in.

**Why `message` stays in the blob, by the same rule as everything else:** a field
earns a real column only if code must **search it across rows** or `onSheetEdit`
must **detect an edit to that specific column**. Nothing searches Message —
`findExistingLead` dedupes on Email, `matchReferrer` matches on Referral Code /
Email / Name — and `onSheetEdit` watches Status, Category, and Referred By Email,
never Message. It fails both halves of the test, so it goes in `Details`. That it
is *important*, and that a human might like to read it in the grid, are explicitly
**not** reasons (see *What is explicitly NOT a reason* in
`backend-architecture.md`).

**One live consumer to carry over, not drop:** `handleResubmission` currently
**appends a resubmission note to the Message cell** (`Code.gs`, `C.MESSAGE`). Under
the unified schema that becomes a read-modify-write of `Details.message` — parse
the blob, append, re-serialize. Whoever migrates `handleResubmission` must not
leave it writing to a column that no longer exists.

#### Why `Details` for `referred`, and explicitly NOT a top-level column

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
| ✅ **`moveColdLeads`** — **MIGRATED 2026-07-14 (Stage 2).** Dispatcher over `moveColdLeadsUnified` (new) and `moveColdLeadsLegacy` (old body, verbatim, delete at cutover). The unified path resolves the header by name, sweeps stale active leads with a single `Status = 'Cold'` write per lead (critical section extracted as `sweepStaleLeadsToCold`), and **deletes nothing and appends nothing**. Takes the script lock (`COLD_SWEEP_LOCK_MS`, 30s, `tryLock`) around the read-decide-write, because the sweep has **two entry points** — the Monday trigger and the "Run Cold Lead Sweep Now" menu item — so two sweeps can genuinely run at once; Contacts calls and the summary email happen **outside** the lock. Covered by `scripts/gas/tests/cold-sweep.test.js` (11 tests). **Known gap, closing in Stage 3:** the lock does not protect against a human's `Status` edit, because `handleStatusEdit` does not yet take it. | *Original entry, for the record:* Stops **physically relocating rows** between tabs. Becomes: find rows whose Status ∈ {New Lead, Contacted, Active} and whose Timestamp is older than `COLD_LEAD_DAYS`, then **set Status = `Cold`**. One field write; no append, no `deleteRow`. | 🔴 High. It is one of only two functions that **delete rows** today. The rewrite removes the deletion entirely, which is a large net safety win — but the transitional version is the single most dangerous code in the migration. |
| ✅ **`handleStatusEdit`** — **MIGRATED 2026-07-14 (Stage 3).** Dispatcher over `handleStatusEditUnified` / `handleStatusEditLegacy` (verbatim, delete at cutover). The unified branch appends nothing, deletes nothing, and writes no cell — the human's `Status` edit is already saved by the Sheets UI before the trigger fires — so all that remains is the Contacts side effect. It takes the shared script lock, reads the **live** row under it, and logs a CONFLICT (without auto-restoring) when the live status disagrees with the edit event. It deliberately ignores the `sheetName`/`editedCols` it is handed, because those come from the not-yet-migrated `onSheetEdit` and are `LEAD_HEADERS`-shaped. **`sweepStaleLeadsToCold` also gained a pre-write live re-read** — the guard that actually closes the Stage-2 clobber gap. Covered by `scripts/gas/tests/status-edit.test.js` (12 tests, incl. the shared-lock contention proofs). | *Original entry, for the record:* Stops moving rows to Cold Leads / Clients / Archive. A status edit becomes **just a status edit** (plus its Contact-group side effects). Most of the function disappears. | 🔴 High. The other row-deleting function. Deletion logic must be *removed*, not ported. |
| **`setCategoryTabStatus`** (2492) | **Deleted.** Its only job is keeping a duplicated row's Status in sync on the category tab. With one row, there is nothing to sync. | 🟢 Low (it stops existing). |
| **`sendMonthlyReferralSummaries`** (2324) | Reads the **Referral Partners tab** and its extra `Reports Enabled` column. Becomes: filter the one table on `Category = 'Referral Partner'`, read `Reports Enabled` as a normal column, keep the existing skips (`Cold`/`Archive` status, `FALSE` opt-out, zero-referral partners). | 🟠 Medium. Currently untested, and a filter bug silently emails the wrong people — or nobody. |
| ✅ **`onSheetEdit`** — **MIGRATED 2026-07-14 (Stage 4).** Dispatcher over `onSheetEditUnified` / `onSheetEditLegacy` (verbatim, delete at cutover). The guard is now one string compare; the three watched columns still resolve **by name** through `resolveUnifiedCols`, so a drifted header cannot route a Status edit into the referral handler. **Wires Status → `handleStatusEdit` (migrated) and Category → `handleCategoryEdit` (needs no migration), and REFUSES `Referred By Email` loudly** until Stage 5 — see the Stage-4 notes. Covered by `scripts/gas/tests/on-sheet-edit.test.js` (9 tests). | *Original entry, for the record:* Its **lead-tab guard** (`leadTabConfigs()` membership) becomes a single `sheet.getName() === 'Leads'` check. The three watched columns must still be resolved **by name** (`resolveCols`) so the dispatch detects *which* column changed. | 🟠 Medium. If the dispatch guard is wrong, edits are routed to the wrong handler or dropped silently. |
| ✅ **`handleFormSubmission`** — **MIGRATED 2026-07-14 (Stage 7).** The switch boundary is **`persistNewLead`** (Unified/Legacy/dispatcher), not a duplicated copy of the whole function: only the append block is schema-dependent, and duplicating the booking/email orchestration would be two copies to hand-sync until cutover. Three appends → **one**. *Original entry:* Appends to **three tabs** (Lifetime + Active + category tab). Becomes **one append**. The category-tab-exists check, the `seedReportsEnabled` per-tab seed, and the missing-tab logging all collapse. | 🟠 Medium. Highest-traffic path in the file; end-to-end untested today (see §5). |
| ✅ **`buildLeadRow`** — **MIGRATED 2026-07-14 (Stage 6).** Dispatcher over `buildLeadRowUnified` / `buildLeadRowLegacy` (verbatim, delete at cutover). Builds the 25-column layout + `JSON.stringify(buildLeadDetails(...))`. **§2a and §2b ship here.** Per-role field lists live in `LEAD_TYPES.detailsFields`. Covered by `build-lead-row.test.js` (18 tests: one per lead type, all 13 qualData fields named individually, the `Details.referred` round-trip, the prose-block negative, the blank-field contract, and the legacy branch still dropping twelve fields). | *Original entry, for the record:* Builds a positional 31-value array from `COLS`. Becomes a 25-column array + a serialized `Details` blob. Still correctly positional — it *constructs* the canonical layout rather than reading a possibly-drifted one. **Implements both §2a and §2b in this same rewrite:** it now writes **all 13 `qualData` fields** into `Details` (per the §1 per-lead-type table) instead of dropping twelve of them, and it writes `submit_referral`'s `referred` block as a **structured `Details.referred` object** instead of flattening it into prose on the Message column. **The prose-building code at `Code.gs:1715-1728` is deleted, not ported** — and `Details.message` holds only what the submitter typed. **There is no top-level Message column in the unified schema** (§2b); `message` is a `Details` key. | 🟠 Medium-high. Every column's meaning changes at once, **and** this is the function where the two data-fidelity fixes actually land — if `Details` is built wrong here, the data loss the migration exists to end simply continues in a new format. |
| ✅ **`findExistingLead` / `existingReferralCodes` / `matchReferrer` / `handleResubmission`** — **MIGRATED 2026-07-14 (Stage 7).** All now scan `leadsTable()` via `resolveUnifiedCols`. **`buildReferralMatch` needed NO migration** — it takes a row + a column map and every key it uses is in both `COLS` and `UCOLS`, so both branches call the same one. **`handleResubmission` is the exception to "logic otherwise unchanged":** it appended to the Message *cell*, and Message is now a `Details` key, so it became a **read-modify-write of the JSON blob** — and therefore takes the shared script lock. | 🟢 Was rated low-medium. **`handleResubmission` was not:** a silent `findExistingLead` miss duplicates a lead on every resubmission, and a lost blob write loses a paragraph the visitor typed. |
| **`sendDailyDigest`** (2260) | Reads Active Leads. Retarget to the one table, filtered on Status. | 🟢 Low. |
| ⚠️ **CORRECTED 2026-07-14 (Stage 4). `handleManualReferralLink` ✅ MIGRATED (Stage 5).** ~~`handleCategoryEdit` (2667) / `handleManualReferralLink` (2564) / `moveContactToCold` (2508) — retarget from a tab to the table.~~ **These three are not one group and two of them need no retarget at all.** • **`handleCategoryEdit` — NO MIGRATION NEEDED.** It reads no tab: its inputs are `rowData` + a column map, its only column is `EMAIL` (a key in both `COLS` and `UCOLS`), and its body is pure `ContactsApp`. Already schema-agnostic; verified through `onSheetEditUnified`. • **`moveContactToCold` — likewise**, it takes an email and touches only Contacts. • ✅ **`handleManualReferralLink` — the ONLY real one. Migrated 2026-07-14 (Stage 5):** dispatcher over `handleManualReferralLinkUnified` / `…Legacy`; the referrer lookup scans `leadsTable()` via `resolveUnifiedCols`; script-locked **around the row write only** (its downstream calls take the same lock themselves — see the Stage-5 notes on reentrancy). Covered by `manual-referral-link.test.js` (9 tests). | 🟢 Low for the two that need nothing. ✅ Done for the one that did. **The `createContact` defect** in `backend-architecture.md` still applies to the Contacts side of all of them. |
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
| **`buildLeadRow` — `submit_referral.referred` round-trip** (§2b) | The referred-person block **round-trips as structured JSON and is retrievable**: build the row from a payload, `JSON.parse` the `Details` cell, and read back `referred.firstName` / `lastName` / `email` / `phone` / `notes` as **discrete values** — not a prose string that happens to contain them. **Assert the negative too:** **`Details.message` no longer contains the `Referred person:` prose block** (there is no top-level Message column to check — §2b), so a regression that keeps the old flattening alongside the new object is caught rather than silently double-writing. |
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
