'use strict';

/*
 * Handler-level locale wiring.
 *
 * WHY THIS FILE IS SEPARATE FROM locale-dispatch.test.js. That file proves the resolver
 * resolves and the renderer selects. Both passed for months while production was broken,
 * because nothing tested the step BETWEEN them: no handler ever called the resolver, so a
 * Spanish preference was validated, stored, shown to a partner, and then silently ignored.
 *
 * These tests capture what the three production handlers actually hand to the template port.
 * If someone deletes the resolver call from a handler, the unit tests above still pass and
 * these fail, which is the correct division of labour.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const {
  buildDeps,
  fakeSubmissionRepository,
  fakeDeliveryRepository,
  fakeLeadRepository,
} = require('./helpers/fakes.js');

/** A templates port that records the locale argument each renderer receives. */
function capturingTemplates() {
  const seen = { ack: [], qrAck: [], booking: [] };
  return {
    seen,
    renderAcknowledgement(lead, config, locale) {
      seen.ack.push(locale);
      return { ok: true, subject: 'ack', htmlBody: '<p>ack</p>', textBody: 'ack' };
    },
    renderQrAcknowledgement(record, config, locale) {
      seen.qrAck.push(locale);
      return { ok: true, subject: 'qr', htmlBody: '<p>qr</p>', textBody: 'qr' };
    },
    renderBookingConfirmation(lead, booking, config, locale) {
      seen.booking.push(locale);
      return { ok: true, subject: 'book', htmlBody: '<p>book</p>', textBody: 'book' };
    },
    renderPartnerNotification() {
      return { ok: true, subject: 'notify', htmlBody: '<p>n</p>', textBody: 'n' };
    },
    renderQrDigest() {
      return { ok: true, subject: 'digest', htmlBody: '<p>d</p>', textBody: 'd' };
    },
  };
}

const RECEIVED = '2026-08-08T18:00:00.000Z';

function inquirySubmission(preferred) {
  return {
    submissionId: 's-1',
    submissionKind: 'service_inquiry',
    email: 'robin@example.test',
    fullName: 'Robin Slate',
    pageLocale: 'en',
    preferredFollowUpLocale: preferred,
    leadId: 'l-1',
    receivedAt: RECEIVED,
    spamSuspected: false,
  };
}

function exchangeSubmission(preferred) {
  return {
    submissionId: 's-2',
    submissionKind: 'contact_exchange',
    email: 'dana@example.test',
    fullName: 'Dana Whitfield',
    pageLocale: 'en',
    preferredFollowUpLocale: preferred,
    contactId: 'c-1',
    receivedAt: RECEIVED,
    spamSuspected: false,
  };
}

function leadRecord(preferred) {
  return {
    leadId: 'l-1',
    sourceSubmissionId: 's-1',
    email: 'robin@example.test',
    fullName: 'Robin Slate',
    pathway: 'general_inquiry',
    pageLocale: 'en',
    preferredFollowUpLocale: preferred,
    calendarStatus: 'booked',
    activeBookingRequestId: 'b-1',
  };
}

/** Deps wired with capturing templates and whatever launch-ready set the test wants. */
function depsWith(templates, launchReady, seeds) {
  const leads = fakeLeadRepository();
  if (seeds && seeds.lead) leads.insertLead(seeds.lead);

  return buildDeps({
    templates,
    launchReadyLocales: launchReady,
    submissions: fakeSubmissionRepository(seeds && seeds.submissions ? seeds.submissions : []),
    deliveries: fakeDeliveryRepository(seeds && seeds.deliveries ? seeds.deliveries : []),
    leads,
  });
}

/* ── Website acknowledgement ──────────────────────────────────────────────── */

test('the acknowledgement handler passes the RESOLVED locale to the renderer', () => {
  const ctx = load();
  const templates = capturingTemplates();

  const submission = inquirySubmission('es');
  const deps = depsWith(templates, ['en'], {
    submissions: [submission],
    deliveries: [{ submissionId: 's-1', submissionKind: 'service_inquiry' }],
    lead: leadRecord('es'),
  });

  const result = ctx.handleSendAcknowledgement({ subjectId: 's-1' }, deps);

  assert.equal(result.ok, true, result.reason);
  assert.equal(templates.seen.ack.length, 1, 'the renderer was not called');
  // Spanish is not launch-ready, so English must be what the renderer is asked for.
  assert.equal(templates.seen.ack[0], 'en', 'the handler did not resolve the outbound locale');
});

