# V2 backend contract (schemaVersion 1)

Authoritative description of the wire contract implemented in
[`scripts/gas-v2`](../scripts/gas-v2/). Derived from the Code Pass 7 audit and its final
correction, implemented in Code Pass 8, and **reconciled in Code Pass 9A** against the
approved communications design.

Pass 9A corrected several Pass 8 positions **within** `schemaVersion` 1 rather than
bumping the version, because nothing consumes or deploys schema version 1 yet: no
frontend sends it and no endpoint exists. They are pre-deployment corrections, listed in
[section 16](#16-pre-deployment-corrections-code-pass-9a).

Pass 9B corrected the storage boundary the same way, listed in
[section 18](#18-pre-deployment-corrections-code-pass-9b).

Pass 9C added `bookingEligible` to the success response (§1). That is an **additive
response-field correction exposing a decision the backend already made**, not a new
policy: the value was computed at intake, stored on the Lead, and returned by the domain
layer, and only the transport layer was dropping it. **No response schema-version bump is
required**, because no V2 frontend and no deployed V2 consumer exists to break.

**Status: implemented and locally tested. Not deployed.** Both frontends, `apps/web` and
`apps/qr`, are wired to this contract through
[`packages/submission-client`](../packages/submission-client/) and build real request
envelopes. What does not exist is anything for those envelopes to reach: no Apps Script
project, no Sheet, no Script Property, no trigger, no endpoint, and no `.clasp.json`.
Nothing has been deployed, and no email, digest, or Calendar action has been sent or
performed. See [`deployment.md`](deployment.md) for what bringing it up actually involves,
and [`branching.md`](branching.md) for why merging this changes nothing externally.

V1 was retired and deleted from this repository on 2026-08-15. This is now the only backend
contract in the repository; there is no second one to reconcile against.

---

## 1. Transport

One anonymous Apps Script web app endpoint. `POST` a JSON body; `GET` is a health
check that reports which capabilities are configured and never the values that
configure them.

Every response is **HTTP 200 with a JSON body**, including every failure. An uncaught
exception in an Apps Script web app returns an HTML error page a cross-origin `fetch`
cannot read, so the browser sees a network failure and the visitor sees nothing.

```jsonc
// service_inquiry or contact_exchange success
{
  "schemaVersion": 1,
  "ok": true,
  "submissionKind": "service_inquiry",
  "submissionId": "<uuid the client generated>",
  "leadId": "<uuid>",          // null on a contact_exchange
  "contactId": "<uuid>",       // null on a service_inquiry
  "slaDueAt": "2026-08-04T22:00:00.000Z",   // null when there is no commitment
  "bookingEligible": true,     // always a strict boolean, never absent
  "replay": false
}

// failure
{ "schemaVersion": 1, "ok": false, "error": { "code": "UNKNOWN_ENUM", "field": "payload.topic" } }
```

### `bookingEligible` on the response

Computed once at intake by `isBookablePathway` (§7), stored on the Lead, and **forwarded**
by the transport layer. `Entry.js` never derives it: deriving it there would be a second
definition of the policy, which is what Pass 9B deleted `BOOKABLE_PATHWAYS` to prevent.

| Submission | `bookingEligible` |
|---|---|
| Management Proposal, scope `pm` / `pm_plus_am` / `undecided` | `true` |
| Investor Services | `false` |
| General Inquiry | `false` |
| QR Contact Exchange | `false`, and `leadId` is `null` |

It is **always a strict boolean and always present**, so a client can branch on `=== true`
without also handling `'TRUE'`, `undefined`, or a missing key. The Sheet round-trips
booleans as strings, which is why the coercion is explicit rather than incidental.

A replay returns the same value as the first response, read back from the stored Lead.
**The frontend must trust this field and must not implement its own booking policy.** The
booking command separately re-evaluates the rule against the stored Lead, so a tampered
snapshot cannot authorise a booking (§7).

Nothing internal crosses the boundary: no stack trace, no Sheet id, no property name,
no address, no row number, and no echo of what the visitor typed.

### Origin checking

There is none, and there is deliberately no setting for one. **An Apps Script web app
cannot read the request's `Origin` header.** Any allowlist would be applied to a value
the client itself supplies, which would look like an access control while providing
none. The endpoint's protections are validation, deferred and bounded side effects,
and spam flagging.

---

## 2. The envelope

A discriminated union on `submissionKind`.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | Exact match. Anything else is `UNSUPPORTED_SCHEMA_VERSION`. |
| `submissionKind` | `service_inquiry` \| `contact_exchange` \| `booking_request` | |
| `submissionId` | UUID v4 | Browser-generated, once per completed form. Drives replay protection. |
| `submittedAt` | ISO string, optional | Advisory. The server timestamps with its own clock. |
| `locale` | object | See §5. |
| `attribution` | object | See §6. |
| `payload` | object | Shape depends on `submissionKind`. |
| `clientSignals` | object, optional | Advisory only. See §8. |

`booking_request` is a command, not a submission, and carries a different top level
(§7).

### Server-owned fields

These are set by the server and **rejected outright** if a client supplies them, at any
depth, with `SERVER_OWNED_FIELD_SUPPLIED`. Stripping them silently would let a
submitter believe they set something they did not.

`leadId`, `contactId`, `logId`, `receivedAt`, `partnerOwner`, `leadStatus`,
`ownerPartner`, `firstHumanContactAt`, `qualificationOutcome`, `proposalSentAt`,
`slaDueAt`, `possibleMatches`, `spamSuspected`, `spamReason`, `ackEmailStatus`,
`partnerNotifyStatus`, `calendarStatus`, `calendarEventId`, `contactSyncStatus`,
`activeBookingRequestId`

The one exception: a `booking_request` may carry `leadId`, because there it
*references* an existing lead rather than claiming to set one.

---

## 3. Wire tokens

**The backend stores tokens, never display text.** Approved copy lives in the frontend
and is mapped to tokens there, so a copy edit or a translation can never change a
stored value.

**Display strings are rejected**, with a specific code (`DISPLAY_STRING_NOT_ACCEPTED`)
rather than a generic enum failure. If `"Multifamily"` were silently accepted, the copy
deck would become the contract.

Hyphenated frontend union values (`pm-plus-am`, `property-management`) are *also*
rejected. The frontend model and the wire are separate vocabularies; mapping between
them is the frontend's job.

| Group | Tokens |
|---|---|
| `submissionKind` | `service_inquiry`, `contact_exchange`, `booking_request` |
| `pathway` | `management_proposal`, `investor_services`, `general_inquiry` |
| `serviceScope` | `pm`, `pm_plus_am`, `undecided` |
| `intentToken` | `property_management`, `asset_management`, `investor_services`, `general` |
| `property.type` | `multifamily`, `retail`, `mixed_portfolio`, `another_property_type` |
| `property.scope` | `one_property`, `portfolio` |
| `situation.current` | `replace_current_management`, `move_away_from_self_management`, `recently_acquired_or_under_contract`, `lease_up_or_turnaround`, `operations_or_reporting_problems`, `exploring_management_options`, `something_else` |
| `situation.involvement` | `property_management`, `property_management_plus_asset_management`, `not_sure` |
| `situation.timing` | `immediately`, `within_30_days`, `days_30_to_60`, `days_60_to_90`, `still_exploring` |
| investor `topic` | `exploring_first_acquisition`, `under_contract_now`, `actively_searching`, `own_property_need_operating_team`, `something_else` |
| general `topic` | `question_about_axispoint`, `vendor_or_service_provider`, `employment`, `press_or_media`, `something_else` |
| `contactCategory` | `property_owner_operator`, `broker_real_estate_advisor`, `investor_capital_partner`, `lender_financial_professional`, `property_management_operations`, `service_provider_vendor`, `other` |
| `mode` | `phone_call`, `video_meeting` |
| `sourceCategory` | `website`, `qr` |
| partner | `zachary_russell`, `ethaniel_vu` (from slugs `zachary-russell`, `ethaniel-vu`) |
| `locale` | `en`, `es`, `zh-Hans`, `zh-Hant`, `vi`, `hi`, `ur`, `gu`, `pa` |

Locales are BCP-47 identifiers and keep their case and script subtags. `zh-Hans` and
`zh-Hant` are never collapsed or substituted for one another.

---

## 4. Payloads

### `service_inquiry`

Always: `pathway`, `contact { fullName, email, phone?, organization? }`.
`fullName` and `email` are required. A phone that is present must contain **7 to 20
digits** and only the approved punctuation (space, parentheses, hyphen, period, plus,
slash, `x`, comma, hash).

The phone is **stored exactly as entered**. Digits are derived for validation and
comparison only, and the stored value is never silently rewritten: a number reformatted
into a shape the person did not write is one they cannot recognise as theirs. No country
is assumed.

Blocks are **pathway-scoped**, and a block belonging to another pathway is rejected
(`BLOCK_NOT_ALLOWED_FOR_PATHWAY`) rather than ignored, because an ignored block
produces a row nobody can interpret later.

| Pathway | Additional blocks |
|---|---|
| `management_proposal` | `serviceScope`, `property { type, scope, location, scale?, scaleUnknown?, propertyCount? }`, `situation { current, involvement, timing, notes? }` |
| `investor_services` | `topic` (investor list) |
| `general_inquiry` | `topic` (general list) |

**Consistency rule.** `serviceScope` and `situation.involvement` describe the same
decision. A mismatch is rejected (`SCOPE_INVOLVEMENT_MISMATCH`) rather than resolved by
guessing which field wins.

| `serviceScope` | must equal `situation.involvement` |
|---|---|
| `pm` | `property_management` |
| `pm_plus_am` | `property_management_plus_asset_management` |
| `undecided` | `not_sure` |

**`payload.booking` is rejected** (`BOOKING_NOT_ALLOWED_IN_SUBMISSION`). Booking is a
separate command; see §7.

### `contact_exchange`

`fullName`, `contactCategory`, and **at least one of** `email` or `phone`
(`EMAIL_OR_PHONE_REQUIRED`). Optional: `company`, `roleOrTitle`.

A contact exchange **does** receive an automated acknowledgement when a valid email was
provided, and it carries **no SLA due time**. Somebody who hands over their details at a
conference and hears nothing has no way to know the exchange worked and no way to correct
a typo in their own address.

Three cases receive nothing, each for its own reason:

| Case | Acknowledgement | Why |
|---|---|---|
| Phone only | `skipped` | The Contact is fully valid and appears in the digest. There is nowhere to write, and no SMS is designed. |
| Suspected spam | `skipped` | Otherwise the form is a way to mail a third party from an address nobody owns. |
| Storage failed | none | A confirmation would contradict the failure the visitor already saw. |

A failed acknowledgement **never** removes or rolls back the stored Contact. Retries use
the existing bounded at-least-once machinery and a stable work identity.

### Field limits

Over-length values are **rejected, not truncated** (`FIELD_TOO_LONG`). Truncation
silently loses whatever the visitor actually said. Notes cap at 5,000 characters; the
whole body caps at 100 KB.

An empty string on an *optional* field means absent, not invalid: a browser form sends
`""` for every untouched input.

---

## 5. Locale

```jsonc
"locale": { "page": "en", "preferredFollowUp": "es" }
```

**Two separate facts, never collapsed.** `page` is where the visitor was;
`preferredFollowUp` is how they want to be answered. Someone can read the English page
and ask to be called back in Spanish, and both halves matter operationally.

All nine locales are **accepted** as a stated preference, because knowing somebody
wants an answer in Punjabi is useful long before anything is translated. Only
launch-ready locales are used to **send**. Today that is English alone, matching
`apps/web/src/i18n/locales.ts`, where only `en` is `enabled` and `review: 'reviewed'`.

When no preference is stated, follow-up falls back to the page locale, and
`preferredFollowUpStated` records that the value was inferred, so nobody later reads an
inference as something the visitor said.

---

## 6. Attribution and ownership

```jsonc
"attribution": {
  "sourceCategory": "qr",
  "sourceDetail": "zachary-russell",
  "landingPage": "https://…",
  "intentToken": "property_management",
  "refToken": "",
  "utm": { "source": "", "medium": "", "campaign": "", "content": "", "term": "" }
}
```

**Acquisition attribution is immutable. Ownership is current state.** They are two
columns and never one.

`acquisitionSource` records which card produced the record and never changes again:

| `sourceDetail` | `acquisitionSource` | Digest label |
|---|---|---|
| `zachary-russell` | `zachary_russell` | Gathered through Zachary Russell |
| `ethaniel-vu` | `ethaniel_vu` | Gathered through Ethaniel Vu |
| `axispoint-partners` | `firm` | Gathered through AxisPoint Partners |
| anything else | `unknown` | Gathered through Unknown |
| *(website submission)* | `""` | not applicable |

**The QR frontend has sent only `axispoint-partners` since 2026-08-17.** Its three-state card
was collapsed into one combined page by owner direction, so the browser has no
partner-specific identifier to send and does not invent one. **The table above is unchanged
and still correct:** the backend still resolves both partner slugs, and this is a statement
about what one client currently emits, not a narrowing of the contract. Restoring per-partner
cards later needs no backend change. See [`design-sources.md`](design-sources.md) for the
decision and its accepted cost.

`firm` and `unknown` stay distinguishable and neither is added to the partner enum.
`firm` is a real, intentional scan of the firm card; `unknown` is evidence that a printed
card is wrong, and hiding it inside `firm` would lose that. `scannedPartner` stays empty
for both, so no downstream code can treat "the firm" as an assignable person.

**`ownerPartner` is unassigned at intake for every record**, including one gathered
through a partner's own card. A scan gave that partner a name, not a claim. Pass 8 let a
resolved scan provisionally set the owner, which meant a printed card decided who was
accountable and any reassignment was fighting a rule that kept reasserting itself.

Reassignment later changes `ownerPartner` and changes neither `acquisitionSource` nor
`sourceDetail`. Digest routing uses acquisition attribution, never ownership.

**`refToken` is inert by contract.** Stored verbatim, never resolved to a person, never
used to build a referral chain, never triggers a notification, never feeds reporting. It
exists so the raw signal is not thrown away if referral tracking is built later.

---

## 7. Booking

Booking is a **separate command issued after a submission**, never a block inside one.
The two operations have genuinely different failure modes: an inquiry must be storable
while the calendar is down, and a calendar conflict must never reject an inquiry.

### One rule, in one place

`isBookablePathway(pathway, serviceScope)` is the single definition. Both the intake
response and the booking command call it.

| Pathway | Bookable |
|---|---|
| `management_proposal`, scope `pm` | Yes |
| `management_proposal`, scope `pm_plus_am` | Yes |
| `management_proposal`, scope `undecided` | Yes. The visitor is asking about management and simply has not chosen the scope; refusing the call would refuse the conversation that resolves it |
| `investor_services` | No |
| `general_inquiry` | No |
| `contact_exchange` | No, and it produces no Lead to book against |

`Booking.js` previously carried its own `BOOKABLE_PATHWAYS` list. Two definitions of one
policy drift: one gains a pathway and the other does not, and the visible symptom is a
form offering a call the command then refuses, or the reverse. The list is deleted.

**`bookingEligible` is stored on the Lead as the intake-time snapshot**, so the frontend
and a future dashboard can read what the visitor was told without re-deriving it. It is
**not a competing policy definition**: the booking command re-evaluates
`isBookablePathway` against the stored Lead, so editing that cell in the Sheet cannot
authorise a booking that the rule refuses.

```jsonc
{
  "schemaVersion": 1,
  "submissionKind": "booking_request",
  "bookingRequestId": "<uuid>",
  "leadId": "<uuid returned by the submission>",
  "slotStart": "2026-08-04T15:00:00.000Z",
  "durationMinutes": 30,
  "mode": "phone_call"
}
```

### The command returns a truthful final result

| `bookingStatus` | Meaning |
|---|---|
| `confirmed` | The Calendar service created the event and returned its id |
| `unavailable` | The slot is taken, or outside the rules |
| `rejected` | The request is not allowed: wrong pathway, unknown lead, already booked |
| `failed` | The Calendar service was reachable and did not succeed |
| `not_configured` | There is no calendar to book against |

**`confirmed` is reachable from exactly one place: a successful `createEvent`.** The
Calendar port is called **synchronously** inside the command. Pass 8 queued the calendar
write and returned `pending` while the visitor's screen said their call was booked; the
failure mode is somebody sitting by a phone at 10:30 for a meeting that does not exist.

Other rules:

- The Lead must already exist. A Calendar failure **never** deletes or changes it.
- An unreadable calendar is not an available calendar: a failed availability read returns
  `failed`, because treating it as "nothing is booked" double-books a partner.
- The slot must start at least 60 minutes ahead and no more than 60 days ahead, and
  **both ends** must fall inside one business day (Mon–Fri, 09:00–17:00 project time).
- The same `bookingRequestId` **replays** the recorded outcome. A different request while
  one is confirmed is `rejected`. After a failed attempt a fresh request is accepted.
- With no calendar configured the request is still recorded for a partner to confirm by
  hand, and the result is `not_configured`, never `confirmed`.
- Only the confirmation **email** is queued, and its handler re-checks the stored calendar
  state before sending.

---

## 8. Spam screening

Screening **flags; it never discards**. The cost of silently dropping one real owner
inquiry is far higher than a partner glancing at a flagged row. Output is
`spamSuspected` plus a comma-separated `spamReason`, so a partner can see why and
disagree.

Signals: filled honeypot, implausibly fast completion, three or more links in free
text, a disposable email domain, a URL in the name field, a long run of repeated
characters, an unbroken text block.

**`clientSignals` is advisory only.** A bot controls what it sends, so a missing or
generous signal can never clear a content-based flag; signals can only add evidence.

A flagged submission is stored, routed to the whole firm for review, and gets **no
automated acknowledgement** (auto-replying to a forged address damages the sending
domain's reputation for somebody else's abuse).

---

## 9. Routing

**Website inquiries are notified immediately. QR Contacts are not notified at all**; they
go into the daily digest (section 9A). One email per scanned card is unreadable after a
conference table: thirty messages arrive overnight and the one that mattered is archived
with the rest.

| Situation | Notified | When | `ownerPartner` |
|---|---|---|---|
| Website submission | firm | immediately | *(unassigned)* |
| Website submission, flagged | firm | immediately | *(unassigned)* |
| QR Contact | per acquisition attribution | 8:00 AM daily digest | *(unassigned)* |
| QR Contact, flagged | nobody | never | *(unassigned)* |

**Nothing in routing assigns ownership.** Receiving a notification or a digest does not
make a partner responsible for anything in it.

A QR Contact's `partnerNotifyStatus` reads `deferred_to_digest` rather than sitting at
`pending` forever and reading as a stuck queue.

If a per-partner address is not configured, the notification falls back to the
firm-wide list rather than being dropped. An undeliverable notification is worse than
an over-broad one.

---

## 9A. The daily QR Contact digest

One internal email at **8:00 AM `America/Chicago`**, replacing per-scan notification.
**This pass installs no trigger.** `runDailyQrDigestTrigger` is callable and unscheduled;
scheduling it is a separate, deliberate operation against a real Apps Script project.

### Eligibility

A submission enters the queue as `pending_digest` when it is a Contact Exchange and was
not flagged. A flagged one is stored and recorded `excluded_spam`. Everything else is
`not_applicable`, which is a different fact again from "waiting".

**Zero eligible Contacts sends nothing at all.** There is no empty-state digest, because
an empty digest teaches partners to ignore the digest.

### Routing

By acquisition attribution alone:

- Zachary receives Contacts gathered through his validated card. Ethaniel receives his.
- Firm-fallback and unknown-source Contacts appear in shared sections delivered to
  **both** partners, identically.
- A partner with nothing attributed and nothing shared receives nothing that morning.

### Record shape

Seven rows, in a fixed order, every time: category, email, phone, collected, gathered
through, current owner, follow-up. The order never changes, so a partner who learned the
shape on a one-contact day reads the same shape on a thirty-contact day.

Absent optional values read `Not provided` here rather than disappearing, because the
absence is the information: an empty Email row is why no acknowledgement was sent.

**"Gathered through" and "Current owner" are separate rows, both always present.** The
owner is read from the linked Contact **at generation time**, so it prints `Unassigned`
at launch and prints the real owner once assignment exists, while the attribution row
never changes. It is not hardcoded.

Records are ordered by collection time ascending inside each group: the only ordering
that carries no judgment, because it reproduces the order the conversations happened in.

A possible-match callout fires only on exact email or exact phone (section 10) and states
plainly that nothing was merged.

### Delivery-bound state

- A Contact advances to `delivered` **only after the entire applicable digest delivered**.
  A shared Contact advances only when **both** partners received it.
- A failed send leaves the whole eligible set open, so a retry contains the same Contacts
  rather than a second copy of a day already read.
- Because the window is delivery-bound and not clock-bound, a two-day outage produces one
  digest covering two days, labelled by its window line.
- Digest identity is deterministic over the eligible set, so a retry is recognisably the
  same digest. That narrows the duplicate window; it does not close it. The guarantee is
  still bounded at-least-once (section 12).

### Size

Gmail clips a body above roughly 102 KB and the clipped part is the part nobody reads.
The working ceiling is **90 KB per HTML part**. Above it the digest **splits** at Contact
boundaries, preferring group boundaries, and every part is numbered. A Contact is never
split, and nothing is ever truncated.

The packer works from an estimated shell allowance and then **measures its own rendered
output**, re-packing with a larger allowance if a part came out over the ceiling. The
estimate is unreliable on its own: the counts panel grows with the number of distinct
categories and the headings grow with the number of groups.

---

## 10. The storage model

### Six tabs

| Tab | Holds | Mutability |
|---|---|---|
| `Submissions` | One immutable record of every accepted request | **Insert-only** |
| `Deliveries` | Acknowledgement, notification, and digest state, one row per submission | Mutable |
| `Leads` | Website service inquiries **only** | Mutable |
| `Contacts` | QR Contact Exchanges **only** | Mutable |
| `Work` | The idempotent side-effect queue | Mutable |
| `Log` | Operational history, retained 90 days (§13A) | Append, then expire |

**The Submission is insert-only, and that is enforced rather than asserted.** The
repository port declares exactly two methods, `insertSubmission` and
`findBySubmissionId`. There is no update method on the port, the Sheet adapter, or the
test fake, so no caller can write one by accident. Mutable per-submission state lives on
the `Deliveries` row precisely so the audit record can stay untouched.

### One Submission, exactly one business record

| Submission kind | Creates | Never creates |
|---|---|---|
| `service_inquiry` | `Submissions` + `Leads` + `Deliveries` | **No Contact** |
| `contact_exchange` | `Submissions` + `Contacts` + `Deliveries` | **No Lead** |

A website inquiry does not file a person: it is a request with a pathway, an SLA, and a
qualification state. A handshake at a conference is not a request with a clock on it.
Until Pass 9B every submission wrote a Lead row, which left QR rows in the Leads tab with
an empty pathway and a qualification state nobody would ever set.

`buildLead` throws on any kind other than `service_inquiry`, and `buildContact` throws on
any kind other than `contact_exchange`. A silent half-empty row is how this defect would
return, so the builders refuse rather than degrade.

A Contact may be linked or converted to a Lead **by a person**, recorded in
`linkedLeadIds`. Nothing does it automatically.

### Identity matching flags, and only flags

Evidence is exact and nothing else qualifies:

| Evidence | Effect |
|---|---|
| Exact normalized email | Records a possible-match flag |
| Exact normalized **full** phone digit string | Records a possible-match flag |
| Anything else | Not evidence at all |

**A match never links, merges, overwrites, or updates an existing Contact.** Every QR
Contact Exchange creates a NEW Contact; the flag is written to `possibleMatches` and
`matchNote` on the Submission and on the business record, for a human to act on. Two
records that turn out to be the same person are trivially reconcilable by hand; a merge
of two records that turn out to be different people destroys the losing record's history
and nobody finds out.

Name, company, name plus company, and email domain are not evidence, and a shared email
domain is never evidence. Phone comparison uses the complete digit string, never the last
ten, because a tail comparison collides unrelated international numbers.

There is no `mergeContact` function in the codebase, and a test asserts it stays absent.
Another test replaces `updateContact` with a thrower and runs a matching submission
through intake, so the rule is proven by the absence of the call rather than by the
absence of an effect.

### Google Contacts readiness

The internal Contact is the source of truth. Google Contacts would be a downstream copy,
never the database. `contactSyncStatus` is `not_configured`, and
`externalContactResourceName`, `externalContactEtag`, and `externalContactSyncedAt` exist
so a later adapter has somewhere to write without a migration. Nothing populates them, no
People API call exists in `src`, and the manifest requests no contacts scope.

---

## 11. SLA

**One policy, one number.** Every website `service_inquiry` is due at **5:00 PM
`America/Chicago` on the next business day**. Business days are Monday to Friday.
Holidays are ignored at launch, and that is a stated simplification: a holiday calendar
nobody maintains produces wrong deadlines silently, which is worse than a deadline
everyone knows ignores holidays.

"Next" is strict. A submission at 9:01 AM Monday is due Tuesday, not the same afternoon:
the commitment is a full working day, not the remainder of today.

Pass 8's pathway-specific 4 / 8 / 24 business-hour policy is **removed**. Three clocks
meant nobody could state a deadline without first checking which pathway they were
looking at, so in practice nobody checked at all.

| Submission | Due |
|---|---|
| `service_inquiry`, any pathway | 5:00 PM next business day |
| `contact_exchange` | No SLA at all |

The clock is satisfied by **`firstHumanContactAt` only**. An automated acknowledgement
proves the machine worked; it proves nothing about the response the commitment is about.

States: `pending`, `met`, `missed`, `breached`, `not_applicable`.

---

## 12. Processing order, recovery, and the delivery guarantee

### Order

Within one lock: **check for an existing Submission → screen → flag possible matches →
write the Submission → write the business record → write the Delivery row → queue side
effects → return.**

The Submission is written first on purpose: it is the record that cannot be
reconstructed. Everything after it is recoverable.

### Partial-write recovery

Writing the Submission first means a failure anywhere after it, a throw, a lost lock, an
execution killed at the Apps Script time limit, leaves a Submission with no business
record, no Delivery row, or no queued work. Before Pass 9B the retry found the Submission
and reported success, so the request stayed permanently half-written: no acknowledgement,
no digest entry, nothing in the tab a partner reads, and no error anywhere.

**A retry now reconciles before it reports success.** Each boundary is checked
independently, because the failure can land at any one of them:

| Missing | Repaired by |
|---|---|
| Lead | Rebuilt under the id the Submission recorded, with SLA and `bookingEligible` restored |
| Contact | Rebuilt under the recorded id, unassigned, `contactSyncStatus: not_configured` |
| Delivery row | Rebuilt, including `pending_digest` so a QR Contact becomes visible to the digest |
| Work items | Re-enqueued; the idempotency key makes a surviving item a no-op |

**Recovery uses the fingerprint-verified retry envelope together with the immutable
Submission's recorded identifiers, timestamp, screening result, and match flags.** It does
not re-derive them. Re-running spam screening or identity matching at repair time would
produce different answers, because the Contacts tab has grown since; the flags belong to
the moment of submission, and a repaired record must be the record that was accepted.

**This is retry-triggered reconciliation, not a background sweep.** Nothing scans for
half-written requests on a schedule. Repair happens only when the same request arrives
again, which means a request that is never retried stays half-written. A repair is logged
at `error` level as `submission_reconciled`, so a silent half-write leaves evidence even
though it was silently repaired.

Repair never duplicates: repeated retries produce exactly one Submission, one business
record, one Delivery row, and one work item per kind. A clean retry with nothing to repair
changes nothing at all, and reconciliation never rewrites the Submission.

### Idempotency and conflict

A retry is recognised by `submissionId`. To be treated as a retry it must carry the same
`submissionId` **and a materially identical payload, attribution, and locale**.

`payloadFingerprint`, stored on the Submission, is a hash over the submission kind, the
payload, `sourceCategory`, `sourceDetail`, and both locale fields. It deliberately
excludes `submittedAt` and `clientSignals`: an honest retry carries a new client clock
reading and a new fill-time measurement, and treating either as a change would turn every
genuine retry into a conflict. It deliberately includes attribution and locale, because
the same details submitted from a different partner's card, or with a different follow-up
language, is a different request.

A reused `submissionId` carrying materially different data returns
**`SUBMISSION_ID_CONFLICT`**. Nothing is created and nothing is overwritten. Reporting it
as a replay would tell the sender their new data was accepted when it was discarded.

> **`payloadFingerprint` is an idempotency and conflict-detection guard. It is not
> authentication, not authorization, and not a security credential of any kind.** It is a
> non-cryptographic digest, it is not secret, and it proves nothing about who sent a
> request. It answers one question: is this the same request as the one already stored.

### Binding client requirement

Any frontend that connects to this endpoint **must preserve the same `submissionId` and
the same payload, attribution, and locale across transport retries.** A client that mints
a fresh `submissionId` on retry creates duplicate business records; a client that reuses an
id while changing the data gets `SUBMISSION_ID_CONFLICT` and its data is not stored. This
is a requirement on the client, not a suggestion, and the shared submission client is
where it has to be implemented.

As of Code Pass 10A that client exists, and Code Pass 10C extends the same rule to the
booking command's `bookingRequestId`: see
[section 19](#19-the-frontend-transport-boundary).

### The delivery guarantee, stated honestly

**Bounded at-least-once.** A handler can run more than once: the side effect happens, the
process dies before the item is marked done, and the next cycle retries. There is **no
exactly-once guarantee and none is claimed**. What is guaranteed is that attempts are
bounded, so a permanently failing item stops instead of emailing forever.

| Bound | Value |
|---|---|
| Worker cycle | every 5 minutes |
| Items claimed per cycle | 20 |
| Attempts per item | 4 |
| Backoff | 5, 15, 60 minutes |
| Work kinds | `send_acknowledgement`, `send_qr_acknowledgement`, `notify_partners`, `send_booking_confirmation` |

A work item's `subjectId` is a `submissionId` for the acknowledgement and notification
handlers and a `leadId` for the booking confirmation. It was `leadId` for every kind until
Pass 9B, which stopped being true when a QR Contact Exchange stopped producing a Lead.

A permanent failure (missing configuration, rejected address, unknown work kind) is
abandoned on the first attempt and logged. Delivery states recorded per submission:
`pending`, `sent`, `failed`, `skipped`, `not_configured`, and `deferred_to_digest` for a
QR Contact, which says explicitly that it is waiting for the 8:00 AM digest rather than
sitting at `pending` and reading as a stuck queue.

---

## 13. Configuration

Read from Script Properties **by name at call time**. No value is defaulted; a missing
property fails closed.

| Property | Used for |
|---|---|
| `AXP_SHEET_ID` | intake |
| `AXP_CALENDAR_ID` | booking |
| `AXP_PARTNER_NOTIFY_TO` | partner notification (comma-separated); also added as attendees on confirmed Calendar booking events so partners receive a calendar invite |
| `AXP_PARTNER_EMAIL_MAP` | per-partner routing (JSON keyed by partner token) |
| `AXP_REPLY_TO` | visitor acknowledgement |
| `AXP_FROM_NAME` | outbound mail |
| `AXP_PARTNER_DIRECT_EMAIL_MAP` | The direct address printed in a QR acknowledgement (JSON by partner token) |
| `AXP_PARTNER_DIRECT_PHONE_MAP` | The direct phone. The row is omitted when absent |
| `AXP_FIRM_EMAIL` | The one verified firm address on the firm-fallback acknowledgement |
| `AXP_FIRM_PHONE` | Firm phone. The row is omitted entirely rather than shown empty |
| `AXP_WEBSITE_URL` | Public website, printed as a word rather than a bare URL |
| `AXP_LOGO_URL` | Logo PNG. Both emails are complete without it |
| `AXP_RUN_MODE` | `live` or `dry_run`; anything else is `dry_run` |

### Configuration health

`doGet` reports `health`, which separates two different questions: whether a capability
**can** run, and whether the copy it would send is currently **true**.

`blockers` is the second list, and it is **currently empty**: no outbound copy makes a
promise that configuration has to make true. `promisesKeepable` is therefore `true`. The
list and the field are kept in the response shape so the next piece of copy that promises
something has somewhere honest to report it.

Two blockers used to live here. The QR acknowledgement said "reply to this message and we
will update them" and "reply and we will remove your information", rendered only when
`AXP_REPLY_TO_MONITORED` and `AXP_REMOVAL_PROCEDURE_CONFIGURED` were both `true`. On
2026-08-15 that copy was deleted and both properties removed: correction and removal on
request are not offered, so the honest fix was to stop promising it rather than to gate
it. Neither property is read anywhere; setting either one has no effect.

Neither automated reply ingestion nor automated deletion is implemented, and the
acknowledgement no longer invites a reply for either purpose.

An unset run mode is **`dry_run`**, not `live`. Nothing leaves the project until
somebody says so explicitly.

### Sheet layout

Six tabs, resolved **by header name, never by position**, so reordering a column in the
live Sheet breaks nothing. See §10 for what each holds and which are mutable.

`Submissions`, `Deliveries`, `Leads`, `Contacts`, `Work`, `Log`.

`expectedTabLayout()` in `src/platform/SheetRepository.js` declares the header row for each. It is
read by a provisioning operator; nothing in this repository creates a tab.

---

## 13A. Retention

**Business records never expire automatically.** Leads, Contacts, submissions,
attribution, qualification history, proposal milestones, and idempotency keys retained
with their underlying record. Deleting them on a timer destroys the answer to "have we
spoken to this owner before", which is the question this system exists to answer.

There is **no business-record purge job** in this repository. `planRetention` returns a
plan whose shape has no key for one, so adding it would be a visible contract change
rather than a quiet behavioural drift, and a test asserts that no business record is ever
selected at any age.

**Operational records expire after 90 days**: system logs, and completed or permanently
exhausted delivery-attempt details.

**Pending or retryable work is never purged, regardless of age.** An old queued item is a
side effect that has not happened yet; removing it drops the acknowledgement and leaves
the record looking complete. Age is measured from `completedAt`, not `createdAt`, so an
item that retried for weeks and finished yesterday is young. A record whose timestamp
cannot be parsed is kept, because deleting it would turn a data problem into data loss.

`runRetentionMaintenanceTrigger` is callable and **unscheduled**. It accepts
`{ dryRun: true }`, which is how it should be run the first time against real data.

Not automated here, by design: manual correction and deletion on request remain possible
and are performed by a person. Legal hold is an operational procedure, not a flag this
code honours. **Any future business-record cleanup policy requires explicit approval and
its own tests before a line of it is written.**

---

## 14. Error codes

Stable strings a client can branch on.

`MALFORMED_BODY`, `BODY_TOO_LARGE`, `UNSUPPORTED_SCHEMA_VERSION`, `UNKNOWN_ENUM`,
`DISPLAY_STRING_NOT_ACCEPTED`, `INVALID_UUID`, `INVALID_TYPE`, `MISSING_REQUIRED`,
`FIELD_TOO_LONG`, `INVALID_EMAIL`, `INVALID_PHONE`, `EMAIL_OR_PHONE_REQUIRED`,
`SERVER_OWNED_FIELD_SUPPLIED`, `BLOCK_NOT_ALLOWED_FOR_PATHWAY`,
`SCOPE_INVOLVEMENT_MISMATCH`, `BOOKING_NOT_ALLOWED_IN_SUBMISSION`, `LEAD_NOT_FOUND`,
`BOOKING_ALREADY_ACTIVE`, `SLOT_UNAVAILABLE`, `SLOT_TOO_SOON`, `SLOT_TOO_FAR_AHEAD`,
`SLOT_OUTSIDE_BUSINESS_HOURS`, `INVALID_TIMESTAMP`, `INVALID_DURATION`,
`SERVICE_NOT_CONFIGURED`, `SERVICE_UNAVAILABLE`, `BUSY_TRY_AGAIN`, `INTERNAL_ERROR`,
`PATHWAY_NOT_BOOKABLE`, `CALENDAR_NOT_CONFIGURED`, `CALENDAR_CREATE_FAILED`,
`AVAILABILITY_UNAVAILABLE`, `SUBMISSION_ID_CONFLICT`

`SUBMISSION_ID_CONFLICT` means a stored `submissionId` was reused with materially
different data. Nothing was created and nothing was overwritten; see §12.

A refused booking also carries `bookingStatus` alongside its code, so a client can say
"that slot is taken" rather than a generic failure.

---

## 15. What is deliberately not implemented

| Not implemented | Why | Observable behaviour |
|---|---|---|
| A reachable endpoint | No Apps Script project or deployment has been created yet. | Both frontends are wired through `packages/submission-client` and build real envelopes; there is nothing for them to reach. The wiring is not what is missing. |
| Google People sync | Scoped to a later pass. | `contactSyncStatus: not_configured`; no contacts scope requested. |
| Automated reply ingestion | There is no correction and removal promise left to ingest replies against. | The promise and the two Script Properties that gated it were **removed** on 2026-08-15, not left gated. No acknowledgement offers correction or removal. See §13. |
| Automated deletion | As above, and see section 13A. | Manual only. |
| Referral resolution | Inert by contract. | `refToken` stored, used for nothing. |
| Origin enforcement | Impossible in an Apps Script web app. | Documented, not faked. |
| Translated email | English is the only send-ready locale. | The stated preference is recorded and shown internally; no template pretends to be translated. |
| Trigger installation | Every schedule is a deliberate external operation. | The digest, worker, and retention handlers are callable and unscheduled. |
| Dashboard, CRM, lead-record surface | None exists. | No email contains a link to one. A dead link in an internal email is worse than no link. |

---

## 16. Pre-deployment corrections (Code Pass 9A)

Each of these supersedes a Pass 8 position. They were reconciled **within**
`schemaVersion` 1 because nothing consumes or deploys it yet.

| # | Pass 8 position | Corrected to | Where |
|---|---|---|---|
| 1 | Contact Exchange acknowledgement skipped | Sent when a valid email exists; skipped for phone-only and for suspected spam | §4 |
| 2 | One immediate partner notification per QR Contact | Conditional daily 8:00 AM digest; website inquiries keep immediate notification | §9, §9A |
| 3 | A resolved QR scan provisionally sets `ownerPartner` | Ownership is unassigned at intake for everyone; attribution is a separate immutable field | §6 |
| 4 | Probable and weak matches on name, company, domain | Exact normalized email or exact normalized full phone only | §10 |
| 5 | Phone validated at 10 to 15 digits | 7 to 20 digits, approved punctuation, no country assumption | §4 |
| 6 | Phone matched on the last 10 digits | The complete normalized digit string | §10 |
| 7 | Pathway-specific 4 / 8 / 24 business-hour SLAs | One policy: 5:00 PM next business day | §11 |
| 8 | Queued Calendar creation returning `pending` | Synchronous Calendar call returning a truthful final status; `confirmed` only after `createEvent` succeeds | §7 |
| 9 | No implemented retention policy | Business records never expire; operational records expire at 90 days; pending work never purged | §13A |
| 10 | Template port deliberately failing | The approved templates are implemented as one canonical renderer | §17 |

Two further conflicts were found during the pass and are recorded here rather than
silently changed:

- **The firm card had no wire representation.** Pass 8 could distinguish only "resolved
  partner" from "unresolved". The approved digest requires `firm` and `unknown` as
  separate facts, so `acquisitionSource` was added with `axispoint-partners` as the firm
  slug. Frontend is not wired, so this costs nothing.
- **Booking was offered on every pathway.** The approved scope is Management Proposal
  only; the other pathways are questions, not engagements.

---

## 17. Email templates

One canonical renderer per message, in `scripts/gas-v2/src/emails/`: one file each for the
five templates below, with the pieces they share in `EmailHelpers.js` and locale selection
in `Registry.js`. **There is no embedded-constant-versus-mirror-file duplication**; that V1
pattern kept every template twice and the two drifted silently until a parity test was
written to catch it. Each V2 template is one pure function returning
`{ ok, subject, htmlBody, textBody }`, and the plain-text part is written as a
specification rather than generated by stripping tags. The booking confirmation additionally
returns `icsContent` and `icsFilename` (see below).

| Template | Sent to | When |
|---|---|---|
| Website inquiry acknowledgement | The visitor | On a `service_inquiry`, queued |
| Internal website inquiry notification | Partners | Immediately on a `service_inquiry`, queued |
| QR Contact acknowledgement | The person who shared their details | When a valid email exists |
| Daily QR Contact digest | Partners, per attribution | 8:00 AM, only when there is something to send |
| Booking confirmation | The visitor | Only after the Calendar confirmed the event |

### Rules every template obeys

- **Human labels, never wire tokens.** `property_owner_operator` is a storage value.
- **Missing optional values disappear**, never render empty, and are never filled with an
  invented placeholder. The digest is the one exception, where `Not provided` is itself
  information.
- **Every interpolated value is escaped**, in HTML and in plain text, and subjects are
  stripped of CR and LF because a subject is a mail header.
- **No tracking pixel, open tracking, click wrapping, marketing enrollment, nurture
  language, or preference centre.** These are transactional messages.
- **No invented value.** No recipient, sender, reply-to, phone, profile URL, logo URL, or
  removal-process value exists in this repository.
- **No em dashes.**

### The QR acknowledgement in particular

The submitted address has not been verified as belonging to the person who typed it, so
the **display name is the only submitted value that appears anywhere in it**. Phone,
company, role, and category are never echoed: mailing an unverified record back mails it
to whoever actually owns that inbox.

It also carries no response-time promise, no visible reference number, and no Save
Contact action. The action is withheld until a permanent profile URL or a verified vCard
delivery method exists.

### The booking confirmation in particular

Every confirmed booking -- both `phone_call` and `video_meeting` -- attaches a valid RFC
5545 `.ics` calendar file to the confirmation email. The renderer returns `icsContent`
(the iCalendar string) and `icsFilename` (`booking.ics`) alongside the usual HTML and
plain-text parts. The mail adapter attaches it via `Utilities.newBlob` with MIME type
`text/calendar; method=PUBLISH`.

For `video_meeting` bookings, the Google Meet link is generated by `Calendar.Events.insert`
(Advanced Calendar API, `conferenceDataVersion: 1`), threaded through the work-queue item
payload as `meetLink`, and included in the email HTML and plain-text body. The `.ics` file
for a `video_meeting` booking carries the link in its `DESCRIPTION`, `LOCATION`, and `URL`
fields. A `phone_call` booking sends `meetLink: null`; its `.ics` omits those fields.

Partner email addresses from `AXP_PARTNER_NOTIFY_TO` are added as Calendar event attendees
(`sendUpdates: 'all'`), so each partner receives a Google Calendar invite when a booking is
confirmed. The visitor is deliberately excluded from the attendee list: they receive
AxisPoint's own confirmation email with the `.ics` attachment, and a duplicate attendee
invite would arrive on top of it.

### Degradation

- With no configured logo the header prints the wordmark as live text. No broken image
  ever appears, and there is no other image in any template.
- One `<style>` block stacks key above value below 480px, matching the approved 390px
  behaviour. The layout does **not** depend on it: every cell carries its full inline
  style, so a client that strips the head (Gmail does) renders the side-by-side layout
  correctly.

### What the rendering verification does and does not prove

Specimens are rendered by `scripts/gas-v2/tools/render-previews.js` and checked in
headless Chrome at 600, 390, and 320 for horizontal overflow, preheader visibility,
external requests, and console errors.

**A browser is not an email client.** Gmail strips the document head, Outlook renders
through the Word engine, and iOS Mail and Android apply their own dark transforms. The
dark column in the contact sheet is a CSS filter approximation, not a client dark mode.
**No real client has been tested, and this pass claims none.** Testing in Gmail, Outlook,
iOS Mail, and Android remains outstanding before any email is sent to a real person.

---

## 18. Pre-deployment corrections (Code Pass 9B)

Reconciled within `schemaVersion` 1 for the same reason as §16: nothing consumes or
deploys it yet.

| # | Pass 9A position | Corrected to | Where |
|---|---|---|---|
| 1 | Every submission wrote a Lead row, QR included | Six-tab model. One Submission plus exactly one business record: inquiry to Lead, exchange to Contact | §10 |
| 2 | Delivery status lived on the Lead | Its own `Deliveries` row, keyed by `submissionId`, so a QR exchange has somewhere correct to keep it | §10 |
| 3 | No audit record of what was submitted | `Submissions`, insert-only, enforced by the absence of an update method on port, adapter, and fake | §10 |
| 4 | An exact match reused and updated an existing Contact | A match records a flag and nothing else. Never links, merges, overwrites, or updates | §10 |
| 5 | A retry found the Submission and reported success, leaving a half-written request | Retry-triggered reconciliation repairs the missing business record, Delivery row, or work items before reporting success | §12 |
| 6 | A reused `submissionId` was always a replay | `payloadFingerprint` detects a materially different request and returns `SUBMISSION_ID_CONFLICT` | §12 |
| 7 | `Booking.js` carried its own `BOOKABLE_PATHWAYS` list | One rule, `isBookablePathway`, used by both the intake response and the command | §7 |
| 8 | Work items were keyed on `leadId` | Keyed on `subjectId`, a `submissionId` for acknowledgement and notification work | §12 |

Two supporting changes were made for the same reason and are not separate decisions:
`findBySourceSubmissionId` was added to the Lead and Contact repositories so reconciliation
can ask whether the record for a submission exists, and the dead
`findLeadBySubmissionId` and `listPendingDigestSubmissions` lookups were removed because
they read columns the Lead no longer has.

---

## 19. The frontend transport boundary (Code Pass 10A)

One package, [`packages/submission-client`](../packages/submission-client/), is the **only**
place in the repository that may send a submission. **Both apps consume it as of Code Pass
10B**: `apps/web` sends `service_inquiry`, `apps/qr` sends `contact_exchange`. Neither app
contains a second transport, a second wire-token list, or a `fetch` of its own. It is not in
`packages/brand`: brand holds presentation, and a transport that decides retry semantics and
holds PII in memory is not presentation.

**Nothing in this section deploys anything.** No endpoint, Apps Script project, Sheet, or
Google resource exists. Pass 10A connected the website intake to the client; it did not
connect the client to a backend.

### What the client owns

| Concern | Where | Rule |
|---|---|---|
| Wire tokens | `src/wire.ts` | Mirrors `scripts/gas-v2/src/core/Tokens.js`. Tokens are read from the backend source, never inferred from a UI label |
| Attempt identity | `src/attempt.ts` | One `submissionId` per attempt, preserved across retries |
| Error classification | `src/errors.ts` | Backend code to `ok` / `retryable` / `permanent` / `not_configured` |
| Transport selection | `src/transport.ts` | Simulator, network, or fail-closed |

### The same-id retry requirement, implemented

`retry()` resends **the same `submissionId` and the same envelope**, satisfying the binding
client requirement in §12. It never re-mints an id and never re-reads the form.

A new id is minted only when the attempt is genuinely new: no envelope yet, the material
content changed, or the previous attempt succeeded. "Material content" is a fingerprint over
`submissionKind`, `payload`, `attribution`, and `locale`, deliberately **not** `submittedAt`
or `clientSignals`, which change on every attempt and would otherwise make every retry look
like a different request and trip `SUBMISSION_ID_CONFLICT` against the backend's own
`submissionFingerprint`.

`SUBMISSION_ID_CONFLICT` is classified permanent and marks the attempt exhausted, so the UI
cannot offer a retry that is guaranteed to fail again.

### Retention: memory only

The envelope lives in memory for the lifetime of the page. **Nothing is written to
`localStorage`, `sessionStorage`, cookies, or the URL**, and a successful submission clears
the envelope immediately so PII is not held after it stops being needed. A page reload ends
the attempt; there is no resumable draft, and offering one is a product decision nobody has
made.

### Transport selection, and how it fails

`createTransport` fails closed. It reaches the network only with an endpoint **and** the
network enabled; it reaches the simulator only in a development build; otherwise every
submission returns `not_configured`, which the UI renders as an honest "nothing was sent".

Both apps behave identically here, and each resolves its endpoint in its own
`vite.endpoint.ts`:

| Build | Endpoint | Transport |
|---|---|---|
| `pnpm dev` | forced empty by the config | simulator |
| `pnpm dev:e2e` | `VITE_V2_SUBMISSION_ENDPOINT` from `.env.e2e.local`, hard failure if absent | network |
| `pnpm build` with `VITE_V2_SUBMISSION_ENDPOINT` | from the build environment | network |
| `pnpm build` without one | none | `not_configured` |

### The endpoint variable is V2-specific, and that is a safety property

Both apps read **`VITE_V2_SUBMISSION_ENDPOINT`** and never `VITE_FORM_ENDPOINT`. The
historical name still points at the **V1** deployment, which speaks an entirely different
payload shape, so inheriting it would aim a V2 envelope at the V1 backend and the resulting
failure would read as a backend bug rather than a configuration mistake. In e2e mode a lone
V1 value is a **hard error that names the problem**, not a silent default.

`apps/web` moved in Pass 10A and `apps/qr` in Pass 10B, when it gained a submission surface
of its own. Endpoint resolution lives in a separate module in each app specifically so it can
be unit-tested against fixture env directories, rather than by running e2e mode against a
machine-local secret holding a live endpoint.

**A production build can never simulate success.** The simulator requires
`import.meta.env.DEV`, and the fixture names are dead code the bundler drops.

Simulated responses are chosen by **explicit fixture only** (`?submit=` in development).
There is no magic value: an earlier design triggered a failure from an email address
beginning `fail@`, which meant a real visitor with such an address would have been shown a
failure that never happened. Removed deliberately.

### A success is validated before anybody is told it worked

`ok: true` is not on its own accepted. Success is the one outcome that cannot be withdrawn:
it tells someone their inquiry was received and stops them trying again. Before the client
reports success it requires all of:

| Checked | Rule |
|---|---|
| `schemaVersion` | equals 1 |
| `submissionId` | equals the id that was sent |
| `submissionKind` | equals the kind that was sent |
| `replay`, `bookingEligible` | strict booleans, never coerced |
| `leadId`, `contactId`, `slaDueAt` | string or `null`, correctly typed |
| Service inquiry | non-empty `leadId`, `contactId` **null** |
| Contact exchange | non-empty `contactId`, `leadId` **null**, `slaDueAt` **null** |

The identity checks are kind-specific because the backend creates exactly one business
record per submission (§10). A success carrying both a Lead and a Contact, or neither,
contradicts the storage model and is not a response this client understands. `slaDueAt` is
allowed to be null on an inquiry because the replay path reads it back off the stored Lead.

Anything failing these becomes **`MALFORMED_RESPONSE`**, classified **retryable**: the
request may genuinely have been stored, and the attempt keeps its `submissionId`, so a retry
is a replay rather than a duplicate. The realistic hazards this catches are an intermediary
returning a cached or generic JSON 200, a future backend answering a different schema
version, and a response arriving for a different attempt than the one in flight.

An `ok: false` body is validated too. It must carry a real error object with a non-empty
string `code`, and a `field` that is **present** and either a string or null. An absent
`field` is rejected rather than read as null: the contract says every error carries the key,
so a body without it did not come from a backend speaking this contract, and treating "the
key is missing" as "no particular field is at fault" is a guess dressed up as a fact. `null`
still has to be written down. **A malformed error body no longer defaults to
`INTERNAL_ERROR`**, which invented a verdict no backend gave, and a retryable one at that; it
is now `MALFORMED_RESPONSE`.

### Two defects this pass found and fixed

Both were found by driving a real browser, not by reading code, and both are recorded because
the class of mistake matters more than the instances.

1. **A production build with a real endpoint would have refused every submission.** The
   website bound its `NETWORK_ENABLED` flag to `__E2E_MODE__`, which is false for every
   `vite build`. The endpoint compiled in, the network transport was tree-shaken out, and the
   live site would have fail-closed on every inquiry while looking correct in dev and in every
   test. Nothing caught it because the only bundle check ran against a no-endpoint build,
   where fail-closed is the *correct* outcome. `scripts/test/inspect-bundle.mjs` now takes
   `--expect-endpoint` and asserts the endpoint **and** the network transport survive, so the
   endpoint-enabled build is checked as its own case.
2. **Focus never moved to the error alert on the fail-closed path.** Focus was moved from a
   `requestAnimationFrame` scheduled in the same callback that set the state, which races
   React's commit: the frame can run while the alert is still unmounted and the move is
   silently skipped. Reproducible in a production build. Now a post-commit effect, keyed on a
   counter so a second consecutive failure re-announces.

### Verified against the real parser, not a copy of it

Every mapper output is run through the **actual** `parseEnvelope` from `scripts/gas-v2`,
loaded into a VM, so the frontend cannot drift from the backend's own validator. The sweep
covers all property-type, scope, situation, and timing permutations, every topic, and all
nine locales. Two tests tamper with a valid envelope to prove the guards matter, confirming
the backend rejects a display string with `DISPLAY_STRING_NOT_ACCEPTED` and a client-supplied
booking with `BOOKING_NOT_ALLOWED_IN_SUBMISSION`.

### Why translation can no longer reach these tokens

**This contract did not change for localization, and that is the point.** The frontend used to
reach it by a route that could not survive a second language: six intake controls held their
**English label** in draft state, and the mapper looked the token up *by that label*. A
translated UI would have sent an unrecognized label for every Management Proposal.

Those controls now hold the snake_case token itself and render their label from the message
catalog, so the value in this contract is the value the control stored, in any language. The
mapper's six label-keyed tables are deleted; it validates against the token list directly.
Regression coverage swaps in a synthetic catalog that changes every visible label and asserts
the envelope is unchanged. Nothing here is locale-dependent, and no display string is ever a
key. See the localization entry in [`STATUS.md`](STATUS.md).

### The QR Contact Exchange (Code Pass 10B)

`apps/qr/src/exchange` implements the approved
`AxisPoint QR Contact Exchange.dc.html` (design@2026-08-01) surface and submits through this
same client. **The backend needed no change to accept it**: the seven category tokens, the
payload shape, the card slugs, and the phone and email rules already matched, which a
preflight against `scripts/gas-v2` confirmed before any code was written.

**A QR submission creates a Submission and a Contact, never a Lead** (§10, and the board's
own contact-versus-lead rule). The category is a filing label a partner would write on the
back of a card, not a router: it never creates a service lead, never changes the copy, the
routes offered, or what happens next, and selecting "Investor or capital partner" does not
produce an Investor Services lead. A test proves the rule where it is enforced rather than
where it is avoided, by running a parsed exchange through the real `buildContact` and
asserting the real `buildLead` **throws**.

**Gathered-through attribution stays separate from ownership.** The browser sends only the
scan: `sourceCategory: 'qr'` and `sourceDetail`, the card slug. Everything else is derived
server-side (§ Attribution):

| Fact | Field | Lifetime |
|---|---|---|
| Which card produced this person | `acquisitionSource`, `scannedPartner` | Immutable |
| Who is responsible right now | `ownerPartner` | Mutable, **empty at intake for everyone** |

A scan gives a partner a name, not a claim, so ownership starts unassigned even for a
contact gathered through that partner's own card. An unrecognised slug resolves to `unknown`
and is deliberately **not** rewritten to the firm: a card that did not resolve is evidence a
printed card is wrong, and hiding it inside `firm` would destroy exactly that signal. The
browser never sends an owner, and the backend rejects `ownerPartner` as a server-owned field
if one were ever supplied, which a test confirms by tampering with a valid envelope.

**The category control is the approved native-select fallback.** The board draws a custom
button and listbox, and **binds** the implementation to a proven accessible select or listbox
primitive rather than bespoke keyboard and screen-reader logic, naming a native select as an
acceptable fallback. This repository introduces no component library, so the native control
is the proven primitive: arrow keys, type-ahead, Escape, the mobile picker, and assistive
technology behaviour all come from the platform. The board's only objection to it was iOS
truncating the longest label at 320px, which is answered directly by echoing the full
selected label as wrapping text beneath the control, so nothing is ever hidden.

**The duplicate case renders nothing.** Per the approved board, a possible match shows the
ordinary success screen word for word. Duplicate review is internal work done later by a
partner; the client is never told a match occurred, so there is nothing in the frontend
conditional on one.

### The booking command (Code Pass 10C)

Choosing a time issues a real `booking_request` through the same client. **The backend needed
no change**: a read-only audit confirmed the request shape, the response shape, the refusal
codes, and the idempotency rule were all already complete.

**Eligibility is the backend's, in both directions.** The intake offers a call only when
`bookingEligible` came back true on the submission response, and `executeBookingCommand`
re-evaluates `isBookablePathway` against the stored Lead at the moment somebody books rather
than trusting that snapshot. There is no pathway list in the frontend, for the same reason
there is none in `Booking.js`.

**Candidate times are policy-valid requests, not availability.** This is the one place the
frontend could easily lie, so it is worth stating plainly: V2 exposes no availability query
(`listBusy` is internal to the command, `doGet` is a health check), so the browser cannot
know which times are free. The picker therefore derives candidates from the backend's own
rules and claims nothing more:

| Mirrored rule | Value |
|---|---|
| Minimum lead time | 60 minutes |
| Horizon | 60 days |
| Business hours | 09:00 to 17:00, both ends inside one business day |
| Business days | Monday to Friday |
| Slot cadence and duration | 30 minutes |
| Zone | `America/Chicago`, with real daylight-saving offsets |

These are mirrored, not owned, so `apps/web/tests/booking.contract.test.ts` reads each value
out of the real backend source and fails if either side moves. A drifted mirror is worse than
none: the form would quietly offer times the command refuses, and the visitor finds out.
Every generated `slotStart` is additionally run through the backend's own
`isWithinBusinessHours`.

**Nothing is ever drawn as taken**, and the copy never describes these times as live
availability. The backend remains the authority and may still refuse a candidate.

**A refusal is classified by `bookingStatus`, not guessed:**

| Status | Client outcome | What the visitor sees |
|---|---|---|
| `unavailable` | permanent, attempt exhausted | "That time is no longer available. Please choose another." No retry: the same request would be refused again. |
| `rejected` | permanent, attempt exhausted | Trying again would not help. |
| `failed` | **retryable** | The same request is worth resending, with the same id. |
| `not_configured` | not configured | Nothing was booked, said plainly. |

**`bookingRequestId` follows the same two rules as `submissionId`, pulling opposite ways.**
An unchanged retry reuses the id, so a timeout cannot create a second calendar hold; the
backend replays the recorded outcome. Changing the slot or the mode is a **material edit**
and mints a new id, because replaying the old booking would confirm a time the visitor just
moved away from. The fingerprint covers `leadId`, `slotStart`, `durationMinutes`, and `mode`,
and excludes `submittedAt` so an honest retry is not mistaken for a different request.

**A booking reply is validated against the booking shape**, not the submission shape: it
carries no `submissionId`, `leadId`, `slaDueAt`, or `bookingEligible`. A success is accepted
only with the matching `bookingRequestId`, a boolean `replay`, and `bookingStatus` exactly
`confirmed`. An `ok: true` body claiming any other status is rejected outright, because
treating "ok but unavailable" as a confirmation is how somebody ends up waiting for a call
that was never booked.

**One shared AxisPoint calendar** is unchanged: a single `AXP_CALENDAR_ID` Script Property.

### A production simulator leak, and a bundle assertion that was not a guarantee

Pass 10C found and fixed a real defect, and retired a check that had been measuring the wrong
thing. Both are recorded because the pattern matters more than the instances.

**The simulator shipped in a production bundle.** `createTransport` used to return
`simulatorTransport(...)` when `isDevelopment` was true. In a production build that branch was
removed only because the bundler inlined `createTransport` and folded the flag away, which
held while exactly one call site existed. Adding the booking client ended the inlining, and
the simulator's fake lead ids and every fixture name appeared in the production bundle.
`verify:bundle` caught it. **The fix is structural, not a patch**: `createTransport` can no
longer return the simulator at all, and each app reaches the simulator directly behind its own
`import.meta.env.DEV` literal, so production code never references it and it is dropped
because it is genuinely unreferenced rather than by luck.

**The "no endpoint, therefore no network transport in the bundle" assertion was removed.** It
was added in Pass 10A and it over-claimed. `createTransport` references `networkTransport` on
one branch, so whether that code survives tree-shaking measures whether the bundler inlined
the function, not whether the build is safe; it began failing the moment a second client
existed even though nothing unsafe had changed. What actually prevents a no-endpoint build
from posting anywhere is that there is no endpoint to post to, and the checks that prove that
all remain: no endpoint literal in the bundle, the fail-closed `NOT_CONFIGURED` path present,
no dev fixtures, and the `--expect-endpoint` direction confirming an endpoint-enabled build
does keep its transport.

### Locale-aware visitor templates (Localization Readiness)

**The contract is unchanged.** Same `schemaVersion`, same storage headers, same request
tokens, all nine locales still accepted and stored, and page locale still kept separate from
preferred follow-up.

What changed is that the resolution machinery is now actually called. `resolveOutboundLocale`
and `LAUNCH_READY_LOCALES` existed since Pass 9A, but no handler used them: a Spanish
preference was validated, stored, and shown to a partner, and then had no effect on which
template rendered. The acknowledgement and booking-confirmation handlers now resolve the
outbound locale and pass it to template selection.

`LAUNCH_READY_LOCALES` remains `['en']`, so an unlaunched preference resolves to English with
`satisfied: false`. **Nothing pretends to be translated.**

**The one fallback rule:** a renderer is taken from the requested locale's set when that set
exists and defines it; otherwise English. That covers both failure shapes at once. An unknown
locale has no set, so English. A registered but incomplete set is missing that one renderer,
so English for that message while its other messages still come from its own set. Falling
back per renderer is safe because each is a separate, self-contained email: an English
booking confirmation beside a translated acknowledgement is two correct messages, not one
half-translated one.

**Internal mail stays English by construction.** `renderPartnerNotification` and
`renderQrDigest` take no locale parameter at all, so no caller can ask for one. They are read
by the two partners and already display the visitor's preferred language as a field.

**Storage is untouched by any of this.** A test asserts that resolving an outbound locale
never rewrites the stored record, and that a Spanish preference is still stored as Spanish
after an English message is sent.

### Still unconnected after this pass

- **No endpoint exists.** Every check above ran against the dev simulator or a local stub on
  `127.0.0.1`. No request has ever been sent to Google, and no calendar was contacted.
- **Nothing else was added**: no automatic matching, no merging, no Google Contact sync, no
  storage persistence, and no referral resolution. Matching remains a server-side flag only,
  and `contactSyncStatus` remains `not_configured` with no People API code and no scope.
