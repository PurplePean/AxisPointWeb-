'use strict';

/*
 * Partial-write recovery.
 *
 * THE FAILURE THIS GUARDS. Intake writes the immutable Submission first, deliberately: it
 * is the record that cannot be reconstructed. But that ordering means a failure anywhere
 * after it leaves a Submission with no business record, no Delivery row, or no queued
 * work, and the retry then finds the Submission and says "already stored".
 *
 * That is the worst possible combination. The visitor is told it worked, and the request
 * is permanently invisible: no acknowledgement, no digest entry, nothing in the tab a
 * partner reads. Nobody ever finds out, because from the outside it looks like a success.
 *
 * Every test here injects a real failure at one boundary, then retries and asserts the
 * request is whole. The last group asserts the other half of the contract: repair must
 * never duplicate, and a reused id carrying different data is a conflict, not a replay.
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

/**
 * Runs a submission with one repository call sabotaged, so the write really fails partway
 * through exactly as it would in production.
 */
function submitWithFailure(envelope, deps, breakIt) {
  const restore = breakIt(deps);
  assert.throws(() => submit(envelope, deps), /InjectedFailure/);
  restore();
}

const boom = () => {
  throw new Error('InjectedFailure');
};

/* ── The Submission survives every injected failure ───────────────────────── */

test('a failure after the Submission write leaves the Submission behind', () => {
  const deps = buildDeps();
  submitWithFailure(fx.managementProposal(), deps, (d) => {
    const real = d.leads.insertLead;
    d.leads.insertLead = boom;
    return () => { d.leads.insertLead = real; };
  });

  assert.equal(deps.submissions.store.rows.length, 1, 'the audit record landed');
  assert.equal(deps.leads.store.rows.length, 0, 'and nothing downstream did');
});

/* ── Boundary 1: the Lead is missing ──────────────────────────────────────── */

test('a retry rebuilds a missing Lead', () => {
  const deps = buildDeps();
  submitWithFailure(fx.managementProposal(), deps, (d) => {
    const real = d.leads.insertLead;
    d.leads.insertLead = boom;
    return () => { d.leads.insertLead = real; };
  });

  const result = submit(fx.managementProposal(), deps);

  assert.equal(result.replay, true);
  assert.equal(deps.leads.store.rows.length, 1, 'the Lead was repaired');
  assert.equal(result.leadId, deps.submissions.store.rows[0].leadId, 'under its original id');

  const lead = deps.leads.findLeadById(result.leadId);
  assert.equal(lead.pathway, 'management_proposal');
  assert.equal(lead.propertyLocation, 'Dallas, TX');
  assert.ok(lead.slaDueAt, 'the SLA is restored, not left blank');
  assert.equal(lead.bookingEligible, true);
});

test('a repaired Lead reports the same booking eligibility the first attempt would have', () => {
  const deps = buildDeps();
  submitWithFailure(fx.investorServices(), deps, (d) => {
    const real = d.leads.insertLead;
    d.leads.insertLead = boom;
    return () => { d.leads.insertLead = real; };
  });

  const result = submit(fx.investorServices(), deps);
  assert.equal(result.bookingEligible, false);
  assert.equal(deps.leads.store.rows[0].bookingEligible, false);
});

/* ── Boundary 2: the Contact is missing ───────────────────────────────────── */

test('a retry rebuilds a missing Contact under its original id', () => {
  const deps = buildDeps();
  submitWithFailure(fx.contactExchange(), deps, (d) => {
    const real = d.contacts.insertContact;
    d.contacts.insertContact = boom;
    return () => { d.contacts.insertContact = real; };
  });

  const result = submit(fx.contactExchange(), deps);

  assert.equal(result.replay, true);
  assert.equal(deps.contacts.store.rows.length, 1);
  assert.equal(result.contactId, deps.submissions.store.rows[0].contactId);

  const contact = deps.contacts.findContactById(result.contactId);
  assert.equal(contact.fullName, 'Priya Raman');
  assert.equal(contact.acquisitionSource, 'zachary_russell');
  assert.equal(contact.ownerPartner, '', 'still unassigned');
  assert.equal(contact.contactSyncStatus, 'not_configured');
  assert.equal(deps.leads.store.rows.length, 0, 'still no Lead');
});

