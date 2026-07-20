'use strict';

/*
 * Email-template parity: each embedded TEMPLATE_* constant that Apps Script
 * actually renders at runtime must byte-match its scripts/gas/emails/*.html
 * mirror. The mirrors are a source-of-truth copy maintained BY HAND, and they
 * have silently drifted before (the footer-address line, 2026-07-06). This test
 * makes that drift a failing check instead of a thing someone has to remember to
 * diff.
 *
 * The embedded constant is the one that ships; the mirror is documentation. If
 * they differ, that is the bug, regardless of which one is "right" — the fix is
 * to reconcile them, which this test forces.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadCode } = require('./helpers/load-code.js');

const S = loadCode();
const EMAILS_DIR = path.join(__dirname, '..', 'emails');

// Embedded constant name → mirror filename.
const PAIRS = {
  TEMPLATE_VISITOR_PHONE: 'visitor-confirmation-phone.html',
  TEMPLATE_VISITOR_MEET: 'visitor-confirmation-meet.html',
  TEMPLATE_VISITOR_NO_BOOKING: 'visitor-confirmation-no-booking.html',
  TEMPLATE_REFERRER_NOTIFICATION: 'referrer-notification.html',
  TEMPLATE_REFERRER_MONTHLY: 'referrer-monthly-summary.html',
  TEMPLATE_PARTNER_NOTIFICATION: 'partner-notification.html',
  TEMPLATE_WELCOME_SUBSCRIBER: 'welcome-subscriber.html',
  TEMPLATE_DAILY_DIGEST: 'daily-digest.html',
};

for (const [constName, file] of Object.entries(PAIRS)) {
  test(`template parity: ${constName} == emails/${file}`, () => {
    const embedded = S[constName];
    assert.equal(typeof embedded, 'string', `${constName} not found as a string in Code.gs`);

    const mirrorPath = path.join(EMAILS_DIR, file);
    assert.ok(fs.existsSync(mirrorPath), `mirror file missing: ${file}`);

    const mirror = fs.readFileSync(mirrorPath, 'utf8');
    // Mirrors are commonly saved with a single trailing newline; the embedded
    // constant is a join() with none. Treat a lone trailing newline as equal,
    // but nothing else.
    const mirrorNoTrailing = mirror.replace(/\n$/, '');

    assert.ok(
      embedded === mirror || embedded === mirrorNoTrailing,
      `DRIFT between ${constName} and ${file}. Reconcile the embedded constant and the mirror.\n` +
        firstDiff(embedded, mirrorNoTrailing)
    );
  });
}

test('template parity: every embedded TEMPLATE_* has a mirror mapping', () => {
  // Guard against a new template being added to Code.gs without a parity entry
  // here — otherwise it could drift untested.
  const embeddedNames = Object.keys(S).filter((k) => /^TEMPLATE_/.test(k) && typeof S[k] === 'string');
  for (const name of embeddedNames) {
    assert.ok(name in PAIRS, `${name} exists in Code.gs but has no parity mapping in this test`);
  }
  assert.equal(embeddedNames.length, Object.keys(PAIRS).length);
});

function firstDiff(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      return (
        `  first difference at line ${i + 1}:\n` +
        `    embedded: ${JSON.stringify(la[i])}\n` +
        `    mirror:   ${JSON.stringify(lb[i])}`
      );
    }
  }
  return `  (line counts differ: embedded ${la.length}, mirror ${lb.length})`;
}
