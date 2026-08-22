'use strict';

/*
 * The booking command.
 *
 * THE CORRECTION THIS FILE EXISTS TO PIN: booking never falsely confirms.
 *
 * Pass 8 queued the calendar write and returned `pending` while the visitor's screen said
 * their call was booked. The failure mode is somebody sitting by a phone at 10:30 for a
 * meeting that does not exist. The Calendar port is now called synchronously inside the
 * command, and `confirmed` is reachable from exactly one place: a successful createEvent.
 *
 * The other guarded failures are a calendar outage taking a stored Lead down with it, a
 * duplicate hold, and a booking offered on a pathway that never asked for one.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps, fakeCalendarService } = require('./helpers/fakes.js');

const ctx = load();

/** Tuesday 2026-08-04, 10:00 CDT. Inside the window, well after the lead time. */
const GOOD_SLOT = '2026-08-04T15:00:00.000Z';

function seedLead(deps, envelope) {
  const parsed = ctx.parseEnvelope(JSON.stringify(envelope || fx.managementProposal()));
  assert.equal(parsed.ok, true, `fixture should be valid: ${parsed.code || ''}`);
  return ctx.processSubmission(parsed.value, deps);
}

function book(deps, leadId, patch = {}) {
  const parsed = ctx.parseEnvelope(
    JSON.stringify(fx.bookingRequest({ leadId, slotStart: GOOD_SLOT, ...patch })),
  );
  assert.equal(parsed.ok, true, `booking fixture should be valid: ${parsed.code || ''}`);
  return ctx.executeBookingCommand(parsed.value, deps);
}

/* ── Never falsely confirms ───────────────────────────────────────────────── */

test('confirmed is returned only after the calendar created the event', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.status, 'confirmed');
  assert.equal(result.ok, true);
  assert.equal(deps.calendar.created.length, 1, 'the event must exist before confirming');
  assert.equal(deps.leads.findLeadById(lead.leadId).calendarEventId, 'evt-1');
});

test('a calendar failure returns failed, never confirmed', () => {
  const deps = buildDeps({ calendar: fakeCalendarService({ createFails: true }) });
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.status, 'failed');
  assert.equal(result.ok, false);
  assert.notEqual(result.status, 'confirmed');
  assert.equal(deps.leads.findLeadById(lead.leadId).calendarStatus, 'failed');
});

test('no configured calendar returns not_configured, never confirmed', () => {
  const deps = buildDeps({ config: { calendarId: '' } });
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.status, 'not_configured');
  assert.equal(result.ok, false);
  assert.equal(deps.calendar.created.length, 0);
  // The visitor's stated intent is still recorded for a partner to confirm by hand.
  assert.equal(deps.leads.findLeadById(lead.leadId).activeBookingRequestId, fx.BOOKING_UUID);
});

test('an unreadable calendar is not treated as an available calendar', () => {
  // Reading a failed availability check as "nothing is booked" is how a partner ends up
  // double-booked.
  const deps = buildDeps();
  deps.calendar.listBusy = () => ({ ok: false, reason: 'calendar_error:Test', busy: [] });
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.status, 'failed');
  assert.equal(deps.calendar.created.length, 0);
});

test('a busy slot returns unavailable and creates nothing', () => {
  const calendar = fakeCalendarService({
    busy: [{ startIso: '2026-08-04T15:15:00.000Z', endIso: '2026-08-04T16:00:00.000Z' }],
  });
  const deps = buildDeps({ calendar });
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.status, 'unavailable');
  assert.equal(calendar.created.length, 0);
});

test('a dry_run booking (placeholder eventId) correctly reaches confirmed status and queues the email', () => {
  // In dry_run mode GoogleServices.createEvent returns { ok: true, status: 'dry_run', eventId: 'dry_run_evt' }.
  // 'dry_run_evt' is a clearly-fake non-empty placeholder so the success check (!created.eventId)
  // passes without any special-casing in Booking.js. The Lead must reach calendarStatus: 'booked'
  // and the confirmation email work item must be queued.
  const dryRunCalendar = {
    ...fakeCalendarService(),
    createEvent(spec) {
      this.created.push({ ...spec });
      return { ok: true, status: 'dry_run', eventId: 'dry_run_evt' };
    },
  };
  const deps = buildDeps({ calendar: dryRunCalendar });
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.eventId, 'dry_run_evt');
  const stored = deps.leads.findLeadById(lead.leadId);
  assert.equal(stored.calendarStatus, 'booked');
  assert.equal(stored.calendarEventId, 'dry_run_evt');
  assert.equal(deps.work.items.filter((i) => i.kind === 'send_booking_confirmation').length, 1);
});

