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

/*
 * The auto-linking tests that lived here are gone, not relocated.
 *
 * They asserted that an exact email match REUSED and UPDATED an existing Contact. That is
 * the behaviour Pass 9B removed: a match may raise a flag and nothing more. The full
 * replacement contract, including the negative cases, is in storage-model.test.js.
 */

test('a match is flagged on the record without reusing an existing Contact', () => {
  const deps = buildDeps();
  const first = submit(fx.contactExchange(), deps);
  const second = submit(fx.qrSubmission(9, 'zachary-russell'), deps);

  assert.notEqual(second.contactId, first.contactId);
  assert.equal(deps.contacts.store.rows.length, 2);
  assert.match(
    deps.submissions.findBySubmissionId(second.submissionId).possibleMatches,
    /exact:email_exact/,
  );
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

test('a contact exchange stores a Submission and a Contact, and no Lead', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);

  assert.equal(deps.leads.store.rows.length, 0);
  assert.equal(
    deps.submissions.findBySubmissionId(result.submissionId).scannedPartner,
    'zachary_russell',
  );
  assert.equal(deps.contacts.store.rows[0].scannedPartner, 'zachary_russell');
  assert.equal(deps.contacts.store.rows[0].contactCategory, 'broker_real_estate_advisor');
});

test('a contact exchange carries no SLA due time', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);
  assert.equal(result.slaDueAt, null);
});

test('a QR contact queues an acknowledgement and NO immediate partner notification', () => {
  // The immediate per-scan notification is replaced by the 8:00 AM digest. One email per
  // scanned card is unreadable after a conference table.
  const deps = buildDeps();
  submit(fx.contactExchange(), deps);

  assert.deepEqual(Array.from(deps.work.kinds()), ['send_qr_acknowledgement']);
  assert.equal(Array.from(deps.work.kinds()).indexOf('notify_partners'), -1);
});

test('a QR contact records that its notification is deferred, not pending', () => {
  // 'pending' forever would read as a stuck queue rather than an intentional wait.
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);

  const row = deps.deliveries.findBySubmissionId(result.submissionId);
  assert.equal(row.partnerNotifyStatus, 'deferred_to_digest');
  assert.equal(row.digestStatus, 'pending_digest');
});

test('a website inquiry still queues an immediate internal notification', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  assert.deepEqual(
    Array.from(deps.work.kinds()).sort(),
    ['notify_partners', 'send_acknowledgement'],
  );
});

/* ── Attribution and ownership ────────────────────────────────────────────── */

test('a resolved partner scan records attribution and assigns nobody', () => {
  // A scan gave that partner a name, not a claim.
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);

  const submission = deps.submissions.findBySubmissionId(result.submissionId);
  assert.equal(submission.acquisitionSource, 'zachary_russell');
  assert.equal(submission.scannedPartner, 'zachary_russell');
  assert.equal(deps.contacts.store.rows[0].acquisitionSource, 'zachary_russell');
  assert.equal(deps.contacts.store.rows[0].ownerPartner, '');
  assert.equal(deps.contacts.store.rows[0].followUpState, 'not_contacted');
});

test('the firm card and an unresolved card stay distinguishable', () => {
  const deps = buildDeps();
  submit(fx.qrSubmission(1, 'axispoint-partners'), deps);
  submit(fx.qrSubmission(2, 'retired-card'), deps);

  assert.equal(deps.contacts.store.rows[0].acquisitionSource, 'firm');
  assert.equal(deps.contacts.store.rows[1].acquisitionSource, 'unknown');
});

test('firm is not a partner and never becomes one', () => {
  const deps = buildDeps();
  submit(fx.qrSubmission(3, 'axispoint-partners'), deps);
  assert.equal(deps.contacts.store.rows[0].scannedPartner, '', 'firm must not occupy a partner field');
});

test('a website submission has no acquisition source at all', () => {
  // Acquisition attribution is a QR fact. It is recorded on the immutable Submission,
  // which a website inquiry also produces, and it is empty there.
  const deps = buildDeps();
  const result = submit(fx.managementProposal(), deps);
  assert.equal(deps.submissions.findBySubmissionId(result.submissionId).acquisitionSource, '');
});
