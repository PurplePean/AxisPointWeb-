/**
 * Envelope parsing and validation for schemaVersion 1.
 *
 * Every rule the browser enforces is re-enforced here. Browser validation is a
 * courtesy; this is the boundary.
 *
 * Result shape is always { ok: true, value } or { ok: false, code, field }. Error
 * codes are stable strings the client can branch on. Nothing here ever emits a
 * secret, a stack trace, a Sheet id, or an internal message.
 */

var MAX_BODY_BYTES = 100 * 1024;

var FIELD_LIMITS = {
  fullName: 200,
  email: 320,
  phone: 50,
  organization: 200,
  company: 200,
  roleOrTitle: 200,
  location: 200,
  scale: 100,
  propertyCount: 50,
  notes: 5000,
  landingPage: 2000,
  sourceDetail: 200,
  refToken: 100,
  utm: 200
};

/** Server owns these. If a browser supplies any of them the submission is rejected. */
var SERVER_OWNED_FIELDS = [
  'leadId', 'contactId', 'logId', 'receivedAt', 'partnerOwner',
  'leadStatus', 'ownerPartner', 'firstHumanContactAt',
  'qualificationOutcome', 'proposalSentAt',
  'slaDueAt', 'possibleMatches', 'spamSuspected', 'spamReason',
  'ackEmailStatus', 'partnerNotifyStatus', 'calendarStatus',
  'calendarEventId', 'contactSyncStatus', 'activeBookingRequestId'
];

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
var ISO_OFFSET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(code, field) {
  return { ok: false, code: code, field: field || null };
}

function ok(value) {
  return { ok: true, value: value };
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Rejects rather than truncating, so nothing is ever silently lost. */
function checkLength(value, limit, field) {
  if (typeof value !== 'string') return fail('INVALID_TYPE', field);
  if (value.length > limit) return fail('FIELD_TOO_LONG', field);
  return ok(value);
}

function requireString(obj, key, limit, field) {
  var v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') return fail('MISSING_REQUIRED', field);
  return checkLength(v, limit, field);
}

/**
 * An empty string on an optional field means ABSENT, not invalid. A browser form
 * sends "" for every untouched input, so treating it as an error would reject the
 * ordinary case; and a whitespace-only value is the same non-answer as an empty one.
 */
function optionalString(obj, key, limit, field) {
  if (obj[key] === undefined || obj[key] === null) return ok(undefined);
  if (typeof obj[key] !== 'string') return fail('INVALID_TYPE', field);
  if (obj[key].trim() === '') return ok(undefined);
  return checkLength(obj[key], limit, field);
}

/** Enum check that names a display string specifically, so the client learns why. */
function requireToken(value, list, field) {
  if (isRejectedDisplayString(value)) return fail('DISPLAY_STRING_NOT_ACCEPTED', field);
  if (!isKnownToken(list, value)) return fail('UNKNOWN_ENUM', field);
  return ok(value);
}

/**
 * Finds the first server-owned field anywhere in the body, at any depth.
 *
 * `allowed` names fields that are legitimate INPUTS for this kind of request. A
 * booking request has to say which lead it is for, so `leadId` is a reference there
 * even though it is server-owned on a submission.
 */
function hasAnyServerOwnedField(obj, prefix, allowed) {
  var permitted = allowed || [];
  var found = null;
  Object.keys(obj || {}).forEach(function (k) {
    if (found) return;
    var path = prefix ? prefix + '.' + k : k;
    if (SERVER_OWNED_FIELDS.indexOf(k) !== -1 && permitted.indexOf(k) === -1) {
      found = path;
    } else if (isPlainObject(obj[k])) {
      var nested = hasAnyServerOwnedField(obj[k], path, permitted);
      if (nested) found = nested;
    }
  });
  return found;
}

/* ── Envelope ─────────────────────────────────────────────────────────────── */

function parseEnvelope(rawBody) {
  if (typeof rawBody !== 'string') return fail('MALFORMED_BODY');
  if (rawBody.length > MAX_BODY_BYTES) return fail('BODY_TOO_LARGE');

  var body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return fail('MALFORMED_BODY');
  }
  if (!isPlainObject(body)) return fail('MALFORMED_BODY');

  if (body.schemaVersion !== SCHEMA_VERSION) return fail('UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion');

  var kind = requireToken(body.submissionKind, SUBMISSION_KINDS, 'submissionKind');
  if (!kind.ok) return kind;

  if (body.submissionKind === 'booking_request') return validateBookingRequest(body);
  return validateSubmission(body);
}

