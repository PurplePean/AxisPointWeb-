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

  /*
   * There are deliberately NO reply-monitored or removal-procedure flags here. Two
   * properties used to gate a QR acknowledgement block promising that a reply would
   * correct or remove somebody's record. AxisPoint does not offer that, so the copy was
   * deleted and the gates with it. A flag is the wrong answer to a promise nobody
   * intends to keep; not making the promise is.
   */

  /** JSON keyed by partner token: the direct address printed in a QR acknowledgement. */
  PARTNER_DIRECT_EMAIL_MAP: 'AXP_PARTNER_DIRECT_EMAIL_MAP',
  /** JSON keyed by partner token: the direct phone. Row omitted when absent. */
  PARTNER_DIRECT_PHONE_MAP: 'AXP_PARTNER_DIRECT_PHONE_MAP',
  /** The one verified firm address printed on the firm-fallback acknowledgement. */
  FIRM_EMAIL: 'AXP_FIRM_EMAIL',
  /** Firm phone. The row is omitted entirely rather than shown empty when absent. */
  FIRM_PHONE: 'AXP_FIRM_PHONE',
  /** Public website, printed as a word rather than a bare URL. */
  WEBSITE_URL: 'AXP_WEBSITE_URL',
  /** Absolute URL of the logo PNG. Both emails are complete without it. */
  LOGO_URL: 'AXP_LOGO_URL',
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

/** Business hours used by SLA and booking arithmetic. Local to the project time zone. */
var BUSINESS_TIMEZONE = 'America/Chicago';
var BUSINESS_START_HOUR = 9;
var BUSINESS_END_HOUR = 17;
var BUSINESS_DAYS = [1, 2, 3, 4, 5];

/**
 * ONE SLA. Every website service inquiry is due at 5:00 PM local on the next business
 * day, regardless of pathway. See Sla.js for why a single number beats three.
 *
 * Contact Exchange has no SLA at all, so there is no constant for it: an absent
 * commitment is expressed by the absence of a due time, not by a sentinel value that
 * some later reader treats as a number.
 */
var SLA_DUE_HOUR = 17;

/** The daily QR digest's intended local send hour. No trigger is installed here. */
var DIGEST_HOUR_LOCAL = 8;

/**
 * Working ceiling for one digest HTML part.
 *
 * Gmail clips a message body above roughly 102 KB and shows "View entire message"; the
 * clipped part is the part nobody reads, so a digest that clips has failed. 90 KB is
 * the approved ceiling, leaving headroom for long organization names and multibyte
 * characters. Above it the digest SPLITS at record boundaries. It never truncates.
 */
var DIGEST_MAX_HTML_BYTES = 90 * 1024;

/**
 * Retention.
 *
 * Business records never expire automatically, so there is deliberately no constant for
 * them: a number here would eventually be wired to something. Operational records are
 * diagnostics and delivery bookkeeping, and 90 days is long enough to investigate an
 * incident and short enough that the Sheet stays workable.
 */
var OPERATIONAL_RETENTION_DAYS = 90;

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

    partnerDirectEmail: parsePartnerEmailMap(get(PROP_KEYS.PARTNER_DIRECT_EMAIL_MAP)),
    partnerDirectPhone: parsePartnerEmailMap(get(PROP_KEYS.PARTNER_DIRECT_PHONE_MAP)),
    firmEmail: get(PROP_KEYS.FIRM_EMAIL),
    firmPhone: get(PROP_KEYS.FIRM_PHONE),
    websiteUrl: get(PROP_KEYS.WEBSITE_URL),
    logoUrl: get(PROP_KEYS.LOGO_URL),

    runMode: runMode === RUN_MODE_LIVE ? RUN_MODE_LIVE : RUN_MODE_DRY_RUN
  };
}

/**
 * Per-partner values, supplied as JSON keyed by partner token. Malformed JSON yields an
 * empty map rather than throwing: the caller then omits the row or falls back to the
 * firm-wide list, which is the correct degradation. Losing a notification because one
 * property was mistyped is not.
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
  } else if (capability === 'qr_acknowledge') {
    need(config.replyTo, PROP_KEYS.REPLY_TO);
    need(config.fromName, PROP_KEYS.FROM_NAME);
    need(config.firmEmail, PROP_KEYS.FIRM_EMAIL);
    need(config.websiteUrl, PROP_KEYS.WEBSITE_URL);
  } else if (capability === 'digest') {
    // Per-partner addresses, not the firm-wide list: a digest is routed by acquisition
    // attribution, so sending Zachary's contacts to a shared inbox is not the same
    // message and is not an acceptable fallback.
    need(Object.keys(config.partnerEmailMap || {}).length > 0 ? 'set' : '', PROP_KEYS.PARTNER_EMAIL_MAP);
    need(config.fromName, PROP_KEYS.FROM_NAME);
  }
  return missing;
}

function isConfigured(config, capability) {
  return missingConfigFor(config, capability).length === 0;
}

/**
 * Configuration health, reported rather than assumed.
 *
 * `ready` says whether the capability can run at all. `promises` is the separate and
 * more important question: whether the copy this system is about to send is currently
 * TRUE. Two blockers used to live here, gating a QR acknowledgement block that promised
 * a reply would correct or remove a record; that copy was deleted, so nothing outbound
 * makes a promise that configuration has to make true and the list is empty. It is kept
 * as a list, and reported, because the next piece of copy that promises something needs
 * somewhere honest to say so.
 */
function configHealth(config) {
  var blockers = [];

  var warnings = [];
  if (!config.logoUrl) {
    warnings.push({ key: PROP_KEYS.LOGO_URL, issue: 'logo_absent', effect: 'Emails render the wordmark as text. Nothing is lost.' });
  }
  if (!config.firmPhone) {
    warnings.push({ key: PROP_KEYS.FIRM_PHONE, issue: 'firm_phone_absent', effect: 'The firm phone row is omitted rather than shown empty.' });
  }
  PARTNERS.forEach(function (p) {
    if (!(config.partnerDirectEmail || {})[p]) {
      warnings.push({ key: PROP_KEYS.PARTNER_DIRECT_EMAIL_MAP, issue: 'partner_direct_email_absent:' + p, effect: 'That partner acknowledgement falls back to the firm address.' });
    }
    if (!(config.partnerDirectPhone || {})[p]) {
      warnings.push({ key: PROP_KEYS.PARTNER_DIRECT_PHONE_MAP, issue: 'partner_direct_phone_absent:' + p, effect: 'The phone row is omitted.' });
    }
  });

  return {
    capabilities: {
      intake: isConfigured(config, 'intake'),
      acknowledge: isConfigured(config, 'acknowledge'),
      qrAcknowledge: isConfigured(config, 'qr_acknowledge'),
      notify: isConfigured(config, 'notify'),
      digest: isConfigured(config, 'digest'),
      booking: isConfigured(config, 'booking')
    },
    /** True only when every promise the approved copy makes is currently keepable. */
    promisesKeepable: blockers.length === 0,
    blockers: blockers,
    warnings: warnings
  };
}
