'use strict';

/*
 * Notification routing for website inquiries.
 *
 * QR Contacts are no longer routed here at all; they go to the daily digest, and
 * `intake.test.js` asserts that no immediate partner notification is queued for one.
 *
 * The rule this file pins is that ROUTING ASSIGNS NOTHING. Pass 8 let a resolved QR scan
 * provisionally set `ownerPartner`, which meant a printed card decided who was
 * accountable for a relationship and any reassignment was fighting an automatic rule.
 * `ownerPartner` is now unassigned at intake, always, and the decision object no longer
 * has a field to carry it.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const { fakeConfig } = require('./helpers/fakes.js');

const ctx = load();

const CLEAN = { spamSuspected: false };
const FLAGGED = { spamSuspected: true, spamReason: 'honeypot_filled' };

function lead(overrides = {}) {
  return { sourceCategory: 'website', ...overrides };
}

test('a website submission goes to the firm', () => {
  const decision = ctx.routeNotification(lead(), CLEAN);
  assert.equal(decision.reason, 'website_submission_to_firm');
  assert.equal(decision.useFirmFallback, true);
});

test('a flagged submission goes to the firm with its own reason', () => {
  // One partner quietly deciding a flagged lead was junk is how a real one is lost, so
  // the reason travels with the message rather than the routing being silently identical.
  const decision = ctx.routeNotification(lead(), FLAGGED);
  assert.equal(decision.reason, 'spam_suspected_firm_review');
});

test('the decision carries no ownership field at all', () => {
  // Not "ownerPartner is empty": the field is gone, so nothing downstream can read a
  // routing decision as an assignment.
  const decision = ctx.routeNotification(lead(), CLEAN);
  assert.deepEqual(Object.keys(decision).sort(), ['reason', 'recipients', 'useFirmFallback']);
  assert.equal('ownerPartner' in decision, false);
});

test('the QR routing reasons are gone', () => {
  assert.equal(ctx.ROUTING_REASONS.SCANNED_PARTNER, undefined);
  assert.equal(ctx.ROUTING_REASONS.UNRESOLVED_SLUG, undefined);
});

test('routing decides, it does not send', () => {
  const decision = ctx.routeNotification(lead(), CLEAN);
  assert.equal(typeof decision.recipients.length, 'number');
});

/* ── Address resolution ───────────────────────────────────────────────────── */

test('a firm decision resolves to the firm-wide list', () => {
  const to = ctx.resolveRecipients(ctx.routeNotification(lead(), CLEAN), fakeConfig());
  assert.deepEqual(Array.from(to), ['firm@example.test']);
});

test('duplicate addresses collapse to one recipient', () => {
  const config = fakeConfig({
    partnerNotifyTo: ['firm@example.test', 'FIRM@example.test', ' firm@example.test '],
  });
  const to = ctx.resolveRecipients(ctx.routeNotification(lead(), CLEAN), config);
  assert.equal(to.length, 1);
});

test('nothing configured resolves to no recipients, which the caller must handle', () => {
  const config = fakeConfig({ partnerNotifyTo: [], partnerEmailMap: {} });
  const to = ctx.resolveRecipients(ctx.routeNotification(lead(), CLEAN), config);
  assert.equal(to.length, 0);
});
