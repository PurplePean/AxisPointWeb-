/**
 * Local fixture registry for the QR business card (design@2026-07-30).
 *
 * This is a CONFIGURABLE LOCAL FIXTURE, not a data contract and not a public URL
 * contract. The approved board leaves five values unresolved and this pass does not
 * invent any of them:
 *
 *   1. a verified phone for each partner, or a decision to omit Call
 *   2. verified email behaviour for each partner, or a decision to route to the firm
 *   3. whether a firm phone will ever exist
 *   4. the final permanent profile URL, printed on the card and unrevisable after print
 *   5. the contact-file generation and delivery method
 *
 * Anything unresolved is `null` here, and the UI follows the approved missing-data
 * rules: omit the action cleanly, never a disabled control, never a placeholder,
 * never a masked number.
 *
 * On contact values: this used to warn against `packages/brand/src/team.ts` and
 * `packages/brand/src/utils/vcard.ts`, which carried unverified V1 partner phone numbers
 * and email addresses. Both files were deleted in the 2026-08-15 V1 retirement pass, and
 * the owner confirmed the current values directly in that same pass. They are recorded in
 * `docs/PARTNER_CONTACTS.md`, which is now the one place to read them from.
 *
 * They are still deliberately NOT filled in below. Wiring verified contact data into this
 * profile fixture is a decision for the QR replacement pass, not a side effect of V1
 * retirement, and `docs/STATUS.md` still carries the surrounding open items (the permanent
 * profile URL and the contact-file delivery method) that a printed card depends on.
 */

export interface PartnerProfile {
  /** Local fixture key. NOT the permanent public URL. */
  key: string;
  displayName: string;
  /** Approved: both partners are titled Partner only. */
  title: 'Partner';
  /** Verified direct line, or null. Null omits the Call action entirely. */
  phone: { href: string; display: string } | null;
  /** Verified direct address, or null. Null routes Email to the firm inbox. */
  email: string | null;
  /**
   * Permanent public profile URL. Unresolved, so null. The contact record falls back
   * to the firm site address rather than printing a placeholder.
   */
  profileUrl: string | null;
  /**
   * Where Save Contact would fetch a hosted contact file. Unresolved, so null.
   * This pass prepares the card locally instead; see `contact-file.ts`.
   */
  vCardUrl: string | null;
}

/** Values the approved ledger records as Confirmed or Approved. */
export const FIRM = {
  name: 'AxisPoint Partners',
  /** "Approved" in the ledger, and the one approved address on the board. */
  email: 'info@axispoint.llc',
  /** "Confirmed" in the ledger. */
  website: 'axispoint.llc',
  websiteUrl: 'https://axispoint.llc',
  /** "Confirmed". No street address appears on this surface. */
  locality: 'Houston, Texas',
  /** No verified firm phone exists, so no firm Call action is ever shown. */
  phone: null as { href: string; display: string } | null,
  /** Firm-level description, shared by both partner profiles. */
  description:
    'AxisPoint manages multifamily and retail properties for owners across Texas, with an asset management layer when the property calls for it.',
  /**
   * Owner-directed copy correction, 2026-07-31. A deliberate deviation from the
   * approved board, which reads "This card did not resolve to a partner profile.
   * Reach the firm directly and we will route you to the right partner." The
   * replacement drops the mention of an unresolved card and leads with the action.
   */
  fallbackDescription: 'Connect directly with the firm. We will route your inquiry to the right partner.',
  partnersLine: 'Partner-led from Houston by Zachary Russell and Ethaniel Vu.',
  /**
   * Organization note for the contact record. The board records its wording as
   * "Needs approval", so nothing is written into the card until it is approved.
   */
  organizationNote: null as string | null,
} as const;

export const PARTNERS: PartnerProfile[] = [
  {
    key: 'zachary-russell',
    displayName: 'Zachary Russell',
    title: 'Partner',
    phone: null,
    email: null,
    profileUrl: null,
    vCardUrl: null,
  },
  {
    key: 'ethaniel-vu',
    displayName: 'Ethaniel Vu',
    title: 'Partner',
    phone: null,
    email: null,
    profileUrl: null,
    vCardUrl: null,
  },
];

/**
 * Development-only fixtures used to exercise the approved missing-data states that
 * the real fixtures cannot currently reach, since both partners have every optional
 * value unresolved.
 *
 * The phone numbers below are in the 555-01xx range, reserved for fictional use. They
 * are never presented as AxisPoint contact details, are labelled on screen as a state
 * demo, and are stripped from production builds because `import.meta.env.DEV` gates
 * every use.
 */
export const DEV_STATE_FIXTURES: PartnerProfile[] = [
  {
    key: 'demo-phone-and-email',
    displayName: 'State demo, both values present',
    title: 'Partner',
    phone: { href: 'tel:+15550100', display: '(555) 010-0000' },
    email: 'demo@example.com',
    profileUrl: null,
    vCardUrl: null,
  },
  {
    key: 'demo-missing-phone',
    displayName: 'State demo, no verified phone',
    title: 'Partner',
    phone: null,
    email: 'demo@example.com',
    profileUrl: null,
    vCardUrl: null,
  },
  {
    key: 'demo-missing-email',
    displayName: 'State demo, no verified email',
    title: 'Partner',
    phone: { href: 'tel:+15550101', display: '(555) 010-0001' },
    email: null,
    profileUrl: null,
    vCardUrl: null,
  },
];

export function allSelectableProfiles(): PartnerProfile[] {
  return import.meta.env.DEV ? [...PARTNERS, ...DEV_STATE_FIXTURES] : PARTNERS;
}

/**
 * Resolve a profile from the local preview key.
 *
 * This is a DEVELOPMENT PREVIEW MECHANISM ONLY. It is deliberately not presented as
 * the permanent public URL contract: the real card will resolve one printed URL per
 * partner, and that route is an unresolved owner decision. An unknown, absent, or
 * dev-only key in production resolves to the firm fallback, which is the approved
 * behaviour for an unresolved card.
 */
export function resolveProfile(key: string | null): PartnerProfile | null {
  if (!key) return null;
  const pool = allSelectableProfiles();
  return pool.find((p) => p.key === key) ?? null;
}

/**
 * The website base URL is configurable so the local web preview can be used during
 * development without asserting the permanent QR-host routing contract.
 * `VITE_WEB_BASE_URL` overrides it; otherwise production points at the firm site.
 */
export const WEB_BASE_URL: string =
  (import.meta.env.VITE_WEB_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : FIRM.websiteUrl);

/** The approved quiet routes out to the shared website. */
export const WEB_LINKS = {
  managementProposal: `${WEB_BASE_URL}/contact?intent=property-management`,
  propertyManagement: `${WEB_BASE_URL}/property-management`,
  home: `${WEB_BASE_URL}/`,
};
