/**
 * Identity matching.
 *
 * This SUGGESTS, it never merges. Automatic merging of two records that turn out to
 * be different people is unrecoverable through normal use: the losing record's
 * history is gone and nobody knows it existed. Suggestion costs one glance; a wrong
 * merge costs a relationship.
 *
 * So the output is an ordered list of candidate ids with a confidence and a reason,
 * written to `possibleMatches` for a human to act on.
 */

var MATCH_CONFIDENCE = { STRONG: 'strong', PROBABLE: 'probable', WEAK: 'weak' };

/** Free-mail domains carry no organizational signal and must never drive a match. */
var GENERIC_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com',
  'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'mac.com', 'proton.me', 'protonmail.com', 'gmx.com', 'zoho.com'
];

var MAX_SUGGESTIONS = 5;

/**
 * `candidates` are existing contact records: { contactId, email, phone, fullName,
 * company }. Comparison is on normalized keys so formatting differences never split
 * one person into two.
 */
function findPossibleMatches(incoming, candidates) {
  var inEmail = emailKey(incoming.email);
  var inPhone = phoneKey(incoming.phone);
  var inName = lowerTrim(incoming.fullName);
  var inCompany = lowerTrim(incoming.company);
  var inDomain = emailDomain(incoming.email);
  var domainIsGeneric = inDomain === '' || GENERIC_EMAIL_DOMAINS.indexOf(inDomain) !== -1;

  var results = [];

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var cEmail = emailKey(c.email);
    var cPhone = phoneKey(c.phone);
    var cName = lowerTrim(c.fullName);
    var cCompany = lowerTrim(c.company);

    var reasons = [];
    var confidence = null;

    if (inEmail && cEmail && inEmail === cEmail) {
      reasons.push('email_exact');
      confidence = MATCH_CONFIDENCE.STRONG;
    } else if (inPhone && cPhone && inPhone === cPhone) {
      reasons.push('phone_exact');
      confidence = MATCH_CONFIDENCE.STRONG;
    } else if (inName && cName && inName === cName && inCompany && cCompany && inCompany === cCompany) {
      reasons.push('name_and_company');
      confidence = MATCH_CONFIDENCE.PROBABLE;
    } else if (inName && cName && inName === cName && !domainIsGeneric && emailDomain(c.email) === inDomain) {
      // Same name at the same company domain. A shared free-mail domain is not a
      // signal, which is why generic domains are excluded before this ever runs.
      reasons.push('name_and_email_domain');
      confidence = MATCH_CONFIDENCE.PROBABLE;
    } else if (inName && cName && inName === cName) {
      reasons.push('name_only');
      confidence = MATCH_CONFIDENCE.WEAK;
    }

    if (confidence) {
      results.push({
        contactId: c.contactId,
        confidence: confidence,
        reason: reasons.join(','),
        rank: confidenceRank(confidence)
      });
    }
  }

  results.sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return String(a.contactId) < String(b.contactId) ? -1 : 1;
  });

  return results.slice(0, MAX_SUGGESTIONS);
}

function confidenceRank(confidence) {
  if (confidence === MATCH_CONFIDENCE.STRONG) return 0;
  if (confidence === MATCH_CONFIDENCE.PROBABLE) return 1;
  return 2;
}

/** Compact, human-readable form for the `possibleMatches` cell. */
function formatPossibleMatches(matches) {
  return matches.map(function (m) {
    return m.contactId + ':' + m.confidence + ':' + m.reason;
  }).join(' | ');
}