test('repairing a Contact does not link it to anybody else', () => {
  // The repair path creates a record. It must not become a back door into the reuse
  // behaviour the approved rule forbids.
  const deps = buildDeps();
  const first = submit(fx.qrSubmission(1, 'zachary-russell'), deps);

  submitWithFailure(fx.qrSubmission(2, 'zachary-russell'), deps, (d) => {
    const real = d.contacts.insertContact;
    d.contacts.insertContact = boom;
    return () => { d.contacts.insertContact = real; };
  });

  deps.contacts.updateContact = () => {
    throw new Error('repair must never update an existing Contact');
  };
  const repaired = submit(fx.qrSubmission(2, 'zachary-russell'), deps);

  assert.notEqual(repaired.contactId, first.contactId);
  assert.equal(deps.contacts.store.rows.length, 2);
});

test('a repaired Contact keeps the match flags raised at submission time', () => {
  // Re-running the match today would give a different answer, because the Contacts tab
  // has grown since. The flags belong to the moment of submission.
  const deps = buildDeps();
  submit(fx.qrSubmission(1, 'zachary-russell'), deps);

  submitWithFailure(fx.qrSubmission(2, 'zachary-russell'), deps, (d) => {
    const real = d.contacts.insertContact;
    d.contacts.insertContact = boom;
    return () => { d.contacts.insertContact = real; };
  });

  const repaired = submit(fx.qrSubmission(2, 'zachary-russell'), deps);
  const contact = deps.contacts.findContactById(repaired.contactId);
  assert.match(contact.possibleMatches, /exact:email_exact/);
});

/* ── Boundary 3: the Delivery row is missing ──────────────────────────────── */

test('a retry rebuilds a missing Delivery row for a website inquiry', () => {
  const deps = buildDeps();
  submitWithFailure(fx.managementProposal(), deps, (d) => {
    const real = d.deliveries.insertDelivery;
    d.deliveries.insertDelivery = boom;
    return () => { d.deliveries.insertDelivery = real; };
  });

  const result = submit(fx.managementProposal(), deps);
  const row = deps.deliveries.findBySubmissionId(result.submissionId);

  assert.ok(row, 'the delivery row was repaired');
  assert.equal(row.ackEmailStatus, 'pending');
  assert.equal(row.partnerNotifyStatus, 'pending');
  assert.equal(row.digestStatus, 'not_applicable');
});

test('a retry rebuilds a missing Delivery row for a QR exchange, with digest state intact', () => {
  // Without this, the Contact exists and is invisible to the digest forever.
  const deps = buildDeps();
  submitWithFailure(fx.contactExchange(), deps, (d) => {
    const real = d.deliveries.insertDelivery;
    d.deliveries.insertDelivery = boom;
    return () => { d.deliveries.insertDelivery = real; };
  });

  const result = submit(fx.contactExchange(), deps);
  const row = deps.deliveries.findBySubmissionId(result.submissionId);

  assert.equal(row.digestStatus, 'pending_digest');
  assert.equal(row.partnerNotifyStatus, 'deferred_to_digest');

  // And it really does reach the digest afterwards.
  const summary = ctx.runDailyQrDigest(deps);
  assert.equal(summary.sent, 1);
});

test('a repaired Delivery row keeps a flagged submission excluded from the digest', () => {
  const deps = buildDeps();
  const flagged = fx.contactExchange({ clientSignals: { honeypot: 'bot' } });

  submitWithFailure(flagged, deps, (d) => {
    const real = d.deliveries.insertDelivery;
    d.deliveries.insertDelivery = boom;
    return () => { d.deliveries.insertDelivery = real; };
  });

  const result = submit(flagged, deps);
  assert.equal(deps.deliveries.findBySubmissionId(result.submissionId).digestStatus, 'excluded_spam');
});

/* ── Boundary 4: work items are missing ───────────────────────────────────── */

test('a retry restores missing work items for a website inquiry', () => {
  const deps = buildDeps();
  submitWithFailure(fx.managementProposal(), deps, (d) => {
    const real = d.work.enqueue;
    d.work.enqueue = boom;
    return () => { d.work.enqueue = real; };
  });

  assert.equal(deps.work.items.length, 0);
  submit(fx.managementProposal(), deps);

  assert.deepEqual(
    Array.from(deps.work.kinds()).sort(),
    ['notify_partners', 'send_acknowledgement'],
  );
});

test('a retry restores a missing QR acknowledgement item', () => {
  const deps = buildDeps();
  submitWithFailure(fx.contactExchange(), deps, (d) => {
    const real = d.work.enqueue;
    d.work.enqueue = boom;
    return () => { d.work.enqueue = real; };
  });

  submit(fx.contactExchange(), deps);
  assert.deepEqual(Array.from(deps.work.kinds()), ['send_qr_acknowledgement']);
});

