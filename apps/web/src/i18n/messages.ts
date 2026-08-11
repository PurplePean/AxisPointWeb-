import { DEFAULT_LOCALE, type LocaleCode } from './locales';
// Explicit `/index`, not the bare directory: the test resolver hook rescues extensionless
// specifiers but Node rejects a directory import before it ever gets the chance.
import { REVIEWED_CATALOGS } from './catalogs/reviewed/index';
// Aliased away in every build. See `./catalogs/none.ts` and `apps/web/vite.config.ts`.
import { loadAuditCandidate } from './catalogs/audit/active';

/**
 * The message catalog for the intake surfaces that are already catalog-driven.
 *
 * WHAT THIS COVERS, PRECISELY. Every key here has a consumer today: the gateway, the option
 * labels for the six stable-token controls, the scale copy that adapts to property type, the
 * short-pathway copy, validation and help text, the review-summary fallbacks, and booking
 * copy. Nothing else.
 *
 * WHAT IT DELIBERATELY DOES NOT COVER. Step headings, individual field labels and
 * placeholders, and the submission-state screens are still hardcoded in `Intake.tsx`, along
 * with all marketing pages, the navigation, and the footer. Migrating those is the
 * Multilingual Content Rollout pass. Keys for them were removed rather than left as
 * scaffolding: a catalog holding keys nothing renders claims coverage it does not have, with
 * values nobody has checked against the page.
 *
 * EVERY VALUE BELOW IS TRANSCRIBED, NOT WRITTEN. It comes from the JSX that renders it or
 * from the approved model constant it replaced. An earlier revision wrote several from
 * memory and got them wrong, which is why a rendered-English baseline is captured and
 * compared.
 *
 * `Messages` is flat and fully required on purpose. A partial catalog is how a
 * half-translated locale ships with blanks in it: TypeScript refuses the object, and
 * `missingKeys` refuses it in development and in tests.
 */

export interface Messages {
  /* ── Gateway ── */
  gatewayTitle: string;
  gatewayLead: string;
  gatewayOwnerKicker: string;
  gatewayOwnerTitle: string;
  gatewayOwnerBody: string;
  gatewayOwnerAction: string;
  gatewayAssetTitle: string;
  gatewayAssetBody: string;
  gatewayInvestorTitle: string;
  gatewayInvestorBody: string;
  gatewayGeneralTitle: string;
  gatewayGeneralBody: string;

  /* ── Option labels for the six stable-token controls ── */
  propertyTypeMultifamily: string;
  propertyTypeRetail: string;
  propertyTypeMixedPortfolio: string;
  propertyTypeAnother: string;
  propertyScopeOne: string;
  propertyScopePortfolio: string;

  situationReplace: string;
  situationMoveAway: string;
  situationRecentlyAcquired: string;
  situationLeaseUp: string;
  situationOperations: string;
  situationExploring: string;
  situationSomethingElse: string;

  involvementPm: string;
  involvementPmHint: string;
  involvementPmAm: string;
  involvementPmAmHint: string;
  involvementNotSure: string;
  involvementNotSureHint: string;

  timingImmediately: string;
  timingWithin30: string;
  timing30to60: string;
  timing60to90: string;
  timingStillExploring: string;

  investorTopicFirstAcquisition: string;
  investorTopicUnderContract: string;
  investorTopicActivelySearching: string;
  investorTopicOwnProperty: string;
  investorTopicSomethingElse: string;
  generalTopicQuestion: string;
  generalTopicVendor: string;
  generalTopicEmployment: string;
  generalTopicPress: string;
  generalTopicSomethingElse: string;

  bookingModePhone: string;
  bookingModeVideo: string;