function validateSubmission(body) {
  var offending = hasAnyServerOwnedField(body, '', []);
  if (offending) return fail('SERVER_OWNED_FIELD_SUPPLIED', offending);

  if (typeof body.submissionId !== 'string' || !UUID_RE.test(body.submissionId)) {
    return fail('INVALID_UUID', 'submissionId');
  }
  if (body.submittedAt !== undefined && typeof body.submittedAt !== 'string') {
    return fail('INVALID_TYPE', 'submittedAt');
  }

  var locale = validateLocale(body.locale);
  if (!locale.ok) return locale;

  var attribution = validateAttribution(body.attribution);
  if (!attribution.ok) return attribution;

  if (!isPlainObject(body.payload)) return fail('MISSING_REQUIRED', 'payload');

  var payload =
    body.submissionKind === 'service_inquiry'
      ? validateServiceInquiry(body.payload)
      : validateContactExchange(body.payload);
  if (!payload.ok) return payload;

  return ok({
    schemaVersion: SCHEMA_VERSION,
    submissionKind: body.submissionKind,
    submissionId: body.submissionId,
    submittedAt: typeof body.submittedAt === 'string' ? body.submittedAt : null,
    locale: locale.value,
    attribution: attribution.value,
    payload: payload.value,
    clientSignals: isPlainObject(body.clientSignals) ? body.clientSignals : {}
  });
}

/* ── Locale ───────────────────────────────────────────────────────────────── */

function validateLocale(locale) {
  if (!isPlainObject(locale)) return fail('MISSING_REQUIRED', 'locale');
  var page = requireToken(locale.page, LOCALES, 'locale.page');
  if (!page.ok) return page;

  var preferred = locale.preferredFollowUp;
  if (preferred !== null && preferred !== undefined) {
    var p = requireToken(preferred, LOCALES, 'locale.preferredFollowUp');
    if (!p.ok) return p;
  }
  // Stored separately and never collapsed: "answered in Spanish" is not the same
  // fact as "the form was completed in Spanish".
  return ok({ page: locale.page, preferredFollowUp: preferred === undefined ? null : preferred });
}

/* ── Attribution ──────────────────────────────────────────────────────────── */

function validateAttribution(attr) {
  if (!isPlainObject(attr)) return fail('MISSING_REQUIRED', 'attribution');

  var cat = requireToken(attr.sourceCategory, SOURCE_CATEGORIES, 'attribution.sourceCategory');
  if (!cat.ok) return cat;

  var detail = requireString(attr, 'sourceDetail', FIELD_LIMITS.sourceDetail, 'attribution.sourceDetail');
  if (!detail.ok) return detail;

  var landing = optionalString(attr, 'landingPage', FIELD_LIMITS.landingPage, 'attribution.landingPage');
  if (!landing.ok) return landing;

  if (attr.intentToken !== null && attr.intentToken !== undefined) {
    var it = requireToken(attr.intentToken, INTENT_TOKENS, 'attribution.intentToken');
    if (!it.ok) return it;
  }

  // refToken is inert: stored as a string, never resolved, never linked, never
  // used to build a chain, notify a referrer, or drive reporting.
  var ref = optionalString(attr, 'refToken', FIELD_LIMITS.refToken, 'attribution.refToken');
  if (!ref.ok) return ref;

  var utm = {};
  var utmKeys = ['source', 'medium', 'campaign', 'content', 'term'];
  var utmIn = isPlainObject(attr.utm) ? attr.utm : {};
  for (var i = 0; i < utmKeys.length; i++) {
    var k = utmKeys[i];
    var v = optionalString(utmIn, k, FIELD_LIMITS.utm, 'attribution.utm.' + k);
    if (!v.ok) return v;
    utm[k] = v.value === undefined ? '' : v.value;
  }

  return ok({
    sourceCategory: attr.sourceCategory,
    sourceDetail: attr.sourceDetail,
    landingPage: landing.value === undefined ? '' : landing.value,
    intentToken: attr.intentToken === undefined ? null : attr.intentToken,
    refToken: ref.value === undefined ? '' : ref.value,
    utm: utm
  });
}

/* ── Service inquiry ──────────────────────────────────────────────────────── */

