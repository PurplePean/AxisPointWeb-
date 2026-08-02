'use strict';

/*
 * The submission path, end to end, against fakes.
 *
 * WHAT THESE TESTS ARE FOR. This is where a lead is either kept or lost. The
 * assertions are ordered around the failures that are silent in production:
 *
 *  - a double-clicked submit creating two leads (the visitor sees one success either
 *    way, so nothing surfaces it)
 *  - storage happening AFTER a side effect, so a mail failure loses the record
 *  - a second inquiry from a known person starting a second identity
 *  - personal data reaching the log
 *
 * Every dependency is a fake that really stores things, so these assert outcomes
 * rather than call counts.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps, fakeContactRepository } = require('./helpers/fakes.js');

const ctx = load();

function parsed(envelope) {
  const result = ctx.parseEnvelope(JSON.stringify(envelope));
  assert.equal(result.ok, true, `fixture should be valid: ${result.code || ''}`);
  return result.value;
}

function submit(envelope, deps) {
  return ctx.processSubmission(parsed(envelope), deps);
}

test('a submission is stored with an id and a due time', () => {
  const deps = buildDeps();
  const result = submit(fx.managementProposal(), deps);

  assert.equal(result.ok, true);
  assert.equal(deps.leads.store.rows.length, 1);
  assert.equal(deps.leads.store.rows[0].leadId, result.leadId);
  assert.ok(result.slaDueAt, 'a management proposal must carry a due time');
});

test('the durable record is written before any side effect is queued', () => {
  // Order is the whole design. A queued email that fails is recoverable; a lost
  // submission is not.
  const deps = buildDeps();
  const order = [];
  const realInsert = deps.leads.insertLead.bind(deps.leads);
  const realEnqueue = deps.work.enqueue.bind(deps.work);
  deps.leads.insertLead = (lead) => {
    order.push('insert');
    return realInsert(lead);
  };
  deps.work.enqueue = (item) => {
    order.push('enqueue');
    return realEnqueue(item);
  };

  submit(fx.managementProposal(), deps);
  assert.equal(order[0], 'insert');
  assert.ok(order.indexOf('enqueue') > 0);
});

test('the whole submission runs under one lock', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  assert.equal(deps.lock.calls, 1);
});

test('a repeated submissionId returns the original lead instead of a second one', () => {
  const deps = buildDeps();
  const first = submit(fx.managementProposal(), deps);
  const second = submit(fx.managementProposal(), deps);

  assert.equal(second.replay, true);
  assert.equal(second.leadId, first.leadId);
  assert.equal(deps.leads.store.rows.length, 1);
});

test('a replay does not queue a second acknowledgement', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  const queuedAfterFirst = deps.work.items.length;
  submit(fx.managementProposal(), deps);
  assert.equal(deps.work.items.length, queuedAfterFirst);
});

test('two genuinely different submissions produce two leads', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  submit(fx.investorServices(), deps);
  assert.equal(deps.leads.store.rows.length, 2);
});

/* ── Identity ─────────────────────────────────────────────────────────────── */

test('a first-time person gets a new contact', () => {
  const deps = buildDeps();
  const result = submit(fx.managementProposal(), deps);
  assert.equal(deps.contacts.store.rows.length, 1);
  assert.equal(deps.contacts.store.rows[0].contactId, result.contactId);
});

test('an exact email match links to the existing contact instead of duplicating', () => {
  const contacts = fakeContactRepository([
    {
      contactId: 'existing-1',
      fullName: 'Dana Whitfield',
      email: 'dana@whitfieldholdings.test',
      phone: '',
      company: 'Whitfield Holdings',
      leadCount: 1,
    },
  ]);
  const deps = buildDeps({ contacts });
  const result = submit(fx.managementProposal(), deps);

  assert.equal(result.contactId, 'existing-1');
  assert.equal(contacts.store.rows.length, 1);
  assert.equal(contacts.store.rows[0].leadCount, 2);
});

test('linking to an existing contact never discards what was already stored', () => {
  const contacts = fakeContactRepository([
    {
      contactId: 'existing-1',
      fullName: 'Dana Whitfield',
      email: 'dana@whitfieldholdings.test',
      phone: '214-555-9999',
      company: 'Whitfield Holdings',
      roleOrTitle: 'Managing Partner',
      leadCount: 1,
    },
  ]);
  const deps = buildDeps({ contacts });
  submit(fx.managementProposal({ payload: { contact: { organization: undefined } } }), deps);

  const stored = contacts.store.rows[0];
  assert.equal(stored.roleOrTitle, 'Managing Partner');
  assert.equal(stored.company, 'Whitfield Holdings');
});