test('nothing is queued that could confirm later without the calendar', () => {
  // The only queued item on the happy path is the confirmation EMAIL, and its handler
  // re-checks the stored calendar state before sending.
  const deps = buildDeps({ calendar: fakeCalendarService({ createFails: true }) });
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  assert.equal(deps.work.items.filter((i) => i.kind === 'send_booking_confirmation').length, 0);
});

/* ── The Lead is never harmed ─────────────────────────────────────────────── */

test('a calendar failure does not delete or alter the stored Lead', () => {
  const deps = buildDeps({ calendar: fakeCalendarService({ createFails: true }) });
  const lead = seedLead(deps);
  const before = { ...deps.leads.findLeadById(lead.leadId) };

  book(deps, lead.leadId);
  const after = deps.leads.findLeadById(lead.leadId);

  assert.equal(deps.leads.store.rows.length, 1);
  assert.equal(after.fullName, before.fullName);
  assert.equal(after.email, before.email);
  assert.equal(after.propertyLocation, before.propertyLocation);
  assert.equal(after.slaDueAt, before.slaDueAt);
});

/* ── Separation from submission ───────────────────────────────────────────── */

test('a submission stores nothing calendar-related on its own', () => {
  const deps = buildDeps();
  const result = seedLead(deps);
  const lead = deps.leads.findLeadById(result.leadId);

  assert.equal(lead.calendarStatus, 'none');
  assert.equal(lead.activeBookingRequestId, '');
  assert.equal(deps.calendar.created.length, 0);
});

test('the lead must already exist', () => {
  const deps = buildDeps();
  const result = book(deps, '00000000-0000-4000-8000-000000009999');
  assert.equal(result.status, 'rejected');
  assert.equal(result.code, 'LEAD_NOT_FOUND');
});

/* ── Management Proposal only ─────────────────────────────────────────────── */

test('booking is refused on the investor services pathway', () => {
  // A question is not an engagement. Offering a slot would put a partner in a meeting
  // the visitor never asked for.
  const deps = buildDeps();
  const lead = seedLead(deps, fx.investorServices());
  const result = book(deps, lead.leadId);

  assert.equal(result.status, 'rejected');
  assert.equal(result.code, 'PATHWAY_NOT_BOOKABLE');
  assert.equal(deps.calendar.created.length, 0);
});

test('booking is refused on the general inquiry pathway', () => {
  const deps = buildDeps();
  const lead = seedLead(deps, fx.generalInquiry());
  const result = book(deps, lead.leadId);
  assert.equal(result.code, 'PATHWAY_NOT_BOOKABLE');
});

test('booking is refused for a contact exchange, which has no Lead to book against', () => {
  // The strongest form of the rule. A QR exchange produces no Lead at all, so a booking
  // request naming it cannot resolve to one.
  const deps = buildDeps();
  const exchange = seedLead(deps, fx.contactExchange());

  assert.equal(exchange.leadId, null);
  assert.equal(deps.leads.store.rows.length, 0);

  const result = book(deps, '00000000-0000-4000-8000-000000007777');
  assert.equal(result.status, 'rejected');
  assert.equal(result.code, 'LEAD_NOT_FOUND');
});

/* ── Duplicate protection ─────────────────────────────────────────────────── */

test('the same bookingRequestId replays the recorded outcome', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  const second = book(deps, lead.leadId);

  assert.equal(second.replay, true);
  assert.equal(second.status, 'confirmed');
  assert.equal(deps.calendar.created.length, 1, 'no second hold');
});

