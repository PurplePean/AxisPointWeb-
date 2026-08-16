/**
 * The Submission and Delivery records.
 *
 * WHY THEY ARE NEW, AND WHY THEY ARE SEPARATE FROM EACH OTHER.
 *
 * A SUBMISSION is the immutable audit record of one accepted request. Every accepted
 * request produces exactly one, whatever kind it is. It carries the submitted values as
 * typed, the normalized values derived from them, the attribution, the locale, and the
 * spam determination, so the record of what somebody actually sent survives any later
 * edit to the business record built from it. **This tab is insert-only.** There is no
 * update function for it anywhere in `src`, and a test asserts that.
 *
 * A DELIVERY is the mutable per-submission operational state: acknowledgement status,
 * notification status, digest status. It exists as its own record for two reasons. First,
 * keeping it out of the Submission is what lets "immutable" be enforced rather than
 * merely asserted. Second, a QR Contact Exchange has delivery state and no Lead at all, so
 * the Lead row is the wrong place for it.
 *
 * WHAT THIS REPLACES. Until Pass 9B, delivery status lived on the Lead row and every
 * submission produced a Lead, including a QR Contact Exchange. That made a handshake at a
 * conference into a Lead with an empty pathway and no SLA.
 */

/**
 * Submission columns. IMMUTABLE: written once, never patched.
 *
 * Both kinds share one column shape so the tab is readable end to end and a reader never
 * has to know which kind they are looking at before they can find the attribution or the
 * locale. Columns that do not apply to a kind are empty, not absent.
 */
var SUBMISSION_HEADERS = [
  'submissionId', 'submissionKind', 'schemaVersion', 'receivedAt', 'submittedAt',

  // Attribution. Immutable by definition, and immutable here by storage.
  'sourceCategory', 'sourceDetail', 'acquisitionSource', 'scannedPartner',
  'landingPage', 'intentToken', 'refToken',
  'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm',

  // Locale exactly as submitted.
  'pageLocale', 'preferredFollowUpLocale', 'preferredFollowUpStated',

  // Submitted values, exactly as typed. Never reformatted.
  'fullName', 'email', 'phone', 'organization', 'contactCategory', 'roleOrTitle',

  // Derived for matching only, stored ALONGSIDE the originals rather than instead of
  // them, so a later change to the matching rules can be re-derived from what the person
  // actually wrote.
  'normalizedEmail', 'normalizedPhone',

  // Website inquiry detail. Empty on a contact exchange.
  'pathway', 'serviceScope', 'topic',
  'propertyType', 'propertyScope', 'propertyLocation', 'propertyScale',
  'propertyScaleUnknown', 'propertyCount',
  'situationCurrent', 'situationInvolvement', 'situationTiming', 'situationNotes',

  'spamSuspected', 'spamReason',

  // Possible matches are a FLAG recorded here for a human. Recording one never links,
  // merges, or updates anything. See Matching.js.
  'possibleMatches', 'matchNote',

  /*
   * A digest of the material content of the request.
   *
   * A submissionId identifies ONE request. If the same id arrives carrying different
   * data, that is not a retry: it is either a client bug reusing an id or somebody
   * trying to overwrite a stored record through the replay path. Either way, silently
   * returning "success, already stored" would tell them their new data was accepted
   * when it was discarded. The fingerprint is what makes the difference detectable.
   */
  'payloadFingerprint',

  // What this submission produced. Exactly one of these is populated.
  'leadId', 'contactId'
];

/** Delivery columns: the mutable per-submission operational state. */
var DELIVERY_HEADERS = [
  'submissionId', 'submissionKind', 'createdAt', 'updatedAt',
  'ackEmailStatus', 'partnerNotifyStatus',
  'digestStatus', 'digestDeliveredAt'
];

/**
 * Builds the immutable audit record.
 *
 * `ctx` supplies everything the record must not invent: { receivedAt, screening,
 * possibleMatches, leadId, contactId }.
 */
