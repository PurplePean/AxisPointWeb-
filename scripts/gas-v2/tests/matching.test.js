'use strict';

/*
 * Identity matching.
 *
 * WHAT THESE TESTS ARE FOR. An automatic merge of two people who happen to share a
 * name is unrecoverable through normal use, and nobody finds out. The assertions here
 * are therefore about restraint as much as recall: a shared free-mail domain must not
 * be evidence, a name alone must never be strong, and the function must return
 * suggestions rather than perform anything.
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
    phone: '(214) 555-0117',
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

test('an exact email match is strong', () => {
  const matches = ctx.findPossibleMatches(
    { fullName: 'D. Whitfield', email: 'DANA@whitfieldholdings.test', phone: '', company: '' },
    CANDIDATES,
  );
  assert.equal(matches[0].contactId, 'c-001');
  assert.equal(matches[0].confidence, 'strong');
  assert.equal(matches[0].reason, 'email_exact');
});

test('email comparison ignores case and surrounding whitespace', () => {
  const matches = ctx.findPossibleMatches(
    { fullName: '', email: '  Dana@WhitfieldHoldings.test ', phone: '', company: '' },
    CANDIDATES,
  );
  assert.equal(matches[0].contactId, 'c-001');
});

test('phone comparison ignores formatting and a leading country code', () => {
  // +1 (214) 555-0117 and (214) 555-0117 are the same person's phone.
  const matches = ctx.findPossibleMatches(
    { fullName: '', email: '', phone: '+1 214.555.0117', company: '' },
    CANDIDATES,
  );
  assert.equal(matches[0].contactId, 'c-001');
  assert.equal(matches[0].confidence, 'strong');
});

test('name plus company is probable, not strong', () => {
  const matches = ctx.findPossibleMatches(
    { fullName: 'Marcus Alvarez', email: 'm.alvarez@other.test', phone: '', company: 'Alvarez Capital' },
    CANDIDATES,
  );
  const marcus = matches.find((m) => m.contactId === 'c-003');
  assert.equal(marcus.confidence, 'probable');
});

test('a shared free-mail domain is never evidence', () => {
  // Two people both on gmail.com share nothing. Treating that as a signal would merge
  // strangers who happen to have the same name.
  const matches = ctx.findPossibleMatches(
    { fullName: 'Dana Whitfield', email: 'different.dana@gmail.com', phone: '', company: '' },
    CANDIDATES,
  );
  const byGmail = matches.find((m) => m.contactId === 'c-002');
  assert.equal(byGmail.confidence, 'weak');
  assert.equal(byGmail.reason, 'name_only');
});

test('the same name at the same company domain is probable', () => {
  const matches = ctx.findPossibleMatches(
    { fullName: 'Dana Whitfield', email: 'dana.whitfield@whitfieldholdings.test', phone: '', company: '' },
    CANDIDATES,
  );
  const match = matches.find((m) => m.contactId === 'c-001');
  assert.equal(match.confidence, 'probable');
  assert.equal(match.reason, 'name_and_email_domain');
});

test('a name alone is never more than weak', () => {
  const matches = ctx.findPossibleMatches(
    { fullName: 'Dana Whitfield', email: '', phone: '', company: '' },
    CANDIDATES,
  );
  matches.forEach((m) => assert.equal(m.confidence, 'weak'));
});

test('an unrelated person matches nothing', () => {
  const matches = ctx.findPossibleMatches(
    { fullName: 'Priya Raman', email: 'priya@ramanbrokers.test', phone: '972-555-0143', company: 'Raman Brokers' },
    CANDIDATES,
  );
  assert.equal(matches.length, 0);
});

test('an empty incoming record matches nothing rather than everything', () => {
  // An empty key must never equal an empty stored value. That mistake would match a
  // blank submission to every contact with a blank phone.
  const matches = ctx.findPossibleMatches({ fullName: '', email: '', phone: '', company: '' }, CANDIDATES);
  assert.equal(matches.length, 0);
});

test('results are ordered strongest first', () => {
  const matches = ctx.findPossibleMatches(
    { fullName: 'Dana Whitfield', email: 'dana@whitfieldholdings.test', phone: '', company: '' },
    CANDIDATES,
  );
  assert.equal(matches[0].confidence, 'strong');
  assert.equal(matches[matches.length - 1].confidence, 'weak');
});

test('the suggestion list is capped', () => {
  const many = [];
  for (let i = 0; i < 20; i += 1) {
    many.push({ contactId: `c-${i}`, fullName: 'Dana Whitfield', email: '', phone: '', company: '' });
  }
  const matches = ctx.findPossibleMatches({ fullName: 'Dana Whitfield', email: '', phone: '', company: '' }, many);
  assert.equal(matches.length, 5);
});

test('matching performs nothing: it returns data only', () => {
  // The candidates array is the only thing it could mutate, and it does not.
  const before = JSON.stringify(CANDIDATES);
  ctx.findPossibleMatches({ fullName: 'Dana Whitfield', email: '', phone: '', company: '' }, CANDIDATES);
  assert.equal(JSON.stringify(CANDIDATES), before);
});

test('the formatted cell names the id, the confidence, and the reason', () => {
  const formatted = ctx.formatPossibleMatches([
    { contactId: 'c-001', confidence: 'strong', reason: 'email_exact' },
    { contactId: 'c-002', confidence: 'weak', reason: 'name_only' },
  ]);
  assert.equal(formatted, 'c-001:strong:email_exact | c-002:weak:name_only');
});
