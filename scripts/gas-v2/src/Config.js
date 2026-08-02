/**
 * Runtime configuration.
 *
 * Every environment-specific value is read from Script Properties by NAME at call
 * time. No Sheet id, calendar id, deployment id, endpoint, or address appears in this
 * repository, and none is defaulted here. A missing property is a configuration
 * error that fails closed with a stable code, never a silent fallback to some other
 * environment's resource.
 *
 * This file names properties. It does not create them. Provisioning is a separate,
 * deliberate operation performed against a real Apps Script project.
 */

var PROP_KEYS = {
  /** Spreadsheet holding the Leads, Contacts, Log, and Work tabs. */
  SHEET_ID: 'AXP_SHEET_ID',
  /** Calendar used for availability reads and booking event creation. */
  CALENDAR_ID: 'AXP_CALENDAR_ID',
  /** Where partner notifications are delivered. Comma-separated. */
  PARTNER_NOTIFY_TO: 'AXP_PARTNER_NOTIFY_TO',
  /** JSON object keyed by partner token, mapping to that partner's address. */
  PARTNER_EMAIL_MAP: 'AXP_PARTNER_EMAIL_MAP',
  /** Reply-to on visitor acknowledgements. */
  REPLY_TO: 'AXP_REPLY_TO',
  /** From-name on outbound mail. */
  FROM_NAME: 'AXP_FROM_NAME',
  /* There is deliberately NO allowed-origins property. An Apps Script web app cannot
   * read the request's Origin header, so any such setting would be applied to a value
   * the client itself supplies. Shipping it would create the appearance of an access
   * control that does not exist, which is worse than having none. */

  /** 'live' or 'dry_run'. Anything else is treated as dry_run. */
  RUN_MODE: 'AXP_RUN_MODE'
};

var RUN_MODE_LIVE = 'live';
var RUN_MODE_DRY_RUN = 'dry_run';

/* Worker and delivery bounds. Approved values: a 5 minute cycle, at most 20 work
 * items per cycle, at most 4 attempts per item. These are policy, not environment,
 * so they live in code where a review can see them change. */
var WORKER_INTERVAL_MINUTES = 5;
var WORKER_MAX_ITEMS_PER_RUN = 20;
var WORKER_MAX_ATTEMPTS = 4;

/** Backoff between attempts, in minutes, indexed by attempt number already made. */
var WORKER_BACKOFF_MINUTES = [0, 5, 15, 60];

/** Business hours used by SLA arithmetic. Local to the project time zone. */
var BUSINESS_TIMEZONE = 'America/Chicago';
var BUSINESS_START_HOUR = 9;
var BUSINESS_END_HOUR = 17;
var BUSINESS_DAYS = [1, 2, 3, 4, 5];

/** Response target in business hours, by pathway. */
var SLA_BUSINESS_HOURS = {
  management_proposal: 4,
  investor_services: 8,
  general_inquiry: 24
};

/** Contact Exchange has no response commitment; it is a record, not a request. */
var SLA_CONTACT_EXCHANGE_HOURS = null;

/**
 * Reads configuration through an injected property reader so the whole config layer
 * is testable without Apps Script. `reader` is any object with get(name).
 */
function readConfig(reader) {
  function get(key) {
    var v = reader.get(key);
    return typeof v === 'string' ? v.trim() : '';
  }

  var runMode = get(PROP_KEYS.RUN_MODE);

  return {
    sheetId: get(PROP_KEYS.SHEET_ID),
    calendarId: get(PROP_KEYS.CALENDAR_ID),
    partnerNotifyTo: splitList(get(PROP_KEYS.PARTNER_NOTIFY_TO)),
    partnerEmailMap: parsePartnerEmailMap(get(PROP_KEYS.PARTNER_EMAIL_MAP)),
    replyTo: get(PROP_KEYS.REPLY_TO),
    fromName: get(PROP_KEYS.FROM_NAME),
    runMode: runMode === RUN_MODE_LIVE ? RUN_MODE_LIVE : RUN_MODE_DRY_RUN
  };
}

/**
 * Per-partner addresses, supplied as JSON. Malformed JSON yields an empty map rather
 * than throwing: routing then falls back to the firm-wide list, which is the correct
 * degradation. Losing a notification because one property was mistyped is not.
 */
function parsePartnerEmailMap(value) {
  if (!value) return {};
  var parsed;
  try {
    parsed = JSON.parse(value);
  } catch (e) {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  var out = {};
  Object.keys(parsed).forEach(function (k) {
    if (PARTNERS.indexOf(k) !== -1 && typeof parsed[k] === 'string' && parsed[k].trim() !== '') {
      out[k] = parsed[k].trim();
    }
  });
  return out;
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ''; });
}

/**
 * Names every property required for a given capability. Returned as a list of
 * missing keys so a caller can report all of them at once instead of one per run.
 */
function missingConfigFor(config, capability) {
  var missing = [];
  function need(value, key) {
    if (!value || (Array.isArray(value) && value.length === 0)) missing.push(key);
  }

  if (capability === 'intake') {
    need(config.sheetId, PROP_KEYS.SHEET_ID);
  } else if (capability === 'notify') {
    need(config.partnerNotifyTo, PROP_KEYS.PARTNER_NOTIFY_TO);
    need(config.fromName, PROP_KEYS.FROM_NAME);
  } else if (capability === 'acknowledge') {
    need(config.replyTo, PROP_KEYS.REPLY_TO);
    need(config.fromName, PROP_KEYS.FROM_NAME);
  } else if (capability === 'booking') {
    need(config.calendarId, PROP_KEYS.CALENDAR_ID);
  }
  return missing;
}

function isConfigured(config, capability) {
  return missingConfigFor(config, capability).length === 0;
}