function validateServiceInquiry(p) {
  var pathway = requireToken(p.pathway, PATHWAYS, 'payload.pathway');
  if (!pathway.ok) return pathway;

  if (p.booking !== undefined) return fail('BOOKING_NOT_ALLOWED_IN_SUBMISSION', 'payload.booking');

  var contact = validateInquiryContact(p.contact);
  if (!contact.ok) return contact;

  var isProposal = p.pathway === 'management_proposal';

  if (!isProposal) {
    if (p.property !== undefined) return fail('BLOCK_NOT_ALLOWED_FOR_PATHWAY', 'payload.property');
    if (p.situation !== undefined) return fail('BLOCK_NOT_ALLOWED_FOR_PATHWAY', 'payload.situation');
    if (p.serviceScope !== undefined) return fail('BLOCK_NOT_ALLOWED_FOR_PATHWAY', 'payload.serviceScope');
  }

  var out = { pathway: p.pathway, contact: contact.value };

  if (isProposal) {
    var scope = requireToken(p.serviceScope, SERVICE_SCOPES, 'payload.serviceScope');
    if (!scope.ok) return scope;

    var property = validateProperty(p.property);
    if (!property.ok) return property;

    var situation = validateSituation(p.situation);
    if (!situation.ok) return situation;

    // The two fields describe one decision. A mismatch is rejected rather than
    // resolved by guessing which one the visitor meant.
    if (SCOPE_TO_INVOLVEMENT[p.serviceScope] !== situation.value.involvement) {
      return fail('SCOPE_INVOLVEMENT_MISMATCH', 'payload.serviceScope');
    }

    if (p.topic !== undefined) return fail('BLOCK_NOT_ALLOWED_FOR_PATHWAY', 'payload.topic');

    out.serviceScope = p.serviceScope;
    out.property = property.value;
    out.situation = situation.value;
  } else {
    var topics = p.pathway === 'investor_services' ? TOPICS_INVESTOR : TOPICS_GENERAL;
    var topic = requireToken(p.topic, topics, 'payload.topic');
    if (!topic.ok) return topic;
    out.topic = p.topic;
  }

  return ok(out);
}

function validateInquiryContact(c) {
  if (!isPlainObject(c)) return fail('MISSING_REQUIRED', 'payload.contact');

  var name = requireString(c, 'fullName', FIELD_LIMITS.fullName, 'payload.contact.fullName');
  if (!name.ok) return name;

  var email = requireString(c, 'email', FIELD_LIMITS.email, 'payload.contact.email');
  if (!email.ok) return email;
  if (!EMAIL_RE.test(c.email)) return fail('INVALID_EMAIL', 'payload.contact.email');

  var phone = optionalString(c, 'phone', FIELD_LIMITS.phone, 'payload.contact.phone');
  if (!phone.ok) return phone;
  if (phone.value !== undefined) {
    var ph = validatePhone(phone.value, 'payload.contact.phone');
    if (!ph.ok) return ph;
  }

  var org = optionalString(c, 'organization', FIELD_LIMITS.organization, 'payload.contact.organization');
  if (!org.ok) return org;

  return ok({
    fullName: c.fullName,
    email: c.email,
    phone: phone.value === undefined ? '' : phone.value,
    organization: org.value === undefined ? '' : org.value
  });
}

function validateProperty(pr) {
  if (!isPlainObject(pr)) return fail('MISSING_REQUIRED', 'payload.property');

  var type = requireToken(pr.type, PROPERTY_TYPES, 'payload.property.type');
  if (!type.ok) return type;

  var scope = requireToken(pr.scope, PROPERTY_SCOPES, 'payload.property.scope');
  if (!scope.ok) return scope;

  var location = requireString(pr, 'location', FIELD_LIMITS.location, 'payload.property.location');
  if (!location.ok) return location;

  var scale = optionalString(pr, 'scale', FIELD_LIMITS.scale, 'payload.property.scale');
  if (!scale.ok) return scale;

  var count = optionalString(pr, 'propertyCount', FIELD_LIMITS.propertyCount, 'payload.property.propertyCount');
  if (!count.ok) return count;

  if (pr.scaleUnknown !== undefined && typeof pr.scaleUnknown !== 'boolean') {
    return fail('INVALID_TYPE', 'payload.property.scaleUnknown');
  }

  return ok({
    type: pr.type,
    scope: pr.scope,
    location: pr.location,
    scale: scale.value === undefined ? '' : scale.value,
    scaleUnknown: pr.scaleUnknown === true,
    propertyCount: count.value === undefined ? '' : count.value
  });
}

