# Correction and removal procedure

**Accountable person: Zach Russell (Zach@axispoint.llc).**

This document is the thing `AXP_REMOVAL_PROCEDURE_CONFIGURED` refers to. Until it exists
and is true, that Script Property must stay unset, because the flag is not a preference: it
gates whether the QR acknowledgement prints a promise to a real person.

## What the promise is

The approved QR Contact Exchange acknowledgement contains two lines, rendered only when
**both** `AXP_REPLY_TO_MONITORED` and `AXP_REMOVAL_PROCEDURE_CONFIGURED` are `true`:

- reply and we will update your details
- reply and we will remove your information

Someone who scanned a card at a conference and handed over their details is being told a
human will act on a reply. Printing that without a monitored mailbox and a written procedure
is a promise nobody is keeping, which is why the backend refuses to print it by default
(`configHealth` in `scripts/gas-v2/src/Config.js` reports both as launch blockers).

## Where a request arrives

`info@axispoint.llc`, the `AXP_REPLY_TO` address on every outbound message. A request may
also reach either partner directly; whoever receives it forwards it to `info@` so there is
one place the record of it lives.

## Response commitment

| | |
|---|---|
| Acknowledge receipt | within **2 business days** |
| Complete the correction or removal | within **10 business days** |
| Accountable if either slips | Zach |

No response-time promise appears in any outbound copy, deliberately. The approved copy
inventory forbids it, and a commitment printed to a stranger is harder to honour than one
held internally.

## Handling a correction request

1. Locate the person in the `Contacts` tab by `normalizedEmail` or `normalizedPhone`.
2. Edit the affected fields **in place**: `fullName`, `email`, `phone`, `company`,
   `roleOrTitle`, `contactCategory`.
3. Update `updatedAt` to the current ISO timestamp.
4. Leave `acquisitionSource`, `scannedPartner`, `firstSourceCategory`, `firstSourceDetail`,
   and the originating `Submissions` row **unchanged**. Those record how the contact was
   gathered, which stays true even after the details change. Correcting a phone number is
   not a reason to rewrite the history of a handshake.
5. Reply from `info@` confirming what changed.

## Handling a removal request

1. Locate the person as above, and identify every row that concerns them: the `Contacts`
   row, any `Leads` row, and the originating `Submissions` rows.
2. Delete the `Contacts` row.
3. Delete any `Leads` row for the same person.
4. In each originating `Submissions` row, clear the personal fields: `fullName`, `email`,
   `phone`, `organization`, `roleOrTitle`, `normalizedEmail`, `normalizedPhone`,
   `situationNotes`. Leave the row itself, its `submissionId`, its timestamps, and its
   attribution in place.
5. Delete any pending `Work` rows whose `subjectId` is one of those submissions, so no
   queued email is sent to somebody who asked to be removed.
6. If a booking exists, delete the calendar event and clear `calendarEventId` and
   `calendarStatus` on the Lead before deleting it.
7. Reply from `info@` confirming the removal.
8. Record the completion in the `Log` tab: `level: info`, `event: removal_completed`, and a
   `detail` that names **no** personal data.

**Why the `Submissions` row is emptied rather than deleted.** The row is the audit record
that a request was received and what the system did about it. Deleting it outright would
also delete the evidence that the removal itself was handled. Clearing the personal fields
removes the person's data while leaving that evidence intact. If a future decision says the
row must go entirely, that supersedes this step.

## What this procedure does not cover

- **Google Contacts.** Nothing is written to Google Contacts. `contactSyncStatus` is
  `not_configured`, no People API code exists, and no contacts scope is requested. If sync
  is built later, this procedure must gain a step and that is a blocker for shipping it.
- **Email already sent.** A delivered message cannot be recalled. Removal covers stored
  records and future sends.
- **Backups.** No separate backup of the Sheet exists. If one is introduced, it needs a
  removal step here before it is created, not after.

## Review

Reviewed by Zach when any of these changes: the storage model, the acknowledgement copy,
the reply-to address, or the introduction of contact sync or backups.
