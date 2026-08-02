/**
 * Attribution and locale resolution.
 *
 * Two rules drive this file:
 *
 * 1. A QR card identifies WHICH card was scanned. It does not assign ownership. The
 *    scanned partner is recorded as `scannedPartner`; who works the lead is decided
 *    by notification routing, which may or may not agree.
 *
 * 2. Page locale and preferred follow-up locale are different facts and are never
 *    collapsed. Someone can read the English page and ask to be called back in
 *    Spanish, and both halves matter operationally.
 */

/**
 * Resolves a QR source detail to a known partner.
 *
 * Only the two approved slugs resolve. Anything else, including a slug that used to
 * exist, is the firm fallback: recorded as unresolved rather than guessed at, so a
 * stale card never silently attributes to the wrong person.
 */
function resolveScannedPartner(attribution) {
  if (!attribution || attribution.sourceCategory !== 'qr') {
    return { scannedPartner: '', scannedSlug: '', resolved: false };
  }
  var slug = lowerTrim(attribution.sourceDetail);
  var partner = Object.prototype.hasOwnProperty.call(SLUG_TO_PARTNER, slug)
    ? SLUG_TO_PARTNER[slug]
    : '';
  return {
    scannedPartner: partner,
    scannedSlug: slug,
    resolved: partner !== ''
  };
}

/**
 * Flattens attribution into the fields storage keeps.
 *
 * `refToken` is carried through verbatim and inert. It is never resolved to a person,
 * never used to build a referral chain, never triggers a notification, and never
 * feeds reporting. It exists so that if referral tracking is built later the raw
 * signal was not thrown away in the meantime.
 */
function buildAttributionRecord(attribution) {
  var scan = resolveScannedPartner(attribution);
  var utm = attribution.utm || {};
  return {
    sourceCategory: attribution.sourceCategory,
    sourceDetail: attribution.sourceDetail,
    landingPage: attribution.landingPage || '',
    intentToken: attribution.intentToken || '',
    scannedPartner: scan.scannedPartner,
    scannedSlugUnresolved: attribution.sourceCategory === 'qr' && !scan.resolved,
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
 * `pageLocale` is where the visitor was. `preferredFollowUpLocale` is how they want
 * to be answered. When they did not say, follow-up falls back to the page locale for
 * routing purposes but the stored `preferredFollowUpStated` flag keeps the
 * distinction visible, so nobody later reads an inferred value as a stated one.
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
 * The locale outbound mail should use.
 *
 * Only launch-ready locales may be used for real correspondence. Today that is
 * English alone, so a Spanish request is recorded and surfaced to the partner as a
 * language need rather than answered by an untranslated template pretending to be
 * Spanish. `launchReady` is supplied by the caller so this stays a pure decision.
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