test('a replay of a failed booking carries a code in the wire response', () => {
  // A failed booking sets activeBookingRequestId on the Lead. The same bookingRequestId
  // on a retry replays the failure. The wire layer calls errorBody(booking.code), so the
  // replay return must include a code — an absent code becomes undefined, which JSON drops,
  // and the client receives an error object without a code field.
  const deps = buildDeps({ calendar: fakeCalendarService({ createFails: true }) });
  const lead = seedLead(deps);
  book(deps, lead.leadId);

  const replay = book(deps, lead.leadId);
  assert.equal(replay.status, 'failed');
  assert.equal(replay.replay, true);
  assert.equal(typeof replay.code, 'string');
  assert.ok(replay.code.length > 0, 'code must be non-empty on a failed replay');
});

test('a different booking while one is confirmed is refused', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  const second = book(deps, lead.leadId, {
    bookingRequestId: '22223333-4444-4555-8666-777788889999',
    slotStart: '2026-08-05T15:00:00.000Z',
  });

  assert.equal(second.status, 'rejected');
  assert.equal(second.code, 'BOOKING_ALREADY_ACTIVE');
  assert.equal(deps.calendar.created.length, 1);
});

test('after a failed attempt a fresh booking request is accepted', () => {
  // A failed hold must not lock the lead out of ever booking again.
  const calendar = fakeCalendarService({ createFails: true });
  const deps = buildDeps({ calendar });
  const lead = seedLead(deps);
  book(deps, lead.leadId);

  calendar.createFails = false;
  const retry = book(deps, lead.leadId, {
    bookingRequestId: '33334444-5555-4666-8777-888899990000',
    slotStart: '2026-08-05T15:00:00.000Z',
  });
  assert.equal(retry.status, 'confirmed');
});

/* ── Slot rules ───────────────────────────────────────────────────────────── */

test('a slot in the immediate future is unavailable', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  assert.equal(book(deps, lead.leadId, { slotStart: '2026-08-03T14:30:00.000Z' }).code, 'SLOT_TOO_SOON');
});

test('a slot months ahead is unavailable', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  assert.equal(book(deps, lead.leadId, { slotStart: '2027-08-04T15:00:00.000Z' }).code, 'SLOT_TOO_FAR_AHEAD');
});

test('a weekend slot is unavailable', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  assert.equal(book(deps, lead.leadId, { slotStart: '2026-08-08T15:00:00.000Z' }).code, 'SLOT_OUTSIDE_BUSINESS_HOURS');
});

test('a slot that starts inside hours but ends after closing is unavailable', () => {
  // 16:45 CDT plus 30 minutes runs past 17:00. Checking only the start would let this
  // through and book a meeting nobody is there for.
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, { slotStart: '2026-08-04T21:45:00.000Z', durationMinutes: 30 });
  assert.equal(result.code, 'SLOT_OUTSIDE_BUSINESS_HOURS');
});

test('a slot ending exactly at closing is allowed', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  const result = book(deps, lead.leadId, { slotStart: '2026-08-04T21:30:00.000Z', durationMinutes: 30 });
  assert.equal(result.status, 'confirmed');
});

/* ── The confirmation email ───────────────────────────────────────────────── */

test('a confirmed booking queues its confirmation email', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);
  assert.equal(deps.work.items.filter((i) => i.kind === 'send_booking_confirmation').length, 1);
});

test('the confirmation is not sent if the booking stopped being confirmed', () => {
  const deps = buildDeps();
  const lead = seedLead(deps);
  book(deps, lead.leadId);

  deps.leads.updateLeadFields(lead.leadId, { calendarStatus: 'failed' });
  const summary = ctx.runWorkerCycle(deps, ctx.defaultWorkHandlers());

  assert.equal(deps.templates.bookings.length, 0);
  assert.ok(summary.abandoned >= 1);
});

test('the confirmation template refuses to render an unconfirmed booking', () => {
  // The last line of defence: even handed the wrong status directly, it will not render.
  const rendered = ctx.renderBookingConfirmation(
    { fullName: 'Dana Whitfield', email: 'dana@example.test' },
    { status: 'pending', slotStart: GOOD_SLOT, durationMinutes: 30, mode: 'phone_call' },
    {},
  );
  assert.equal(rendered.ok, false);
  assert.equal(rendered.reason, 'booking_not_confirmed');
});
