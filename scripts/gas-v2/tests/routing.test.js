'use strict';

/*
 * Notification routing.
 *
 * WHAT THESE TESTS ARE FOR. The rule that a QR scan identifies a CARD and not an
 * OWNER is easy to state and easy to lose. The assertions below pin both halves: the
 * scanned partner is the obvious first responder, and ownership stays provisional and
 * separately stored so a reassignment is not fought by an automatic rule.
 *
 * The other guarded failure is a notification that reaches nobody. Every path is
 * asserted to produce at least one recipient whenever any address is configured.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const { fakeConfig } = require('./helpers/fakes.js');

const ctx = load();

const CLEAN = { spamSuspected: false };
const FLAGGED = { spamSuspected: true, spamReason: 'honeypot_filled' };

function lead(overrides = {}) {
  return {
    sourceCategory: 'website',
    scannedPartner: '',
    scannedSlugUnresolved: false,
    ...overrides,
  };
}

test('a website submission goes to the firm with no provisional owner', () => {
  const decision = ctx.routeNotification(lead(), CLEAN);
  assert.equal(decision.reason, 'website_submission_to_firm');
  assert.equal(decision.ownerPartner, '');
  assert.equal(decision.useFirmFallback, true);
});

test('a scanned card notifies that partner and provisionally assigns them', () => {
  const decision = ctx.routeNotification(
    lead({ sourceCategory: 'qr', scannedPartner: 'zachary_russell' }),
    CLEAN,
  );
  assert.equal(decision.reason, 'scanned_partner_card');
  assert.equal(Array.from(decision.recipients).join(), 'zachary_russell');
  assert.equal(decision.ownerPartner, 'zachary_russell');
});

test('a retired card slug reaches the whole firm and assigns nobody', () => {
  // Guessing an owner here would attribute someone else's handshake to the wrong
  // partner, which is worse than an extra email.
  const decision = ctx.routeNotification(
    lead({ sourceCategory: 'qr', scannedPartner: '', scannedSlugUnresolved: true }),
    CLEAN,
  );
  assert.equal(decision.reason, 'unresolved_partner_slug');
  assert.equal(decision.ownerPartner, '');
  assert.equal(decision.useFirmFallback, true);
});

test('a flagged submission goes to the firm even when a card was scanned', () => {
  // One partner quietly deciding a flagged lead was junk is how a real one is lost.
  const decision = ctx.routeNotification(
    lead({ sourceCategory: 'qr', scannedPartner: 'ethaniel_vu' }),
    FLAGGED,
  );
  assert.equal(decision.reason, 'spam_suspected_firm_review');
  assert.equal(decision.ownerPartner, '');
});

test('routing decides, it does not send', () => {
  const decision = ctx.routeNotification(lead(), CLEAN);
  assert.deepEqual(Object.keys(decision).sort(), [
    'ownerPartner',
    'reason',
    'recipients',
    'useFirmFallback',
  ]);
});

/* ── Address resolution ───────────────────────────────────────────────────── */

test('a scanned partner resolves to that partner address', () => {
  const decision = ctx.routeNotification(
    lead({ sourceCategory: 'qr', scannedPartner: 'zachary_russell' }),
    CLEAN,
  );
  const to = ctx.resolveRecipients(decision, fakeConfig());
  assert.deepEqual(Array.from(to), ['zr@example.test']);
});

test('a firm decision resolves to the firm-wide list', () => {
  const to = ctx.resolveRecipients(ctx.routeNotification(lead(), CLEAN), fakeConfig());
  assert.deepEqual(Array.from(to), ['firm@example.test']);
});

test('an unconfigured partner address falls back to the firm rather than nobody', () => {
  // An undeliverable notification is worse than an over-broad one.
  const decision = ctx.routeNotification(
    lead({ sourceCategory: 'qr', scannedPartner: 'zachary_russell' }),
    CLEAN,
  );
  const to = ctx.resolveRecipients(decision, fakeConfig({ partnerEmailMap: {} }));
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
