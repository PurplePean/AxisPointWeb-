/**
 * Lead and Contact domain records.
 *
 * A Lead is a REQUEST: one submission, one moment, one thing somebody wanted. A
 * Contact is a PERSON: stable across every request they ever make. Collapsing the two
 * is what forced V1's rework, because the second inquiry from the same owner had
 * nowhere correct to go.
 *
 * Every record is built from validated envelope data plus server-owned operational
 * fields. Nothing the browser sends can set an operational field; the contract layer
 * rejects the attempt outright rather than stripping it silently.
 */

var LEAD_STATUSES = [
  'new', 'working', 'qualified', 'proposal_sent', 'won', 'lost', 'disqualified'
];

var QUALIFICATION_OUTCOMES = [
  'pending', 'qualified', 'not_qualified', 'no_response', 'not_a_fit'
];

/** Delivery states used by every bounded at-least-once side effect. */
var DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'skipped', 'not_configured'];

var CALENDAR_STATUSES = ['none', 'pending', 'booked', 'failed', 'not_configured'];

/**
 * Column order for the Leads tab. Order is part of the contract with the sheet, so it
 * is declared once here and read by header name everywhere else, never by index.
 */
var LEAD_HEADERS = [
  'leadId', 'contactId', 'receivedAt', 'submissionId', 'submissionKind',
  'pathway', 'serviceScope', 'topic',
  'propertyType', 'propertyScope', 'propertyLocation', 'propertyScale',
  'propertyScaleUnknown', 'propertyCount',
  'situationCurrent', 'situationInvolvement', 'situationTiming', 'situationNotes',
  'fullName', 'email', 'phone', 'organization',
  'pageLocale', 'preferredFollowUpLocale', 'preferredFollowUpStated',
  'sourceCategory', 'sourceDetail', 'landingPage', 'intentToken',
  'scannedPartner', 'scannedSlugUnresolved', 'refToken',
  'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm',
  'leadStatus', 'ownerPartner', 'firstHumanContactAt',
  'qualificationOutcome', 'proposalSentAt',
  'slaDueAt', 'possibleMatches', 'spamSuspected', 'spamReason',
  'ackEmailStatus', 'partnerNotifyStatus',
  'calendarStatus', 'calendarEventId', 'activeBookingRequestId'
];

var CONTACT_HEADERS = [
  'contactId', 'createdAt', 'updatedAt',
  'fullName', 'email', 'phone', 'company', 'roleOrTitle', 'contactCategory',
  'preferredFollowUpLocale', 'firstSourceCategory', 'firstSourceDetail',
  'scannedPartner', 'leadCount', 'lastLeadId', 'lastLeadAt',
  'possibleMatches', 'contactSyncStatus'
];

var LOG_HEADERS = [
  'logId', 'at', 'level', 'event', 'submissionId', 'leadId', 'detail'
];

var WORK_HEADERS = [
  'workId', 'createdAt', 'kind', 'leadId', 'state',
  'attempts', 'nextAttemptAt', 'lastError', 'completedAt'
];

/**
 * Builds a Lead from a validated envelope.
 *
 * `ctx` supplies everything the domain must not invent: { leadId, contactId,
 * receivedAt, slaDueAt, screening, possibleMatches, ackStatus, notifyStatus }.
 */
