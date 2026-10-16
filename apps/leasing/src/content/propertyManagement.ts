/**
 * All property-management-page claims in one place.
 *
 * UNCONFIRMED: Every value here is test content. Ethaniel Vu and Theophanes
 * Gaitanaros must confirm or correct each item before launch. See the launch
 * checklist in docs/deployment.md.
 */

// UNCONFIRMED: Service scope and descriptions.
export const SERVICE_GROUPS = [
  {
    title: 'Core management',
    items: [
      'Rent collection and disbursement.',
      'Maintenance coordination and vendor management.',
      'Periodic property inspections and condition reporting.',
      'Owner reporting and financial summaries.',
    ],
  },
  {
    title: 'NNN administration',
    items: [
      'CAM reconciliation and tenant billing.',
      'Tax and insurance pass-through tracking.',
      'Lease compliance and renewal tracking.',
    ],
  },
] as const;

// Flat list of every service, derived from the groups above.
export const SERVICES: readonly string[] = SERVICE_GROUPS.flatMap((g) => g.items);

// UNCONFIRMED: Management fee and agreement term. Set to null until Ethaniel
// confirms the fee structure and term. No fee or percentage renders while null.
export const AGREEMENT: null = null;

// UNCONFIRMED: Reporting cadence and format. Set to null until Ethaniel
// confirms. No reporting detail renders while null.
export const REPORTING: null = null;

/**
 * Returns the list of section keys that have content and should render.
 * A section whose data is null is excluded from the list.
 */
export function visibleSections(): ('services' | 'agreement' | 'reporting')[] {
  const out: ('services' | 'agreement' | 'reporting')[] = ['services'];
  if (AGREEMENT !== null) out.push('agreement');
  if (REPORTING !== null) out.push('reporting');
  return out;
}

// UNCONFIRMED: Short list shown on the Home page lane. Keep in step with
// SERVICE_GROUPS above.
export const HOME_LANE_ITEMS = [
  'Rent collection and vendor coordination',
  'NNN administration and CAM reconciliation',
  'Inspections and owner reporting',
] as const;
