/**
 * Notification routing for website service inquiries.
 *
 * QR Contacts do not appear here at all any more. They are routed by the daily digest
 * (Digest.js), by acquisition attribution, and they never produce an immediate email.
 *
 * NOTHING IN THIS FILE ASSIGNS OWNERSHIP. `ownerPartner` is unassigned at intake for
 * every record, and routing decides only who is told. Receiving a notification does not
 * make a partner responsible for anything, which is what keeps a later reassignment from
 * fighting an automatic rule that keeps reasserting itself.
 *
 * Routing is a pure decision. It returns partner tokens and a reason; turning tokens into
 * addresses is the adapter's job, because addresses are environment values that never
 * appear in this repository.
 */

var ROUTING_REASONS = {
  WEBSITE_FIRM: 'website_submission_to_firm',
  SPAM_SUSPECTED: 'spam_suspected_firm_review'
};

/**
 * Decides who is notified about a website inquiry.
 *
 * Both branches reach the whole firm; they are kept apart because the REASON differs and
 * the reason is what a partner needs in order to read the message correctly. A flagged
 * submission going to one person's inbox is how a real lead gets quietly dismissed, so a
 * second pair of eyes is deliberate rather than incidental.
 */
function routeNotification(lead, screening) {
  var flagged = !!(screening && screening.spamSuspected);
  return {
    recipients: PARTNERS.slice(),
    reason: flagged ? ROUTING_REASONS.SPAM_SUSPECTED : ROUTING_REASONS.WEBSITE_FIRM,
    useFirmFallback: true
  };
}

/**
 * Turns partner tokens into addresses.
 *
 * The firm-wide list is the floor: if a per-partner address is not configured, the
 * notification still goes out to the firm rather than being dropped. An undeliverable
 * notification is worse than an over-broad one.
 */
function resolveRecipients(decision, config) {
  var map = config.partnerEmailMap || {};
  var addresses = [];

  if (!decision.useFirmFallback) {
    for (var i = 0; i < decision.recipients.length; i++) {
      var addr = map[decision.recipients[i]];
      if (addr) addresses.push(addr);
    }
  }

  if (addresses.length === 0) addresses = (config.partnerNotifyTo || []).slice();

  var seen = {};
  return addresses.filter(function (a) {
    var k = lowerTrim(a);
    if (!k || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}