  /* ── Scale copy, keyed by property-type token ── */
  scaleUnitsLabel: string;
  scaleUnitsPlaceholder: string;
  scaleUnitsHelp: string;
  scaleSqftLabel: string;
  scaleSqftPlaceholder: string;
  scaleSqftHelp: string;
  scaleMixedLabel: string;
  scaleMixedPlaceholder: string;
  scaleMixedHelp: string;
  scaleOtherLabel: string;
  scaleOtherPlaceholder: string;
  scaleOtherHelp: string;
  scaleFallbackLabel: string;
  scaleFallbackPlaceholder: string;
  scaleFallbackHelp: string;

  /* ── Short pathways ── */
  investorKicker: string;
  investorTitle: string;
  investorLead: string;
  investorTopicLabel: string;
  investorNoteLabel: string;
  investorNotePlaceholder: string;
  generalKicker: string;
  generalTitle: string;
  generalLead: string;
  generalTopicLabel: string;
  generalNoteLabel: string;
  generalNotePlaceholder: string;
  organizationLabel: string;
  submitLabel: string;

  /* ── Validation, help, and summary ── */
  nameHelp: string;
  nameError: string;
  emailHelp: string;
  emailError: string;
  topicError: string;
  followUpSameAsPage: string;
  selectOne: string;
  notSpecified: string;

  /* ── Booking ── */
  bookingCandidateNote: string;
  bookingSlotTaken: string;
  bookingFailed: string;
  bookingRefused: string;
  bookingUnavailable: string;
  bookingDurationLabel: string;
  bookingWithLabel: string;

  /* ── Site chrome: navigation, footer, shell, 404 (added in PR 2) ──
   *
   * The four service and firm names are ONE key each, shared by the header and the
   * footer, because both render the same label for the same destination. Two keys with
   * identical values is how the header and footer drift apart in a later translation.
   *
   * The `*Aria` keys are assistive-technology labels. They are copy: a screen-reader user
   * hears them instead of seeing the layout, so leaving them English on a translated page
   * is worse than leaving a visible string English, not better. */
  navPropertyManagement: string;
  navAssetManagement: string;
  navInvestorServices: string;
  navPartners: string;
  navContact: string;
  navCta: string;
  navHomeAria: string;
  navPrimaryAria: string;
  navMenu: string;
  navMenuDialogAria: string;
  navCloseMenu: string;

  skipToContent: string;

  footerPositioning: string;
  footerServices: string;
  footerFirm: string;
  footerLocation: string;
  footerStatewide: string;
  /** Legal copy. See the warning above the English value. */
  footerLegal: string;
  footerCopyright: string;

  notFoundMessage: string;
  notFoundAction: string;

  /**
   * The language selector's own assistive labels.
   *
   * `{language}` is substituted at the call site with the active locale's name. This is the
   * only interpolated string in the catalog, and it is a literal `String.replace` rather than
   * a formatting library: one placeholder does not justify a dependency, and an ICU message
   * syntax nobody else uses would be a second thing translators have to get right.
   */
  languageChooseAria: string;
  languageListAria: string;
}

/**
 * English. The only reviewed, production-enabled catalog.
 *
 * Where each group came from, so a reviewer can check without reading the whole component:
 *   gateway*                          the gateway JSX in `Intake.tsx`
 *   option labels, scale*             the approved model constants they replaced
 *   investor*, general*, submitLabel  the approved `SHORT_PATHS` constant
 *   organizationLabel                 `SHORT_PATHS`, which reads `Company`
 *   name*, email*, topicError         the approved validation constants
 *   booking*                          the approved `BOOKING_COPY` constant
 */
