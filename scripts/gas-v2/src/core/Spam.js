/**
 * Spam screening.
 *
 * Screening FLAGS. It never discards. Every submission is stored and every genuine
 * one is answerable, because the cost of silently dropping one real owner inquiry is
 * far higher than the cost of a partner glancing at a flagged row.
 *
 * The output is a boolean plus the reasons, so a partner can see why something was
 * flagged and disagree with it.
 */

var SPAM_LINK_LIMIT = 3;
var SPAM_MIN_FILL_SECONDS = 3;
var SPAM_DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'trashmail.com',
  'yopmail.com', 'sharklasers.com', 'temp-mail.org', 'throwawaymail.com'
];

var URL_RE = /https?:\/\/|www\./gi;

/**
 * `clientSignals` is advisory only. A bot controls what it sends, so a missing or
 * dishonest signal must never be able to make something look clean; it can only add
 * evidence, never remove it.
 */
function screenSubmission(envelope) {
  var reasons = [];
  var payload = envelope.payload || {};
  var signals = envelope.clientSignals || {};

  var freeText = collectFreeText(envelope);
  var name = envelope.submissionKind === 'contact_exchange'
    ? payload.fullName
    : (payload.contact && payload.contact.fullName);
  var email = envelope.submissionKind === 'contact_exchange'
    ? payload.email
    : (payload.contact && payload.contact.email);

  if (signals.honeypot !== undefined && signals.honeypot !== null && String(signals.honeypot) !== '') {
    reasons.push('honeypot_filled');
  }

  if (typeof signals.fillSeconds === 'number' && signals.fillSeconds >= 0 &&
      signals.fillSeconds < SPAM_MIN_FILL_SECONDS) {
    reasons.push('submitted_too_fast');
  }

  var links = (freeText.match(URL_RE) || []).length;
  if (links >= SPAM_LINK_LIMIT) reasons.push('excessive_links');

  if (email && SPAM_DISPOSABLE_DOMAINS.indexOf(emailDomain(email)) !== -1) {
    reasons.push('disposable_email_domain');
  }

  if (name && looksLikeUrl(name)) reasons.push('url_in_name');

  if (freeText && hasLongRunOfRepeats(freeText)) reasons.push('repeated_character_run');

  // Free text with no spaces at all, past a real sentence's length, is machine output.
  if (freeText.length > 120 && freeText.indexOf(' ') === -1) reasons.push('unbroken_text_block');

  return {
    spamSuspected: reasons.length > 0,
    spamReason: reasons.join(','),
    reasons: reasons
  };
}

function collectFreeText(envelope) {
  var payload = envelope.payload || {};
  var parts = [];
  if (payload.situation && payload.situation.notes) parts.push(payload.situation.notes);
  if (payload.property && payload.property.location) parts.push(payload.property.location);
  if (payload.contact && payload.contact.organization) parts.push(payload.contact.organization);
  if (payload.company) parts.push(payload.company);
  if (payload.roleOrTitle) parts.push(payload.roleOrTitle);
  return parts.join(' ');
}

function looksLikeUrl(value) {
  return /https?:\/\/|www\.|\.[a-z]{2,}\//i.test(String(value));
}

function hasLongRunOfRepeats(value) {
  return /(.)\1{9,}/.test(String(value));
}