test('a weak name-only similarity does NOT link automatically', () => {
  // Two different people who share a name must stay two people. The similarity is
  // recorded for a human instead.
  const contacts = fakeContactRepository([
    {
      contactId: 'existing-1',
      fullName: 'Dana Whitfield',
      email: 'other.dana@gmail.com',
      phone: '',
      company: '',
      leadCount: 1,
    },
  ]);
  const deps = buildDeps({ contacts });
  const result = submit(fx.managementProposal(), deps);

  assert.notEqual(result.contactId, 'existing-1');
  assert.equal(contacts.store.rows.length, 2);
  assert.match(deps.leads.store.rows[0].possibleMatches, /existing-1:weak:name_only/);
});

test('two conflicting strong matches create a new contact and surface both', () => {
  // The stored data already disagrees with itself. Silently picking one hides that.
  const contacts = fakeContactRepository([
    { contactId: 'a-1', fullName: 'Dana Whitfield', email: 'dana@whitfieldholdings.test', phone: '', company: '', leadCount: 1 },
    { contactId: 'b-2', fullName: 'Dana W', email: '', phone: '(214) 555-0117', company: '', leadCount: 1 },
  ]);
  const deps = buildDeps({ contacts });
  const result = submit(fx.managementProposal(), deps);

  assert.notEqual(result.contactId, 'a-1');
  assert.notEqual(result.contactId, 'b-2');
  assert.match(deps.leads.store.rows[0].possibleMatches, /a-1:strong/);
  assert.match(deps.leads.store.rows[0].possibleMatches, /b-2:strong/);
});

/* ── Queued work ──────────────────────────────────────────────────────────── */

test('a submission queues exactly one acknowledgement and one notification', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  assert.deepEqual(Array.from(deps.work.kinds()).sort(), ['notify_partners', 'send_acknowledgement']);
});

test('work is queued even when nothing is configured to deliver it', () => {
  // Recording not_configured against the lead is a visible state. Skipping the queue
  // would leave 'pending' forever and read as a stuck queue rather than a missing
  // setting.
  const deps = buildDeps({ config: { partnerNotifyTo: [], replyTo: '', fromName: '' } });
  submit(fx.managementProposal(), deps);
  assert.equal(deps.work.items.length, 2);
});

test('nothing is sent during the request itself', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  assert.equal(deps.mail.sent.length, 0);
  assert.equal(deps.mail.attempts, 0);
});

/* ── Flagged submissions ──────────────────────────────────────────────────── */

test('a flagged submission is still stored', () => {
  const deps = buildDeps();
  submit(fx.managementProposal({ clientSignals: { honeypot: 'bot' } }), deps);

  assert.equal(deps.leads.store.rows.length, 1);
  assert.equal(deps.leads.store.rows[0].spamSuspected, true);
  assert.match(deps.leads.store.rows[0].spamReason, /honeypot_filled/);
});

test('a flagged submission still queues a partner notification', () => {
  const deps = buildDeps();
  submit(fx.managementProposal({ clientSignals: { honeypot: 'bot' } }), deps);
  assert.ok(Array.from(deps.work.kinds()).indexOf('notify_partners') !== -1);
});

/* ── Logging ──────────────────────────────────────────────────────────────── */

test('the log records the acceptance without the visitor personal data', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);

  const entry = deps.log.entries.find((e) => e.event === 'submission_accepted');
  assert.ok(entry);
  assert.equal(entry.detail.indexOf('dana@whitfieldholdings.test'), -1);
  assert.equal(entry.detail.indexOf('Dana Whitfield'), -1);
  assert.match(entry.detail, /d\*\*\*@whitfieldholdings\.test/);
});

test('the log records why a submission was flagged', () => {
  const deps = buildDeps();
  submit(fx.managementProposal({ clientSignals: { honeypot: 'bot' } }), deps);
  const entry = deps.log.entries.find((e) => e.event === 'submission_accepted');
  assert.match(entry.detail, /flagged:honeypot_filled/);
});

/* ── Contact exchange ─────────────────────────────────────────────────────── */

test('a contact exchange stores a lead and a contact with the scanned partner', () => {
  const deps = buildDeps();
  submit(fx.contactExchange(), deps);

  assert.equal(deps.leads.store.rows[0].scannedPartner, 'zachary_russell');
  assert.equal(deps.contacts.store.rows[0].scannedPartner, 'zachary_russell');
  assert.equal(deps.contacts.store.rows[0].contactCategory, 'broker_real_estate_advisor');
});

test('a contact exchange carries no SLA due time', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);
  assert.equal(result.slaDueAt, null);
});
