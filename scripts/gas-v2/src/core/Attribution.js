/**
 * Attribution and locale resolution.
 *
 * THE GOVERNING DISTINCTION: acquisition attribution is immutable, ownership is current
 * state. `acquisitionSource` records which card produced this record and never changes
 * again. `ownerPartner` records who is responsible right now and starts unassigned for
 * every record, including one gathered through a partner's own card.
 *
 * A scan gave a partner a name, not a claim. Automatically assigning ownership from a
 * scan would mean a reassignment is permanently fighting a rule that keeps reasserting
 * itself, and it would let a printed card decide who is accountable for a relationship.
 *
 * Locale keeps two separate facts: page locale is where the visitor was, preferred
 * follow-up is how they want to be answered. Someone can read the English page and ask
 * to be called back in Spanish, and both halves matter operationally.
 */

/**
 * Resolves a QR source detail to an acquisition source.
 *
 * Four outcomes, three of them distinct facts worth keeping apart:
 *   - a partner slug resolves to that partner
 *   - the firm card's own slug resolves to `firm`: a real, intentional scan
 *   - anything else resolves to `unknown`: a card that did not resolve, which is
 *     evidence that a printed card is wrong and must not be hidden inside `firm`
 *   - a website submission has no acquisition source at all
 */
function resolveAcquisitionSource(attribution) {
  if (!attribution || attribution.sourceCategory !== 'qr') {
    return { acquisitionSource: '', scannedPartner: '', resolved: false };
  }

  var slug = lowerTrim(attribution.sourceDetail);

  if (Object.prototype.hasOwnProperty.call(SLUG_TO_PARTNER, slug)) {
    var partner = SLUG_TO_PARTNER[slug];
    return { acquisitionSource: partner, scannedPartner: partner, resolved: true };
  }

  if (slug === FIRM_SLUG) {
    // The firm card is not a partner. `scannedPartner` stays empty precisely so no
    // downstream code can treat "the firm" as an assignable person.
    return { acquisitionSource: 'firm', scannedPartner: '', resolved: true };
  }

  return { acquisitionSource: 'unknown', scannedPartner: '', resolved: false };
}

/**
 * Flattens attribution into the fields storage keeps.
 *
 * `refToken` is carried through verbatim and inert. It is never resolved to a person,
 * never used to build a referral chain, never triggers a notification, and never feeds
 * reporting. It exists so that if referral tracking is built later the raw signal was
 * not thrown away in the meantime.
 */
function buildAttributionRecord(attribution) {
  var scan = resolveAcquisitionSource(attribution);
  var utm = attribution.utm || {};
  return {
    sourceCategory: attribution.sourceCategory,
    sourceDetail: attribution.sourceDetail,
    landingPage: attribution.landingPage || '',
    intentToken: attribution.intentToken || '',
    acquisitionSource: scan.acquisitionSource,
    scannedPartner: scan.scannedPartner,
    scannedSlugUnresolved: scan.acquisitionSource === 'unknown',
    refToken: attribution.refToken || '',
    utmSource: utm.source || '',
    utmMedium: utm.medium || '',
    utmCampaign: utm.campaign || '',
    utmContent: utm.content || '',
    utmTerm: utm.term || ''
  };
}

/**
 * Locale record.
 *
 * When no preference was stated, follow-up falls back to the page locale for routing
 * purposes, and `preferredFollowUpStated` keeps the distinction visible so nobody later
 * reads an inferred value as a stated one.
 */
function buildLocaleRecord(locale) {
  var page = locale.page;
  var stated = typeof locale.preferredFollowUp === 'string' && locale.preferredFollowUp !== '';
  return {
    pageLocale: page,
    preferredFollowUpLocale: stated ? locale.preferredFollowUp : page,
    preferredFollowUpStated: stated
  };
}

/**
 * The locale outbound mail should actually be written in.
 *
 * Only launch-ready locales may be used for real correspondence. Today that is English
 * alone, so a Spanish request is recorded and surfaced to the partner as a language
 * need rather than answered by an untranslated template pretending to be Spanish.
 */
function resolveOutboundLocale(localeRecord, launchReadyLocales) {
  var wanted = localeRecord.preferredFollowUpLocale;
  if (launchReadyLocales.indexOf(wanted) !== -1) {
    return { locale: wanted, satisfied: true };
  }
  return {
    locale: launchReadyLocales.length > 0 ? launchReadyLocales[0] : 'en',
    satisfied: false
  };
}
