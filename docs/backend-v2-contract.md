# V2 backend contract (schemaVersion 1)

Authoritative description of the wire contract implemented in
[`scripts/gas-v2`](../scripts/gas-v2/). Derived from the Code Pass 7 audit and its
final correction; implemented in Code Pass 8.

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
`fullName` and `email` are required; a phone that is present must be 10 to 15 digits.

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

A contact exchange receives **no automated acknowledgement**. It is a record of a
handshake, not a request for a reply, and an unsolicited automated email to somebody
who just swapped a card is the wrong move. It also carries **no SLA due time**.

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

## 6. Attribution

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

**A QR scan identifies WHICH CARD was scanned. It does not assign ownership.** The
resolved partner is stored as `scannedPartner`; who works the lead is `ownerPartner`,
decided by routing (§9) and freely reassignable. Only the two approved slugs resolve;
anything else, including a slug that used to exist, is stored as
`scannedSlugUnresolved` rather than guessed at.

**`refToken` is inert by contract.** It is stored verbatim and never resolved to a
person, never used to build a referral chain, never triggers a notification, and never
feeds reporting. It exists so the raw signal is not thrown away if referral tracking is
built later.

---

## 7. Booking

Booking is a **separate command issued after a submission**, never a block inside one.
The two operations have genuinely different failure modes: an inquiry must be storable
while the calendar is down, and a calendar conflict must never reject an inquiry.

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

Rules:

- The slot must start at least 60 minutes ahead and no more than 60 days ahead.
- **Both ends** must fall inside one business day (Mon–Fri, 09:00–17:00 project time).
  Checking only the start would book a meeting nobody is there for.
- A busy calendar returns `SLOT_UNAVAILABLE`.
- The same `bookingRequestId` **replays**, returning the existing outcome instead of
  creating a second hold. A *different* request while one is active is refused
  (`BOOKING_ALREADY_ACTIVE`); after a failed hold, a fresh request is accepted.
- The calendar write is **queued**, not inline, so a calendar outage delays a meeting
  rather than losing one. A queued write whose booking was superseded is abandoned
  rather than creating an event nobody asked for.
- With no calendar configured, the request is still recorded (`not_configured`) for a
  partner to confirm by hand, because the visitor's stated intent is worth keeping.

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

| Situation | Notified | `ownerPartner` |
|---|---|---|
| Website submission | firm | *(none)* |
| QR scan, slug resolves | that partner | that partner (provisional) |
| QR scan, slug unresolved | firm | *(none)* |
| Flagged as suspected spam | firm | *(none)* |

Ownership from a scan is **provisional**: whoever handed over the card is the obvious
first responder, but a partner can reassign, and reassignment must not be fighting an
automatic rule that keeps reasserting itself.

If a per-partner address is not configured, the notification falls back to the
firm-wide list rather than being dropped. An undeliverable notification is worse than
an over-broad one.

---

## 10. Identity: Lead vs Contact

A **Lead** is a request: one submission, one moment, one thing somebody wanted. A
**Contact** is a person: stable across every request they ever make. Collapsing the two
is what forced V1's rework, because a second inquiry from the same owner had nowhere
correct to go.

Matching **suggests; it never merges.** An automatic merge of two people who happen to
share a name is unrecoverable through normal use and nobody finds out.

| Evidence | Confidence | Effect |
|---|---|---|
| Exact email, or exact phone (last 10 digits) | strong | Links to the existing contact |
| Name + company, or name + non-generic email domain | probable | Recorded in `possibleMatches` |
| Name alone | weak | Recorded in `possibleMatches` |

A shared free-mail domain (`gmail.com`, `outlook.com`, …) is **never** evidence. Two
strong candidates that disagree produce a *new* contact plus both suggestions, because
the stored data already contradicts itself and picking one would hide that.

Linking is not merging: a blank incoming value never overwrites a populated stored one,
so somebody filling in only a phone on their second submission does not lose the email
from their first.

`contactSyncStatus` is `not_configured`. Google People synchronization is scoped to a
later pass, and the manifest deliberately requests no contacts scope.

---

## 11. SLA

Measured in **business hours** (Mon–Fri, 09:00–17:00, project time zone), not elapsed
hours. A Friday evening inquiry with a four hour target is due Monday late morning. A
wall-clock deadline would mark almost every weekend lead breached before anyone could
have answered, which makes the field worthless and then ignored.

| Pathway | Target |
|---|---|
| `management_proposal` | 4 business hours |
| `investor_services` | 8 business hours |
| `general_inquiry` | 24 business hours |
| `contact_exchange` | none |

The clock is satisfied by **`firstHumanContactAt` only**. An automated acknowledgement
proves the machine worked; it proves nothing about the response the commitment is
about.

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
| `AXP_RUN_MODE` | `live` or `dry_run`; anything else is `dry_run` |

An unset run mode is **`dry_run`**, not `live`. Nothing leaves the project until
somebody says so explicitly.

### Sheet layout

Four tabs, resolved **by header name, never by position**, so reordering a column in
the live Sheet breaks nothing.

| Tab | Contents |
|---|---|
| `Leads` | One row per submission, including all operational fields. |
| `Contacts` | One row per person. |
| `Log` | Diagnostics only. Personal data is redacted; a missing Log tab never fails a write. |
| `Work` | The deferred-work queue, including `idempotencyKey` and a serialized `payload`. |

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
`SERVICE_NOT_CONFIGURED`, `SERVICE_UNAVAILABLE`, `BUSY_TRY_AGAIN`, `INTERNAL_ERROR`

---

## 15. What is deliberately not implemented

| Not implemented | Why | Observable behaviour |
|---|---|---|
| Email templates | The approved email design is separate work; interim wording would put unapproved copy in front of real people. | The template port fails permanently; `ackEmailStatus` / `partnerNotifyStatus` record `failed`, and the lead is still stored. |
| Google People sync | Scoped to a later pass. | `contactSyncStatus: not_configured`; no contacts scope requested. |
| Frontend wiring | Neither app has a submission surface pointed here. | No change in `apps/`. |
| Referral resolution | Inert by contract. | `refToken` stored verbatim, used for nothing. |
| Origin enforcement | Impossible in an Apps Script web app. | Documented, not faked. |
