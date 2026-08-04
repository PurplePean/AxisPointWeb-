/**
 * The business records: Lead and Contact.
 *
 * A LEAD is a website service inquiry: a request with a pathway, an SLA, a qualification
 * state, and possibly a booking. A CONTACT is a person met through a scanned card.
 *
 * ONE SUBMISSION KIND PRODUCES ONE OF THEM, NEVER BOTH:
 *
 *   service_inquiry   Submission + Lead
 *   contact_exchange  Submission + Contact
 *
 * A website inquiry does not file a person. A handshake at a conference does not open a
 * request with a clock on it. Pass 9A produced a Lead for both, which left QR rows sitting
 * in the Leads tab with an empty pathway and a qualification state nobody would ever set.
 *
 * A Contact may later be linked or converted to a Lead BY A PERSON. Nothing here does it
 * automatically, and `linkedLeadIds` is where that decision would be recorded.
 *
 * The immutable Submission and the mutable Delivery live in Records.js.
 */

var LEAD_STATUSES = [
  'new', 'working', 'qualified', 'proposal_sent', 'won', 'lost', 'disqualified'
];

var QUALIFICATION_OUTCOMES = [
  'pending', 'qualified', 'not_qualified', 'no_response', 'not_a_fit'
];

/** Delivery states used by every bounded at-least-once side effect. */
var DELIVERY_STATUSES = [
  'pending', 'sent', 'failed', 'skipped', 'not_configured',
  /* A QR Contact is never notified immediately. Its notify status says so explicitly
   * rather than sitting at 'pending' forever and reading as a stuck queue. */
  'deferred_to_digest'
];

var CALENDAR_STATUSES = ['none', 'pending', 'booked', 'failed', 'not_configured'];

/**
 * Google Contacts sync states.
 *
 * `not_configured` is the only value anything in this repository can produce. The internal
 * Contact is the source of truth; Google Contacts would be a downstream copy, never the
 * database. The external-reference columns exist so a later adapter has somewhere to write
 * without a migration. Nothing populates them, no People API call exists anywhere in
 * `src`, and the manifest requests no contacts scope.
 */
var CONTACT_SYNC_STATUSES = ['not_configured', 'pending', 'synced', 'failed'];

/**
 * Lead columns. WEBSITE SERVICE INQUIRIES ONLY.
 *
 * The person's submitted details are carried on the Lead itself, because a website inquiry
 * produces no Contact record to hold them.
 *
 * Delivery status is NOT here. It lives on the Delivery row, so a QR Contact Exchange,
 * which has delivery state and no Lead, has somewhere correct to keep it.
 */
var LEAD_HEADERS = [
  'leadId', 'sourceSubmissionId', 'receivedAt',
  'pathway', 'serviceScope', 'topic',
  'propertyType', 'propertyScope', 'propertyLocation', 'propertyScale',
  'propertyScaleUnknown', 'propertyCount',
  'situationCurrent', 'situationInvolvement', 'situationTiming', 'situationNotes',
  'fullName', 'email', 'phone', 'organization',
  'pageLocale', 'preferredFollowUpLocale', 'preferredFollowUpStated',
  'sourceCategory', 'sourceDetail', 'landingPage', 'intentToken', 'refToken',
  'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm',

  'leadStatus', 'ownerPartner', 'firstHumanContactAt',
  'qualificationOutcome', 'proposalSentAt',
  'slaDueAt', 'possibleMatches', 'matchNote', 'spamSuspected', 'spamReason',

  // Decided once, at intake, and stored so the frontend never re-derives eligibility and
  // cannot disagree with the backend about it.
  'bookingEligible',
  'calendarStatus', 'calendarEventId', 'activeBookingRequestId'
];

/**
 * Contact columns. A PERSON, met through a scanned card.
 *
 * `acquisitionSource` and `scannedPartner` are IMMUTABLE: which card produced this person,
 * written once. `ownerPartner` is MUTABLE and starts unassigned for everyone, including a
 * Contact gathered through a partner's own card. One column for both would make an
 * acquisition fact look like an assignment.
 *
 * `submissionCount`, `lastSubmissionId`, and `lastSubmissionAt` describe THIS record only.
 * They are not a running total across duplicates, because duplicates are never folded
 * together; see Matching.js.
 */
