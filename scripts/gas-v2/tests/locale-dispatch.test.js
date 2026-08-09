'use strict';

/*
 * Locale-aware visitor template dispatch.
 *
 * WHAT WAS WRONG. `resolveOutboundLocale` and `LAUNCH_READY_LOCALES` existed since Pass 9A,
 * but nothing in the acknowledgement or booking handlers called them. A Spanish preference
 * was validated, stored, and shown to a partner, and then had no effect whatsoever on which
 * template was rendered. The machinery looked wired and was not.
 *
 * These tests hold the connection in place: selection must follow the resolved outbound
 * locale, unlaunched preferences must fall back to English honestly, and the stored locale
 * facts must stay untouched by any of it.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

/** Fresh context per test: template registration mutates module state. */
function ctx() {
  return load();
}

/* ── Resolution ───────────────────────────────────────────────────────────── */

test('a launch-ready preference is satisfied', () => {
  const c = ctx();
  const out = c.resolveOutboundLocale({ preferredFollowUpLocale: 'en' }, ['en']);
  assert.equal(out.locale, 'en');
  assert.equal(out.satisfied, true);
});

test('an unlaunched preference falls back to English and says it was not satisfied', () => {
  const c = ctx();
  const out = c.resolveOutboundLocale({ preferredFollowUpLocale: 'es' }, ['en']);
  assert.equal(out.locale, 'en');
  assert.equal(out.satisfied, false, 'the fallback must be reported, not hidden');
});

test('LAUNCH_READY_LOCALES is English alone', () => {
  const c = ctx();
  assert.deepEqual(Array.from(c.LAUNCH_READY_LOCALES), ['en']);
});

test('all nine locales remain accepted and stored regardless of launch readiness', () => {
  const c = ctx();
  assert.deepEqual(
    Array.from(c.LOCALES),
    ['en', 'es', 'zh-Hans', 'zh-Hant', 'vi', 'hi', 'ur', 'gu', 'pa'],
  );
});

/* ── Dispatch ─────────────────────────────────────────────────────────────── */

const LEAD = {
  leadId: 'l-1',
  email: 'robin@example.test',
  fullName: 'Robin Slate',
  pathway: 'general_inquiry',
  preferredFollowUpLocale: 'es',
};

test('an unlaunched Spanish preference renders the ENGLISH visitor template', () => {
  const c = ctx();
  const templates = c.realTemplates();

  const english = templates.renderAcknowledgement(LEAD, {}, 'en');
  const requested = templates.renderAcknowledgement(LEAD, {}, 'es');

  assert.equal(english.ok, true);
  assert.equal(requested.ok, true);
  // No Spanish set exists, so the same English body is produced. Nothing pretends.
  assert.equal(requested.subject, english.subject);
  assert.equal(requested.htmlBody, english.htmlBody);
});

test('a test-injected launch-ready locale selects ITS template', () => {
  const c = ctx();

  const templates = c.realTemplates({
    es: {
      renderAcknowledgement: function () {
        return { ok: true, subject: 'QA-ES-SUBJECT', htmlBody: '<p>qa-es</p>', textBody: 'qa-es' };
      },
    },
  });

  const rendered = templates.renderAcknowledgement(LEAD, {}, 'es');
  assert.equal(rendered.ok, true);
  assert.equal(rendered.subject, 'QA-ES-SUBJECT', 'dispatch did not reach the injected set');

  // A port built without the injection is unaffected: sets are per-call, never global.
  const plain = c.realTemplates();
  assert.notEqual(plain.renderAcknowledgement(LEAD, {}, 'es').subject, 'QA-ES-SUBJECT');
});

test('an INCOMPLETE locale set falls back per renderer, by the one documented rule', () => {
  const c = ctx();

  // Supplies an acknowledgement but no booking confirmation.
  const templates = c.realTemplates({
    es: {
      renderAcknowledgement: function () {
        return { ok: true, subject: 'QA-ES', htmlBody: '<p>x</p>', textBody: 'x' };
      },
    },
  });

  const ack = templates.renderAcknowledgement(LEAD, {}, 'es');
  assert.equal(ack.subject, 'QA-ES', 'the defined renderer comes from the registered set');

  const booking = templates.renderBookingConfirmation(
    LEAD,
    { status: 'confirmed', slotStart: '2026-08-12T10:30:00-05:00', durationMinutes: 30, mode: 'phone_call' },
    {},
    'es',
  );
  // The missing one falls back to English rather than failing the send.
  assert.equal(booking.ok, true);
  assert.notEqual(booking.subject, 'QA-ES');
});

test('an unknown locale falls back to English', () => {
  const c = ctx();
  const templates = c.realTemplates();
  const unknown = templates.renderAcknowledgement(LEAD, {}, 'qq-Fake');
  const english = templates.renderAcknowledgement(LEAD, {}, 'en');
  assert.equal(unknown.ok, true);
  assert.equal(unknown.subject, english.subject);
});

test('omitting the locale entirely still renders English', () => {
  const c = ctx();
  const templates = c.realTemplates();
  const omitted = templates.renderAcknowledgement(LEAD, {});
  assert.equal(omitted.ok, true);
  assert.equal(omitted.subject, templates.renderAcknowledgement(LEAD, {}, 'en').subject);
});

/* ── Internal mail stays English ──────────────────────────────────────────── */

test('partner notification and QR digest take no locale at all', () => {
  const c = ctx();
  const templates = c.realTemplates();
  // Read by the two partners, not the visitor. They display the visitor's preferred
  // language as a field rather than being written in it.
  assert.equal(templates.renderPartnerNotification.length < 3, true);
  assert.equal(typeof templates.renderQrDigest, 'function');
});

/* ── Storage facts are untouched by dispatch ──────────────────────────────── */

test('resolving an outbound locale never rewrites the stored locale record', () => {
  const c = ctx();
  const record = { pageLocale: 'en', preferredFollowUpLocale: 'es', preferredFollowUpStated: true };
  const before = JSON.stringify(record);

  c.resolveOutboundLocale(record, ['en']);

  assert.equal(JSON.stringify(record), before, 'the stored facts must survive verbatim');
});

test('a Spanish preference is still stored as Spanish after English is sent', () => {
  const c = ctx();
  const envelope = {
    schemaVersion: 1,
    submissionKind: 'service_inquiry',
    submissionId: '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d',
    locale: { page: 'en', preferredFollowUp: 'es' },
    attribution: { sourceCategory: 'website', sourceDetail: '/contact' },
    payload: {
      pathway: 'general_inquiry',
      topic: 'press_or_media',
      contact: { fullName: 'Robin Slate', email: 'robin@example.test' },
    },
  };

  const parsed = c.parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.ok, true, parsed.code);

  const lead = c.buildLead(parsed.value, {
    leadId: 'l-1', contactId: '', receivedAt: '2026-08-08T18:00:00.000Z',
    slaDueAt: null, screening: {}, possibleMatches: [],
  });

  assert.equal(lead.pageLocale, 'en');
  assert.equal(lead.preferredFollowUpLocale, 'es');

  // And the outbound decision does not change what was stored.
  const out = c.resolveOutboundLocale(lead, ['en']);
  assert.equal(out.locale, 'en');
  assert.equal(lead.preferredFollowUpLocale, 'es');
});
