'use strict';

/*
 * SLA arithmetic.
 *
 * THE POLICY: every website service inquiry is due at 5:00 PM local on the NEXT business
 * day. One number, every pathway. Pass 8's 4 / 8 / 24 business-hour policy is gone, and
 * the first test below exists specifically to stop it coming back: three clocks meant
 * nobody could state a deadline without first checking which pathway they were looking
 * at, so in practice nobody checked at all.
 *
 * The tests pin the boundaries a naive implementation gets wrong: a submission that
 * arrives first thing in the morning, one that arrives at 4:59 PM, a Friday, a weekend,
 * and a daylight saving change.
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

function due(iso, resolver) {
  const d = ctx.computeSlaDueAt('service_inquiry', 'management_proposal', new Date(iso), resolver || CDT);
  return d === null ? null : d.toISOString();
}

/* ── One policy ───────────────────────────────────────────────────────────── */

test('every pathway gets the same due time', () => {
  // The whole point of the correction. If this ever fails, three clocks are back.
  const at = new Date('2026-08-03T14:00:00.000Z');
  const proposal = ctx.computeSlaDueAt('service_inquiry', 'management_proposal', at, CDT);
  const investor = ctx.computeSlaDueAt('service_inquiry', 'investor_services', at, CDT);
  const general = ctx.computeSlaDueAt('service_inquiry', 'general_inquiry', at, CDT);

  assert.equal(proposal.toISOString(), investor.toISOString());
  assert.equal(investor.toISOString(), general.toISOString());
});

test('the pathway-specific hour table is gone from the code', () => {
  assert.equal(ctx.SLA_BUSINESS_HOURS, undefined);
  assert.equal(ctx.SLA_DUE_HOUR, 17);
});

/* ── Next business day at 5:00 PM ─────────────────────────────────────────── */

test('a Monday morning inquiry is due Tuesday at 5:00 PM', () => {
  // Monday 2026-08-03, 09:30 CDT = 14:30Z. Due Tuesday 17:00 CDT = 22:00Z.
  assert.equal(due('2026-08-03T14:30:00.000Z'), '2026-08-04T22:00:00.000Z');
});

test('an inquiry at one minute to five is still due the NEXT day, not today', () => {
  // The commitment is a full working day, not the remainder of this one.
  assert.equal(due('2026-08-03T21:59:00.000Z'), '2026-08-04T22:00:00.000Z');
});

test('a late evening inquiry is due the next business day, not two days out', () => {
  // Monday 23:30 CDT is Tuesday 04:30Z. The local day is still Monday.
  assert.equal(due('2026-08-04T04:30:00.000Z'), '2026-08-04T22:00:00.000Z');
});

test('a Friday inquiry is due Monday, not Saturday', () => {
  // Friday 2026-08-07 10:00 CDT. Saturday and Sunday are skipped.
  assert.equal(due('2026-08-07T15:00:00.000Z'), '2026-08-10T22:00:00.000Z');
});

test('a Saturday inquiry is due Monday', () => {
  assert.equal(due('2026-08-08T16:00:00.000Z'), '2026-08-10T22:00:00.000Z');
});

test('a Sunday inquiry is due Monday', () => {
  assert.equal(due('2026-08-09T16:00:00.000Z'), '2026-08-10T22:00:00.000Z');
});

test('daylight saving is taken from the resolver, not assumed', () => {
  // Monday 2026-12-07 10:00 CST = 16:00Z. Due Tuesday 17:00 CST = 23:00Z.
  assert.equal(due('2026-12-07T16:00:00.000Z', CST), '2026-12-08T23:00:00.000Z');
});

/* ── Which submissions carry a commitment ─────────────────────────────────── */

test('a contact exchange has no due time at all', () => {
  // It is a record of a handshake, not a request for a reply. A fake distant deadline
  // would put it in the same overdue reports as a real inquiry.
  const at = new Date('2026-08-03T14:00:00.000Z');
  assert.equal(ctx.computeSlaDueAt('contact_exchange', null, at, CDT), null);
});

/* ── State ────────────────────────────────────────────────────────────────── */

test('an automated acknowledgement does not satisfy the SLA', () => {
  // Only firstHumanContactAt counts. An auto-reply proves the machine worked.
  const state = ctx.slaState('2026-08-04T22:00:00.000Z', '', new Date('2026-08-05T15:00:00.000Z'));
  assert.equal(state, 'breached');
});

test('human contact before the due time is met', () => {
  const state = ctx.slaState(
    '2026-08-04T22:00:00.000Z',
    '2026-08-04T17:30:00.000Z',
    new Date('2026-08-05T15:00:00.000Z'),
  );
  assert.equal(state, 'met');
});

test('human contact after the due time is missed, and stays missed', () => {
  const state = ctx.slaState(
    '2026-08-04T22:00:00.000Z',
    '2026-08-06T15:00:00.000Z',
    new Date('2026-08-20T15:00:00.000Z'),
  );
  assert.equal(state, 'missed');
});

test('an open lead before its due time is pending, not breached', () => {
  const state = ctx.slaState('2026-08-04T22:00:00.000Z', '', new Date('2026-08-04T16:00:00.000Z'));
  assert.equal(state, 'pending');
});

test('no due time means not applicable rather than breached', () => {
  assert.equal(ctx.slaState('', '', new Date('2026-08-03T16:00:00.000Z')), 'not_applicable');
  assert.equal(ctx.slaState(null, '', new Date('2026-08-03T16:00:00.000Z')), 'not_applicable');
});