test('a launch-ready preference reaches the acknowledgement renderer unchanged', () => {
  const ctx = load();
  const templates = capturingTemplates();

  const submission = inquirySubmission('es');
  const deps = depsWith(templates, ['en', 'es'], {
    submissions: [submission],
    deliveries: [{ submissionId: 's-1', submissionKind: 'service_inquiry' }],
    lead: leadRecord('es'),
  });

  const result = ctx.handleSendAcknowledgement({ subjectId: 's-1' }, deps);

  assert.equal(result.ok, true, result.reason);
  assert.equal(templates.seen.ack[0], 'es', 'a launch-ready locale must not be downgraded');
});

/* ── QR acknowledgement ───────────────────────────────────────────────────── */

test('the QR acknowledgement handler passes the resolved locale', () => {
  const ctx = load();
  const templates = capturingTemplates();

  const submission = exchangeSubmission('hi');
  const deps = depsWith(templates, ['en'], {
    submissions: [submission],
    deliveries: [{ submissionId: 's-2', submissionKind: 'contact_exchange' }],
  });

  const result = ctx.handleSendQrAcknowledgement({ subjectId: 's-2' }, deps);

  assert.equal(result.ok, true, result.reason);
  assert.equal(templates.seen.qrAck.length, 1, 'the QR renderer was not called');
  assert.equal(templates.seen.qrAck[0], 'en', 'Hindi is not launch-ready, English was required');
});

test('a launch-ready preference reaches the QR renderer unchanged', () => {
  const ctx = load();
  const templates = capturingTemplates();

  const submission = exchangeSubmission('hi');
  const deps = depsWith(templates, ['en', 'hi'], {
    submissions: [submission],
    deliveries: [{ submissionId: 's-2', submissionKind: 'contact_exchange' }],
  });

  ctx.handleSendQrAcknowledgement({ subjectId: 's-2' }, deps);
  assert.equal(templates.seen.qrAck[0], 'hi');
});

/* ── Booking confirmation ─────────────────────────────────────────────────── */

test('the booking confirmation handler passes the resolved locale', () => {
  const ctx = load();
  const templates = capturingTemplates();

  const deps = depsWith(templates, ['en'], { lead: leadRecord('ur') });

  const item = {
    leadId: 'l-1',
    payload: {
      bookingRequestId: 'b-1',
      slotStart: '2026-08-12T10:30:00-05:00',
      durationMinutes: 30,
      mode: 'phone_call',
    },
  };

  const result = ctx.handleSendBookingConfirmation(item, deps);

  assert.equal(result.ok, true, result.reason);
  assert.equal(templates.seen.booking.length, 1, 'the booking renderer was not called');
  assert.equal(templates.seen.booking[0], 'en', 'Urdu is not launch-ready, English was required');
});

test('a launch-ready preference reaches the booking renderer unchanged', () => {
  const ctx = load();
  const templates = capturingTemplates();

  const deps = depsWith(templates, ['en', 'ur'], { lead: leadRecord('ur') });

  ctx.handleSendBookingConfirmation({
    leadId: 'l-1',
    payload: {
      bookingRequestId: 'b-1',
      slotStart: '2026-08-12T10:30:00-05:00',
      durationMinutes: 30,
      mode: 'phone_call',
    },
  }, deps);

  assert.equal(templates.seen.booking[0], 'ur');
});

/* ── Injection replaces the removed mutable globals ───────────────────────── */

test('realTemplates accepts an injected locale set instead of mutating globals', () => {
  const ctx = load();

  assert.equal(typeof ctx.registerVisitorTemplateSet, 'undefined', 'test-only mutator shipped');
  assert.equal(typeof ctx.clearVisitorTemplateSet, 'undefined', 'test-only mutator shipped');

  const injected = ctx.realTemplates({
    es: {
      renderAcknowledgement: function () {
        return { ok: true, subject: 'QA-ES', htmlBody: '<p>qa</p>', textBody: 'qa' };
      },
    },
  });

  const lead = leadRecord('es');
  assert.equal(injected.renderAcknowledgement(lead, {}, 'es').subject, 'QA-ES');

  // A separate port built without the injection is unaffected: no shared mutable state.
  const plain = ctx.realTemplates();
  assert.notEqual(plain.renderAcknowledgement(lead, {}, 'es').subject, 'QA-ES');
});
