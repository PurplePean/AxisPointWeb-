/**
 * Small shared primitives. No Google service is touched here; everything that needs
 * one takes it as an argument, so this file runs unchanged under Node in tests.
 */

/** RFC 4122 v4. Injected randomness keeps id generation deterministic in tests. */
function uuidV4(random) {
  var rnd = random || Math.random;
  var hex = '0123456789abcdef';
  var out = '';
  for (var i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += hex[(Math.floor(rnd() * 16) & 0x3) | 0x8];
    } else {
      out += hex[Math.floor(rnd() * 16) & 0xf];
    }
  }
  return out;
}

/** ISO-8601 with a Z offset. The only timestamp format written to storage. */
function toIso(date) {
  return new Date(date).toISOString();
}

function parseIso(value) {
  if (typeof value !== 'string' || value === '') return null;
  var ms = Date.parse(value);
  return isNaN(ms) ? null : new Date(ms);
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000);
}

function normalizeWhitespace(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
}

function lowerTrim(value) {
  return normalizeWhitespace(value).toLowerCase();
}

/** Digits only. Used for comparison, never as the stored value. */
function digitsOnly(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\D+/g, '');
}

/**
 * North American numbers are compared on their last ten digits so a leading 1, a
 * +1, or punctuation never makes the same phone look like two people.
 */
function phoneKey(value) {
  var d = digitsOnly(value);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

function emailKey(value) {
  return lowerTrim(value);
}

function emailDomain(value) {
  var e = emailKey(value);
  var at = e.lastIndexOf('@');
  return at === -1 ? '' : e.slice(at + 1);
}

/**
 * Accepts a plausible phone number without pretending to be a full validator. Ten
 * to fifteen digits covers North America and international dialing; anything outside
 * that is a typo or a bot, and both are better rejected at the boundary.
 */
function validatePhone(value, field) {
  var d = digitsOnly(value);
  if (d.length < 10 || d.length > 15) return { ok: false, code: 'INVALID_PHONE', field: field || null };
  return { ok: true, value: value };
}

/** Redaction for anything that reaches a log. Personal data never lands in the log. */
function redactEmail(value) {
  var e = emailKey(value);
  var at = e.indexOf('@');
  if (at <= 0) return e === '' ? '' : '***';
  return e[0] + '***@' + e.slice(at + 1);
}

function redactPhone(value) {
  var d = digitsOnly(value);
  if (d.length < 4) return d === '' ? '' : '***';
  return '***' + d.slice(-4);
}

function redactName(value) {
  var n = normalizeWhitespace(value);
  if (n === '') return '';
  return n.split(' ').map(function (part, i) {
    return i === 0 ? part : (part[0] || '') + '.';
  }).join(' ');
}

/** Stable non-cryptographic digest, used for dedupe keys and nothing security-bearing. */
function stableHash(value) {
  var s = String(value === undefined || value === null ? '' : value);
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
