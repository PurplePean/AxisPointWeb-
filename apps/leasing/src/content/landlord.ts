/**
 * All landlord-page claims in one place.
 *
 * UNCONFIRMED: Every value here is test content. The owner and broker
 * (Ethaniel Vu and Theophanes Gaitanaros) must confirm or correct each item
 * before launch. See the launch checklist in docs/deployment.md.
 */

// UNCONFIRMED: Agreement terms and commission rates.
export const AGREEMENT_OPTIONS = [
  { days: 90, ratePercent: 6 },
  { days: 120, ratePercent: 5 },
] as const;

// UNCONFIRMED: Controls whether commission rates are shown on the page.
// Set to false to hide every percentage until the rates are confirmed.
// When false the page shows only the term choice and never mentions a
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
  'You choose the term',
  'Nothing hidden',
] as const;

/**
 * Returns the display label for an agreement option card.
 * When showRates is false the percentage is omitted entirely.
 */
export function formatAgreementLabel(
  option: (typeof AGREEMENT_OPTIONS)[number],
  showRates: boolean,
): string {
  return showRates
    ? `${option.days} day agreement, ${option.ratePercent}%`
    : `${option.days} day agreement`;
}
