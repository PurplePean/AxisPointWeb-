/**
 * Notification routing.
 *
 * The governing rule from the contract: a QR scan identifies WHICH CARD was scanned.
 * It does not assign ownership. So `scannedPartner` is an input to routing, not the
 * answer, and the two are stored separately.
 *
 * Routing is a pure decision. It returns partner tokens and a reason; turning tokens
 * into addresses is the adapter's job, because addresses are environment values that
 * never appear in this repository.
 */

var ROUTING_REASONS = {
  SCANNED_PARTNER: 'scanned_partner_card',
  UNRESOLVED_SLUG: 'unresolved_partner_slug',
  WEBSITE_FIRM: 'website_submission_to_firm',
  SPAM_SUSPECTED: 'spam_suspected_firm_review'
};

/**
 * Decides who is notified and who provisionally owns the lead.
 *
 * Ownership on a QR scan is provisional, not final: whoever handed over the card is
 * the obvious first responder, but a partner can reassign, and reassignment must not
 * be fighting an automatic rule that keeps reasserting itself.
 */
function routeNotification(lead, screening) {
  // Flagged submissions go to the whole firm rather than to one person's inbox. A
  // single partner quietly deciding a flagged lead was junk is how a real one gets
  // lost; a second pair of eyes costs nothing.
  if (screening && screening.spamSuspected) {
    return {
      recipients: PARTNERS.slice(),
      ownerPartner: '',
      reason: ROUTING_REASONS.SPAM_SUSPECTED,
      useFirmFallback: true
    };
  }

  if (lead.sourceCategory === 'qr' && lead.scannedPartner) {
    return {
      recipients: [lead.scannedPartner],
      ownerPartner: lead.scannedPartner,
      reason: ROUTING_REASONS.SCANNED_PARTNER,
      useFirmFallback: false
    };
  }

  if (lead.sourceCategory === 'qr' && lead.scannedSlugUnresolved) {
    // A retired or mistyped card must reach a human, and it must be visible that the
    // card did not resolve. Guessing an owner here would attribute someone else's
    // handshake to the wrong partner.
    return {
      recipients: PARTNERS.slice(),
      ownerPartner: '',
      reason: ROUTING_REASONS.UNRESOLVED_SLUG,
      useFirmFallback: true
    };
  }

  return {
    recipients: PARTNERS.slice(),
    ownerPartner: '',
    reason: ROUTING_REASONS.WEBSITE_FIRM,
    useFirmFallback: true
  };
}

/**
 * Turns partner tokens into addresses.
 *
 * The firm-wide list is the floor: if a per-partner address is not configured, the
 * notification still goes out to the firm rather than being dropped. An
 * undeliverable notification is worse than an over-broad one.
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