export const EN: Messages = {
  gatewayTitle: 'What would you like to discuss?',
  gatewayLead: 'Choose the path that best matches your situation. You can change it later.',
  gatewayOwnerKicker: 'Most owners start here',
  gatewayOwnerTitle: 'Property Owner',
  gatewayOwnerBody: 'I own or oversee a property and need management.',
  gatewayOwnerAction: 'Start property details',
  gatewayAssetTitle: 'Asset Management',
  gatewayAssetBody:
    'I own property and want help directing strategy, performance, and reporting.',
  gatewayInvestorTitle: 'Investor Services',
  gatewayInvestorBody:
    'I am preparing to acquire commercial real estate and need an operating team.',
  gatewayGeneralTitle: 'General inquiry',
  gatewayGeneralBody: 'Something else. Vendors, press, employment, or a question.',

  propertyTypeMultifamily: 'Multifamily',
  propertyTypeRetail: 'Retail',
  propertyTypeMixedPortfolio: 'Mixed portfolio',
  propertyTypeAnother: 'Another property type',
  propertyScopeOne: 'One property',
  propertyScopePortfolio: 'Portfolio',

  situationReplace: 'Replace current management',
  situationMoveAway: 'Move away from self-management',
  situationRecentlyAcquired: 'Recently acquired or under contract',
  situationLeaseUp: 'Lease-up or turnaround',
  situationOperations: 'Operations or reporting problems',
  situationExploring: 'Exploring management options',
  situationSomethingElse: 'Something else',

  involvementPm: 'Property Management',
  involvementPmHint: 'Run the property day to day.',
  involvementPmAm: 'Property Management + Asset Management',
  involvementPmAmHint: 'Run the property and help direct the investment strategy.',
  involvementNotSure: 'Not Sure',
  involvementNotSureHint: 'Help me determine the appropriate level of involvement.',

  timingImmediately: 'Immediately',
  timingWithin30: 'Within 30 days',
  timing30to60: '30 to 60 days',
  timing60to90: '60 to 90 days',
  timingStillExploring: 'Still exploring',

  investorTopicFirstAcquisition: 'Exploring my first acquisition',
  investorTopicUnderContract: 'Under contract now',
  investorTopicActivelySearching: 'Actively searching',
  investorTopicOwnProperty: 'Own property, need an operating team',
  investorTopicSomethingElse: 'Something else',
  generalTopicQuestion: 'A question about AxisPoint',
  generalTopicVendor: 'Vendor or service provider',
  generalTopicEmployment: 'Employment',
  generalTopicPress: 'Press or media',
  generalTopicSomethingElse: 'Something else',

  bookingModePhone: 'Phone call',
  bookingModeVideo: 'Video meeting',

  scaleUnitsLabel: 'Approximate units',
  scaleUnitsPlaceholder: 'For example 184',
  scaleUnitsHelp:
    'A round number is fine. We are sizing the operating team, not auditing the rent roll.',
  scaleSqftLabel: 'Approximate square footage',
  scaleSqftPlaceholder: 'For example 42,000',
  scaleSqftHelp: 'Gross leasable area is the most useful figure here.',
  scaleMixedLabel: 'Approximate combined scale',
  scaleMixedPlaceholder: 'For example 300 units and 40,000 sq ft',
  scaleMixedHelp: 'Units, square footage, or both. Tell us in whatever terms you track it.',
  scaleOtherLabel: 'Approximate scale',
  scaleOtherPlaceholder: 'Units, square feet, or another measure',
  scaleOtherHelp: 'Describe the size in the terms that make sense for this property type.',
  scaleFallbackLabel: 'Approximate scale',
  scaleFallbackPlaceholder: 'Units or square feet',
  scaleFallbackHelp: 'Choose a property type above and this adapts to the right measure.',

  investorKicker: 'Investor Services',
  investorTitle: 'Tell us where you are in the process.',
  investorLead: 'A short note is enough to start. We will follow up to arrange a conversation.',
  investorTopicLabel: 'Where are you in the process?',
  investorNoteLabel: 'What are you looking at?',
  investorNotePlaceholder: 'Asset type, market, or timeline',
  generalKicker: 'General inquiry',
  generalTitle: 'What can we help with?',
  generalLead: 'Tell us who you are and what you need. We will route it to the right partner.',
  generalTopicLabel: 'What is this about?',
  generalNoteLabel: 'Your message',
  generalNotePlaceholder: 'A few sentences is plenty',
  // The SHORT_PATHS value, NOT the management-proposal field's longer label. A blanket
  // "correct it from the JSX" pass changed this to 'Company or ownership group' and would
  // have silently altered the short pathways' visible copy.
  organizationLabel: 'Company',
  submitLabel: 'Send Inquiry',

  nameHelp: 'As you would like us to address you.',
  nameError: 'Enter the name we should ask for when we call.',
  emailHelp: 'Where we’ll send our reply and any follow-up details.',
  emailError:
    'This address is missing the part after the @ sign. Add the full address, for example name@company.com.',
  topicError: 'Choose the option that best describes your inquiry.',
  followUpSameAsPage: 'Same as this page, English',
  selectOne: 'Select one',
  notSpecified: 'Not specified',

  bookingCandidateNote:
    'Times are shown in Central Time, Houston. Availability is confirmed when you book.',
  bookingSlotTaken: 'That time is no longer available. Please choose another.',
  bookingFailed: 'We could not confirm that time. Nothing was booked. Try again.',
  bookingRefused: 'We could not book that time, and trying again would not help.',
  bookingUnavailable: 'Scheduling is unavailable right now. Nothing was booked.',
  bookingDurationLabel: '30 minutes',
  bookingWithLabel: 'AxisPoint Partners',

  navPropertyManagement: 'Property Management',
  navAssetManagement: 'Asset Management',
  navInvestorServices: 'Investor Services',
  navPartners: 'Partners',
  navContact: 'Contact',
  navCta: 'Request a Management Proposal',
  navHomeAria: 'AxisPoint, home',
  navPrimaryAria: 'Primary',
  navMenu: 'Menu',
  navMenuDialogAria: 'Site menu',
  navCloseMenu: 'Close menu',

  skipToContent: 'Skip to main content',

  footerPositioning:
    'Property management first, with asset management available when the property calls for a strategic layer above it.',
  footerServices: 'Services',
  footerFirm: 'Firm',
  footerLocation: 'Houston, Texas',
  footerStatewide: 'Serving owners statewide across Texas',
  /*
   * LEGAL COPY. Carried forward verbatim from the footer; `STATUS.md` records that a legal
   * review is a prelaunch check and this pass does not perform one.
   *
   * The translated versions of this one string deserve more scepticism than anything else in
   * the catalogs. A mistranslated disclaimer does not read as broken, it reads as a different
   * promise, and "does not constitute an offer to sell securities" is a sentence whose force
   * comes from its exact wording. A native reader is not sufficient here: this needs somebody
   * qualified to say the translated sentence carries the same meaning.
   */
  footerLegal:
    'Brokerage and leasing activities are conducted through our licensed partner. AxisPoint Partners does not provide tax or legal advice. This website is intended for informational purposes only and does not constitute an offer to sell securities.',
  footerCopyright: '© 2026 AxisPoint Partners',

  notFoundMessage: 'Page not found',
  notFoundAction: 'Go Home',

  languageChooseAria: 'Choose language. Current language: {language}.',
  languageListAria: 'Choose language',
};

