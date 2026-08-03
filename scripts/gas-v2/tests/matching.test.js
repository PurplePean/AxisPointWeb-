'use strict';

/*
 * Identity matching.
 *
 * EXACT EVIDENCE ONLY: an exact normalized email, or an exact normalized FULL phone
 * digit string. The name, name-plus-company, and shared-domain suggestions from Pass 8
 * are gone, and several tests below exist specifically to keep them gone. A suggestion a
 * partner learns to ignore is worse than no suggestion, because the exact-match case it
 * was hiding is the one that actually needed attention.
 *
 * The other correction pinned here is phone comparison. Comparing the last ten digits was
 * a North American assumption that would collide two unrelated international numbers on
 * their tails and merge two people.
 *
 * Matching SUGGESTS. It never merges.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

const ctx = load();

const CANDIDATES = [
  {
    contactId: 'c-001',
    fullName: 'Dana Whitfield',
    email: 'dana@whitfieldholdings.test',
    phone: '(713) 555-0198',
    company: 'Whitfield Holdings',
  },
  {
    contactId: 'c-002',
    fullName: 'Dana Whitfield',
    email: 'dana.w@gmail.com',
    phone: '972-555-0900',
    company: '',
  },
  {
    contactId: 'c-003',
    fullName: 'Marcus Alvarez',
    email: 'marcus@alvarezcapital.test',
    phone: '',
    company: 'Alvarez Capital',
  },
];

function match(incoming) {
  return ctx.findPossibleMatches(incoming, CANDIDATES);
}

/* ── What counts as evidence ──────────────────────────────────────────────── */

test('an exact email match is found', () => {
  const matches = match({ fullName: 'D. Whitfield', email: 'DANA@whitfieldholdings.test', phone: '' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].contactId, 'c-001');
  assert.equal(matches[0].confidence, 'exact');
  assert.equal(matches[0].reason, 'email_exact');
});

test('email comparison ignores case and surrounding whitespace', () => {
  const matches = match({ fullName: '', email: '  Dana@WhitfieldHoldings.test ', phone: '' });
  assert.equal(matches[0].contactId, 'c-001');
});

test('phone comparison ignores punctuation and spacing', () => {
  const matches = match({ fullName: '', email: '', phone: '713.555.0198' });
  assert.equal(matches[0].contactId, 'c-001');
  assert.equal(matches[0].reason, 'phone_exact');
});

test('the FULL digit string is compared, so a country code makes it a different number', () => {
  // +1 713 555 0198 is eleven digits; the stored number is ten. Under the old last-ten
  // rule these collided. They are now two records for a human to judge, which is the
  // conservative direction: a wrong merge is unrecoverable, a duplicate is not.
  const matches = match({ fullName: '', email: '', phone: '+1 (713) 555-0198' });
  assert.equal(matches.length, 0);
});

test('two international numbers sharing a tail do not match', () => {
  const candidates = [{ contactId: 'x-1', email: '', phone: '+44 20 7946 0958' }];
  const matches = ctx.findPossibleMatches({ email: '', phone: '+1 202 794 60958' }, candidates);
  assert.equal(matches.length, 0);
});

test('matching on both email and phone reports both reasons', () => {
  const matches = match({ fullName: '', email: 'dana@whitfieldholdings.test', phone: '(713) 555-0198' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].reason, 'email_exact,phone_exact');
});

/* ── What is NOT evidence ─────────────────────────────────────────────────── */

test('a shared name alone is not evidence', () => {
  const matches = match({ fullName: 'Dana Whitfield', email: '', phone: '' });
  assert.equal(matches.length, 0);
});

test('name plus company is not evidence', () => {
  const matches = match({ fullName: 'Marcus Alvarez', email: 'm.alvarez@other.test', phone: '', company: 'Alvarez Capital' });
  assert.equal(matches.length, 0);
});

test('a shared email domain is not evidence', () => {
  const matches = match({ fullName: 'Dana Whitfield', email: 'dana.whitfield@whitfieldholdings.test', phone: '' });
  assert.equal(matches.length, 0);
});

test('a shared free-mail domain is not evidence', () => {
  const matches = match({ fullName: 'Dana Whitfield', email: 'different.dana@gmail.com', phone: '' });
  assert.equal(matches.length, 0);
});

test('probable and weak confidences no longer exist', () => {
  assert.deepEqual(Object.keys(ctx.MATCH_CONFIDENCE), ['EXACT']);
  assert.equal(ctx.GENERIC_EMAIL_DOMAINS, undefined);
});

test('an empty incoming record matches nothing rather than everything', () => {
  // An empty key must never equal an empty stored value. That mistake would match a
  // blank submission to every contact with a blank phone.
  const matches = match({ fullName: '', email: '', phone: '' });
  assert.equal(matches.length, 0);
});

test('an unrelated person matches nothing', () => {
  const matches = match({ fullName: 'Priya Raman', email: 'priya@ramanbrokers.test', phone: '972-555-0143' });
  assert.equal(matches.length, 0);
});

/* ── Output shape ─────────────────────────────────────────────────────────── */

test('the suggestion list is capped', () => {
  const many = [];
  for (let i = 0; i < 20; i += 1) {
    many.push({ contactId: `c-${i}`, email: 'same@example.test', phone: '' });
  }
  const matches = ctx.findPossibleMatches({ email: 'same@example.test', phone: '' }, many);
  assert.equal(matches.length, 5);
});

test('matching performs nothing: it returns data only', () => {
  const before = JSON.stringify(CANDIDATES);
  match({ fullName: 'Dana Whitfield', email: 'dana@whitfieldholdings.test', phone: '' });
  assert.equal(JSON.stringify(CANDIDATES), before);
});

test('the formatted cell names the id, the confidence, and the reason', () => {
  const formatted = ctx.formatPossibleMatches([
    { contactId: 'c-001', confidence: 'exact', reason: 'email_exact' },
    { contactId: 'c-002', confidence: 'exact', reason: 'phone_exact' },
  ]);
  assert.equal(formatted, 'c-001:exact:email_exact | c-002:exact:phone_exact');
});

/* ── The sentence a digest prints ─────────────────────────────────────────── */

test('the match note names the evidence and says nothing was merged', () => {
  const note = ctx.matchNoteFor([{ contactId: 'c-1', confidence: 'exact', reason: 'email_exact' }]);
  assert.match(note, /shares this email address/);
  assert.match(note, /Nothing was merged, changed, or overwritten\./);
});

test('the match note distinguishes phone evidence from email evidence', () => {
  const byPhone = ctx.matchNoteFor([{ contactId: 'c-1', confidence: 'exact', reason: 'phone_exact' }]);
  assert.match(byPhone, /shares this phone number/);

  const both = ctx.matchNoteFor([{ contactId: 'c-1', confidence: 'exact', reason: 'email_exact,phone_exact' }]);
  assert.match(both, /shares this email address and this phone number/);
});

test('no matches produces no note rather than an empty callout', () => {
  assert.equal(ctx.matchNoteFor([]), '');
  assert.equal(ctx.matchNoteFor(null), '');
});
