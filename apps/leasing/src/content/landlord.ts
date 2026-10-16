/**
 * All landlord-page claims in one place.
 *
 * UNCONFIRMED: Every value here is test content. The owner and broker
 * (Ethaniel Vu and Theophanes Gaitanaros) must confirm or correct each item
 * before launch. See the launch checklist in docs/deployment.md.
 */

// UNCONFIRMED: Agreement structure. One 90-day listing agreement whose
// commission rate depends on when the lease is signed. The reading that the
// rate steps down based on the lease signing date (not the listing start date)
// needs owner confirmation.
export const AGREEMENT = {
  totalDays: 90,
  phases: [
    { fromDay: 1, toDay: 60, ratePercent: 6 },
    { fromDay: 61, toDay: 90, ratePercent: 5 },
  ],
} as const;

// UNCONFIRMED: Controls whether commission rates are shown on the page.
// Set to false to hide every percentage until the rates are confirmed.
// When false the page shows only the agreement term and never mentions a
// percentage anywhere.
export const SHOW_RATES = true;

// UNCONFIRMED: Speed promises shown in the speed section.
export const SPEED_PROMISES = [
  'Same business day reply to every inquiry.',
  'Tours scheduled around the prospect, not our calendar.',
  'Updates the day something changes, not when we get around to it.',
] as const;

// Short promise phrases for the home page promise strip (links to /landlord).
// UNCONFIRMED: confirm wording with the owner.
export const HOME_STRIP_PROMISES = [
  'Same business day reply',
  'One 90 day agreement',
  'Nothing hidden',
] as const;

/**
 * Returns display labels for each phase of the agreement.
 * When showRates is true: "Days 1 to 60: 6%", "Days 61 to 90: 5%"
 * When showRates is false: "Days 1 to 90" (single collapsed label, no percentages)
 */
export function agreementPhaseLabels(showRates: boolean): string[] {
  if (!showRates) {
    const first = AGREEMENT.phases[0];
    const last = AGREEMENT.phases[AGREEMENT.phases.length - 1];
    return [`Days ${first.fromDay} to ${last.toDay}`];
  }
  return AGREEMENT.phases.map((p) => `Days ${p.fromDay} to ${p.toDay}: ${p.ratePercent}%`);
}

// UNCONFIRMED: Sales-cycle FAQ entries. Wording must be reviewed by Ethaniel
// and Theophanes before launch.
export const SALES_CYCLE_FAQ = [
  {
    question: 'Does every space lease at the same speed?',
    answer:
      'No. Inline shop space usually moves fastest because the process is straightforward and the tenant pool is large. Pad sites, large suites and single-tenant net lease (STNL) properties usually take longer because there are more steps and more decision makers involved. The speed we promise is how fast we reply, tour and update you, not a guaranteed lease date.',
  },
  {
    question: 'Why do pad sites and STNL properties take longer?',
    answer:
      'Pad sites often involve site plans, municipal approvals or build-to-suit negotiation before a tenant commits. Large suites have a smaller pool of qualified tenants, so it takes longer to find the right fit. National STNL tenants run their own real estate committee and credit approval processes, which are outside anyone\'s control.',
  },
] as const;

// UNCONFIRMED: Owner to decide whether the 90-day agreement extends for pad
// sites, large suites and STNL properties, and at what rate.
// TODO: owner to supply extension terms before this entry can be enabled.
export const EXTENSION_FAQ: { question: string; answer: string } | null = null;

/**
 * Returns the sales-cycle FAQ entries to render. Includes EXTENSION_FAQ only
 * when it is non-null.
 */
export function salesCycleFaqEntries(): ReadonlyArray<{ question: string; answer: string }> {
  const out: { question: string; answer: string }[] = [...SALES_CYCLE_FAQ];
  if (EXTENSION_FAQ !== null) out.push(EXTENSION_FAQ);
  return out;
}

/**
 * Returns a summary sentence for the agreement.
 * When showRates is true includes a sentence about the rate depending on when
 * the lease is signed.
 * TODO: owner to supply the commission basis wording (e.g., "of gross lease value").
 */
export function agreementSummary(showRates: boolean): string {
  const base = `One ${AGREEMENT.totalDays} day agreement.`;
  if (!showRates) return base;
  // UNCONFIRMED: the reading that the commission rate depends on when the
  // lease is signed (not the listing start date) needs owner confirmation.
  return `${base} The commission rate depends on when the lease is signed.`;
}

/**
 * Answer for the "Who do I talk to?" FAQ item. The reply-time wording comes
 * from SPEED_PROMISES so it is never hardcoded in the page.
 * UNCONFIRMED: confirm wording with the owner.
 */
export function whoToTalkAnswer(): string {
  return `Use the button below and tell us about your property. ${SPEED_PROMISES[0]}`;
}
