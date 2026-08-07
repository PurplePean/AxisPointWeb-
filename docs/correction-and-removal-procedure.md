# Correction and removal procedure (DRAFT)

> **STATUS: DRAFT. NOT APPROVED.**
>
> This document has **not** been reviewed or approved by Zach Russell. Nothing in it is in
> force. Every commitment below is **proposed**, not agreed.
>
> **Until Zach approves this document in writing, both flags must remain `false`:**
>
> | Script Property | Required value while this is a draft |
> |---|---|
> | `AXP_REMOVAL_PROCEDURE_CONFIGURED` | **`false`** |
> | `AXP_REPLY_TO_MONITORED` | **`false`** |
>
> While either is false the QR acknowledgement **omits** its correction and removal lines,
> which is the correct behaviour: the system must not promise a person something no
> approved procedure stands behind.

**Proposed accountable person: Zach Russell (Zach@axispoint.llc)**, subject to his
acceptance of that role.

---

## 1. What the flags gate

The approved QR acknowledgement contains two lines rendered only when **both** flags are
`true` (`configHealth`, `scripts/gas-v2/src/Config.js`):

- reply and we will update your details
- reply and we will remove your information

Someone who handed over their details at a conference is being told a human will act. That
is why the backend refuses to print it by default and why this draft cannot flip the flag
by existing. Approval is a decision, not a file.

## 2. Proposed response targets, NOT APPROVED

| | Proposed |
|---|---|
| Acknowledge receipt | within **2 business days** |
| Complete the correction or removal | within **10 business days** |

These are **starting proposals for Zach to accept, change, or reject.** They are not
commitments, and no response-time promise appears in any outbound copy in any case: the
approved copy inventory forbids it.

## 3. Requester identity verification

**Perform this before changing or deleting anything.** A removal request is a destructive,
irreversible instruction, and acting on an unverified one lets a third party delete somebody
else's record or, worse, confirm to a stranger that a named person is in the system.

1. **Reply from `info@axispoint.llc` to the address already on the record**, not to the
   address that sent the request, and ask the person to confirm the request from there.
   Acting only on a reply to the stored address is the check.
2. If the request arrives from an address **not** on any record, do **not** confirm or deny
   that a record exists. Reply asking them to write from the address they believe was
   submitted. Saying "you are not in our system" is itself a disclosure.
3. If the record has **only** a phone number, call it and confirm the request verbally.
   Record the date and time of that call in the completion log entry.
4. If identity cannot be established after one follow-up, **do not act**. Reply explaining
   that the request could not be verified, and stop.
5. **Never** ask for a government ID, a photograph, or any document. Collecting more
   personal data to delete personal data is self-defeating.

An unverified requester is a reason to stop, not a reason to hurry.

## 4. Where a request arrives

`info@axispoint.llc`, the `AXP_REPLY_TO` address on every outbound message. A request may
also reach a partner directly; whoever receives it forwards it to `info@` so one place holds
the record of it.

## 5. Correction

1. Verify identity per §3.
2. Locate the person in `Contacts` by `normalizedEmail` or `normalizedPhone`.
3. Edit the affected fields in place: `fullName`, `email`, `phone`, `company`,
   `roleOrTitle`, `contactCategory`.
4. Set `updatedAt` to the current ISO timestamp.
5. Leave `acquisitionSource`, `scannedPartner`, `firstSourceCategory`, `firstSourceDetail`,
   and the originating `Submissions` row unchanged. Those record **how the record was
   gathered**, which stays true after the details change. Correcting a phone number is not a
   reason to rewrite the history of a handshake.
6. Reply from `info@` confirming what changed.

## 6. Removal, with a full field audit

Verify identity per §3 first.

The rule applied throughout: **remove or redact every value that is about the person or was
typed by them; retain only values that describe the system's own handling and cannot be
attributed to them.**

### 6.1 `Contacts`: delete the entire row

