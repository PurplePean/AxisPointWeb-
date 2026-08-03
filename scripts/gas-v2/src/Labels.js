/**
 * Wire value to human label.
 *
 * NO EMAIL EVER PRINTS A WIRE TOKEN. `property_owner_operator` is a storage value; a
 * partner reading a digest at 8am reads "Property Owner or Operator". The approved
 * communications board states this as a rule with its own table, and it is enforced
 * here rather than by remembering to format at each call site.
 *
 * `labelFor` never returns an empty string for a known field. An unknown token falls
 * back to a readable de-slugged form instead of a blank cell, because a blank cell in
 * an email reads as missing data rather than as an unrecognised value.
 */

var CONTACT_CATEGORY_LABELS = {
  property_owner_operator: 'Property Owner or Operator',
  broker_real_estate_advisor: 'Broker or Real Estate Advisor',
  investor_capital_partner: 'Investor or Capital Partner',
  lender_financial_professional: 'Lender or Financial Professional',
  property_management_operations: 'Property Management or Operations',
  service_provider_vendor: 'Service Provider or Vendor',
  other: 'Other'
};

/**
 * Acquisition labels. `firm` and `unknown` read as full phrases rather than as status
 * words, so no row in a digest looks like an error state.
 */
var ACQUISITION_SOURCE_LABELS = {
  zachary_russell: 'Zachary Russell',
  ethaniel_vu: 'Ethaniel Vu',
  firm: 'AxisPoint Partners',
  unknown: 'Unknown'
};

var PARTNER_LABELS = {
  zachary_russell: 'Zachary Russell',
  ethaniel_vu: 'Ethaniel Vu'
};

var PATHWAY_LABELS = {
  management_proposal: 'Management Proposal',
  investor_services: 'Investor Services',
  general_inquiry: 'General Inquiry'
};

var SERVICE_SCOPE_LABELS = {
  pm: 'Property Management',
  pm_plus_am: 'Property Management and Asset Management',
  undecided: 'Not decided'
};

var PROPERTY_TYPE_LABELS = {
  multifamily: 'Multifamily',
  retail: 'Retail',
  mixed_portfolio: 'Mixed portfolio',
  another_property_type: 'Another property type'
};

var PROPERTY_SCOPE_LABELS = {
  one_property: 'One property',
  portfolio: 'Portfolio'
};

var SITUATION_LABELS = {
  replace_current_management: 'Replacing current management',
  move_away_from_self_management: 'Moving away from self-management',
  recently_acquired_or_under_contract: 'Recently acquired or under contract',
  lease_up_or_turnaround: 'Lease-up or turnaround',
  operations_or_reporting_problems: 'Operations or reporting problems',
  exploring_management_options: 'Exploring management options',
  something_else: 'Something else'
};

var INVOLVEMENT_LABELS = {
  property_management: 'Property Management',
  property_management_plus_asset_management: 'Property Management and Asset Management',
  not_sure: 'Not sure'
};

var TIMING_LABELS = {
  immediately: 'Immediately',
  within_30_days: 'Within 30 days',
  days_30_to_60: '30 to 60 days',
  days_60_to_90: '60 to 90 days',
  still_exploring: 'Still exploring'
};

var TOPIC_LABELS = {
  exploring_first_acquisition: 'Exploring a first acquisition',
  under_contract_now: 'Under contract now',
  actively_searching: 'Actively searching',
  own_property_need_operating_team: 'Owns property, needs an operating team',
  question_about_axispoint: 'A question about AxisPoint',
  vendor_or_service_provider: 'Vendor or service provider',
  employment: 'Employment',
  press_or_media: 'Press or media',
  something_else: 'Something else'
};

var BOOKING_MODE_LABELS = {
  phone_call: 'Phone call',
  video_meeting: 'Video meeting'
};

var INTENT_LABELS = {
  property_management: 'Property Management',
  asset_management: 'Asset Management',
  investor_services: 'Investor Services',
  general: 'General'
};

/** English names, used only on internal mail so a reply goes out in the right language. */
var LOCALE_LABELS = {
  en: 'English',
  es: 'Spanish',
  'zh-Hans': 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese',
  vi: 'Vietnamese',
  hi: 'Hindi',
  ur: 'Urdu',
  gu: 'Gujarati',
  pa: 'Punjabi'
};

var FOLLOW_UP_LABELS = {
  not_contacted: 'Not contacted',
  contacted: 'Contacted'
};

/** The one string that stands in for an absent optional value, everywhere. */
var NOT_PROVIDED_LABEL = 'Not provided';

/** An unassigned owner reads as a word, never as a blank cell. */
var UNASSIGNED_LABEL = 'Unassigned';

/**
 * De-slugs an unrecognised token: `some_new_value` becomes `Some new value`. This is a
 * fallback, not a formatting strategy. Every token that reaches a real email should be
 * in a map above; this only guarantees that adding a token before adding its label
 * degrades to something readable rather than to a blank.
 */
function humanizeToken(value) {
  var s = String(value === undefined || value === null ? '' : value).trim();
  if (s === '') return '';
  s = s.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function labelFor(map, value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback === undefined ? NOT_PROVIDED_LABEL : fallback;
  }
  if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
  return humanizeToken(value);
}

function categoryLabel(value) { return labelFor(CONTACT_CATEGORY_LABELS, value); }
function acquisitionLabel(value) { return labelFor(ACQUISITION_SOURCE_LABELS, value, 'Unknown'); }
function ownerLabel(value) { return labelFor(PARTNER_LABELS, value, UNASSIGNED_LABEL); }
function followUpLabel(value) { return labelFor(FOLLOW_UP_LABELS, value || 'not_contacted'); }
function localeLabel(value) { return labelFor(LOCALE_LABELS, value, 'English'); }
