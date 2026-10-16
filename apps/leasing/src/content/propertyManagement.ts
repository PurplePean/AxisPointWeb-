/**
 * All property-management-page claims in one place.
 *
 * UNCONFIRMED: Every value here is test content. Ethaniel Vu and Theophanes
 * Gaitanaros must confirm or correct each item before launch. See the launch
 * checklist in docs/deployment.md.
 */

// UNCONFIRMED: Service scope and descriptions.
export const SERVICES = [
  // Core services
  'Rent collection and disbursement.',
  'Maintenance coordination and vendor management.',
  'Periodic property inspections and condition reporting.',
  'Owner reporting and financial summaries.',
  // NNN-specific services
  'CAM reconciliation and tenant billing.',
  'Tax and insurance pass-through tracking.',
  'Lease compliance and renewal tracking.',
] as const;

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
