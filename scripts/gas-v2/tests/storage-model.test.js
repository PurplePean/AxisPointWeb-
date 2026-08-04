'use strict';

/*
 * The storage boundary.
 *
 * FOUR INVARIANTS, AND EACH ONE GUARDS A FAILURE THAT IS SILENT IN PRODUCTION.
 *
 * 1. Every accepted request creates exactly one immutable Submission. Without it there is
 *    no record of what somebody actually sent, and every later edit to a Lead or Contact
 *    overwrites the only copy.
 *
 * 2. A website service inquiry creates a Lead and NO Contact. It is a request with a
 *    pathway and a clock, not a person to file.
 *
 * 3. A QR Contact Exchange creates a Contact and NO Lead. Pass 9A wrote a Lead row for
 *    one, which made a handshake at a conference into a Lead with an empty pathway, no
 *    SLA, and a qualification state nobody would ever set.
 *
 * 4. An exact email or full-phone match only ever raises a FLAG. It never links, merges,
 *    overwrites, or updates an existing Contact. This is the one whose failure cannot be
 *    undone: an automatic merge of two people destroys the losing record's history and
 *    nobody finds out.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps } = require('./helpers/fakes.js');

const ctx = load();

function submit(envelope, deps) {
  const parsed = ctx.parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.ok, true, `fixture should be valid: ${parsed.code || ''}`);
  return ctx.processSubmission(parsed.value, deps);
}

/* ── 1. One immutable Submission per accepted request ─────────────────────── */

test('a website inquiry creates exactly one Submission', () => {
  const deps = buildDeps();
  const result = submit(fx.managementProposal(), deps);

  assert.equal(deps.submissions.store.rows.length, 1);
  const stored = deps.submissions.findBySubmissionId(result.submissionId);
  assert.ok(stored);
  assert.equal(stored.submissionKind, 'service_inquiry');
});

test('a QR contact exchange creates exactly one Submission', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);

  assert.equal(deps.submissions.store.rows.length, 1);
  assert.equal(deps.submissions.findBySubmissionId(result.submissionId).submissionKind, 'contact_exchange');
});

test('the Submission keeps the submitted values exactly as typed', () => {
  const deps = buildDeps();
  const typed = '+44 (0)20 7946-0958';
  const result = submit(fx.contactExchange({ payload: { phone: typed } }), deps);

  const stored = deps.submissions.findBySubmissionId(result.submissionId);
  assert.equal(stored.phone, typed, 'the stored value must not be reformatted');
  assert.equal(stored.normalizedPhone, '4402079460958', 'normalized alongside, not instead of');
  assert.equal(stored.email, 'priya@ramanbrokers.test');
  assert.equal(stored.fullName, 'Priya Raman');
});

test('the Submission keeps the submitted locale', () => {
  const deps = buildDeps();
  const result = submit(fx.investorServices(), deps);

  const stored = deps.submissions.findBySubmissionId(result.submissionId);
  assert.equal(stored.pageLocale, 'en');
  assert.equal(stored.preferredFollowUpLocale, 'es');
  assert.equal(stored.preferredFollowUpStated, true);
});

test('the Submission keeps the acquisition attribution and the spam state', () => {
  const deps = buildDeps();
  const result = submit(fx.qrSubmission(1, 'zachary-russell', { clientSignals: { honeypot: 'bot' } }), deps);

  const stored = deps.submissions.findBySubmissionId(result.submissionId);
  assert.equal(stored.acquisitionSource, 'zachary_russell');
  assert.equal(stored.scannedPartner, 'zachary_russell');
  assert.equal(stored.sourceDetail, 'zachary-russell');
  assert.equal(stored.spamSuspected, true);
  assert.match(stored.spamReason, /honeypot_filled/);
});

test('the Submission repository exposes no way to mutate a record', () => {
  // "Immutable" is enforced by the absence of a method, not by a convention.
  const deps = buildDeps();
  ['updateSubmission', 'update', 'patch', 'remove', 'delete', 'removeByIds']
    .forEach((method) => {
      assert.equal(typeof deps.submissions[method], 'undefined', `submissions.${method} must not exist`);
    });
});

test('the Submission port declares no update method either', () => {
  assert.deepEqual(
    Array.from(ctx.SUBMISSION_REPOSITORY_PORT).sort(),
    ['findBySubmissionId', 'insertSubmission'],
  );
});