/** The one interpolation in the catalog. See `languageChooseAria`. */
export function withLanguage(template: string, language: string): string {
  return template.replace('{language}', language);
}

/**
 * THE FALLBACK RULE, now stated per key rather than per catalog.
 *
 * It used to be all-or-nothing: a locale either had a complete `Messages` or it got English
 * wholesale. That worked while English was the only catalog, and it stops working the moment
 * a real translation arrives partially reviewed, because the honest intermediate state is
 * "these forty strings are checked and the rest are not."
 *
 * So a catalog is a `Partial<Messages>` and every key resolves independently: a present,
 * non-empty string wins, and anything else falls back to English. A half-reviewed locale
 * therefore renders reviewed copy where it exists and correct English everywhere else, which
 * is a page a visitor can use. It never renders a blank, and it never renders `undefined`.
 *
 * Empty string is treated as missing on purpose. It is what a spreadsheet export produces for
 * a row a translator skipped, and rendering it would leave a silently blank label.
 */
export function mergeCatalog(partial: Partial<Messages> | null | undefined): Messages {
  if (!partial) return EN;
  const out: Messages = { ...EN };
  (Object.keys(EN) as (keyof Messages)[]).forEach((key) => {
    const value = partial[key];
    if (typeof value === 'string' && value !== '') out[key] = value;
  });
  return out;
}

