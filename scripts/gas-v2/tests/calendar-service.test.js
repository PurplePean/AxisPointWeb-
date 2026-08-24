'use strict';

/*
 * GoogleServices.makeCalendarService adapter — attendee guarantee.
 *
 * Partners must receive a calendar invite when a booking is made, so they are added as
 * attendees and sendUpdates is 'all'. The visitor is deliberately excluded from attendees
 * because they already receive AxisPoint's own confirmation email; an attendee invite on
 * top would produce a duplicate. These tests pin both sides of that boundary.
 *
 * We load the full src context with a stub Calendar.Events.insert so we can inspect the
 * exact resource and options passed to the API — no mocking framework needed, just the
 * same VM loader the rest of the test suite uses.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

function makeCtxWithCalendarStub(overrides = {}) {
  let capturedResource = null;
  let capturedCalendarId = null;
  let capturedOptions = null;

  const ctx = load({
    Calendar: {
      Events: {
        insert(resource, calendarId, options) {
          capturedResource = resource;
          capturedCalendarId = calendarId;
          capturedOptions = options;
          return { id: 'test-evt-id', conferenceData: overrides.conferenceData || null, hangoutLink: null };
        },
      },
    },
    CalendarApp: { getCalendarById: () => ({ getEvents: () => [] }) },
    Utilities: { newBlob: () => ({}) },
    MailApp: { sendEmail: () => {} },
    SpreadsheetApp: {},
    LockService: {},
    PropertiesService: {},
  });

  return {
    ctx,
    captured() {
      return { resource: capturedResource, calendarId: capturedCalendarId, options: capturedOptions };
    },
  };
}

const PARTNER_EMAILS = ['partner1@example.test', 'partner2@example.test'];
const LIVE_CONFIG = { calendarId: 'test-cal-id', runMode: 'live', partnerNotifyTo: PARTNER_EMAILS };
const BASE_SPEC = {
  startIso: '2026-08-04T15:00:00.000Z',
  endIso: '2026-08-04T15:30:00.000Z',
  leadId: 'lead-test-001',
  attendeeName: 'Dana Whitfield',
  attendeeEmail: 'dana@example.test',
};

/* ── Partner attendees ────────────────────────────────────────────────────── */

test('Calendar.Events.insert receives partner emails as attendees for phone_call', () => {
  const { ctx, captured } = makeCtxWithCalendarStub();
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  service.createEvent({ ...BASE_SPEC, mode: 'phone_call' });

  const { resource } = captured();
  assert.ok(resource, 'Calendar.Events.insert must have been called');
  assert.ok(Array.isArray(resource.attendees), 'attendees must be an array');
  const emails = resource.attendees.map(a => a.email);
  assert.ok(emails.includes('partner1@example.test'), 'partner1 must be an attendee');
  assert.ok(emails.includes('partner2@example.test'), 'partner2 must be an attendee');
});

test('Calendar.Events.insert receives partner emails as attendees for video_meeting', () => {
  const { ctx, captured } = makeCtxWithCalendarStub({
    conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/x' }] },
  });
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  service.createEvent({ ...BASE_SPEC, mode: 'video_meeting' });

  const { resource } = captured();
  assert.ok(resource, 'Calendar.Events.insert must have been called');
  assert.ok(Array.isArray(resource.attendees), 'attendees must be an array');
  const emails = resource.attendees.map(a => a.email);
  assert.ok(emails.includes('partner1@example.test'), 'partner1 must be an attendee');
  assert.ok(emails.includes('partner2@example.test'), 'partner2 must be an attendee');
});

test('visitor email is never included in attendees', () => {
  const { ctx, captured } = makeCtxWithCalendarStub();
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  service.createEvent({ ...BASE_SPEC, mode: 'phone_call' });

  const { resource } = captured();
  const emails = (resource.attendees || []).map(a => a.email);
  assert.ok(!emails.includes(BASE_SPEC.attendeeEmail), 'visitor must never be an attendee');
});

