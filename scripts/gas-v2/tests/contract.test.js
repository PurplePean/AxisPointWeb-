'use strict';

/*
 * The contract boundary.
 *
 * WHAT THESE TESTS ARE FOR. Browser validation is a courtesy and can be bypassed by
 * anyone with a terminal. Every rule the form enforces has to be enforced again here,
 * and the failures that matter are the SILENT ones: a display string accepted as a
 * wire value (which would quietly make the copy deck the contract), a server-owned
 * field accepted from the client (which would let a submitter set their own SLA or
 * mark themselves not-spam), and a pathway accepting blocks that belong to another
 * pathway (which produces rows nobody can interpret later).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');

const ctx = load();

function parse(envelope) {
  return ctx.parseEnvelope(JSON.stringify(envelope));
}

test('accepts a complete management proposal', () => {
  const result = parse(fx.managementProposal());
  assert.equal(result.ok, true);
  assert.equal(result.value.payload.pathway, 'management_proposal');
  assert.equal(result.value.payload.property.type, 'multifamily');
});

test('accepts investor services and general inquiry', () => {
  assert.equal(parse(fx.investorServices()).ok, true);
  assert.equal(parse(fx.generalInquiry()).ok, true);
});

test('accepts a contact exchange', () => {
  const result = parse(fx.contactExchange());
  assert.equal(result.ok, true);
  assert.equal(result.value.payload.contactCategory, 'broker_real_estate_advisor');
});

test('rejects a body that is not JSON', () => {
  const result = ctx.parseEnvelope('{not json');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MALFORMED_BODY');
});

test('rejects an oversized body before parsing it', () => {
  const result = ctx.parseEnvelope('x'.repeat(200 * 1024));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BODY_TOO_LARGE');
});

test('rejects an unsupported schema version', () => {
  const result = parse(fx.managementProposal({ schemaVersion: 2 }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNSUPPORTED_SCHEMA_VERSION');
});

test('rejects an unknown submission kind', () => {
  const result = parse(fx.managementProposal({ submissionKind: 'newsletter_signup' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNKNOWN_ENUM');
  assert.equal(result.field, 'submissionKind');
});

test('rejects a non-UUID submissionId', () => {
  const result = parse(fx.managementProposal({ submissionId: 'abc123' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_UUID');
});

/* ── Display strings are not wire values ──────────────────────────────────── */

