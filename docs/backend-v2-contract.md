# V2 backend contract (schemaVersion 1)

Authoritative description of the wire contract implemented in
[`scripts/gas-v2`](../scripts/gas-v2/). Derived from the Code Pass 7 audit and its final
correction, implemented in Code Pass 8, and **reconciled in Code Pass 9A** against the
approved communications design.

Pass 9A corrected several Pass 8 positions **within** `schemaVersion` 1 rather than
bumping the version, because nothing consumes or deploys schema version 1 yet: no
frontend sends it and no endpoint exists. They are pre-deployment corrections, listed in
[section 16](#16-pre-deployment-corrections-code-pass-9a).

**Status: implemented and locally tested. Not deployed, not connected.** There is no
Apps Script project, no Sheet, no trigger, no deployment, and neither frontend submits
to it. See [`deployment.md`](deployment.md) for what bringing it up actually involves,
and [`branching.md`](branching.md) for why merging this changes nothing externally.

V1 (`scripts/gas/Code.gs`) is untouched and remains the deployed backend.

---

## 1. Transport

One anonymous Apps Script web app endpoint. `POST` a JSON body; `GET` is a health
check that reports which capabilities are configured and never the values that
configure them.

Every response is **HTTP 200 with a JSON body**, including every failure. An uncaught
exception in an Apps Script web app returns an HTML error page a cross-origin `fetch`
cannot read, so the browser sees a network failure and the visitor sees nothing.

```jsonc
// success
{ "schemaVersion": 1, "ok": true, ... }

// failure
{ "schemaVersion": 1, "ok": false, "error": { "code": "UNKNOWN_ENUM", "field": "payload.topic" } }
```

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
while the calendar is down, and a calendar conflict must never reject an inquiry. It is
offered on the **Management Proposal pathway only**; the other pathways are questions,
not engagements.

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

## 10. Identity: Lead vs Contact

A **Lead** is a request: one submission, one moment, one thing somebody wanted. A
**Contact** is a person: stable across every request they ever make. Collapsing the two
is what forced V1's rework, because a second inquiry from the same owner had nowhere
correct to go.

Matching **suggests; it never merges.** An automatic merge of two people who happen to
share a name is unrecoverable through normal use and nobody finds out.

**Exact evidence only.**

| Evidence | Effect |
|---|---|
| Exact normalized email | Links to the existing Contact |
| Exact normalized **full** phone digit string | Links to the existing Contact |
| Anything else | Not evidence. Not a link, and not even a suggestion |

Name, company, name plus company, and email domain are **not** matching evidence, and a
shared email domain is never evidence. Those produced Pass 8's "probable" and "weak"
suggestions, which are removed: a suggestion a partner learns to ignore hides the exact
match that actually needed attention.

Phone comparison uses the **complete** digit string, not the last ten. The last-ten rule
was a North American assumption that would collide two unrelated international numbers on
their tails and merge two people.

Two exact candidates that disagree (an email pointing at one Contact and a phone at
another) produce a *new* Contact plus both suggestions, because the stored data already
contradicts itself and picking one would hide that.

Linking is not merging: a blank incoming value never overwrites a populated stored one,
so somebody filling in only a phone on their second submission does not lose the email
from their first.

`contactSyncStatus` is `not_configured`. Google People synchronization is scoped to a
later pass, and the manifest deliberately requests no contacts scope.

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

## 12. Processing order and delivery guarantee

Within one lock: **replay check → screen → resolve identity → write Lead → write or
merge Contact → queue side effects → return.**

Storage comes first because the durable record is the only artifact that cannot be
reconstructed. Email and calendar work is queued and executed by a time-driven trigger.

**Replay protection.** A repeated `submissionId` returns the original result and queues
nothing further, so a double-click or a flaky network cannot create two leads.

**The guarantee is bounded at-least-once, stated honestly.** A handler can run more than
once: the side effect happens, the process dies before the item is marked done, and the
next cycle retries. There is **no exactly-once guarantee and none is claimed**. What is
guaranteed is that attempts are bounded.

| Bound | Value |
|---|---|
| Worker cycle | every 5 minutes |
| Items claimed per cycle | 20 |
| Attempts per item | 4 |
| Work kinds | `send_acknowledgement`, `send_qr_acknowledgement`, `notify_partners`, `send_booking_confirmation` |
| Backoff | 5, 15, 60 minutes |

A permanent failure (missing configuration, rejected address, unimplemented template,
unknown work kind) is abandoned on the first attempt and logged. Retrying it three more
times changes nothing.

Delivery states recorded per lead: `pending`, `sent`, `failed`, `skipped`,
`not_configured`. A missing service records `not_configured` rather than a silent
success, and the work is still queued so the state is visible rather than looking like
a stuck queue.

---

## 13. Configuration

Read from Script Properties **by name at call time**. No value is defaulted; a missing
property fails closed.

| Property | Used for |
|---|---|
| `AXP_SHEET_ID` | intake |
| `AXP_CALENDAR_ID` | booking |
| `AXP_PARTNER_NOTIFY_TO` | partner notification (comma-separated) |
| `AXP_PARTNER_EMAIL_MAP` | per-partner routing (JSON keyed by partner token) |
| `AXP_REPLY_TO` | visitor acknowledgement |
| `AXP_FROM_NAME` | outbound mail |
| `AXP_PARTNER_DIRECT_EMAIL_MAP` | The direct address printed in a QR acknowledgement (JSON by partner token) |
| `AXP_PARTNER_DIRECT_PHONE_MAP` | The direct phone. The row is omitted when absent |
| `AXP_FIRM_EMAIL` | The one verified firm address on the firm-fallback acknowledgement |
| `AXP_FIRM_PHONE` | Firm phone. The row is omitted entirely rather than shown empty |
| `AXP_WEBSITE_URL` | Public website, printed as a word rather than a bare URL |
| `AXP_LOGO_URL` | Logo PNG. Both emails are complete without it |
| `AXP_REPLY_TO_MONITORED` | `true` only when the reply-to address reaches a monitored human mailbox |
| `AXP_REMOVAL_PROCEDURE_CONFIGURED` | `true` only when a written correction/removal procedure with a named owner exists |
| `AXP_RUN_MODE` | `live` or `dry_run`; anything else is `dry_run` |

### Configuration health, and the two launch blockers

`doGet` reports `health`, which separates two different questions: whether a capability
**can** run, and whether the copy it would send is currently **true**.

The QR acknowledgement's approved copy says "reply to this message and we will update
them" and "reply and we will remove your information". Printing that with nobody reading
the mailbox tells a real person something untrue. So the block renders **only** when both
`AXP_REPLY_TO_MONITORED` and `AXP_REMOVAL_PROCEDURE_CONFIGURED` are `true`, and both are
reported as launch **blockers** until they are. Unset means false; an unset flag is never
read as "yes, somebody is watching".

Neither automated reply ingestion nor automated deletion is implemented. Correction and
removal are manual procedures performed by a person.

An unset run mode is **`dry_run`**, not `live`. Nothing leaves the project until
somebody says so explicitly.

### Sheet layout

Four tabs, resolved **by header name, never by position**, so reordering a column in
the live Sheet breaks nothing.

| Tab | Contents |
|---|---|
| `Leads` | One row per submission, including all operational fields. |
| `Contacts` | One row per person. |
| `Log` | Diagnostics only. Personal data is redacted; a missing Log tab never fails a write. Expires at 90 days. |
| `Work` | The deferred-work queue, including `idempotencyKey` and a serialized `payload`. |

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
`AVAILABILITY_UNAVAILABLE`

A refused booking also carries `bookingStatus` alongside its code, so a client can say
"that slot is taken" rather than a generic failure.

---

## 15. What is deliberately not implemented

| Not implemented | Why | Observable behaviour |
|---|---|---|
| Frontend wiring | Scoped to a later pass. | No app sends anything. No endpoint exists. |
| Google People sync | Scoped to a later pass. | `contactSyncStatus: not_configured`; no contacts scope requested. |
| Automated reply ingestion | The correction and removal promise is a manual human procedure. | The promise is gated on configuration and omitted when it cannot be kept. |
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

One canonical renderer in `scripts/gas-v2/src/Templates.js`. **There is no
embedded-constant-versus-mirror-file duplication**; that V1 pattern kept every template
twice and the two drifted silently until a parity test was written to catch it. Each V2
template is one pure function returning `{ ok, subject, htmlBody, textBody }`, and the
plain-text part is written as a specification rather than generated by stripping tags.

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
