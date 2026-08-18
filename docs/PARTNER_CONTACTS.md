# Partner Contact Values

**Confirmed:** August 15, 2026
**Confirmed by:** the owner, directly, in the V1 retirement pass
**Status:** current and authoritative

## Why this file exists

`packages/brand/src/team.ts` carried partner email and phone literals. Those were
**historical V1 values**, and `docs/system-classification.md` was explicit that they must not
be copied forward into V2 runtime code or a tracked contact document without owner
verification.

That verification has happened. The values below were supplied directly by the owner on the
date above. They were **not** read out of `team.ts` and are not inherited from V1. `team.ts`
was deleted in the same pass that created this file, so this document, not the deleted
source, is the reference from here on.

This is public-facing business contact information. It is not a secret, and it is deliberately
tracked in the repository so that future work has one verified place to read it from rather
than recovering literals out of a git tag.

## Confirmed current values

| Partner | Email | Phone |
| --- | --- | --- |
| Zachary Russell | zach@axispoint.llc | 832-580-2815 |
| Ethaniel Vu | ethaniel@axispoint.llc | 832-499-8389 |

## What this is the reference for

Any future V2 work that needs current partner contact information should read it here:

- **`apps/qr/src/profiles.ts`, which carries these values as of 2026-08-17.** No longer a
  future consumer: the QR card is now one page showing both partners, it displays both direct
  numbers and both direct addresses to anyone who scans it, and it writes them into the
  two-record contact file that visitors save. **This document stays the source of record**,
  and a change updates it and `profiles.ts` in the same pull request.
- Email signatures.
- Footer and contact-page content, if partner-level contact detail is ever surfaced there.
  The current `apps/web` contact page does not surface it.

## Maintenance rule

These are people's real contact details, so they go stale in the real world rather than in a
diff. Confirm them with the owner again before relying on them for anything printed, anything
that ships to visitors, or anything with a permanent address behind it, and update this file
and its confirmation date in the same pull request when a value changes.

**"Anything that ships to visitors" is no longer hypothetical.** Since 2026-08-17 these exact
values are rendered on the QR card and written into the contact file people save to their
phones, so a stale value here becomes a stale value in somebody's address book, which no
deploy can reach back and correct.

Do not reintroduce a `team.ts`-style module that duplicates these values in code. One tracked
source, read at the point it is needed.
