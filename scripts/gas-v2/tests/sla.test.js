'use strict';

/*
 * SLA arithmetic.
 *
 * WHAT THESE TESTS ARE FOR. Wall-clock deadlines mark almost every evening and
 * weekend lead breached before any human could have answered, which makes the field
 * meaningless and then ignored. The tests below pin the business-hours behaviour at
 * exactly the boundaries where a naive implementation gets it wrong: after hours,
 * Friday evening, mid-window, and across a daylight saving change.
 *
 * Offsets are supplied explicitly, so nothing here depends on the machine's time zone.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const { fixedOffsetResolver } = require('./helpers/fakes.js');

const ctx = load();

/** America/Chicago: CDT is -05:00, CST is -06:00. */
const CDT = fixedOffsetResolver(-300);
const CST = fixedOffsetResolver(-360);

function due(iso, hours, resolver) {
  return ctx.addBusinessHours(new Date(iso), hours, resolver || CDT).toISOString();
}

test('mid-morning start stays inside the same day', () => {
  // Monday 2026-08-03, 10:00 CDT = 15:00Z. Plus 4 business hours = 14:00 CDT.
  assert.equal(due('2026-08-03T15:00:00.000Z', 4), '2026-08-03T19:00:00.000Z');
});

test('an after-hours arrival starts the clock at the next open', () => {
  // Monday 21:00 CDT is outside the window. The clock starts Tuesday 09:00 CDT.
  assert.equal(due('2026-08-04T02:00:00.000Z', 4), '2026-08-04T18:00:00.000Z');
});

test('an early-morning arrival waits for opening rather than counting from midnight', () => {
  // Tuesday 06:00 CDT. Four hours from 09:00 CDT is 13:00 CDT.
  assert.equal(due('2026-08-04T11:00:00.000Z', 4), '2026-08-04T18:00:00.000Z');
});

test('work spills into the next business day rather than past closing', () => {
  // Monday 15:00 CDT with a 4 hour target: 2 hours left today, 2 more Tuesday morning.
  assert.equal(due('2026-08-03T20:00:00.000Z', 4), '2026-08-04T16:00:00.000Z');
});

test('a Friday evening inquiry is due Monday, not Saturday', () => {
  // This is the case a wall-clock deadline gets catastrophically wrong.
  // Friday 2026-08-07 19:00 CDT -> clock starts Monday 2026-08-10 09:00 CDT.
  assert.equal(due('2026-08-08T00:00:00.000Z', 4), '2026-08-10T18:00:00.000Z');
});

test('a Saturday arrival is due Monday', () => {
  assert.equal(due('2026-08-08T16:00:00.000Z', 4), '2026-08-10T18:00:00.000Z');
});

test('a long target walks across several business days', () => {
  // 24 business hours from Monday 09:00 CDT is three full 8 hour days, landing exactly
  // at Wednesday close (17:00 CDT). A deadline sitting on the closing bell is a real
  // deadline, not one that should roll to Thursday morning.
  assert.equal(due('2026-08-03T14:00:00.000Z', 24), '2026-08-05T22:00:00.000Z');
});

test('daylight saving is taken from the resolver, not assumed', () => {
  // Same local wall time, winter offset. 10:00 CST = 16:00Z, plus 4 hours = 20:00Z.
  assert.equal(due('2026-12-07T16:00:00.000Z', 4, CST), '2026-12-07T20:00:00.000Z');
});

/* ── Which submissions carry a commitment ─────────────────────────────────── */

test('each pathway gets its own target', () => {
  const at = new Date('2026-08-03T14:00:00.000Z');
  const proposal = ctx.computeSlaDueAt('service_inquiry', 'management_proposal', at, CDT);
  const investor = ctx.computeSlaDueAt('service_inquiry', 'investor_services', at, CDT);
  const general = ctx.computeSlaDueAt('service_inquiry', 'general_inquiry', at, CDT);

  assert.ok(proposal.getTime() < investor.getTime());
  assert.ok(investor.getTime() < general.getTime());
});

test('a contact exchange has no due time at all', () => {
  // It is a record of a handshake, not a request for a reply. A fake distant deadline
  // would put it in the same overdue reports as a real inquiry.
  const at = new Date('2026-08-03T14:00:00.000Z');
  assert.equal(ctx.computeSlaDueAt('contact_exchange', null, at, CDT), null);
});

/* ── State ────────────────────────────────────────────────────────────────── */

test('an automated acknowledgement does not satisfy the SLA', () => {
  // Only firstHumanContactAt counts. An auto-reply proves the machine worked.
  const state = ctx.slaState('2026-08-03T19:00:00.000Z', '', new Date('2026-08-03T20:00:00.000Z'));
  assert.equal(state, 'breached');
});

test('human contact before the due time is met', () => {
  const state = ctx.slaState(
    '2026-08-03T19:00:00.000Z',
    '2026-08-03T17:30:00.000Z',
    new Date('2026-08-03T20:00:00.000Z'),
  );
  assert.equal(state, 'met');
});

test('human contact after the due time is missed, and stays missed', () => {
  const state = ctx.slaState(
    '2026-08-03T19:00:00.000Z',
    '2026-08-04T15:00:00.000Z',
    new Date('2026-08-10T15:00:00.000Z'),
  );
  assert.equal(state, 'missed');
});

test('an open lead before its due time is pending, not breached', () => {
  const state = ctx.slaState('2026-08-03T19:00:00.000Z', '', new Date('2026-08-03T16:00:00.000Z'));
  assert.equal(state, 'pending');
});

test('no due time means not applicable rather than breached', () => {
  assert.equal(ctx.slaState('', '', new Date('2026-08-03T16:00:00.000Z')), 'not_applicable');
  assert.equal(ctx.slaState(null, '', new Date('2026-08-03T16:00:00.000Z')), 'not_applicable');
});