test('a retry restores only the item that is missing, not the one that survived', () => {
  // The acknowledgement enqueues first, so a failure on the second call leaves one behind.
  const deps = buildDeps();
  let calls = 0;
  const realEnqueue = deps.work.enqueue.bind(deps.work);
  deps.work.enqueue = (item) => {
    calls += 1;
    if (calls === 2) throw new Error('InjectedFailure');
    return realEnqueue(item);
  };
  assert.throws(() => submit(fx.managementProposal(), deps), /InjectedFailure/);
  deps.work.enqueue = realEnqueue;

  assert.equal(deps.work.items.length, 1);
  const survivingWorkId = deps.work.items[0].workId;

  submit(fx.managementProposal(), deps);

  assert.equal(deps.work.items.length, 2);
  assert.equal(deps.work.items[0].workId, survivingWorkId, 'the survivor was not replaced');
});

test('the whole request is workable after a repair', () => {
  // The real proof: repair, then run the worker, and the acknowledgement actually sends.
  const deps = buildDeps();
  submitWithFailure(fx.managementProposal(), deps, (d) => {
    const real = d.leads.insertLead;
    d.leads.insertLead = boom;
    return () => { d.leads.insertLead = real; };
  });

  const result = submit(fx.managementProposal(), deps);
  const summary = ctx.runWorkerCycle(deps, ctx.defaultWorkHandlers());

  assert.equal(summary.succeeded, 2);
  assert.equal(deps.mail.sent.length, 2);
  assert.equal(deps.deliveries.findBySubmissionId(result.submissionId).ackEmailStatus, 'sent');
});

/* ── Repair never duplicates ──────────────────────────────────────────────── */

test('repairing never creates a second Submission, Lead, Delivery, or work item', () => {
  const deps = buildDeps();
  submitWithFailure(fx.managementProposal(), deps, (d) => {
    const real = d.deliveries.insertDelivery;
    d.deliveries.insertDelivery = boom;
    return () => { d.deliveries.insertDelivery = real; };
  });

  submit(fx.managementProposal(), deps);
  submit(fx.managementProposal(), deps);
  submit(fx.managementProposal(), deps);

  assert.equal(deps.submissions.store.rows.length, 1);
  assert.equal(deps.leads.store.rows.length, 1);
  assert.equal(deps.contacts.store.rows.length, 0);
  assert.equal(deps.deliveries.store.rows.length, 1);
  assert.equal(deps.work.items.length, 2);
});

test('repairing never creates a second Contact', () => {
  const deps = buildDeps();
  submitWithFailure(fx.contactExchange(), deps, (d) => {
    const real = d.deliveries.insertDelivery;
    d.deliveries.insertDelivery = boom;
    return () => { d.deliveries.insertDelivery = real; };
  });

  submit(fx.contactExchange(), deps);
  submit(fx.contactExchange(), deps);

  assert.equal(deps.contacts.store.rows.length, 1);
  assert.equal(deps.submissions.store.rows.length, 1);
  assert.equal(deps.work.items.length, 1);
});

test('a clean retry with nothing to repair changes nothing at all', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);

  const before = JSON.stringify({
    submissions: deps.submissions.store.rows,
    leads: deps.leads.store.rows,
    deliveries: deps.deliveries.store.rows,
    work: deps.work.items,
  });

  submit(fx.managementProposal(), deps);

  assert.equal(JSON.stringify({
    submissions: deps.submissions.store.rows,
    leads: deps.leads.store.rows,
    deliveries: deps.deliveries.store.rows,
    work: deps.work.items,
  }), before);
});

test('a repair is logged, so a silent half-write leaves evidence', () => {
  const deps = buildDeps();
  submitWithFailure(fx.managementProposal(), deps, (d) => {
    const real = d.leads.insertLead;
    d.leads.insertLead = boom;
    return () => { d.leads.insertLead = real; };
  });
  submit(fx.managementProposal(), deps);

  const entry = deps.log.entries.find((e) => e.event === 'submission_reconciled');
  assert.ok(entry, 'the repair was recorded');
  assert.match(entry.detail, /lead/);
  assert.equal(entry.level, 'error');
});

test('reconciliation never rewrites the immutable Submission', () => {
  const deps = buildDeps();
  submitWithFailure(fx.contactExchange(), deps, (d) => {
    const real = d.contacts.insertContact;
    d.contacts.insertContact = boom;
    return () => { d.contacts.insertContact = real; };
  });

  const stored = JSON.stringify(deps.submissions.store.rows[0]);
  submit(fx.contactExchange(), deps);

  assert.equal(JSON.stringify(deps.submissions.store.rows[0]), stored);
});

/* ── A reused id with different data is a conflict ────────────────────────── */

