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
    'bookingEligible',
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

/* ── Booking eligibility crosses the HTTP boundary ────────────────────────── */

/*
 * `bookingEligible` is computed once at intake by `isBookablePathway` and stored on the
 * Lead. Until this correction it was returned by the domain and then DROPPED by
 * `successBody`, so a frontend had no way to learn it except by re-deriving the policy
 * itself, which is the competing definition Pass 9B deleted `BOOKABLE_PATHWAYS` to
 * prevent. These tests pin it at the boundary that actually reaches a browser.
 */

test('a Management Proposal is reported bookable', () => {
  const body = post(fx.managementProposal(), buildDeps());
  assert.equal(body.ok, true);
  assert.equal(body.bookingEligible, true);
});

test('every Management Proposal scope is reported bookable', () => {
  // PM, PM plus AM, and undecided. The last one matters: the visitor is asking about
  // management and has simply not chosen a scope, so refusing the call would refuse the
  // conversation that resolves it.
  const scopes = [
    ['pm', 'property_management'],
    ['pm_plus_am', 'property_management_plus_asset_management'],
    ['undecided', 'not_sure'],
  ];

  scopes.forEach(([serviceScope, involvement]) => {
    const body = post(
      fx.managementProposal({ payload: { serviceScope, situation: { involvement } } }),
      buildDeps(),
    );
    assert.equal(body.ok, true, `${serviceScope} should be accepted`);
    assert.equal(body.bookingEligible, true, `${serviceScope} should be bookable`);
  });
});

test('Investor Services is reported not bookable', () => {
  const body = post(fx.investorServices(), buildDeps());
  assert.equal(body.ok, true);
  assert.equal(body.bookingEligible, false);
});

test('General Inquiry is reported not bookable', () => {
  const body = post(fx.generalInquiry(), buildDeps());
  assert.equal(body.ok, true);
  assert.equal(body.bookingEligible, false);
});

test('a QR Contact Exchange is reported not bookable', () => {
  // It produces no Lead at all, so there is nothing to book against.
  const body = post(fx.contactExchange(), buildDeps());
  assert.equal(body.ok, true);
  assert.equal(body.leadId, null);
  assert.equal(body.bookingEligible, false);
});

test('a replay reports the same eligibility as the first response', () => {
  // A retry must never tell the visitor something different from what they were told the
  // first time, in either direction.
  const bookable = buildDeps();
  const first = post(fx.managementProposal(), bookable);
  const second = post(fx.managementProposal(), bookable);

  assert.equal(second.replay, true);
  assert.equal(second.bookingEligible, first.bookingEligible);
  assert.equal(second.bookingEligible, true);

  const notBookable = buildDeps();
  post(fx.investorServices(), notBookable);
  const replayed = post(fx.investorServices(), notBookable);

  assert.equal(replayed.replay, true);
  assert.equal(replayed.bookingEligible, false);
});

test('the value is always a strict boolean, never a string and never absent', () => {
  // A frontend branching on `=== true` must not also have to handle 'TRUE', undefined, or
  // a missing key. The Sheet round-trips booleans as strings, so this is a real risk.
  const cases = [fx.managementProposal(), fx.investorServices(), fx.generalInquiry(), fx.contactExchange()];

  cases.forEach((envelope) => {
    const deps = buildDeps();
    const fresh = post(envelope, deps);
    const replay = post(envelope, deps);

    [fresh, replay].forEach((body) => {
      assert.equal(typeof body.bookingEligible, 'boolean', 'must be a boolean');
      assert.ok('bookingEligible' in body, 'must always be present');
      assert.notEqual(body.bookingEligible, 'TRUE');
      assert.notEqual(body.bookingEligible, 'FALSE');
    });
  });
});

test('a replay reads eligibility back from the stored Lead, not from a fresh guess', () => {
  // The stored snapshot is what the visitor was told. If somebody edits that cell, the
  // replay reports the stored value; the booking COMMAND is what re-evaluates the rule
  // and refuses. See booking.test.js.
  const deps = buildDeps();
  const first = post(fx.managementProposal(), deps);
  deps.leads.updateLeadFields(first.leadId, { bookingEligible: false });

  assert.equal(post(fx.managementProposal(), deps).bookingEligible, false);
});

test('eligibility is not computed at the transport boundary', () => {
  // Entry.js must forward, never derive. If it derived, blanking the stored value would
  // not change the replay response.
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'src', 'entrypoints', 'Entry.js'),
    'utf8',
  );
  // Matched as a CALL, not as a word: the comment above the forward legitimately names
  // the policy to explain why it is not invoked here.
  assert.equal(/isBookablePathway\s*\(/.test(source), false, 'Entry.js must not call the policy');
  assert.equal(/['"]management_proposal['"]/.test(source), false, 'Entry.js must not name a pathway');
  assert.match(source, /result\.bookingEligible/, 'it forwards the domain result');
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