/* ── sendUpdates is 'all' to notify partner attendees ────────────────────── */

test('sendUpdates is "all" in the Calendar API options', () => {
  // 'all' notifies attendees (the partners). The visitor is not an attendee,
  // so they receive no Google invite — only AxisPoint's own confirmation email.
  const { ctx, captured } = makeCtxWithCalendarStub();
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  service.createEvent({ ...BASE_SPEC, mode: 'phone_call' });

  const { options } = captured();
  assert.ok(options, 'options must be passed to Calendar.Events.insert');
  assert.equal(options.sendUpdates, 'all', 'sendUpdates must be "all" so partners receive a calendar invite');
});

test('sendUpdates is "all" for a video_meeting with a Meet link', () => {
  const { ctx, captured } = makeCtxWithCalendarStub({
    conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/y' }] },
  });
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  service.createEvent({ ...BASE_SPEC, mode: 'video_meeting' });

  const { options } = captured();
  assert.equal(options.sendUpdates, 'all');
});

/* ── conferenceDataVersion is set for video_meeting ──────────────────────── */

test('conferenceDataVersion: 1 is set in options to enable Meet link generation', () => {
  const { ctx, captured } = makeCtxWithCalendarStub();
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  service.createEvent({ ...BASE_SPEC, mode: 'video_meeting' });

  const { options } = captured();
  assert.equal(options.conferenceDataVersion, 1);
});

/* ── Meet link extraction ─────────────────────────────────────────────────── */

test('the Meet link is extracted from the video entryPoint in conferenceData', () => {
  const { ctx } = makeCtxWithCalendarStub({
    conferenceData: {
      entryPoints: [
        { entryPointType: 'phone', uri: 'tel:+1-555-000-0001' },
        { entryPointType: 'video', uri: 'https://meet.google.com/abc-123' },
      ],
    },
  });
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  const result = service.createEvent({ ...BASE_SPEC, mode: 'video_meeting' });

  assert.equal(result.ok, true);
  assert.equal(result.meetLink, 'https://meet.google.com/abc-123');
});

test('hangoutLink is used as fallback when no video entryPoint exists', () => {
  const ctx2 = load({
    Calendar: {
      Events: {
        insert() {
          return { id: 'evt-2', conferenceData: { entryPoints: [] }, hangoutLink: 'https://meet.google.com/fallback' };
        },
      },
    },
    CalendarApp: { getCalendarById: () => ({ getEvents: () => [] }) },
    Utilities: {}, MailApp: {}, SpreadsheetApp: {}, LockService: {}, PropertiesService: {},
  });
  const service = ctx2.makeCalendarService(LIVE_CONFIG);
  const result = service.createEvent({ ...BASE_SPEC, mode: 'video_meeting' });

  assert.equal(result.meetLink, 'https://meet.google.com/fallback');
});

test('phone_call createEvent returns null meetLink regardless of conferenceData', () => {
  const { ctx } = makeCtxWithCalendarStub({
    conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/ignored' }] },
  });
  const service = ctx.makeCalendarService(LIVE_CONFIG);
  const result = service.createEvent({ ...BASE_SPEC, mode: 'phone_call' });

  assert.equal(result.ok, true);
  assert.equal(result.meetLink, null, 'phone_call must never return a meetLink');
});

/* ── Dry-run returns a stable placeholder ─────────────────────────────────── */

test('dry_run createEvent returns a non-empty placeholder eventId and null meetLink', () => {
  const { ctx } = makeCtxWithCalendarStub();
  const service = ctx.makeCalendarService({ calendarId: 'test-cal', runMode: 'dry_run' });
  const result = service.createEvent({ ...BASE_SPEC, mode: 'video_meeting' });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'dry_run');
  assert.ok(result.eventId, 'dry_run eventId must be non-empty');
  assert.equal(result.meetLink, null);
});
