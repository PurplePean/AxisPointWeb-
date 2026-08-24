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

  /* ══ Marketing pages (PR 3) ══════════════════════════════════════════════
   *
   * Page metadata lives beside its page's copy, because a title and a description are
   * that page's copy: they are the first thing a reader sees in a result list, and
   * separating them from the words they summarise is how the two drift apart.
   *
   * Strings identical to an existing `nav*` key REUSE that key rather than restating it.
   * "Property Management", "Asset Management", "Investor Services", "Partners", and
   * "Request a Management Proposal" all appear on these pages exactly as they appear in
   * the chrome. Two keys holding the same English is how they stop matching once one is
   * translated.
   *
   * Proper nouns are NOT catalogued: partner names, "AxisPoint", "Houston", and the email
   * address stay in the component. A name is not copy, and exposing one to translation
   * invites a well-meaning reviewer to transliterate a person. */

  /* ── Shared across pages ── */
  /** Appears verbatim on the home page and Property Management. */
  partnersSignature: string;
  /** The same sentence heads the home page's strategic section and Asset Management. */
  pmRunsAmDirectsTitle: string;

  /* ── Home ── */
  homeMetaTitle: string;
  homeMetaDescription: string;
  homeHeroAlt: string;
  homeHeroTitle: string;
  homeHeroLead: string;
  homeHeroQuietLink: string;
  homeHeroSignature: string;
  homeStripEyebrow: string;
  homeStripBody: string;
  homeWhyTitle: string;
  homeWhyLead: string;
  homeWhySituationManager: string;
  homeWhySituationSelf: string;
  homeWhySituationAcquired: string;
  /** The connective between the third and fourth bolded clause. Its own key because the
   *  clauses are separate `<strong>` elements and a language may not place it first. */
  homeWhyOr: string;
  homeWhySituationReports: string;
  homeWhyBody: string;
  homeWhyLink: string;
  homeStrategicEyebrow: string;
  homeStrategicBody: string;
  homeInvestorEyebrow: string;
  homeInvestorBody: string;
  homeClosingTitle: string;
  homeClosingBody: string;

  /* ── Property Management ── */
  pmMetaTitle: string;
  pmMetaDescription: string;
  pmHeroTitle: string;
  pmHeroLead: string;
  pmSeeFunctions: string;
  pmPhotoAlt: string;
  pmResponsibilityTitle: string;
  pmResponsibilityBody: string;
  pmFunctionsTitle: string;
  pmFnOnsiteTitle: string;
  pmFnOnsiteLede: string;
  pmFnOnsiteItem1: string;
  pmFnOnsiteItem2: string;
  pmFnOnsiteItem3: string;
  pmFnOnsiteItem4: string;
  pmFnOnsiteItem5: string;
  pmFnFinancialTitle: string;
  pmFnFinancialLede: string;
  pmFnFinancialItem1: string;
  pmFnFinancialItem2: string;
  pmFnFinancialItem3: string;
  pmFnFinancialItem4: string;
  pmFnFinancialItem5: string;
  pmFnVendorTitle: string;
  pmFnVendorLede: string;
  pmFnVendorItem1: string;
  pmFnVendorItem2: string;
  pmFnVendorItem3: string;
  pmFnVendorItem4: string;
  pmFnReportingTitle: string;
  pmFnReportingLede: string;
  pmFnReportingItem1: string;
  pmFnReportingItem2: string;
  pmFnReportingItem3: string;
  pmFnReportingItem4: string;
  pmStrengthsTitle: string;
  pmStrengthsBody: string;
  pmStrengthTypesTitle: string;
  pmStrengthTypesItem1: string;
  pmStrengthTypesItem2: string;
  pmStrengthTypesItem3: string;
  pmStrengthTypesItem4: string;
  pmStrengthTypesItem5: string;
  pmStrengthGeographyTitle: string;
  pmStrengthGeographyItem1: string;
  pmStrengthGeographyItem2: string;
  pmStrengthGeographyItem3: string;
  pmStrengthGeographyItem4: string;
  pmStrengthGeographyItem5: string;
  pmStrengthAssignmentsTitle: string;
  pmStrengthAssignmentsItem1: string;
  pmStrengthAssignmentsItem2: string;
  pmStrengthAssignmentsItem3: string;
  pmStrengthAssignmentsItem4: string;
  pmStrengthAssignmentsItem5: string;
  pmQuestionsTitle: string;
  pmQ1: string;
  pmA1: string;
  pmQ2: string;
  pmA2: string;
  pmQ3: string;
  pmA3: string;
  pmQ4: string;
  pmA4: string;
  pmRelatedEyebrow: string;
  pmRelatedAsset: string;
  pmRelatedInvestor: string;
  pmClosingTitle: string;
  pmClosingBody: string;

  /* ── Asset Management ── */
  amMetaTitle: string;
  amMetaDescription: string;
  amHeroTitle: string;
  amHeroAnswer: string;
  amPhotoAlt: string;
  amRelationshipEyebrow: string;
  amRelationshipBody: string;
  amLayersTitle: string;
  amDecidesEyebrow: string;
  amDecidesItem1: string;
  amDecidesItem2: string;
  amDecidesItem3: string;
  amDecidesItem4: string;
  amExecutesEyebrow: string;
  amExecutesItem1: string;
  amExecutesItem2: string;
  amExecutesItem3: string;
  amExecutesItem4: string;
  amClosingTitle: string;
  amClosingBody: string;

  /* ── Investor Services ── */
  isMetaTitle: string;
  isMetaDescription: string;
  isHeroTitle: string;
  isHeroAnswer: string;
  isPhotoAlt: string;
  isWhoEyebrow: string;
  isWhoLead: string;
  isWhoBody: string;
  isTimelineBeforeLabel: string;
  isTimelineBeforeBody: string;
  isTimelineClosingLabel: string;
  isTimelineClosingBody: string;
  isTimelineAfterLabel: string;
  isTimelineAfterBody: string;
  isClosingTitle: string;
  isClosingBody: string;
  isClosingCta: string;

  /* ── Partners ── */
  partnersMetaTitle: string;
  partnersMetaDescription: string;
  partnersHeroTitle: string;
  partnersHeroAnswer: string;
  partnersRoleLabel: string;
  partnerRussellBody: string;
  partnerVuBody: string;
  partnersHowEyebrow: string;
  partnersHowBody: string;
  partnersClosingTitle: string;
  partnersClosingBody: string;

  /* ══ Contact page and intake (PR 4) ═════════════════════════════════════
   *
   * THE RULE THAT MATTERS MOST HERE: everything below is DISPLAY TEXT. Not one of these
   * values is ever stored, sent, or used as a lookup key. Stable snake_case tokens carry
   * the meaning to the wire, exactly as they have since the Localization Readiness pass,
   * and the token tests prove a translated label cannot change a payload.
   *
   * Interpolated values use `interpolate` with the placeholders listed in `PLACEHOLDERS`. */

  /* ── Contact page ── */
  contactEyebrow: string;
  contactHeroTitle: string;
  contactHeroLead: string;
  contactMetaTitle: string;
  contactMetaDescription: string;
  contactPathwayPmAm: string;
  contactPmMetaTitle: string;
  contactPmMetaDescription: string;
  contactAmMetaTitle: string;
  contactAmMetaDescription: string;
  contactIsMetaTitle: string;
  contactIsMetaDescription: string;
  contactGeneralMetaTitle: string;
  contactGeneralMetaDescription: string;

  /* ── Field primitives ── */
  fieldOptional: string;

  /* ── Gateway ── */
  gatewayEmailPrefix: string;

  /* ── Progress ledger and summary labels ── */
  ledgerChangePath: string;
  labelProperty: string;
  labelPropertyEmpty: string;
  labelSituation: string;
  labelSituationEmpty: string;
  labelContact: string;
  labelContactEmpty: string;
  labelInvolvement: string;
  labelPathway: string;
  labelTopic: string;
  labelFollowUpLanguage: string;

  /* ── Confirmation ── */
  confirmKickerProperty: string;
  confirmKickerInquiry: string;
  /** `{name}` */
  confirmTitleProperty: string;
  /** `{name}` */
  confirmTitleInquiry: string;
  confirmBodyProperty: string;
  /** `{email}` */
  confirmBodyInquiry: string;
  confirmWhatYouSent: string;
  confirmScheduleCta: string;
  confirmWait: string;
  backToAxisPoint: string;

  /* ── Booking picker ── */
  scheduleKicker: string;
  scheduleTitle: string;
  scheduleLead: string;
  scheduleSelectDate: string;
  scheduleSelectTime: string;
  scheduleChooseDateFirst: string;
  scheduleHowMeet: string;
  scheduleSelectedLabel: string;
  /** `{day}` `{time}` `{mode}` */
  scheduleSelectedSummary: string;
  scheduleSelectedEmpty: string;
  scheduleConfirm: string;
  scheduleBooking: string;

  /* ── Booking confirmed ── */
  scheduledKicker: string;
  scheduledTitle: string;
  labelWhen: string;
  labelFormat: string;
  labelLength: string;
  labelWith: string;
  /** `{day}` `{time}` */
  scheduledWhenValue: string;
  /** `{email}` */
  scheduledInviteNote: string;
  scheduledDevNote: string;

  /* ── Booking skipped ── */
  skippedTitle: string;
  /** `{email}` */
  skippedBody: string;

  /* ── Validation and submission alerts ── */
  errorSummaryOne: string;
  errorSummaryTwo: string;
  /** `{count}` */
  errorSummaryMany: string;
  errorSummaryFixInquiry: string;
  errorSummaryFixProperty: string;
  failedTitleInquiry: string;
  failedTitleProperty: string;
  failedBody: string;
  tryAgain: string;
  unavailableTitle: string;
  unavailableBody: string;
  blockedBody: string;
  emailAxisPoint: string;

  /* ── Contact fields ── */
  fieldFullName: string;
  fieldEmail: string;
  fieldPhone: string;
  fieldPhonePlaceholder: string;
  fieldPhoneHelp: string;
  fieldCompanyOwnership: string;
  fieldLanguageFollowUp: string;
  /** `{language}` */
  followUpHelpChosen: string;
  followUpHelpDefault: string;
  sending: string;
  noDocuments: string;

  /* ── Management proposal, step 1 ── */
  step1Title: string;
  step1Lead: string;
  step1SubTitle: string;
  legendPropertyType: string;
  legendPropertyScope: string;
  fieldLocation: string;
  fieldLocationPlaceholder: string;
  fieldLocationHelp: string;
  fieldPropertyCount: string;
  fieldPropertyCountPlaceholder: string;
  notSure: string;
  continueLabel: string;
  step1Footer: string;

  /* ── Step 2 ── */
  step2Title: string;
  legendCurrentSituation: string;
  legendInvolvement: string;
  fieldTiming: string;
  fieldTimingPlaceholder: string;
  fieldUnderstand: string;
  fieldUnderstandPlaceholder: string;
  backLabel: string;

  /* ── Step 3 ── */
  step3Title: string;
  privacyNote: string;
  sendPropertyDetails: string;
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

  /* ══ Marketing pages (PR 3) ══
   * Every value below is transcribed from the JSX that rendered it, not rewritten. JSX
   * collapses whitespace, so multi-line source text becomes single-spaced here. The
   * committed baseline is what proves the transcription was exact. */

  partnersSignature: 'Zachary Russell and Ethaniel Vu, Partners.',
  pmRunsAmDirectsTitle:
    'Property management runs the property. Asset management directs the investment.',

  /* ── Home ── */
  homeMetaTitle: 'AxisPoint Partners | Commercial Property Management in Texas',
  homeMetaDescription:
    'AxisPoint manages multifamily and retail properties for owners across Texas, from onsite operations and financial controls to vendor performance and owner reporting.',
  homeHeroAlt: 'Lawn and building elevation of a multifamily community at sunset',
  homeHeroTitle: 'One team accountable for how your property runs.',
  homeHeroLead:
    'AxisPoint manages multifamily and retail properties for owners across Texas, from onsite operations and financial controls to vendor performance and the reporting ownership reads.',
  homeHeroQuietLink: 'See what we take responsibility for',
  homeHeroSignature: 'Partner-led from Houston by Zachary Russell and Ethaniel Vu.',
  homeStripEyebrow: 'Property management first',
  homeStripBody:
    'Primary focus: multifamily and retail properties across Texas. Headquartered in Houston.',
  homeWhyTitle: 'Why owners call AxisPoint',
  homeWhyLead: 'Usually one of four situations.',
  // The four bolded situations. Rendered as separate <strong> elements, so separate keys.
  homeWhySituationManager: 'The current manager has lost ownership’s confidence.',
  homeWhySituationSelf: 'Self-management has become a second job.',
  homeWhySituationAcquired:
    'A newly acquired property needs an operating team before the first month closes.',
  homeWhyOr: 'Or',
  homeWhySituationReports: 'the reports arrive on time and still do not explain the property.',
  homeWhyBody:
    'The question underneath all four is the same: who is answering for the property today. AxisPoint answers it with one accountable team and two partners close enough to the work to know the property by name.',
  homeWhyLink: 'What AxisPoint takes responsibility for',
  homeStrategicEyebrow: 'Strategic layer',
  homeStrategicBody:
    'For owners who want an ownership-level view above the operating work, AxisPoint connects what the property is doing to budgets, capital priorities, and hold decisions. Engaged when the property calls for it, not sold as a default.',
  homeInvestorEyebrow: 'A separate path',
  homeInvestorBody:
    'Entering commercial real estate without an operating team behind you? Investor Services is the way in.',
  homeClosingTitle: 'Tell us what the property needs next.',
  homeClosingBody:
    'Send the property, the current management situation, and the change you are considering. A partner reads it and responds.',

  /* ── Property Management ── */
  pmMetaTitle: 'Property Management in Houston and Across Texas | AxisPoint Partners',
  pmMetaDescription:
    'AxisPoint takes operating responsibility for multifamily and retail properties in Texas: onsite operations, financial controls, vendor performance, and owner reporting.',
  pmHeroTitle: 'Commercial property management in Houston and across Texas',
  pmHeroLead:
    'AxisPoint takes operating responsibility for multifamily and retail properties: the onsite team, the money, the vendors, and the reporting ownership uses to make decisions.',
  pmSeeFunctions: 'See the four operating functions',
  pmPhotoAlt: 'Aerial view of a Texas multifamily community and adjacent retail center',
  pmResponsibilityTitle: 'What AxisPoint takes responsibility for',
  pmResponsibilityBody:
    'Everything that determines how the property runs day to day, and one owner-facing record of it. When something goes wrong at the property, ownership does not have to find out who to call.',
  pmFunctionsTitle: 'Four operating functions, one accountable team',
  pmFnOnsiteTitle: 'Onsite operations',
  pmFnOnsiteLede:
    'The people at the property and the routines they hold to. Staffing decisions, leasing oversight, response standards, and turn schedules that keep the property on plan week to week.',
  pmFnOnsiteItem1: 'Onsite staffing and supervision',
  pmFnOnsiteItem2: 'Leasing oversight',
  pmFnOnsiteItem3: 'Resident and tenant response',
  pmFnOnsiteItem4: 'Turns and make-ready',
  pmFnOnsiteItem5: 'Preventive maintenance',
  pmFnFinancialTitle: 'Financial controls',
  pmFnFinancialLede:
    'Budgets built with ownership, approval thresholds agreed in advance, and a monthly close where any number can be traced back to the decision behind it.',
  pmFnFinancialItem1: 'Annual and reforecast budgets',
  pmFnFinancialItem2: 'Approval thresholds',
  pmFnFinancialItem3: 'Collections and delinquency',
  pmFnFinancialItem4: 'Payables and month-end close',
  pmFnFinancialItem5: 'Variance explanation',
  pmFnVendorTitle: 'Vendor performance',
  pmFnVendorLede:
    'Scoped work, real bid discipline, and follow-through measured on the quality of the result rather than the closing of a ticket.',
  pmFnVendorItem1: 'Scope and bid process',
  pmFnVendorItem2: 'Contract and insurance compliance',
  pmFnVendorItem3: 'Quality verification',
  pmFnVendorItem4: 'Capital project coordination',
  pmFnReportingTitle: 'Owner reporting and communication',
  pmFnReportingLede:
    'One record of what happened at the property, what it cost, and what comes next, plus a partner who answers between reporting periods.',
  pmFnReportingItem1: 'Monthly reporting package',
  pmFnReportingItem2: 'Operating narrative',
  pmFnReportingItem3: 'Capital and project tracking',
  pmFnReportingItem4: 'Direct partner access',
  pmStrengthsTitle: 'Where AxisPoint is strongest',
  pmStrengthsBody:
    'These are the situations the team is built around. They are areas of strength rather than requirements, and a property outside them is still worth a conversation.',
  pmStrengthTypesTitle: 'Property types',
  pmStrengthTypesItem1: 'Multifamily as a primary focus',
  pmStrengthTypesItem2: 'Retail as a primary focus',
  pmStrengthTypesItem3: 'Properties that can support onsite staff',
  pmStrengthTypesItem4: 'Coordinated portfolios under one owner',
  pmStrengthTypesItem5: 'Scattered-site portfolios run as one program',
  pmStrengthGeographyTitle: 'Geography',
  pmStrengthGeographyItem1: 'Houston and the surrounding MSA',
  pmStrengthGeographyItem2: 'Dallas and Fort Worth',
  pmStrengthGeographyItem3: 'San Antonio',
  pmStrengthGeographyItem4: 'Austin',
  pmStrengthGeographyItem5: 'Owners statewide across Texas',
  pmStrengthAssignmentsTitle: 'Assignments',
  pmStrengthAssignmentsItem1: 'Management transitions',
  pmStrengthAssignmentsItem2: 'Lease-ups',
  pmStrengthAssignmentsItem3: 'Heavy capital programs',
  pmStrengthAssignmentsItem4: 'Deferred operational problems',
  pmStrengthAssignmentsItem5: 'Turnaround assignments',
  pmQuestionsTitle: 'Questions owners ask before they switch',
  pmQ1: 'How long does a management transition take?',
  pmA1: 'It depends on the property and the outgoing manager, but the plan is written before the start date: staffing, systems, banking, vendor records, and resident or tenant communication each have an owner and a date.',
  pmQ2: 'Who will actually be answering for my property?',
  pmA2: 'A partner. Zachary Russell and Ethaniel Vu stay close enough to the work to know the property by name, and ownership is not routed through an account layer to reach them.',
  pmQ3: 'What does reporting look like month to month?',
  pmA3: 'A consistent package on a consistent schedule, with a written narrative that explains the variances rather than leaving ownership to interpret the numbers alone.',
  pmQ4: 'Can you take on a property with deferred problems?',
  pmA4: 'Yes. Deferred maintenance, unresolved capital work, and staffing gaps are common reasons owners call. The proposal states what gets addressed first and in what order.',
  pmRelatedEyebrow: 'Related',
  pmRelatedAsset:
    'Asset Management sits above the operating work, for owners who want the investment view',
  pmRelatedInvestor:
    'Investor Services is the entry path for capital-ready clients without an operating team',
  pmClosingTitle: 'Send us the property and the situation.',
  pmClosingBody:
    'A management proposal covers staffing, the reporting package, the transition plan, and who at AxisPoint answers for the property.',

  /* ── Asset Management ── */
  amMetaTitle: 'Asset Management for Texas Property Owners | AxisPoint Partners',
  amMetaDescription:
    'An ownership-level view above the operating work: capital priorities, budget direction, and hold decisions, informed by the team already running the property.',
  amHeroTitle: 'Asset management for Texas property owners',
  amHeroAnswer:
    'An ownership-level view above the operating work: capital priorities, budget direction, and hold decisions, informed by a team that is already running the property.',
  amPhotoAlt: 'Downtown Houston tower and elevated walkway seen from street level',
  amRelationshipEyebrow: 'The relationship',
  amRelationshipBody:
    'Asset management is a layer above the operating work, not a replacement for it. It connects what the property is doing week to week with budgets, capital priorities, and the hold-or-sell conversation. Owners engage it when the property calls for it.',
  amLayersTitle: 'Two layers, stated plainly',
  amDecidesEyebrow: 'Asset management decides',
  amDecidesItem1: 'Capital priorities and sequencing',
  amDecidesItem2: 'Budget direction and reforecast posture',
  amDecidesItem3: 'Hold, refinance, and disposition questions',
  amDecidesItem4: 'Performance review against ownership intent',
  amExecutesEyebrow: 'Property management executes',
  amExecutesItem1: 'Onsite operations and staffing',
  amExecutesItem2: 'Financial controls and monthly close',
  amExecutesItem3: 'Vendor scope and performance',
  amExecutesItem4: 'Owner reporting and communication',
  amClosingTitle: 'Start with the property, add the layer above it.',
  amClosingBody:
    'Most owners begin with property management. Asset management is added when the investment questions need the same team answering them.',

  /* ── Investor Services ── */
  isMetaTitle: 'Investor Services for Texas Commercial Real Estate | AxisPoint Partners',
  isMetaDescription:
    'For capital-ready clients acquiring multifamily or retail in Texas who want the operating side accounted for before the purchase, not after it.',
  isHeroTitle: 'A way into Texas commercial real estate with an operating team behind you',
  isHeroAnswer:
    'For capital-ready clients acquiring multifamily or retail in Texas who want the operating side accounted for before the purchase, not after it.',
  isPhotoAlt: 'Aerial view of a highway interchange in Houston',
  isWhoEyebrow: 'Who this is for',
  isWhoLead: 'Capital-ready clients who need an operating team before they can act.',
  isWhoBody:
    'Investor Services is the smaller of the three paths and stays that way on purpose. It exists for owners entering commercial real estate, or entering Texas, who want the operating side handled from the first property rather than assembled after closing.',
  isTimelineBeforeLabel: 'Before the purchase',
  isTimelineBeforeBody:
    'An operating read on what the property will take to run, so the assumptions behind the offer are the ones a manager would use.',
  isTimelineClosingLabel: 'At closing',
  isTimelineClosingBody:
    'A management team in place on day one, with staffing, systems, and vendor relationships ready rather than pending.',
  isTimelineAfterLabel: 'After the first property',
  isTimelineAfterBody:
    'The relationship moves into Property Management, with Asset Management added if the ownership view calls for it.',
  isClosingTitle: 'Tell us what you are looking to acquire.',
  isClosingBody:
    'Send the property type, the market, and the timeline. A partner responds with an operating read and what management would look like.',
  isClosingCta: 'Discuss an acquisition',

  /* ── Partners ── */
  partnersMetaTitle: 'Partners | AxisPoint Partners',
  partnersMetaDescription:
    'AxisPoint is partner-led from Houston. Zachary Russell and Ethaniel Vu stay on the properties they take on, so ownership talks to the people making the decisions.',
  partnersHeroTitle: 'Two partners, directly accountable for the work',
  partnersHeroAnswer:
    'AxisPoint is partner-led from Houston. The people who take the assignment are the people who stay on it.',
  partnersRoleLabel: 'Partner',
  partnerRussellBody:
    'Works directly on operating performance: staffing decisions, transitions, capital programs, and the properties in the portfolio that need attention this month.',
  partnerVuBody:
    'Works directly on financial controls and the owner-facing record: budgets, approval discipline, monthly close, and the reporting ownership uses to make decisions.',
  partnersHowEyebrow: 'How we work',
  partnersHowBody:
    'Both partners stay on the properties they take on. Ownership talks to the people making the decisions, not to a layer arranged in front of them.',
  partnersClosingTitle: 'Talk to a partner about your property.',
  partnersClosingBody:
    'Send the property and the situation. The partner who reads it is the one who would answer for it.',

  /* ══ Contact page and intake (PR 4) ══
   * Transcribed from the 20-state rendered baseline in `tests/baseline-intake/`, not from
   * the JSX and not from memory. That baseline is what proves the transcription exact. */

  contactEyebrow: 'Contact',
  contactHeroTitle: 'Contact AxisPoint',
  contactHeroLead:
    'Partner-led from Houston, serving owners across Texas. Tell us what you need and a partner reads it.',
  contactMetaTitle: 'Contact AxisPoint | AxisPoint Partners',
  contactMetaDescription:
    'Reach AxisPoint directly from Houston, Texas, serving owners statewide. Choose the path that matches your situation, or write to info@axispoint.llc.',
  contactPathwayPmAm: 'Property Management and Asset Management',
  contactPmMetaTitle: 'Request a Management Proposal | AxisPoint Partners',
  contactPmMetaDescription:
    'Send the property, the current management situation, and the change you are considering. A partner reads it and responds.',
  contactAmMetaTitle: 'Request a Management Proposal with Asset Management | AxisPoint Partners',
  contactAmMetaDescription:
    'Start the management proposal with asset management interest identified, so the operating work and the investment view are handled by the same team.',
  contactIsMetaTitle: 'Investor Services Inquiry | AxisPoint Partners',
  contactIsMetaDescription:
    'Tell us where you are in the process. A partner responds with an operating read and what management would look like.',
  /* Deliberately its OWN key even though its value equals `contactMetaTitle` today. The
   * generic contact page and the general-inquiry pathway are different pages that happen to
   * share a title; merging them would mean retitling one silently retitles the other. */
  contactGeneralMetaTitle: 'Contact AxisPoint | AxisPoint Partners',
  contactGeneralMetaDescription:
    'Tell us who you are and what you need. We will route it to the right partner.',

  fieldOptional: 'Optional',

  gatewayEmailPrefix: 'Prefer email? Write to',

  ledgerChangePath: 'Change path',
  labelProperty: 'Property',
  labelPropertyEmpty: 'Type, location, and scale',
  labelSituation: 'Situation',
  labelSituationEmpty: 'What needs to change',
  labelContact: 'Contact',
  labelContactEmpty: 'How we follow up',
  labelInvolvement: 'Involvement',
  labelPathway: 'Pathway',
  labelTopic: 'Topic',
  labelFollowUpLanguage: 'Follow-up language',

  confirmKickerProperty: 'Property details sent',
  confirmKickerInquiry: 'Inquiry sent',
  confirmTitleProperty: 'Thank you, {name}. We have your property details.',
  confirmTitleInquiry: 'Thank you, {name}. Your inquiry is with us.',
  confirmBodyProperty:
    'Zachary or Ethaniel will review the information and follow up directly.',
  confirmBodyInquiry:
    'Zachary or Ethaniel will review it and follow up directly at {email}.',
  confirmWhatYouSent: 'What you sent',
  confirmScheduleCta: 'Schedule a 30-Minute Call',
  confirmWait: 'I’ll Wait for Follow-Up',
  backToAxisPoint: 'Back to AxisPoint',

  scheduleKicker: 'Optional next step',
  scheduleTitle: 'Schedule a 30-minute call',
  scheduleLead:
    'Your property details are already sent. Pick a time only if it is useful to you.',
  scheduleSelectDate: 'Select a date',
  scheduleSelectTime: 'Select a time',
  scheduleChooseDateFirst: 'Choose a date to see times.',
  scheduleHowMeet: 'How should we meet?',
  scheduleSelectedLabel: 'Selected',
  scheduleSelectedSummary: '{day} at {time}, {mode}',
  scheduleSelectedEmpty: 'Pick a date, a time, and how to meet',
  scheduleConfirm: 'Confirm this time',
  scheduleBooking: 'Booking',

  scheduledKicker: 'Call confirmed',
  scheduledTitle: 'You are on the calendar.',
  labelWhen: 'When',
  labelFormat: 'Format',
  labelLength: 'Length',
  labelWith: 'With',
  /* "Central" is the firm's zone abbreviation and stays put: the INSTANT is computed in
   * America/Chicago regardless of the reader's language, so naming another zone here would
   * be a different meeting. */
  scheduledWhenValue: '{day}, {time} Central',
  scheduledInviteNote:
    'A confirmation email is on its way to {email}, with a calendar file attached. Reply to it if you need to move the time.',
  scheduledDevNote:
    'Development preview. The booking command ran against the simulator, so no calendar event was created and no invitation was sent.',

  skippedTitle: 'No call scheduled. Nothing more is needed from you.',
  skippedBody:
    'Your property details are with Zachary and Ethaniel, and they will reach you at {email}. You can still pick a time if it becomes useful.',

  errorSummaryOne: 'One field needs attention.',
  errorSummaryTwo: 'Two fields need attention.',
  errorSummaryMany: '{count} fields need attention.',
  errorSummaryFixInquiry: 'Correct the fields marked below, then send the inquiry again.',
  errorSummaryFixProperty:
    'Add your full name and an email address we can reply to, then send the property details again.',
  failedTitleInquiry: 'We couldn’t send your inquiry.',
  failedTitleProperty: 'We couldn’t send your property details.',
  failedBody: 'Your answers are still here. Try again or contact AxisPoint directly.',
  tryAgain: 'Try again',
  unavailableTitle: 'Sending is unavailable right now.',
  unavailableBody:
    'Nothing was sent. Your answers are still here, and you can reach AxisPoint directly in the meantime.',
  blockedBody:
    'Nothing was sent, and trying again would not help. Your answers are still here. Please contact AxisPoint directly.',
  emailAxisPoint: 'Email AxisPoint',

  fieldFullName: 'Full name',
  fieldEmail: 'Email',
  fieldPhone: 'Phone',
  /* A format example, not a real number. It stays in the Houston area-code shape because a
   * placeholder's job is to show the expected form. */
  fieldPhonePlaceholder: '(713) 000 0000',
  fieldPhoneHelp: 'Add a number if you prefer a direct call.',
  fieldCompanyOwnership: 'Company or ownership group',
  fieldLanguageFollowUp: 'Language for follow-up',
  followUpHelpChosen:
    'We will reply in {language} where a partner is available, and in English otherwise.',
  followUpHelpDefault: 'Leave this alone and we reply in the language of this page.',
  sending: 'Sending',
  noDocuments: 'No documents needed at this stage.',

  step1Title: 'Tell us about your property.',
  step1Lead:
    'A few details will help us understand what you own, what needs to change, and whether AxisPoint is the right operating partner.',
  step1SubTitle: 'What are we discussing?',
  legendPropertyType: 'Property type',
  legendPropertyScope: 'Property scope',
  fieldLocation: 'Where is the property located?',
  fieldLocationPlaceholder: 'City or market',
  fieldLocationHelp: 'City or market is enough for now. No street address needed.',
  fieldPropertyCount: 'Number of properties',
  fieldPropertyCountPlaceholder: 'For example 6',
  notSure: 'Not sure',
  continueLabel: 'Continue',
  step1Footer: 'Step 1 of 3. About 60 to 90 seconds in total.',

  step2Title: 'What needs to change?',
  legendCurrentSituation: 'Current situation',
  legendInvolvement: 'Where would you like AxisPoint involved?',
  fieldTiming: 'Timing',
  fieldTimingPlaceholder: 'Select a timeframe',
  fieldUnderstand: 'What should we understand before speaking?',
  fieldUnderstandPlaceholder:
    'Anything about the property, the current manager, or the timeline',
  backLabel: 'Back',

  step3Title: 'How should we follow up?',
  privacyNote:
    'AxisPoint will use this information to review your inquiry and follow up with you directly.',
  sendPropertyDetails: 'Send Property Details',
};

/**
 * Placeholder substitution for the catalog's interpolated strings.
 *
 * Deliberately a literal `{name}` replace rather than a formatting library or ICU syntax.
 * The requirement is substitution of already-formatted values, not pluralisation or
 * gender selection, and an unfamiliar message syntax is one more thing a translator can
 * get wrong. Where English needs a plural distinction the catalog carries two keys
 * instead, which a translator can see and adapt.
 *
 * UNKNOWN PLACEHOLDERS ARE LEFT ALONE ON PURPOSE. If a translation invents `{naam}`, this
 * does not silently blank it: the literal survives to the screen, the browser review's
 * unresolved-placeholder check sees it, and a test fails. Silently dropping it would hide
 * the defect.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

/** The language selector's one placeholder. See `languageChooseAria`. */
export function withLanguage(template: string, language: string): string {
  return interpolate(template, { language });
}

/** Every placeholder token the catalog is allowed to contain. Asserted by the test suite. */
export const PLACEHOLDERS = ['{language}', '{name}', '{email}', '{count}', '{day}', '{time}', '{mode}'] as const;

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
