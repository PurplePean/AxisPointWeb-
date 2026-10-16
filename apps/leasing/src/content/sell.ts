/**
 * All Sell and BOV page claims in one place.
 *
 * UNCONFIRMED: Every value here is test content. Ethaniel Vu and Theophanes
 * Gaitanaros must confirm or correct each item before launch, including who
 * handles rent opinions and who handles sale opinions. See the launch checklist
 * in docs/deployment.md.
 */

// UNCONFIRMED: The two kinds of broker opinion of value (BOV). `role` is the
// /contact?role= value that tags the inquiry so each kind sorts itself.
export const BOV_TYPES = [
  {
    key: 'rent',
    title: 'Rent BOV',
    question: 'What rent should my space command?',
    summary:
      'An opinion of the rent your space should command in today\'s market, based on comparable leases nearby.',
    cta: 'Request a rent BOV',
    role: 'bov-rent',
  },
  {
    key: 'sale',
    title: 'Sale BOV',
    question: 'What could my property sell for?',
    summary:
      'An opinion of what your property could sell for, based on comparable sales and the income it produces.',
    cta: 'Request a sale BOV',
    role: 'bov-sale',
  },
] as const;

// UNCONFIRMED: How a BOV request works.
export const BOV_STEPS = [
  'Tell us about the property.',
  'We review it and the market around it.',
  'You get a written opinion of value.',
] as const;

// UNCONFIRMED: Retail investment sales services.
export const SALES_SERVICES = [
  'Retail investment sales representation.',
  'Pricing and marketing strategy.',
  'Buyer outreach and negotiation.',
] as const;

// UNCONFIRMED: Turnaround time, cost and what the owner must provide. Set to
// null until confirmed. Nothing about cost or timing renders while null.
export const BOV_TERMS: null = null;

// UNCONFIRMED: Sales track record. Set to null until the owners supply real
// figures. Nothing renders while null.
export const TRACK_RECORD: null = null;

export function contactHref(role: (typeof BOV_TYPES)[number]['role']): string {
  return '/contact?role=' + role;
}

/** Section keys that have content and should render. Null sections are excluded. */
export function visibleSections(): ('bov' | 'steps' | 'sales' | 'terms' | 'record')[] {
  const out: ('bov' | 'steps' | 'sales' | 'terms' | 'record')[] = ['bov', 'steps', 'sales'];
  if (BOV_TERMS !== null) out.push('terms');
  if (TRACK_RECORD !== null) out.push('record');
  return out;
}