/**
 * Synthetic catalogs, for tests and the development seam ONLY.
 *
 * They exist so the machinery can be proven with a second language without inventing a
 * translation. A fabricated Spanish page is worse than none: it is a lie told to somebody
 * who cannot read the English it is pretending not to be. `verify:bundle` asserts none of
 * this reaches a production bundle.
 */
const testCatalogs = new Map<LocaleCode, Messages>();

export function registerTestCatalog(code: LocaleCode, messages: Messages): void {
  testCatalogs.set(code, messages);
}

export function clearTestCatalogs(): void {
  testCatalogs.clear();
}

/**
 * Builds a clearly synthetic catalog: every value is its own key, marked and bracketed.
 *
 * Deliberately not plausible text. Anybody seeing `[qa] submitLabel` knows immediately they
 * are looking at the seam and not at content, which is exactly what a fake translation would
 * fail to communicate.
 */
export function syntheticCatalog(mark = 'qa'): Messages {
  const out = {} as Record<keyof Messages, string>;
  (Object.keys(EN) as (keyof Messages)[]).forEach((key) => {
    out[key] = `[${mark}] ${key}`;
  });
  return out as Messages;
}

/**
 * The catalog available WITHOUT waiting for anything. Reviewed content only.
 *
 * English and any promoted locale are statically imported, so this is the answer the first
 * paint uses and there is no loading state for a locale that ships. An audit candidate is not
 * reachable here by construction: it lives behind `resolveCatalog` and a dev-only module.
 */
export function messagesFor(code: LocaleCode): Messages {
  const test = testCatalogs.get(code);
  if (test) return test;
  if (code === DEFAULT_LOCALE) return EN;
  return mergeCatalog(REVIEWED_CATALOGS[code]);
}

/**
 * The full resolution, including audit candidates. Asynchronous because they load on demand.
 *
 * ORDER MATTERS AND IS NOT NEGOTIABLE: a reviewed catalog always beats an audit candidate for
 * the same locale. If a locale has been promoted, the model-generated file is dead weight, and
 * silently preferring it would replace checked copy with unchecked copy.
 *
 * In any build this resolves exactly like `messagesFor`, because `loadAuditCandidate` is the
 * stub that returns null. Only a running dev server can reach the real one.
 */
export async function resolveCatalog(code: LocaleCode): Promise<Messages> {
  const test = testCatalogs.get(code);
  if (test) return test;
  if (code === DEFAULT_LOCALE) return EN;

  const reviewed = REVIEWED_CATALOGS[code];
  if (reviewed) return mergeCatalog(reviewed);

  return mergeCatalog(await loadAuditCandidate(code));
}

/**
 * Locales with REVIEWED content, plus any test catalog. Audit candidates are deliberately
 * excluded: this answers "what could ship", and an unreviewed file is not an answer to that.
 */
export function cataloguedLocales(): LocaleCode[] {
  return [
    ...new Set([DEFAULT_LOCALE, ...Object.keys(REVIEWED_CATALOGS), ...testCatalogs.keys()]),
  ] as LocaleCode[];
}

/** Keys a candidate catalog is missing relative to English. Returned, not thrown. */
export function missingKeys(candidate: Partial<Messages>): (keyof Messages)[] {
  return (Object.keys(EN) as (keyof Messages)[]).filter(
    (key) => typeof candidate[key] !== 'string' || candidate[key] === '',
  );
}

export function assertCatalogComplete(code: LocaleCode, candidate: Partial<Messages>): void {
  const missing = missingKeys(candidate);
  if (missing.length > 0) {
    throw new Error(`catalog for ${code} is missing keys: ${missing.join(', ')}`);
  }
}

export { DEFAULT_LOCALE };