var CONTACT_HEADERS = [
  'contactId', 'createdAt', 'updatedAt', 'sourceSubmissionId',
  'fullName', 'email', 'phone', 'company', 'roleOrTitle', 'contactCategory',
  'normalizedEmail', 'normalizedPhone',
  'preferredFollowUpLocale',
  'firstSourceCategory', 'firstSourceDetail',
  'acquisitionSource', 'scannedPartner',
  'ownerPartner', 'followUpState',
  'submissionCount', 'lastSubmissionId', 'lastSubmissionAt',

  // Populated only by a human linking this person to a Lead. Never written at intake.
  'linkedLeadIds',
  'possibleMatches',

  // Google Contacts readiness. Nullable, unpopulated, reserved for a later adapter.
  'contactSyncStatus', 'externalContactResourceName', 'externalContactEtag',
  'externalContactSyncedAt'
];

var LOG_HEADERS = [
  'logId', 'at', 'level', 'event', 'submissionId', 'leadId', 'detail'
];

/**
 * Work columns.
 *
 * `subjectId` is whatever the handler needs to find its record: a submissionId for the
 * acknowledgement and notification handlers, a leadId for the booking confirmation. It was
 * `leadId` until Pass 9B, which stopped being true the moment a QR Contact Exchange
 * stopped producing a Lead.
 */
var WORK_HEADERS = [
  'workId', 'createdAt', 'kind', 'subjectId', 'state',
  'attempts', 'nextAttemptAt', 'lastError', 'completedAt'
];

/* ── Lead ─────────────────────────────────────────────────────────────────── */

/**
 * Builds a Lead. WEBSITE SERVICE INQUIRIES ONLY.
 *
 * Throws on any other kind rather than producing an empty-pathway row. A silent empty row
 * is precisely how the defect this pass removes would come back.
 */
function buildLead(envelope, ctx) {
  if (envelope.submissionKind !== 'service_inquiry') {
    throw new Error('LeadFromNonInquiry');
  }

  var attribution = buildAttributionRecord(envelope.attribution);
  var locale = buildLocaleRecord(envelope.locale);
  var p = envelope.payload;
  var property = p.property || {};
  var situation = p.situation || {};
  var contact = p.contact || {};

  return {
    leadId: ctx.leadId,
    sourceSubmissionId: envelope.submissionId,
    receivedAt: toIso(ctx.receivedAt),

    pathway: p.pathway,
    serviceScope: p.serviceScope || '',
    topic: p.topic || '',

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
    organization: contact.organization || '',

    pageLocale: locale.pageLocale,
    preferredFollowUpLocale: locale.preferredFollowUpLocale,
    preferredFollowUpStated: locale.preferredFollowUpStated,

    sourceCategory: attribution.sourceCategory,
    sourceDetail: attribution.sourceDetail,
    landingPage: attribution.landingPage,
    intentToken: attribution.intentToken,
    refToken: attribution.refToken,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    utmContent: attribution.utmContent,
    utmTerm: attribution.utmTerm,

    leadStatus: 'new',
    // Unassigned at intake. Ownership is a decision a person makes.
    ownerPartner: '',
    firstHumanContactAt: '',
    qualificationOutcome: 'pending',
    proposalSentAt: '',
    slaDueAt: ctx.slaDueAt ? toIso(ctx.slaDueAt) : '',

    // A flag for a human. It links nothing and merges nothing.
    possibleMatches: formatPossibleMatches(ctx.possibleMatches || []),
    matchNote: matchNoteFor(ctx.possibleMatches || []),

    spamSuspected: ctx.screening ? ctx.screening.spamSuspected : false,
    spamReason: ctx.screening ? ctx.screening.spamReason : '',

    bookingEligible: isBookablePathway(p.pathway, p.serviceScope),
    calendarStatus: 'none',
    calendarEventId: '',
    activeBookingRequestId: ''
  };
}