test('a retried submission creates no second business record of any kind', () => {
  const deps = buildDeps();
  const first = submit(fx.contactExchange(), deps);
  const second = submit(fx.contactExchange(), deps);

  assert.equal(second.replay, true);
  assert.equal(second.submissionId, first.submissionId);
  assert.equal(second.contactId, first.contactId);

  assert.equal(deps.submissions.store.rows.length, 1, 'one Submission');
  assert.equal(deps.contacts.store.rows.length, 1, 'one Contact');
  assert.equal(deps.leads.store.rows.length, 0, 'no Lead');
  assert.equal(deps.deliveries.store.rows.length, 1, 'one Delivery');
});

test('a retried website inquiry creates no second Lead', () => {
  const deps = buildDeps();
  const first = submit(fx.managementProposal(), deps);
  const second = submit(fx.managementProposal(), deps);

  assert.equal(second.replay, true);
  assert.equal(second.leadId, first.leadId);
  assert.equal(deps.leads.store.rows.length, 1);
  assert.equal(deps.submissions.store.rows.length, 1);
});

test('every accepted request also creates exactly one Delivery row', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  submit(fx.contactExchange(), deps);

  assert.equal(deps.deliveries.store.rows.length, 2);
  assert.equal(deps.deliveries.store.rows.filter((d) => d.digestStatus === 'pending_digest').length, 1);
  assert.equal(deps.deliveries.store.rows.filter((d) => d.digestStatus === 'not_applicable').length, 1);
});

/* ── 2. Website inquiry: a Lead, and no Contact ───────────────────────────── */

test('a website service inquiry creates a Lead and no Contact', () => {
  const deps = buildDeps();
  const result = submit(fx.managementProposal(), deps);

  assert.equal(deps.leads.store.rows.length, 1);
  assert.equal(deps.contacts.store.rows.length, 0, 'a website inquiry files no person');
  assert.ok(result.leadId);
  assert.equal(result.contactId, null);
});

test('every website pathway creates a Lead and no Contact', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  submit(fx.investorServices(), deps);
  submit(fx.generalInquiry(), deps);

  assert.equal(deps.leads.store.rows.length, 3);
  assert.equal(deps.contacts.store.rows.length, 0);
});

test('the Lead points back at the Submission that produced it', () => {
  const deps = buildDeps();
  const result = submit(fx.managementProposal(), deps);

  const lead = deps.leads.findLeadById(result.leadId);
  assert.equal(lead.sourceSubmissionId, result.submissionId);
  assert.equal(deps.submissions.findBySubmissionId(result.submissionId).leadId, result.leadId);
});

test('the Lead carries the pathway, the SLA, and the qualification state', () => {
  const deps = buildDeps();
  const result = submit(fx.managementProposal(), deps);
  const lead = deps.leads.findLeadById(result.leadId);

  assert.equal(lead.pathway, 'management_proposal');
  assert.ok(lead.slaDueAt);
  assert.equal(lead.qualificationOutcome, 'pending');
  assert.equal(lead.leadStatus, 'new');
  assert.equal(lead.ownerPartner, '', 'unassigned at intake');
});

/* ── 3. QR Contact Exchange: a Contact, and no Lead ───────────────────────── */

test('a QR contact exchange creates a Contact and no Lead', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);

  assert.equal(deps.contacts.store.rows.length, 1);
  assert.equal(deps.leads.store.rows.length, 0, 'a handshake is not a Lead');
  assert.ok(result.contactId);
  assert.equal(result.leadId, null);
});

test('the Contact points back at the Submission that produced it', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);

  const contact = deps.contacts.findContactById(result.contactId);
  assert.equal(contact.sourceSubmissionId, result.submissionId);
  assert.equal(deps.submissions.findBySubmissionId(result.submissionId).contactId, result.contactId);
});

test('a QR Contact carries no pathway, no SLA, and no qualification state', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);
  const contact = deps.contacts.findContactById(result.contactId);

  assert.equal(result.slaDueAt, null);
  assert.equal(contact.pathway, undefined);
  assert.equal(contact.slaDueAt, undefined);
  assert.equal(contact.qualificationOutcome, undefined);
  assert.equal(contact.proposalSentAt, undefined);
});

test('a QR Contact records immutable attribution and a separate unassigned owner', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);
  const contact = deps.contacts.findContactById(result.contactId);

  assert.equal(contact.acquisitionSource, 'zachary_russell');
  assert.equal(contact.scannedPartner, 'zachary_russell');
  assert.equal(contact.ownerPartner, '', 'a scan gives a name, not a claim');
  assert.equal(contact.followUpState, 'not_contacted');
});