function buildSubmission(envelope, ctx) {
  var attribution = buildAttributionRecord(envelope.attribution);
  var locale = buildLocaleRecord(envelope.locale);
  var p = envelope.payload;
  var isInquiry = envelope.submissionKind === 'service_inquiry';

  var property = (isInquiry && p.property) || {};
  var situation = (isInquiry && p.situation) || {};
  var contact = isInquiry ? (p.contact || {}) : p;

  return {
    submissionId: envelope.submissionId,
    submissionKind: envelope.submissionKind,
    schemaVersion: SCHEMA_VERSION,
    receivedAt: toIso(ctx.receivedAt),
    submittedAt: envelope.submittedAt || '',

    sourceCategory: attribution.sourceCategory,
    sourceDetail: attribution.sourceDetail,
    acquisitionSource: attribution.acquisitionSource,
    scannedPartner: attribution.scannedPartner,
    landingPage: attribution.landingPage,
    intentToken: attribution.intentToken,
    refToken: attribution.refToken,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    utmContent: attribution.utmContent,
    utmTerm: attribution.utmTerm,

    pageLocale: locale.pageLocale,
    preferredFollowUpLocale: locale.preferredFollowUpLocale,
    preferredFollowUpStated: locale.preferredFollowUpStated,

    fullName: contact.fullName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    organization: contact.organization || contact.company || '',
    contactCategory: isInquiry ? '' : (p.contactCategory || ''),
    roleOrTitle: isInquiry ? '' : (p.roleOrTitle || ''),

    normalizedEmail: emailKey(contact.email),
    normalizedPhone: phoneKey(contact.phone),

    pathway: isInquiry ? p.pathway : '',
    serviceScope: isInquiry ? (p.serviceScope || '') : '',
    topic: isInquiry ? (p.topic || '') : '',
    propertyType: property.type || '',
    propertyScope: property.scope || '',
    propertyLocation: property.location || '',
    propertyScale: property.scale || '',
    propertyScaleUnknown: property.scaleUnknown === true,
    propertyCount: property.propertyCount || '',
    situationCurrent: situation.current || '',
    situationInvolvement: situation.involvement || '',
    situationTiming: situation.timing || '',
    situationNotes: situation.notes || '',

    spamSuspected: ctx.screening ? ctx.screening.spamSuspected : false,
    spamReason: ctx.screening ? ctx.screening.spamReason : '',
    possibleMatches: formatPossibleMatches(ctx.possibleMatches || []),
    matchNote: matchNoteFor(ctx.possibleMatches || []),

    payloadFingerprint: submissionFingerprint(envelope),

    leadId: ctx.leadId || '',
    contactId: ctx.contactId || ''
  };
}

/**
 * A digest of everything that makes this request THIS request.
 *
 * Deliberately excludes `submittedAt` and `clientSignals`. A genuine retry of the same
 * form carries a new client clock reading and a new fill-time measurement, and treating
 * either as a content change would turn every honest retry into a conflict.
 *
 * Deliberately INCLUDES attribution and locale: the same details submitted from a
 * different partner's card, or with a different follow-up language, is a materially
 * different request even though the person and their contact details are identical.
 */
function submissionFingerprint(envelope) {
  return stableHash(JSON.stringify({
    kind: envelope.submissionKind,
    payload: envelope.payload,
    sourceCategory: envelope.attribution.sourceCategory,
    sourceDetail: envelope.attribution.sourceDetail,
    pageLocale: envelope.locale.page,
    preferredFollowUp: envelope.locale.preferredFollowUp
  }));
}

/**
 * Builds the per-submission delivery row.
 *
 * A website inquiry is acknowledged and notified immediately. A QR exchange is
 * acknowledged and then waits for the 8:00 AM digest, which its notify status says
 * explicitly rather than sitting at `pending` and reading as a stuck queue.
 */
function buildDelivery(envelope, ctx) {
  var isExchange = envelope.submissionKind === 'contact_exchange';
  return {
    submissionId: envelope.submissionId,
    submissionKind: envelope.submissionKind,
    createdAt: toIso(ctx.receivedAt),
    updatedAt: toIso(ctx.receivedAt),
    ackEmailStatus: 'pending',
    partnerNotifyStatus: isExchange ? 'deferred_to_digest' : 'pending',
    // `digestStatusFor` is declared once, in Domain.js. Apps Script evaluates every file
    // into ONE global scope, so a second copy here would silently shadow that one
    // depending on file order rather than being a harmless duplicate.
    digestStatus: digestStatusFor(envelope, ctx),
    digestDeliveredAt: ''
  };
}
