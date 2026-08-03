'use strict';

/*
 * Envelope fixtures.
 *
 * FIXTURE RULE: these are HAND-WRITTEN literals, never derived from the token
 * constants in src. A fixture built from the constant under test proves only that the
 * constant equals itself. When a token changes, these must be updated by hand, and
 * that friction is the point: it is the moment someone notices the wire contract
 * moved.
 */

const VALID_UUID = '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d';
const VALID_UUID_2 = '8a1c2d3e-4f50-4162-9738-495a6b7c8d9e';
const BOOKING_UUID = 'b1c2d3e4-f506-4718-a92b-3c4d5e6f7a8b';

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  Object.keys(patch || {}).forEach((k) => {
    const v = patch[k];
    if (v === undefined) {
      delete out[k];
    } else if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  });
  return out;
}

/** Management Proposal, the fullest of the three shapes. */
function managementProposal(patch = {}) {
  return deepMerge(
    {
      schemaVersion: 1,
      submissionKind: 'service_inquiry',
      submissionId: VALID_UUID,
      submittedAt: '2026-08-03T13:59:00.000Z',
      locale: { page: 'en', preferredFollowUp: null },
      attribution: {
        sourceCategory: 'website',
        sourceDetail: '/property-management',
        landingPage: 'https://example.test/property-management',
        intentToken: 'property_management',
        refToken: '',
        utm: { source: '', medium: '', campaign: '', content: '', term: '' },
      },
      payload: {
        pathway: 'management_proposal',
        serviceScope: 'pm',
        property: {
          type: 'multifamily',
          scope: 'one_property',
          location: 'Dallas, TX',
          scale: '120 units',
          scaleUnknown: false,
          propertyCount: '1',
        },
        situation: {
          current: 'replace_current_management',
          involvement: 'property_management',
          timing: 'within_30_days',
          notes: 'Current manager is unresponsive.',
        },
        contact: {
          fullName: 'Dana Whitfield',
          email: 'dana@whitfieldholdings.test',
          phone: '(214) 555-0117',
          organization: 'Whitfield Holdings',
        },
      },
      clientSignals: { fillSeconds: 94 },
    },
    patch,
  );
}

function investorServices(patch = {}) {
  return deepMerge(
    {
      schemaVersion: 1,
      submissionKind: 'service_inquiry',
      submissionId: VALID_UUID_2,
      submittedAt: '2026-08-03T13:59:00.000Z',
      locale: { page: 'en', preferredFollowUp: 'es' },
      attribution: {
        sourceCategory: 'website',
        sourceDetail: '/investor-services',
        landingPage: 'https://example.test/investor-services',
        intentToken: 'investor_services',
        refToken: '',
        utm: { source: '', medium: '', campaign: '', content: '', term: '' },
      },
      payload: {
        pathway: 'investor_services',
        topic: 'actively_searching',
        contact: {
          fullName: 'Marcus Alvarez',
          email: 'marcus@alvarezcapital.test',
          phone: '',
          organization: 'Alvarez Capital',
        },
      },
      clientSignals: { fillSeconds: 61 },
    },
    patch,
  );
}

function generalInquiry(patch = {}) {
  return deepMerge(
    {
      schemaVersion: 1,
      submissionKind: 'service_inquiry',
      submissionId: '11112222-3333-4444-8555-666677778888',
      locale: { page: 'en', preferredFollowUp: null },
      attribution: {
        sourceCategory: 'website',
        sourceDetail: '/contact',
        landingPage: 'https://example.test/contact',
        intentToken: 'general',
        refToken: '',
        utm: { source: '', medium: '', campaign: '', content: '', term: '' },
      },
      payload: {
        pathway: 'general_inquiry',
        topic: 'press_or_media',
        contact: {
          fullName: 'Robin Slate',
          email: 'robin@dallasbusiness.test',
          phone: '',
          organization: '',
        },
      },
      clientSignals: { fillSeconds: 40 },
    },
    patch,
  );
}

/** QR Contact Exchange, scanned from a partner card. */
function contactExchange(patch = {}) {
  return deepMerge(
    {
      schemaVersion: 1,
      submissionKind: 'contact_exchange',
      submissionId: '99998888-7777-4666-8555-444433332222',
      locale: { page: 'en', preferredFollowUp: null },
      attribution: {
        sourceCategory: 'qr',
        sourceDetail: 'zachary-russell',
        landingPage: 'https://example.test/zachary-russell',
        intentToken: null,
        refToken: '',
        utm: { source: '', medium: '', campaign: '', content: '', term: '' },
      },
      payload: {
        fullName: 'Priya Raman',
        email: 'priya@ramanbrokers.test',
        phone: '972-555-0143',
        company: 'Raman Brokers',
        contactCategory: 'broker_real_estate_advisor',
        roleOrTitle: 'Principal',
      },
      clientSignals: { fillSeconds: 22 },
    },
    patch,
  );
}

function bookingRequest(patch = {}) {
  return deepMerge(
    {
      schemaVersion: 1,
      submissionKind: 'booking_request',
      bookingRequestId: BOOKING_UUID,
      leadId: '00000000-0000-4000-8000-000000000001',
      slotStart: '2026-08-04T15:00:00.000Z',
      durationMinutes: 30,
      mode: 'phone_call',
      submittedAt: '2026-08-03T14:00:00.000Z',
    },
    patch,
  );
}

/**
 * A Contact Exchange with a distinct submissionId, so several can be stored in one test.
 * `slug` drives acquisition attribution: a partner slug, the firm card, or anything else
 * (which resolves to unknown).
 */
function qrSubmission(n, slug, patch = {}) {
  const id = `${String(n).padStart(8, '0')}-1111-4222-8333-444455556666`;
  return deepMerge(
    contactExchange({
      submissionId: id,
      attribution: { sourceDetail: slug },
    }),
    patch,
  );
}

module.exports = {
  qrSubmission,
  VALID_UUID,
  VALID_UUID_2,
  BOOKING_UUID,
  deepMerge,
  managementProposal,
  investorServices,
  generalInquiry,
  contactExchange,
  bookingRequest,
};