test('a QR Contact is not linked to any Lead automatically', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);
  assert.equal(deps.contacts.findContactById(result.contactId).linkedLeadIds, '');
});

test('Google Contacts sync is not configured and carries no external reference', () => {
  const deps = buildDeps();
  const result = submit(fx.contactExchange(), deps);
  const contact = deps.contacts.findContactById(result.contactId);

  assert.equal(contact.contactSyncStatus, 'not_configured');
  assert.equal(contact.externalContactResourceName, '');
  assert.equal(contact.externalContactEtag, '');
  assert.equal(contact.externalContactSyncedAt, '');
});

/* ── 4. A match is a flag, never a link, merge, or update ─────────────────── */

test('an exact email match flags and creates a SEPARATE Contact', () => {
  const deps = buildDeps();
  const first = submit(fx.qrSubmission(1, 'zachary-russell'), deps);
  const second = submit(fx.qrSubmission(2, 'zachary-russell'), deps);

  assert.notEqual(second.contactId, first.contactId, 'never reuse an existing Contact');
  assert.equal(deps.contacts.store.rows.length, 2, 'two records, for a human to judge');

  const flagged = deps.submissions.findBySubmissionId(second.submissionId);
  assert.match(flagged.possibleMatches, new RegExp(`${first.contactId}:exact:email_exact`));
  assert.match(flagged.matchNote, /shares this email address/);
  assert.match(flagged.matchNote, /Nothing was merged, changed, or overwritten/);
});

test('an exact full-phone match flags and creates a SEPARATE Contact', () => {
  const deps = buildDeps();
  const first = submit(fx.qrSubmission(1, 'zachary-russell', { payload: { email: undefined } }), deps);
  const second = submit(fx.qrSubmission(2, 'zachary-russell', { payload: { email: undefined } }), deps);

  assert.notEqual(second.contactId, first.contactId);
  assert.equal(deps.contacts.store.rows.length, 2);
  assert.match(deps.submissions.findBySubmissionId(second.submissionId).possibleMatches, /exact:phone_exact/);
});

test('the earlier Contact is not modified in any way by a later match', () => {
  const deps = buildDeps();
  const first = submit(fx.qrSubmission(1, 'zachary-russell'), deps);
  const before = JSON.stringify(deps.contacts.findContactById(first.contactId));

  submit(fx.qrSubmission(2, 'zachary-russell', {
    payload: { company: 'A Different Company', roleOrTitle: 'A Different Role' },
  }), deps);

  const after = JSON.stringify(deps.contacts.findContactById(first.contactId));
  assert.equal(after, before, 'the existing Contact must be byte-identical');
  assert.equal(deps.contacts.updated.length, 0, 'no update call was made at all');
});

test('intake never calls updateContact', () => {
  // The strongest form of the rule: not "it updated nothing", but "it never asked to".
  const deps = buildDeps();
  deps.contacts.updateContact = () => {
    throw new Error('intake must never update an existing Contact');
  };

  submit(fx.qrSubmission(1, 'zachary-russell'), deps);
  assert.doesNotThrow(() => submit(fx.qrSubmission(2, 'zachary-russell'), deps));
});

test('a website inquiry matching an existing Contact still creates no Contact', () => {
  const deps = buildDeps();
  const qr = submit(fx.contactExchange(), deps);

  // Same person, now filling in the website form.
  submit(fx.managementProposal({
    payload: { contact: { email: 'priya@ramanbrokers.test' } },
  }), deps);

  assert.equal(deps.contacts.store.rows.length, 1, 'still just the one QR Contact');
  assert.equal(deps.leads.store.rows.length, 1);

  const lead = deps.leads.store.rows[0];
  assert.match(lead.possibleMatches, new RegExp(`${qr.contactId}:exact:email_exact`));
});

test('a non-matching submission carries no flag at all', () => {
  const deps = buildDeps();
  submit(fx.qrSubmission(1, 'zachary-russell'), deps);
  const other = submit(fx.qrSubmission(2, 'ethaniel-vu', {
    payload: { fullName: 'Someone Else', email: 'someone@else.test', phone: '713-555-0000' },
  }), deps);

  const stored = deps.submissions.findBySubmissionId(other.submissionId);
  assert.equal(stored.possibleMatches, '');
  assert.equal(stored.matchNote, '');
});

test('the merge helper is gone from the codebase', () => {
  // It existed to fold a new submission into an existing Contact. Keeping it around as
  // dead code is an invitation to call it again.
  assert.equal(typeof ctx.mergeContact, 'undefined');
});