/**
 * Booking eligibility, decided in ONE place so the frontend and the backend cannot
 * disagree.
 *
 * Property Management and Property Management plus Asset Management only. Investor
 * Services, General Inquiry, and a QR Contact Exchange get no booking at launch: they are
 * questions and handshakes, not engagements, and offering a slot would put a partner in a
 * meeting the visitor never asked for.
 *
 * `undecided` scope is still the Management Proposal pathway and is still bookable. The
 * visitor is asking about management; they have simply not chosen between PM and PM plus
 * AM yet, and refusing them a call for that would refuse the conversation that resolves it.
 */
function isBookablePathway(pathway, serviceScope) {
  if (pathway !== 'management_proposal') return false;
  return BOOKABLE_SERVICE_SCOPES.indexOf(String(serviceScope || 'undecided')) !== -1;
}

/* ── Contact ──────────────────────────────────────────────────────────────── */

/**
 * Builds a Contact. QR CONTACT EXCHANGE ONLY.
 *
 * Always a NEW record. An exact email or phone match against an existing Contact raises a
 * flag on the Submission and changes nothing else: no link, no merge, no overwrite, no
 * update. Two records that turn out to be the same person are trivially reconcilable by a
 * human; a merge of two records that turn out to be different people destroys the losing
 * record's history and nobody finds out.
 */
function buildContact(envelope, ctx) {
  if (envelope.submissionKind !== 'contact_exchange') {
    throw new Error('ContactFromNonExchange');
  }

  var attribution = buildAttributionRecord(envelope.attribution);
  var locale = buildLocaleRecord(envelope.locale);
  var p = envelope.payload;

  return {
    contactId: ctx.contactId,
    createdAt: toIso(ctx.receivedAt),
    updatedAt: toIso(ctx.receivedAt),
    sourceSubmissionId: envelope.submissionId,

    // As typed. Never reformatted, never title-cased.
    fullName: p.fullName || '',
    email: p.email || '',
    phone: p.phone || '',
    company: p.company || '',
    roleOrTitle: p.roleOrTitle || '',
    contactCategory: p.contactCategory,

    // Derived for matching, stored alongside the originals rather than instead of them.
    normalizedEmail: emailKey(p.email),
    normalizedPhone: phoneKey(p.phone),

    preferredFollowUpLocale: locale.preferredFollowUpLocale,
    firstSourceCategory: attribution.sourceCategory,
    firstSourceDetail: attribution.sourceDetail,

    // Immutable acquisition attribution.
    acquisitionSource: attribution.acquisitionSource,
    scannedPartner: attribution.scannedPartner,

    // Mutable, and unassigned for everyone at intake.
    ownerPartner: '',
    followUpState: 'not_contacted',

    submissionCount: 1,
    lastSubmissionId: envelope.submissionId,
    lastSubmissionAt: toIso(ctx.receivedAt),

    linkedLeadIds: '',
    possibleMatches: formatPossibleMatches(ctx.possibleMatches || []),

    contactSyncStatus: 'not_configured',
    externalContactResourceName: '',
    externalContactEtag: '',
    externalContactSyncedAt: ''
  };
}

/*
 * There is deliberately no `mergeContact`.
 *
 * It existed to fold a new submission into an existing Contact, which is exactly what the
 * approved rule forbids. Leaving it in place as dead code would be an invitation to call
 * it again, and `storage-model.test.js` asserts it is gone.
 */

/**
 * Whether a submission enters the digest queue.
 *
 * Only a scanned card does. A flagged submission is stored and excluded, and the excluded
 * state is written down rather than inferred, so nobody later reads "not pending" as
 * "already sent". Everything else has no digest at all, which is a different fact again
 * from "waiting", so it gets its own value.
 */
function digestStatusFor(envelope, ctx) {
  if (envelope.submissionKind !== 'contact_exchange') return 'not_applicable';
  if (ctx.screening && ctx.screening.spamSuspected) return 'excluded_spam';
  return 'pending_digest';
}

/* ── Row projection ───────────────────────────────────────────────────────── */

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