test('the same id with materially different data is refused, not replayed', () => {
  const deps = buildDeps();
  submit(fx.contactExchange(), deps);

  const tampered = fx.contactExchange({
    payload: { fullName: 'Somebody Else', email: 'somebody@else.test' },
  });
  const result = submit(tampered, deps);

  assert.equal(result.ok, false);
  assert.equal(result.code, 'SUBMISSION_ID_CONFLICT');
  assert.equal(deps.contacts.store.rows.length, 1, 'nothing was created');
  assert.equal(deps.contacts.store.rows[0].fullName, 'Priya Raman', 'and nothing overwritten');
});

test('a changed category is material', () => {
  const deps = buildDeps();
  submit(fx.contactExchange(), deps);
  const result = submit(fx.contactExchange({ payload: { contactCategory: 'other' } }), deps);
  assert.equal(result.code, 'SUBMISSION_ID_CONFLICT');
});

test('a changed acquisition source is material', () => {
  // The same details submitted from a different partner's card is a different request.
  const deps = buildDeps();
  submit(fx.contactExchange(), deps);
  const result = submit(
    fx.contactExchange({ attribution: { sourceDetail: 'ethaniel-vu' } }),
    deps,
  );
  assert.equal(result.code, 'SUBMISSION_ID_CONFLICT');
});

test('a changed follow-up language is material', () => {
  const deps = buildDeps();
  submit(fx.managementProposal(), deps);
  const result = submit(
    fx.managementProposal({ locale: { page: 'en', preferredFollowUp: 'es' } }),
    deps,
  );
  assert.equal(result.code, 'SUBMISSION_ID_CONFLICT');
});

test('a new client clock reading and fill time are NOT material', () => {
  // An honest retry carries both. Treating either as a change would make every genuine
  // retry a conflict.
  const deps = buildDeps();
  const first = submit(fx.managementProposal(), deps);

  const retried = submit(fx.managementProposal({
    submittedAt: '2026-08-03T15:30:00.000Z',
    clientSignals: { fillSeconds: 302 },
  }), deps);

  assert.equal(retried.ok, true);
  assert.equal(retried.replay, true);
  assert.equal(retried.leadId, first.leadId);
});

test('a conflict is refused at the endpoint with its code', () => {
  const deps = buildDeps();
  ctx.handlePost(JSON.stringify(fx.contactExchange()), { ok: true, deps });

  const body = ctx.handlePost(
    JSON.stringify(fx.contactExchange({ payload: { fullName: 'Somebody Else' } })),
    { ok: true, deps },
  );

  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'SUBMISSION_ID_CONFLICT');
});

/* ── One booking rule ─────────────────────────────────────────────────────── */

test('the separate booking-pathway list is gone', () => {
  assert.equal(typeof ctx.BOOKABLE_PATHWAYS, 'undefined');
  assert.equal(typeof ctx.isBookablePathway, 'function');
});

test('the booking command and the intake response agree on every pathway', () => {
  // The whole reason for removing the second list. A form offering a call the command
  // then refuses is the visible symptom of two policies drifting apart.
  const cases = [
    [fx.managementProposal(), true],
    [fx.investorServices(), false],
    [fx.generalInquiry(), false],
  ];

  cases.forEach(([envelope, expected]) => {
    const deps = buildDeps();
    const result = submit(envelope, deps);
    assert.equal(result.bookingEligible, expected, 'intake response');

    const parsed = ctx.parseEnvelope(JSON.stringify(
      fx.bookingRequest({ leadId: result.leadId, slotStart: '2026-08-04T15:00:00.000Z' }),
    ));
    const booking = ctx.executeBookingCommand(parsed.value, deps);
    const commandAllows = booking.code !== 'PATHWAY_NOT_BOOKABLE';

    assert.equal(commandAllows, expected, 'booking command');
  });
});

test('the command re-evaluates the rule rather than trusting the stored snapshot', () => {
  // `bookingEligible` is an intake-time snapshot for the frontend. If somebody edits it in
  // the Sheet, the command must still apply the real rule.
  const deps = buildDeps();
  const result = submit(fx.investorServices(), deps);
  deps.leads.updateLeadFields(result.leadId, { bookingEligible: true });

  const parsed = ctx.parseEnvelope(JSON.stringify(
    fx.bookingRequest({ leadId: result.leadId, slotStart: '2026-08-04T15:00:00.000Z' }),
  ));
  const booking = ctx.executeBookingCommand(parsed.value, deps);

  assert.equal(booking.code, 'PATHWAY_NOT_BOOKABLE');
});
