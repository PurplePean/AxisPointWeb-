/**
 * Identity matching.
 *
 * EXACT EVIDENCE ONLY. An exact normalized email, or an exact normalized full phone
 * digit string. Nothing else.
 *
 * Pass 8 also produced "probable" and "weak" suggestions from name, name plus company,
 * and shared email domain. Those are removed. They were noise that trained a reader to
 * dismiss the callout: two people can share a name, a company employs many people, and
 * a shared domain is not evidence of anything. A suggestion a partner learns to ignore
 * is worse than no suggestion, because the exact-match case it was hiding is the one
 * that actually needed attention.
 *
 * This SUGGESTS, it never merges. An automatic merge of two records that turn out to be
 * different people is unrecoverable through normal use: the losing record's history is
 * gone and nobody knows it existed.
 */

var MATCH_CONFIDENCE = { EXACT: 'exact' };

var MATCH_REASONS = {
  EMAIL: 'email_exact',
  PHONE: 'phone_exact'
};

var MAX_SUGGESTIONS = 5;

/**
 * `candidates` are existing contact records: { contactId, email, phone }. Comparison is
 * on normalized keys, so formatting differences never split one person into two, and
 * an empty key never matches an empty stored value.
 */
function findPossibleMatches(incoming, candidates) {
  var inEmail = emailKey(incoming.email);
  var inPhone = phoneKey(incoming.phone);

  var results = [];

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var reasons = [];

    if (inEmail && emailKey(c.email) === inEmail) reasons.push(MATCH_REASONS.EMAIL);
    if (inPhone && phoneKey(c.phone) === inPhone) reasons.push(MATCH_REASONS.PHONE);

    if (reasons.length > 0) {
      results.push({
        contactId: c.contactId,
        confidence: MATCH_CONFIDENCE.EXACT,
        reason: reasons.join(',')
      });
    }
  }

  results.sort(function (a, b) {
    return String(a.contactId) < String(b.contactId) ? -1 : 1;
  });

  return results.slice(0, MAX_SUGGESTIONS);
}

/**
 * Compact, human-readable form for the `possibleMatches` cell. Every entry is exact, so
 * the confidence word is constant and the reason carries the information.
 */
function formatPossibleMatches(matches) {
  return matches.map(function (m) {
    return m.contactId + ':' + m.confidence + ':' + m.reason;
  }).join(' | ');
}

/**
 * The sentence a digest prints inside a record.
 *
 * It names the evidence and states plainly that nothing was merged, because a partner
 * seeing a duplicate needs to know the system did not quietly pick one.
 */
function matchNoteFor(matches) {
  if (!matches || matches.length === 0) return '';
  var reasons = matches.map(function (m) { return m.reason; }).join(',');
  var byEmail = reasons.indexOf(MATCH_REASONS.EMAIL) !== -1;
  var byPhone = reasons.indexOf(MATCH_REASONS.PHONE) !== -1;

  var evidence;
  if (byEmail && byPhone) evidence = 'shares this email address and this phone number';
  else if (byEmail) evidence = 'shares this email address';
  else evidence = 'shares this phone number';

  return 'An existing contact ' + evidence + '. Nothing was merged, changed, or overwritten.';
}
