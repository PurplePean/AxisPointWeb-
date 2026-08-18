/**
 * The partner and firm values shown on the QR card.
 *
 * ONE PAGE, BOTH PARTNERS. This module used to be a three-state fixture registry: a
 * `?profile=` query parameter selected Zachary, Ethaniel, or an unresolved-card firm
 * fallback, and the page rendered one of them. That is gone. **Owner-directed decision,
 * 2026-08-17:** one scan resolves to one combined page that shows both partners together,
 * so there is no profile to select, no fallback state to reach, and no per-partner URL to
 * print. `docs/design-sources.md` records this as a deliberate, documented departure from
 * the approved board rather than a silent overwrite of it.
 *
 * CONTACT VALUES ARE THE OWNER-CONFIRMED ONES. They are read from
 * `docs/PARTNER_CONTACTS.md`, confirmed by the owner on 2026-08-15, and that document names
 * this surface as its own immediate consumer. They were NOT recovered from the deleted V1
 * `packages/brand/src/team.ts`, which carried unverified literals.
 *
 * `docs/PARTNER_CONTACTS.md` stays the source of record and carries the maintenance rule:
 * these are real people's details, they go stale in the world rather than in a diff, and a
 * change updates that file and this one together.
 */

export interface PartnerProfile {
  /** Stable local identifier. Not a URL, not a wire value, not sent anywhere. */
  key: string;
  displayName: string;
  /** Approved: both partners are titled Partner only. */
  title: 'Partner';
  /** Owner-confirmed direct line, or null. Null omits that partner's Call action entirely. */
  phone: { href: string; display: string } | null;
  /** Owner-confirmed direct address, or null. Null falls back to the firm inbox. */
  email: string | null;
  /**
   * Permanent public profile URL. Still unresolved, so null. The contact record falls back
   * to the firm site address rather than writing a placeholder into somebody's address book.
   */
  profileUrl: string | null;
}

/** Values the approved ledger records as Confirmed or Approved. */
export const FIRM = {
  name: 'AxisPoint Partners',
  /** "Approved" in the ledger, and the one approved firm address on the board. */
  email: 'info@axispoint.llc',
  /** "Confirmed" in the ledger. */
  website: 'axispoint.llc',
  websiteUrl: 'https://axispoint.llc',
  /** "Confirmed". No street address appears on this surface. */
  locality: 'Houston, Texas',
  /** No verified firm phone exists, so no firm Call action is ever shown. */
  phone: null as { href: string; display: string } | null,
  /** Firm-level description, shown once at the top of the combined page. */
  description:
    'AxisPoint manages multifamily and retail properties for owners across Texas, with an asset management layer when the property calls for it.',
  /**
   * Organization note for the contact record, written into both partners' records as `NOTE`.
   *
   * The board listed this as "Needs approval" and the code left it null until it was. **The
   * owner supplied this exact wording on 2026-08-18**, resolving the third of the four
   * unresolved QR values in `docs/design-sources.md`. It is a firm-level sentence, so both
   * records carry the same one; it is not a per-partner value.
   *
   * It is 91 octets once escaped and prefixed, which is what put line folding into
   * `useSaveContact.ts`. A change to this wording is a change to what lands in real people's
   * address books: update `docs/design-sources.md` in the same commit.
   */
  organizationNote:
    'Property management for multifamily and retail owners across Texas, based in Houston.' as
      | string
      | null,
} as const;

/**
 * Both partners, in the order they appear on the page and in the saved contact file.
 *
 * This list is the whole model now. There is no fallback entry and no dev-only fixture set:
 * the fallback existed only for a card that did not resolve to a partner, and nothing
 * resolves any more because nothing is selected. The dev fixtures existed to exercise the
 * approved missing-data states, which both partners' confirmed values no longer reach.
 *
 * The missing-data RULES are still implemented, in `Profile.tsx` and in the contact-card
 * builder: a null phone or email omits its action cleanly rather than rendering a disabled
 * control or a placeholder. They are simply unreachable with today's values, which is the
 * correct reason for a state to be unreachable.
 */
export const PARTNERS: readonly PartnerProfile[] = [
  {
    key: 'zachary-russell',
    displayName: 'Zachary Russell',
    title: 'Partner',
    phone: { href: 'tel:+18325802815', display: '832-580-2815' },
    email: 'zach@axispoint.llc',
    profileUrl: null,
  },
  {
    key: 'ethaniel-vu',
    displayName: 'Ethaniel Vu',
    title: 'Partner',
    phone: { href: 'tel:+18324998389', display: '832-499-8389' },
    email: 'ethaniel@axispoint.llc',
    profileUrl: null,
  },
];

/*
 * NOTHING IN THIS FILE READS `import.meta.env`, DELIBERATELY.
 *
 * It is imported by `exchange/model.ts`, so the Node test runner loads it as plain source,
 * and Node has no `import.meta.env` to read. The website links that do need it live in
 * `webLinks.ts`, where that comment explains why reading the env object through a variable
 * is not an acceptable workaround.
 */