All 28 columns are either the person's data, derived from it, or a pointer to it. Nothing in
this tab survives a removal.

### 6.2 `Leads`: delete the entire row

All 47 columns likewise. If a booking exists, first delete the calendar event, then clear
`calendarEventId` and `calendarStatus`, then delete the row.

### 6.3 `Submissions`: retain the row, clear the listed fields

The row survives as evidence that a request was received and handled. **Clear these 39
fields:**

| Field | Why it must go |
|---|---|
| `fullName`, `email`, `phone`, `organization`, `roleOrTitle`, `contactCategory` | submitted personal data |
| `normalizedEmail`, `normalizedPhone` | derived directly from the above; a normalised email identifies as well as the original |
| `payloadFingerprint` | **a digest of the personal payload.** A hash of personal data is still person-linked: anyone holding a guess can confirm it by recomputing. This is the field most easily missed |
| `landingPage` | a full URL that may embed `ref`, `utm`, or other identifiers in its query string |
| `refToken` | a referral code that links this person to whoever referred them |
| `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm` | describe how **this person** arrived; `utmContent` and `utmTerm` in particular carry arbitrary values |
| `preferredFollowUpLocale`, `preferredFollowUpStated` | a preference the person stated about themselves |
| `pathway`, `serviceScope`, `topic` | what they asked about |
| `propertyType`, `propertyScope`, `propertyScale`, `propertyScaleUnknown`, `propertyCount` | describe their property |
| `propertyLocation` | **free text, and frequently an address.** Among the most identifying values in the system |
| `situationCurrent`, `situationInvolvement`, `situationTiming` | describe their circumstances |
| `situationNotes` | **free text written by the person.** Unbounded, and the most sensitive field in the table |
| `possibleMatches` | identifiers of **other people's** records. Retaining it leaks a third party |
| `matchNote` | **free text** written by a partner about the match |
| `pageLocale` | a signal about the person; low risk alone, cleared for consistency |
| `leadId`, `contactId` | pointers to rows that no longer exist |

**Retained in `Submissions`, with the reason each is non-personal:**

| Field | Why retaining it is not retaining personal data |
|---|---|
| `submissionId` | an opaque UUID v4 minted at random by the client. Not derived from any personal value, so it cannot be reversed into one. It is the key the audit trail hangs on |
| `submissionKind` | `service_inquiry` or `contact_exchange`: describes which code path ran |
| `schemaVersion` | a contract version number |
| `receivedAt`, `submittedAt` | timestamps of a system event. With every identifying field cleared, a timestamp attaches to no one |
| `sourceCategory` | `website` or `qr`: which surface the request came through |
| `acquisitionSource`, `scannedPartner` | name **an AxisPoint partner, the firm, or `unknown`**, that is, which of *our* cards produced the record. They describe our own materials, not the data subject, and they are the immutable acquisition attribution the storage model exists to protect |
| `sourceDetail` | a card slug or a site path. One of our own identifiers |
| `intentToken` | a fixed enum naming which of our entry points was used |
| `spamSuspected` | a boolean about the submission |
| `spamReason` | **verified to be a fixed enum list**, not free text: `honeypot_filled`, `submitted_too_fast`, `excessive_links`, `disposable_email_domain`, `url_in_name`, `repeated_character_run`, `unbroken_text_block` (`src/Spam.js`). It records **which rule fired**, never what the person wrote |

### 6.4 `Deliveries`: retain the entire row

All 8 columns (`submissionId`, `submissionKind`, `createdAt`, `updatedAt`,
`ackEmailStatus`, `partnerNotifyStatus`, `digestStatus`, `digestDeliveredAt`) are delivery
state machine values and timestamps. None contains an address, a name, or anything the
person typed. This tab is the evidence of what was sent, which is exactly what a removal
record needs to preserve.

### 6.5 `Work`: delete pending rows, audit completed ones

