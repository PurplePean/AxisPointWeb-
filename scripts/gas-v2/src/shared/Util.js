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
 * The COMPLETE normalized digit string. Punctuation and spacing are removed; nothing
 * else is.
 *
 * Comparing only the last ten digits was a North American assumption, and it is wrong
 * in the direction that matters: +44 20 7946 0958 and +1 202 794 60958 would collide
 * on their tails and merge two unrelated people. Two numbers are the same number only
 * when every digit matches, which also means +1 713 555 0198 and 713 555 0198 are
 * correctly treated as different strings and left as two records for a human to judge,
 * rather than merged on a guess about which country the caller is in.
 */
function phoneKey(value) {
  return digitsOnly(value);
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
 * The punctuation a person may legitimately type around a phone number, per the
 * approved Contact Exchange design. Anything else is a paste accident or an injection
 * attempt, and both are better refused at the boundary than stored.
 */
var PHONE_ALLOWED_PUNCTUATION = ' ()-.+/xX,#';

/**
 * Accepts a plausible phone number WITHOUT assuming a country.
 *
 * Seven digits is the shortest real subscriber number; twenty covers the longest
 * international number plus an extension. The old 10-to-15 floor silently rejected
 * valid short-form and extension-bearing numbers, and its ceiling assumed E.164.
 *
 * The value is never rewritten. Digits are DERIVED for validation and comparison; what
 * the person typed is what gets stored, because a number reformatted into a shape they
 * did not write is a number they cannot recognise as theirs.
 */
function validatePhone(value, field) {
  var raw = String(value === undefined || value === null ? '' : value);

  for (var i = 0; i < raw.length; i++) {
    var ch = raw.charAt(i);
    if (ch >= '0' && ch <= '9') continue;
    if (PHONE_ALLOWED_PUNCTUATION.indexOf(ch) !== -1) continue;
    return { ok: false, code: 'INVALID_PHONE', field: field || null };
  }

  var d = digitsOnly(raw);
  if (d.length < 7 || d.length > 20) return { ok: false, code: 'INVALID_PHONE', field: field || null };
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