test('rejects an approved display string used as a property type', () => {
  const result = parse(fx.managementProposal({ payload: { property: { type: 'Multifamily' } } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DISPLAY_STRING_NOT_ACCEPTED');
  assert.equal(result.field, 'payload.property.type');
});

test('rejects an approved display string used as a timing', () => {
  const result = parse(
    fx.managementProposal({ payload: { situation: { timing: 'Within 30 days' } } }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DISPLAY_STRING_NOT_ACCEPTED');
});

test('rejects an approved display string used as a booking mode', () => {
  const result = ctx.parseEnvelope(JSON.stringify(fx.bookingRequest({ mode: 'Phone call' })));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DISPLAY_STRING_NOT_ACCEPTED');
});

test('a hyphenated frontend union value is not a wire token', () => {
  // The frontend model uses 'pm-plus-am'; the wire uses 'pm_plus_am'. The mapping is
  // the frontend's job, and the backend must not quietly accept either form.
  const result = parse(fx.managementProposal({ payload: { serviceScope: 'pm-plus-am' } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNKNOWN_ENUM');
});

/* ── Server-owned fields ──────────────────────────────────────────────────── */

test('rejects a client-supplied leadId on a submission', () => {
  const result = parse(fx.managementProposal({ leadId: '00000000-0000-4000-8000-000000000009' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SERVER_OWNED_FIELD_SUPPLIED');
});

test('rejects a client-supplied spamSuspected buried inside the payload', () => {
  const result = parse(fx.managementProposal({ payload: { spamSuspected: false } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SERVER_OWNED_FIELD_SUPPLIED');
  assert.equal(result.field, 'payload.spamSuspected');
});

test('rejects a client-supplied slaDueAt', () => {
  const result = parse(fx.managementProposal({ slaDueAt: '2030-01-01T00:00:00.000Z' }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SERVER_OWNED_FIELD_SUPPLIED');
});

/* ── Pathway block rules ──────────────────────────────────────────────────── */

test('rejects a property block on investor services', () => {
  const result = parse(
    fx.investorServices({ payload: { property: { type: 'retail', scope: 'portfolio', location: 'X' } } }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BLOCK_NOT_ALLOWED_FOR_PATHWAY');
  assert.equal(result.field, 'payload.property');
});

test('rejects a topic on management proposal', () => {
  const result = parse(fx.managementProposal({ payload: { topic: 'something_else' } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BLOCK_NOT_ALLOWED_FOR_PATHWAY');
});

test('rejects an investor topic used on general inquiry', () => {
  // The two lists share 'something_else' but nothing else. A cross-pathway topic
  // would store a value the reader of that row cannot interpret.
  const result = parse(fx.generalInquiry({ payload: { topic: 'under_contract_now' } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNKNOWN_ENUM');
});

test('rejects a management proposal missing its situation block', () => {
  const result = parse(fx.managementProposal({ payload: { situation: undefined } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MISSING_REQUIRED');
});

test('rejects serviceScope that contradicts situation.involvement', () => {
  const result = parse(
    fx.managementProposal({
      payload: {
        serviceScope: 'pm_plus_am',
        situation: { involvement: 'property_management' },
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SCOPE_INVOLVEMENT_MISMATCH');
});

test('accepts serviceScope that agrees with situation.involvement', () => {
  const result = parse(
    fx.managementProposal({
      payload: {
        serviceScope: 'pm_plus_am',
        situation: { involvement: 'property_management_plus_asset_management' },
      },
    }),
  );
  assert.equal(result.ok, true);
});

/* ── Booking is never part of a submission ────────────────────────────────── */

test('rejects a booking block inside a service inquiry', () => {
  const result = parse(
    fx.managementProposal({ payload: { booking: { mode: 'phone_call', slot: '9:00 AM' } } }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BOOKING_NOT_ALLOWED_IN_SUBMISSION');
});

/* ── Contact rules ────────────────────────────────────────────────────────── */

test('rejects an inquiry with no email', () => {
  const result = parse(fx.managementProposal({ payload: { contact: { email: undefined } } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MISSING_REQUIRED');
});

test('rejects a malformed email', () => {
  const result = parse(fx.managementProposal({ payload: { contact: { email: 'dana@@x' } } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_EMAIL');
});

test('rejects a phone that is too short to be one', () => {
  const result = parse(fx.managementProposal({ payload: { contact: { phone: '555-01' } } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_PHONE');
});

test('contact exchange accepts phone alone', () => {
  const result = parse(fx.contactExchange({ payload: { email: undefined } }));
  assert.equal(result.ok, true);
  assert.equal(result.value.payload.email, '');
});

test('contact exchange accepts email alone', () => {
  const result = parse(fx.contactExchange({ payload: { phone: undefined } }));
  assert.equal(result.ok, true);
});

test('contact exchange rejects neither email nor phone', () => {
  const result = parse(fx.contactExchange({ payload: { email: undefined, phone: undefined } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EMAIL_OR_PHONE_REQUIRED');
});

/* ── Field limits ─────────────────────────────────────────────────────────── */

test('rejects rather than truncates an over-long notes field', () => {
  // Truncation loses whatever the visitor actually said, silently. Rejection tells
  // them, and nothing is lost.
  const result = parse(
    fx.managementProposal({ payload: { situation: { notes: 'x'.repeat(5001) } } }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FIELD_TOO_LONG');
  assert.equal(result.field, 'payload.situation.notes');
});

/* ── Locale ───────────────────────────────────────────────────────────────── */

test('page locale and preferred follow-up are kept as separate facts', () => {
  const result = parse(fx.investorServices());
  assert.equal(result.ok, true);
  assert.equal(result.value.locale.page, 'en');
  assert.equal(result.value.locale.preferredFollowUp, 'es');
});

test('rejects an unknown locale', () => {
  const result = parse(fx.managementProposal({ locale: { page: 'fr' } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNKNOWN_ENUM');
});

test('accepts every locale in the registry, including unlaunched ones', () => {
  // Accepting a stated preference is not the same as promising to answer in it. The
  // preference is worth recording long before anything is translated.
  ['en', 'es', 'zh-Hans', 'zh-Hant', 'vi', 'hi', 'ur', 'gu', 'pa'].forEach((code) => {
    const result = parse(fx.managementProposal({ locale: { page: 'en', preferredFollowUp: code } }));
    assert.equal(result.ok, true, `locale ${code} should be accepted`);
  });
});

/* ── Attribution ──────────────────────────────────────────────────────────── */

test('rejects an unknown source category', () => {
  const result = parse(fx.managementProposal({ attribution: { sourceCategory: 'email_blast' } }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UNKNOWN_ENUM');
});

test('carries refToken through untouched', () => {
  const result = parse(fx.managementProposal({ attribution: { refToken: 'ABC-123' } }));
  assert.equal(result.ok, true);
  assert.equal(result.value.attribution.refToken, 'ABC-123');
});

/* ── Booking request envelope ─────────────────────────────────────────────── */

test('accepts a well formed booking request', () => {
  const result = ctx.parseEnvelope(JSON.stringify(fx.bookingRequest()));
  assert.equal(result.ok, true);
  assert.equal(result.value.mode, 'phone_call');
});

test('rejects a booking request with a non-UUID leadId', () => {
  const result = ctx.parseEnvelope(JSON.stringify(fx.bookingRequest({ leadId: 'lead-1' })));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_UUID');
  assert.equal(result.field, 'leadId');
});

test('rejects a booking request with an unusable duration', () => {
  const result = ctx.parseEnvelope(JSON.stringify(fx.bookingRequest({ durationMinutes: 0 })));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_DURATION');
});

test('rejects a booking slotStart without an offset', () => {
  const result = ctx.parseEnvelope(
    JSON.stringify(fx.bookingRequest({ slotStart: '2026-08-04 15:00' })),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_TIMESTAMP');
});