1. **Delete** every row whose `subjectId` is one of this person's submissions and whose
   `state` is not `succeeded`. A queued acknowledgement must never be sent to somebody who
   asked to be removed. **This step is time-critical:** the worker runs every 5 minutes.
2. For completed rows, inspect **`lastError`**. It is populated from handler reason codes
   (`String(result.reason)` in `src/Worker.js`) such as `mail_send_failed` or
   `calendar_create_failed`, which are non-personal. **Verify this per row rather than
   assuming it**, because a future handler could put a rejected address into a reason string.
   Redact anything person-attributable.
3. Retained columns are non-personal: `workId` (opaque), `createdAt`, `completedAt`,
   `nextAttemptAt` (timestamps), `kind` (a fixed work-kind enum), `state`, `attempts`
   (counters), `subjectId` (an opaque submission id).

### 6.6 `Log`: redact `detail`, retain the rest

**`detail` is person-attributable and must be redacted.** This is the field most likely to
be overlooked, because the code comment above `redactEmail` says personal data never reaches
the log. What it actually writes for `submission_accepted` is:

```
redactEmail('robin@company.com')  ->  'r***@company.com'
```

**The full domain and the first initial survive.** At a small firm that frequently identifies
one person. The booking log line writes `mode + ' @ ' + slotStart`, which is the time of
that person's meeting.

1. Find every `Log` row whose `submissionId` or `leadId` belongs to this person.
2. Overwrite `detail` with `redacted_on_request`.
3. Retain `logId` (opaque), `at` (timestamp), `level`, and `event` (fixed enums naming which
   system event occurred). Retain `submissionId` and `leadId`: once the rows they point at
   are cleared or deleted, they are tombstones pointing at nothing.

### 6.7 Completion record

Add one `Log` row: `level: info`, `event: removal_completed`, `detail` naming **no** personal
data and no partial address. Record the identity-verification method used (§3) and, if a
phone confirmation was used, its date and time.

## 7. What this procedure does not cover

- **Google revision history and provider-side backups are outside this procedure.** Google
  Sheets retains version history, and Google may hold provider-side copies under its own
  retention schedules. Clearing a cell removes it from the current sheet, **not** from that
  history. Neither is under operator control through the steps above, and this document does
  not claim otherwise. Deciding whether that residue is acceptable, and whether sheet version
  history should be purged or the sheet periodically rebuilt, is an open decision for Zach.
- **Google Contacts.** Nothing is written there. `contactSyncStatus` is `not_configured`, no
  People API code exists, and no contacts scope is requested. If sync is ever built, this
  procedure must gain a step **before** that ships.
- **Email already sent.** A delivered message cannot be recalled. Removal covers stored
  records and future sends.
- **Backups.** No separate backup of the spreadsheet exists. If one is introduced, its
  removal step belongs here **before** it is created.

## 8. This is not a legal-compliance determination

This is an **operator procedure**: what the people running this system do when somebody asks.
It is **not** legal advice, and it is **not** an assessment of GDPR, CCPA, CPRA, or any other
regime. Nobody has determined which laws apply to AxisPoint, what a lawful basis or a
verified consumer request means here, or what statutory deadlines bind. The targets in §2 are
operational proposals, not statutory periods.

If a legal obligation applies, it governs and this document must be revised to match. That
assessment has not been done and is not within the scope of this repository.

## 9. Approval

| | |
|---|---|
| Status | **DRAFT, not approved** |
| Proposed owner | Zach Russell |
| Approved by | *(nobody yet)* |
| Approved on | *(not approved)* |

On approval, record it here, then set `AXP_REMOVAL_PROCEDURE_CONFIGURED` to `true`.
`AXP_REPLY_TO_MONITORED` is a **separate** decision about whether a human actually reads
`info@axispoint.llc`; approving this document does not establish that.

Review when the storage model, the acknowledgement copy, the reply-to address, or contact
sync or backups change.
