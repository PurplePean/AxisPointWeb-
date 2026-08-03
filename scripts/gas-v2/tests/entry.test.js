'use strict';

/*
 * The request boundary.
 *
 * WHAT THESE TESTS ARE FOR. Two failures here are invisible from inside the code and
 * expensive outside it.
 *
 * First, leakage. An error message that carries a Sheet id, a property name, an
 * address, or a stack trace hands an anonymous caller information about the account.
 * Several tests below deliberately force internal failures and then assert on the
 * ENTIRE serialized response, not just the code, because that is the only way to
 * catch a leak that arrives through some field nobody thought to check.
 *
 * Second, shape. Apps Script returns an unreadable HTML error page for an uncaught
 * exception, so the browser sees a network error and the visitor sees nothing. Every
 * path here must produce a JSON body with a stable code.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps } = require('./helpers/fakes.js');

const ctx = load();

function post(envelope, deps) {
  return ctx.handlePost(JSON.stringify(envelope), { ok: true, deps: deps || buildDeps() });
}

/* ── Success shape ────────────────────────────────────────────────────────── */

test('a good submission returns the ids the client needs and nothing else', () => {
  const deps = buildDeps();
  const body = post(fx.managementProposal(), deps);

  assert.equal(body.ok, true);
  assert.equal(body.schemaVersion, 1);
  assert.deepEqual(Object.keys(body).sort(), [
    'contactId',
    'leadId',
    'ok',
    'replay',
    'schemaVersion',
    'slaDueAt',
    'submissionId',
    'submissionKind',
  ]);
});

test('a replayed submission reports itself as one', () => {
  const deps = buildDeps();
  post(fx.managementProposal(), deps);
  const second = post(fx.managementProposal(), deps);
  assert.equal(second.replay, true);
});

test('a booking request returns its own shape', () => {
  const deps = buildDeps();
  const lead = post(fx.managementProposal(), deps);
  const body = post(fx.bookingRequest({ leadId: lead.leadId, slotStart: '2026-08-04T15:00:00.000Z' }), deps);

  assert.equal(body.ok, true);
  // A final status, never 'pending'. See booking.test.js.
  assert.equal(body.bookingStatus, 'confirmed');
  assert.equal(body.bookingRequestId, fx.BOOKING_UUID);
});

test('a refused booking still reports its final status', () => {
  // The client can say "that slot is taken" rather than a generic failure.
  const deps = buildDeps({ config: { calendarId: '' } });
  const lead = post(fx.managementProposal(), deps);
  const body = post(fx.bookingRequest({ leadId: lead.leadId, slotStart: '2026-08-04T15:00:00.000Z' }), deps);

  assert.equal(body.ok, false);
  assert.equal(body.bookingStatus, 'not_configured');
  assert.notEqual(body.bookingStatus, 'confirmed');
});

/* ── Error shape ──────────────────────────────────────────────────────────── */

test('a validation failure returns a stable code and the offending field', () => {
  const body = post(fx.managementProposal({ payload: { property: { type: 'Multifamily' } } }));
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'DISPLAY_STRING_NOT_ACCEPTED');
  assert.equal(body.error.field, 'payload.property.type');
});

test('a malformed body does not reach the domain at all', () => {
  const deps = buildDeps();
  const body = ctx.handlePost('not json', { ok: true, deps });
  assert.equal(body.error.code, 'MALFORMED_BODY');
  assert.equal(deps.leads.store.rows.length, 0);
});

test('an empty body is refused rather than treated as an empty submission', () => {
  const body = ctx.handlePost('', { ok: true, deps: buildDeps() });
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'MALFORMED_BODY');
});

test('an unwired deployment says so instead of blaming the request', () => {
  const body = ctx.handlePost(JSON.stringify(fx.managementProposal()), {
    ok: false,
    code: 'SERVICE_NOT_CONFIGURED',
  });
  assert.equal(body.error.code, 'SERVICE_NOT_CONFIGURED');
});

test('a deployment with no sheet configured refuses intake', () => {
  const deps = buildDeps({ config: { sheetId: '' } });
  const body = post(fx.managementProposal(), deps);
  assert.equal(body.error.code, 'SERVICE_NOT_CONFIGURED');
});

test('lock contention is reported as retryable, not as an internal error', () => {
  const deps = buildDeps();
  deps.lock.contended = true;
  const body = post(fx.managementProposal(), deps);
  assert.equal(body.error.code, 'BUSY_TRY_AGAIN');
});

/* ── Leakage ──────────────────────────────────────────────────────────────── */

test('an internal exception never leaks its message, stack, or values', () => {
  const deps = buildDeps();
  deps.leads.insertLead = () => {
    throw new Error(
      'Sheet 1AbCdEfGhIjK_secretSheetId row 42 rejected for zach@axispoint.llc',
    );
  };

  const body = post(fx.managementProposal(), deps);
  const serialized = JSON.stringify(body);

  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(serialized.indexOf('1AbCdEfGhIjK'), -1);
  assert.equal(serialized.indexOf('axispoint.llc'), -1);
  assert.equal(serialized.indexOf('row 42'), -1);
  assert.equal(serialized.indexOf('stack'), -1);
});

test('the response never echoes back what the visitor typed', () => {
  // An endpoint that reflects input is a stored-XSS and phishing surface for whatever
  // renders the response.
  const deps = buildDeps();
  const body = post(fx.managementProposal(), deps);
  const serialized = JSON.stringify(body);

  assert.equal(serialized.indexOf('Dana Whitfield'), -1);
  assert.equal(serialized.indexOf('dana@whitfieldholdings.test'), -1);
  assert.equal(serialized.indexOf('Whitfield Holdings'), -1);
});

test('a failure is logged with a code only, never with the error text', () => {
  const deps = buildDeps();
  deps.leads.insertLead = () => {
    throw new Error('contains zach@axispoint.llc and a sheet id');
  };
  post(fx.managementProposal(), deps);

  const entry = deps.log.entries.find((e) => e.event === 'submission_failed');
  assert.ok(entry);
  assert.equal(entry.detail, 'Error');
});

test('a logging failure does not turn a good submission into a failed one', () => {
  // The log is a diagnostic. Failing a stored submission because a diagnostic write
  // threw would tell the visitor their inquiry was lost when it was not.
  const deps = buildDeps();
  deps.log.append = () => {
    throw new Error('log tab missing');
  };
  const body = post(fx.managementProposal(), deps);

  assert.equal(body.ok, true);
  assert.equal(deps.leads.store.rows.length, 1);
});

/* ── Every rejection path is shaped ───────────────────────────────────────── */

test('every rejection returns ok:false with a string code and no extra keys', () => {
  const cases = [
    ['not json', 'MALFORMED_BODY'],
    [JSON.stringify({ schemaVersion: 9 }), 'UNSUPPORTED_SCHEMA_VERSION'],
    [JSON.stringify({ schemaVersion: 1, submissionKind: 'nope' }), 'UNKNOWN_ENUM'],
    [JSON.stringify(fx.managementProposal({ submissionId: 'x' })), 'INVALID_UUID'],
    [JSON.stringify(fx.contactExchange({ payload: { email: undefined, phone: undefined } })), 'EMAIL_OR_PHONE_REQUIRED'],
  ];

  cases.forEach(([raw, expected]) => {
    const body = ctx.handlePost(raw, { ok: true, deps: buildDeps() });
    assert.equal(body.ok, false);
    assert.equal(body.error.code, expected);
    assert.deepEqual(Object.keys(body).sort(), ['error', 'ok', 'schemaVersion']);
  });
});
