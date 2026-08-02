/**
 * Stable wire tokens for schemaVersion 1.
 *
 * These are the ONLY values the backend stores. Approved display text lives in the
 * frontend and is mapped to these tokens there, so a copy edit or a translation can
 * never change a stored backend value.
 *
 * The backend rejects display strings supplied as wire values. That is deliberate: if
 * "Multifamily" were silently accepted, the display layer would become the contract.
 *
 * Source of truth: Code Pass 7 final correction.
 */

var SCHEMA_VERSION = 1;

var SUBMISSION_KINDS = ['service_inquiry', 'contact_exchange', 'booking_request'];

var PATHWAYS = ['management_proposal', 'investor_services', 'general_inquiry'];

var SERVICE_SCOPES = ['pm', 'pm_plus_am', 'undecided'];

var INTENT_TOKENS = ['property_management', 'asset_management', 'investor_services', 'general'];

var PROPERTY_TYPES = ['multifamily', 'retail', 'mixed_portfolio', 'another_property_type'];

var PROPERTY_SCOPES = ['one_property', 'portfolio'];

var SITUATIONS = [
  'replace_current_management',
  'move_away_from_self_management',
  'recently_acquired_or_under_contract',
  'lease_up_or_turnaround',
  'operations_or_reporting_problems',
  'exploring_management_options',
  'something_else'
];

var INVOLVEMENTS = [
  'property_management',
  'property_management_plus_asset_management',
  'not_sure'
];

var TIMINGS = ['immediately', 'within_30_days', 'days_30_to_60', 'days_60_to_90', 'still_exploring'];

var TOPICS_INVESTOR = [
  'exploring_first_acquisition',
  'under_contract_now',
  'actively_searching',
  'own_property_need_operating_team',
  'something_else'
];

var TOPICS_GENERAL = [
  'question_about_axispoint',
  'vendor_or_service_provider',
  'employment',
  'press_or_media',
  'something_else'
];

var BOOKING_MODES = ['phone_call', 'video_meeting'];

/** Approved on the Contact Exchange board. Already snake_case; used verbatim. */
var CONTACT_CATEGORIES = [
  'property_owner_operator',
  'broker_real_estate_advisor',
  'investor_capital_partner',
  'lender_financial_professional',
  'property_management_operations',
  'service_provider_vendor',
  'other'
];

/** BCP-47 identifiers, not project enums. Kept exact. */
var LOCALES = ['en', 'es', 'zh-Hans', 'zh-Hant', 'vi', 'hi', 'ur', 'gu', 'pa'];

/**
 * Locales outbound correspondence may actually be written in.
 *
 * All nine are ACCEPTED as a stated preference, because knowing someone wants to be
 * answered in Punjabi is useful even before anything is translated. Only these may be
 * used to send. The frontend registry is the same shape and currently agrees: English
 * alone is enabled and translation-reviewed.
 */
var LAUNCH_READY_LOCALES = ['en'];

var SOURCE_CATEGORIES = ['website', 'qr'];

/** The only slugs that may resolve to a partner. Anything else is the firm fallback. */
var PARTNER_SLUGS = ['zachary-russell', 'ethaniel-vu'];

var PARTNERS = ['zachary_russell', 'ethaniel_vu'];

var SLUG_TO_PARTNER = {
  'zachary-russell': 'zachary_russell',
  'ethaniel-vu': 'ethaniel_vu'
};

/**
 * Approved display strings, listed ONLY so the backend can recognise and reject them
 * with a specific error. Never used as stored values, never mapped to a token here.
 * The display-to-wire map belongs to the frontend connection pass.
 */
var REJECTED_DISPLAY_STRINGS = [
  'Multifamily', 'Retail', 'Mixed portfolio', 'Another property type',
  'One property', 'Portfolio',
  'Replace current management', 'Move away from self-management',
  'Recently acquired or under contract', 'Lease-up or turnaround',
  'Operations or reporting problems', 'Exploring management options', 'Something else',
  'Property Management', 'Property Management + Asset Management', 'Not Sure',
  'Immediately', 'Within 30 days', '30 to 60 days', '60 to 90 days', 'Still exploring',
  'Exploring my first acquisition', 'Under contract now', 'Actively searching',
  'Own property, need an operating team',
  'A question about AxisPoint', 'Vendor or service provider', 'Employment', 'Press or media',
  'Phone call', 'Video meeting'
];

/**
 * Management Proposal consistency. serviceScope and situation.involvement describe the
 * same decision, so a mismatch is rejected rather than resolved by guessing which
 * field wins.
 */
var SCOPE_TO_INVOLVEMENT = {
  pm: 'property_management',
  pm_plus_am: 'property_management_plus_asset_management',
  undecided: 'not_sure'
};

function isKnownToken(list, value) {
  return typeof value === 'string' && list.indexOf(value) !== -1;
}

function isRejectedDisplayString(value) {
  return typeof value === 'string' && REJECTED_DISPLAY_STRINGS.indexOf(value) !== -1;
}