function buildLead(envelope, ctx) {
  var attribution = buildAttributionRecord(envelope.attribution);
  var locale = buildLocaleRecord(envelope.locale);
  var p = envelope.payload;
  var isInquiry = envelope.submissionKind === 'service_inquiry';

  var property = (isInquiry && p.property) || {};
  var situation = (isInquiry && p.situation) || {};
  var contact = isInquiry ? (p.contact || {}) : p;

  var lead = {
    leadId: ctx.leadId,
    contactId: ctx.contactId,
    receivedAt: toIso(ctx.receivedAt),
    submissionId: envelope.submissionId,
    submissionKind: envelope.submissionKind,

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

    fullName: contact.fullName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    organization: contact.organization || contact.company || '',

    pageLocale: locale.pageLocale,
    preferredFollowUpLocale: locale.preferredFollowUpLocale,
    preferredFollowUpStated: locale.preferredFollowUpStated,

    sourceCategory: attribution.sourceCategory,
    sourceDetail: attribution.sourceDetail,
    landingPage: attribution.landingPage,
    intentToken: attribution.intentToken,
    scannedPartner: attribution.scannedPartner,
    scannedSlugUnresolved: attribution.scannedSlugUnresolved,
    refToken: attribution.refToken,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    utmContent: attribution.utmContent,
    utmTerm: attribution.utmTerm,

    // Operational fields. Server-owned, every one of them.
    leadStatus: 'new',
    ownerPartner: ctx.ownerPartner || '',
    firstHumanContactAt: '',
    qualificationOutcome: 'pending',
    proposalSentAt: '',
    slaDueAt: ctx.slaDueAt ? toIso(ctx.slaDueAt) : '',
    possibleMatches: formatPossibleMatches(ctx.possibleMatches || []),
    spamSuspected: ctx.screening ? ctx.screening.spamSuspected : false,
    spamReason: ctx.screening ? ctx.screening.spamReason : '',
    ackEmailStatus: ctx.ackStatus || 'pending',
    partnerNotifyStatus: ctx.notifyStatus || 'pending',

    calendarStatus: 'none',
    calendarEventId: '',
    activeBookingRequestId: ''
  };

  return lead;
}

/**
 * Builds a new Contact from a validated envelope.
 *
 * Only Contact Exchange states a category directly. A service inquiry does not ask
 * "what are you", so the category is left empty rather than inferred from the
 * pathway: a guess written into a person's record reads later as a fact somebody
 * stated.
 */
function buildContact(envelope, ctx) {
  var attribution = buildAttributionRecord(envelope.attribution);
  var locale = buildLocaleRecord(envelope.locale);
  var p = envelope.payload;
  var isExchange = envelope.submissionKind === 'contact_exchange';
  var contact = isExchange ? p : (p.contact || {});

  return {
    contactId: ctx.contactId,
    createdAt: toIso(ctx.receivedAt),
    updatedAt: toIso(ctx.receivedAt),
    fullName: contact.fullName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    company: isExchange ? (p.company || '') : (contact.organization || ''),
    roleOrTitle: isExchange ? (p.roleOrTitle || '') : '',
    contactCategory: isExchange ? p.contactCategory : '',
    preferredFollowUpLocale: locale.preferredFollowUpLocale,
    firstSourceCategory: attribution.sourceCategory,
    firstSourceDetail: attribution.sourceDetail,
    scannedPartner: attribution.scannedPartner,
    leadCount: 1,
    lastLeadId: ctx.leadId,
    lastLeadAt: toIso(ctx.receivedAt),
    possibleMatches: formatPossibleMatches(ctx.possibleMatches || []),
    // Google People synchronization is deliberately not implemented in this pass.
    // The field records that truthfully instead of claiming a sync that never ran.
    contactSyncStatus: 'not_configured'
  };
}

/**
 * Non-destructive update of an existing Contact.
 *
 * A blank incoming value NEVER overwrites a populated stored one. Someone filling in
 * only a phone on their second submission must not erase the email from the first.
 * Populated incoming values do win, because the newer statement is the better one.
 */
function mergeContact(existing, incoming, ctx) {
  var merged = clone(existing);
  var fields = ['fullName', 'email', 'phone', 'company', 'roleOrTitle', 'contactCategory'];

  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var value = incoming[f];
    if (typeof value === 'string' && value.trim() !== '') merged[f] = value;
  }

  if (incoming.preferredFollowUpStated) {
    merged.preferredFollowUpLocale = incoming.preferredFollowUpLocale;
  }

  merged.updatedAt = toIso(ctx.receivedAt);
  merged.leadCount = (Number(existing.leadCount) || 0) + 1;
  merged.lastLeadId = ctx.leadId;
  merged.lastLeadAt = toIso(ctx.receivedAt);
  return merged;
}

/** Row projection, by header name. Index-based access is never used anywhere. */
function toRow(headers, record) {
  return headers.map(function (h) {
    var v = record[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return v;
  });
}

function fromRow(headers, row) {
  var out = {};
  for (var i = 0; i < headers.length; i++) {
    var v = row[i];
    if (v === 'TRUE') v = true;
    else if (v === 'FALSE') v = false;
    out[headers[i]] = v === undefined ? '' : v;
  }
  return out;
}
