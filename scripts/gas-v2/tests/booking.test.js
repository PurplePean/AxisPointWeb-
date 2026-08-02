'use strict';

/*
 * The booking command.
 *
 * WHAT THESE TESTS ARE FOR. Booking was moved OUT of the submission for a reason: an
 * inquiry must be storable while the calendar is down, and a calendar conflict must
 * never be able to reject an inquiry. The first assertions pin that separation.
 *
 * The rest guard the failures a visitor would experience directly: a double-submitted
 * booking creating two holds, a stale queued booking landing on the calendar after the
 * visitor changed their mind, and a slot outside business hours being accepted because
 * only its date was checked.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps, fakeCalendarService } = require('./helpers/fakes.js');

const ctx = load();

/** Tuesday 2026-08-04, 10:00 CDT. Well inside the window, well after the lead time. */
const GOOD_SLOT = '2026-08-04T15:00:00.000Z';

function seedLead(deps) {
  const parsed = ctx.parseEnvelope(JSON.stringify(fx.managementProposal()));
  assert.equal(parsed.ok, true);
  return ctx.processSubmission(parsed.value, deps);
}

function book(deps, leadId, patch = {}) {
  const parsed = ctx.parseEnvelope(
    JSON.stringify(fx.bookingRequest({ leadId, slotStart: GOOD_SLOT, ...patch })),
  );
  assert.equal(parsed.ok, true, `booking fixture should be valid: ${parsed.code || ''}`);
  return ctx.executeBookingCommand(parsed.value, deps);
}

/* ── Separation from submission ───────────────────────────────────────────── */

test('a submission stores nothing calendar-related on its own', () => {
  const deps = buildDeps();
  const result = seedLead(deps);
  const lead = deps.leads.findLeadById(result.leadId);

  assert.equal(lead.calendarStatus, 'none');
  assert.equal(lead.activeBookingRequestId, '');
  assert.equal(deps.calendar.created.length, 0);
});

test('a booking references an existing lead and is refused without one', () => {
  const deps = buildDeps();
  const result = book(deps, '00000000-0000-4000-8000-000000009999');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LEAD_NOT_FOUND');
});

/* ── The happy path ───────────────────────────────────────────────────────── */

test('a valid booking is accepted and queued, not written inline', () => {
  // The calendar write is deferred for the same reason email is: a calendar outage
  // should delay a meeting, not lose one.
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'pending');
  assert.equal(deps.calendar.created.length, 0);
  assert.ok(Array.from(deps.work.kinds()).indexOf('create_booking_event') !== -1);
});

test('the queued write puts the event on the calendar and records its id', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  ctx.runWorkerCycle(deps, ctx.defaultWorkHandlers());

  const stored = deps.leads.findLeadById(lead.leadId);
  assert.equal(stored.calendarStatus, 'booked');
  assert.equal(stored.calendarEventId, 'evt-1');
  assert.equal(deps.calendar.created.length, 1);
});

/* ── Duplicate protection ─────────────────────────────────────────────────── */

test('the same bookingRequestId replays instead of creating a second hold', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  const second = book(deps, lead.leadId);

  assert.equal(second.ok, true);
  assert.equal(second.replay, true);
  assert.equal(deps.work.items.filter((i) => i.kind === 'create_booking_event').length, 1);
});

test('a different booking while one is active is refused rather than silently stacked', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  const second = book(deps, lead.leadId, {
    bookingRequestId: '22223333-4444-4555-8666-777788889999',
    slotStart: '2026-08-05T15:00:00.000Z',
  });

  assert.equal(second.ok, false);
  assert.equal(second.code, 'BOOKING_ALREADY_ACTIVE');
});

test('a queued booking that was superseded does not land on the calendar', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);

  // Something else moved the active booking on before the queue ran.
  deps.leads.updateLeadFields(lead.leadId, {
    activeBookingRequestId: '99990000-1111-4222-8333-444455556666',
  });

  const summary = ctx.runWorkerCycle(deps, ctx.defaultWorkHandlers());
  assert.equal(summary.abandoned, 1);
  assert.equal(deps.calendar.created.length, 0);
});

/* ── Slot rules ───────────────────────────────────────────────────────────── */

test('a slot in the immediate future is refused', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, { slotStart: '2026-08-03T14:30:00.000Z' });
  assert.equal(result.code, 'SLOT_TOO_SOON');
});

test('a slot months ahead is refused', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, { slotStart: '2027-08-04T15:00:00.000Z' });
  assert.equal(result.code, 'SLOT_TOO_FAR_AHEAD');
});

test('a weekend slot is refused', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, { slotStart: '2026-08-08T15:00:00.000Z' });
  assert.equal(result.code, 'SLOT_OUTSIDE_BUSINESS_HOURS');
});

test('a slot before opening is refused', () => {
  // 07:00 CDT.
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, { slotStart: '2026-08-04T12:00:00.000Z' });
  assert.equal(result.code, 'SLOT_OUTSIDE_BUSINESS_HOURS');
});

test('a slot that starts inside hours but ends after closing is refused', () => {
  // 16:45 CDT plus 30 minutes runs past 17:00. Checking only the start would let this
  // through and book a meeting nobody is there for.
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, {
    slotStart: '2026-08-04T21:45:00.000Z',
    durationMinutes: 30,
  });
  assert.equal(result.code, 'SLOT_OUTSIDE_BUSINESS_HOURS');
});

test('a slot ending exactly at closing is allowed', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, {
    slotStart: '2026-08-04T21:30:00.000Z',
    durationMinutes: 30,
  });
  assert.equal(result.ok, true);
});

test('a slot the calendar says is busy is refused', () => {
  const calendar = fakeCalendarService({
    busy: [{ startIso: '2026-08-04T15:15:00.000Z', endIso: '2026-08-04T16:00:00.000Z' }],
  });
  const deps = buildDeps({ calendar });
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'SLOT_UNAVAILABLE');
});

/* ── Degradation ──────────────────────────────────────────────────────────── */

test('with no calendar configured the request is still recorded for a human', () => {
  // The visitor asked for a specific time. Recording it beats telling them booking is
  // unavailable and losing the intent.
  const deps = buildDeps({ config: { calendarId: '' } });
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'not_configured');
  const stored = deps.leads.findLeadById(lead.leadId);
  assert.equal(stored.activeBookingRequestId, fx.BOOKING_UUID);
});

test('a failed calendar write is recorded and left retryable', () => {
  const deps = buildDeps({ calendar: fakeCalendarService({ createFails: true }) });
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  ctx.runWorkerCycle(deps, ctx.defaultWorkHandlers());

  const stored = deps.leads.findLeadById(lead.leadId);
  assert.equal(stored.calendarStatus, 'failed');
});

test('after a failed write a fresh booking request is accepted', () => {
  // A failed hold must not lock the lead out of ever booking again.
  const deps = buildDeps({ calendar: fakeCalendarService({ createFails: true }) });
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  ctx.runWorkerCycle(deps, ctx.defaultWorkHandlers());

  const retry = book(deps, lead.leadId, {
    bookingRequestId: '33334444-5555-4666-8777-888899990000',
    slotStart: '2026-08-05T15:00:00.000Z',
  });
  assert.equal(retry.ok, true);
});
