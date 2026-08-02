'use strict';

/*
 * Spam screening.
 *
 * WHAT THESE TESTS ARE FOR. The dangerous failure is not a bot getting through, it is
 * a real property owner being silently discarded. So the central assertions here are
 * that screening FLAGS and never drops, and that a legitimate submission with a long
 * note, a company name, and a real domain comes through clean.
 *
 * Client signals are also asserted to be advisory only: a bot controls what it sends,
 * so a missing or dishonest signal must never be able to clear a flag.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');

const ctx = load();

function screen(envelope) {
  const parsed = ctx.parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.ok, true, `fixture should be valid: ${parsed.code || ''}`);
  return ctx.screenSubmission(parsed.value);
}

test('an ordinary management proposal is clean', () => {
  const result = screen(fx.managementProposal());
  assert.equal(result.spamSuspected, false);
  assert.equal(result.spamReason, '');
});

test('a long, detailed note from a real person is clean', () => {
  const notes =
    'We own a 240 unit property in Oak Cliff and our current manager has missed two ' +
    'monthly reporting deadlines in a row. We would like to talk about a transition ' +
    'before the end of the quarter, ideally with the same on-site staff retained.';
  const result = screen(fx.managementProposal({ payload: { situation: { notes } } }));
  assert.equal(result.spamSuspected, false);
});

test('a contact exchange with only a phone is clean', () => {
  const result = screen(fx.contactExchange({ payload: { email: undefined } }));
  assert.equal(result.spamSuspected, false);
});

/* ── Signals that flag ────────────────────────────────────────────────────── */

test('a filled honeypot flags', () => {
  const result = screen(fx.managementProposal({ clientSignals: { honeypot: 'bot value' } }));
  assert.equal(result.spamSuspected, true);
  assert.match(result.spamReason, /honeypot_filled/);
});

test('an implausibly fast completion flags', () => {
  const result = screen(fx.managementProposal({ clientSignals: { fillSeconds: 1 } }));
  assert.equal(result.spamSuspected, true);
  assert.match(result.spamReason, /submitted_too_fast/);
});

test('a note stuffed with links flags', () => {
  const notes = 'visit https://a.test and https://b.test and www.c.test for cheap deals';
  const result = screen(fx.managementProposal({ payload: { situation: { notes } } }));
  assert.equal(result.spamSuspected, true);
  assert.match(result.spamReason, /excessive_links/);
});

test('a disposable email domain flags', () => {
  const result = screen(
    fx.managementProposal({ payload: { contact: { email: 'x@mailinator.com' } } }),
  );
  assert.equal(result.spamSuspected, true);
  assert.match(result.spamReason, /disposable_email_domain/);
});

test('a URL in the name field flags', () => {
  const result = screen(
    fx.managementProposal({ payload: { contact: { fullName: 'https://cheap-seo.test' } } }),
  );
  assert.equal(result.spamSuspected, true);
  assert.match(result.spamReason, /url_in_name/);
});

test('a long run of repeated characters flags', () => {
  const result = screen(
    fx.managementProposal({ payload: { situation: { notes: 'aaaaaaaaaaaaaaaaaaaa' } } }),
  );
  assert.equal(result.spamSuspected, true);
  assert.match(result.spamReason, /repeated_character_run/);
});

test('several signals are all recorded, not just the first', () => {
  const result = screen(
    fx.managementProposal({
      clientSignals: { honeypot: 'x', fillSeconds: 0 },
      payload: { contact: { email: 'x@yopmail.com' } },
    }),
  );
  assert.equal(result.reasons.length >= 3, true);
});

/* ── Signals are advisory ─────────────────────────────────────────────────── */

test('omitting clientSignals cannot clear a content-based flag', () => {
  const result = screen(
    fx.managementProposal({
      clientSignals: undefined,
      payload: { contact: { email: 'x@mailinator.com' } },
    }),
  );
  assert.equal(result.spamSuspected, true);
});

test('a generous fillSeconds cannot clear a content-based flag', () => {
  // A bot can claim it spent ten minutes on the form. That claim must buy it nothing.
  const result = screen(
    fx.managementProposal({
      clientSignals: { fillSeconds: 600 },
      payload: { contact: { fullName: 'www.spam.test/deals' } },
    }),
  );
  assert.equal(result.spamSuspected, true);
});

test('screening returns a decision and never a discard instruction', () => {
  // The whole surface is a boolean plus reasons. There is no drop, no reject, no
  // silent-discard path anywhere in the result.
  const result = screen(fx.managementProposal({ clientSignals: { honeypot: 'x' } }));
  assert.deepEqual(Object.keys(result).sort(), ['reasons', 'spamReason', 'spamSuspected']);
});