function validateSituation(s) {
  if (!isPlainObject(s)) return fail('MISSING_REQUIRED', 'payload.situation');

  var current = requireToken(s.current, SITUATIONS, 'payload.situation.current');
  if (!current.ok) return current;

  var involvement = requireToken(s.involvement, INVOLVEMENTS, 'payload.situation.involvement');
  if (!involvement.ok) return involvement;

  var timing = requireToken(s.timing, TIMINGS, 'payload.situation.timing');
  if (!timing.ok) return timing;

  var notes = optionalString(s, 'notes', FIELD_LIMITS.notes, 'payload.situation.notes');
  if (!notes.ok) return notes;

  return ok({
    current: s.current,
    involvement: s.involvement,
    timing: s.timing,
    notes: notes.value === undefined ? '' : notes.value
  });
}

/* ── Contact exchange ─────────────────────────────────────────────────────── */

function validateContactExchange(p) {
  if (!isPlainObject(p)) return fail('MISSING_REQUIRED', 'payload');

  var name = requireString(p, 'fullName', FIELD_LIMITS.fullName, 'payload.fullName');
  if (!name.ok) return name;

  var email = optionalString(p, 'email', FIELD_LIMITS.email, 'payload.email');
  if (!email.ok) return email;
  if (email.value !== undefined && !EMAIL_RE.test(email.value)) {
    return fail('INVALID_EMAIL', 'payload.email');
  }

  var phone = optionalString(p, 'phone', FIELD_LIMITS.phone, 'payload.phone');
  if (!phone.ok) return phone;
  if (phone.value !== undefined) {
    var ph = validatePhone(phone.value, 'payload.phone');
    if (!ph.ok) return ph;
  }

  // Approved rule: at least one contact method. One is enough; neither is not.
  if (email.value === undefined && phone.value === undefined) {
    return fail('EMAIL_OR_PHONE_REQUIRED', 'payload.email');
  }

  var category = requireToken(p.contactCategory, CONTACT_CATEGORIES, 'payload.contactCategory');
  if (!category.ok) return category;

  var company = optionalString(p, 'company', FIELD_LIMITS.company, 'payload.company');
  if (!company.ok) return company;

  var role = optionalString(p, 'roleOrTitle', FIELD_LIMITS.roleOrTitle, 'payload.roleOrTitle');
  if (!role.ok) return role;

  return ok({
    fullName: p.fullName,
    email: email.value === undefined ? '' : email.value,
    phone: phone.value === undefined ? '' : phone.value,
    company: company.value === undefined ? '' : company.value,
    contactCategory: p.contactCategory,
    roleOrTitle: role.value === undefined ? '' : role.value
  });
}

/* ── Booking request ──────────────────────────────────────────────────────── */

function validateBookingRequest(body) {
  // leadId is the one server-owned name a booking request may carry: it REFERENCES an
  // existing lead rather than claiming to set one. Everything else stays server-owned,
  // so a client cannot mark its own booking as already confirmed.
  var offending = hasAnyServerOwnedField(body, '', ['leadId']);
  if (offending) return fail('SERVER_OWNED_FIELD_SUPPLIED', offending);

  if (typeof body.bookingRequestId !== 'string' || !UUID_RE.test(body.bookingRequestId)) {
    return fail('INVALID_UUID', 'bookingRequestId');
  }
  if (typeof body.leadId !== 'string' || !UUID_RE.test(body.leadId)) {
    return fail('INVALID_UUID', 'leadId');
  }
  if (typeof body.slotStart !== 'string' || !ISO_OFFSET_RE.test(body.slotStart)) {
    return fail('INVALID_TIMESTAMP', 'slotStart');
  }
  if (typeof body.durationMinutes !== 'number' || body.durationMinutes <= 0 || body.durationMinutes > 480) {
    return fail('INVALID_DURATION', 'durationMinutes');
  }
  var mode = requireToken(body.mode, BOOKING_MODES, 'mode');
  if (!mode.ok) return mode;

  return ok({
    schemaVersion: SCHEMA_VERSION,
    submissionKind: 'booking_request',
    bookingRequestId: body.bookingRequestId,
    leadId: body.leadId,
    slotStart: body.slotStart,
    durationMinutes: body.durationMinutes,
    mode: body.mode,
    submittedAt: typeof body.submittedAt === 'string' ? body.submittedAt : null
  });
}
