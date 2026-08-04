'use strict';

/*
 * The deferred-work state machine.
 *
 * WHAT THESE TESTS ARE FOR. The guarantee is BOUNDED AT-LEAST-ONCE, and both words
 * carry weight. "At-least-once" means a duplicate is possible and must not be claimed
 * away; "bounded" means a permanently failing item stops instead of emailing somebody
 * every five minutes forever. Both are asserted here, including the case that proves
 * the honest limit: a side effect that succeeded but was not acknowledged runs again.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps, fakeMailService, fakeTemplates } = require('./helpers/fakes.js');

const ctx = load();

/**
 * Delivery status now lives on its own record, keyed by submissionId.
 *
 * It moved off the Lead in Pass 9B, because a QR Contact Exchange has delivery state and
 * no Lead at all.
 */
function delivery(deps, result) {
  const row = deps.deliveries.findBySubmissionId(result.submissionId);
  assert.ok(row, `no delivery row for ${result.submissionId}`);
  return row;
}

function seedLead(deps, envelope) {
  const parsed = ctx.parseEnvelope(JSON.stringify(envelope || fx.managementProposal()));
  assert.equal(parsed.ok, true);
  return ctx.processSubmission(parsed.value, deps);
}

function runCycle(deps, handlers) {
  return ctx.runWorkerCycle(deps, handlers || ctx.defaultWorkHandlers());
}

/* ── Retry policy, tested purely ──────────────────────────────────────────── */

test('a successful attempt completes the item', () => {
  const next = ctx.nextWorkState({ attempts: 0 }, { ok: true }, new Date('2026-08-03T14:00:00.000Z'));
  assert.equal(next.state, 'succeeded');
  assert.equal(next.attempts, 1);
  assert.equal(next.nextAttemptAt, '');
});

test('a transient failure is rescheduled with a growing delay', () => {
  const now = new Date('2026-08-03T14:00:00.000Z');
  const first = ctx.nextWorkState({ attempts: 0 }, { ok: false, reason: 'quota' }, now);
  const second = ctx.nextWorkState({ attempts: 1 }, { ok: false, reason: 'quota' }, now);

  assert.equal(first.state, 'pending');
  assert.equal(second.state, 'pending');
  assert.ok(second.nextAttemptAt > first.nextAttemptAt, 'backoff must grow');
});

test('attempts are bounded and the item is abandoned, not retried forever', () => {
  const now = new Date('2026-08-03T14:00:00.000Z');
  const next = ctx.nextWorkState({ attempts: ctx.WORKER_MAX_ATTEMPTS - 1 }, { ok: false }, now);
  assert.equal(next.state, 'abandoned');
  assert.equal(next.lastError, 'max_attempts_exhausted');
});

test('a permanent failure is abandoned on the first attempt', () => {
  // Three more attempts at an unwritten template or a rejected address changes nothing.
  const now = new Date('2026-08-03T14:00:00.000Z');
  const next = ctx.nextWorkState({ attempts: 0 }, { ok: false, permanent: true, reason: 'bad_address' }, now);
  assert.equal(next.state, 'abandoned');
  assert.equal(next.attempts, 1);
});

/* ── Cycle behaviour ──────────────────────────────────────────────────────── */

test('a cycle sends the queued acknowledgement and notification', () => {
  const deps = buildDeps();
  seedLead(deps);
  const summary = runCycle(deps);

  assert.equal(summary.succeeded, 2);
  assert.equal(deps.mail.sent.length, 2);
});

test('a cycle marks the lead statuses it actually achieved', () => {
  const deps = buildDeps();
  const result = seedLead(deps);
  runCycle(deps);

  const lead = delivery(deps, result);
  assert.equal(lead.ackEmailStatus, 'sent');
  assert.equal(lead.partnerNotifyStatus, 'sent');
});

test('a completed item is not picked up again', () => {
  const deps = buildDeps();
  seedLead(deps);
  runCycle(deps);
  const second = runCycle(deps);

  assert.equal(second.claimed, 0);
  assert.equal(deps.mail.sent.length, 2);
});

test('a transient failure retries on a later cycle and then succeeds', () => {
  const mail = fakeMailService({ failTimes: 2 });
  const deps = buildDeps({ mail });
  seedLead(deps);

  const first = runCycle(deps);
  assert.equal(first.retried, 2);
  assert.equal(mail.sent.length, 0);

  // The backoff has to actually elapse; a retry before then is not due.
  deps.clock.advanceMinutes(10);
  const second = runCycle(deps);
  assert.equal(second.succeeded, 2);
  assert.equal(mail.sent.length, 2);
});

test('a not-yet-due item is not claimed', () => {
  const deps = buildDeps({ mail: fakeMailService({ failTimes: 5 }) });
  seedLead(deps);
  runCycle(deps);
  const immediate = runCycle(deps);
  assert.equal(immediate.claimed, 0);
});

test('a permanently failing send stops after one attempt and is recorded', () => {
  const deps = buildDeps({ mail: fakeMailService({ permanentFailure: true }) });
  const result = seedLead(deps);
  const summary = runCycle(deps);

  assert.equal(summary.abandoned, 0, 'a send failure is transient unless the adapter says otherwise');
  const lead = delivery(deps, result);
  assert.equal(lead.ackEmailStatus, 'failed');
});

test('an abandoned item is logged so somebody can act on it', () => {
  const deps = buildDeps({ mail: fakeMailService({ failTimes: 99 }) });
  seedLead(deps);

  for (let i = 0; i < ctx.WORKER_MAX_ATTEMPTS; i += 1) {
    runCycle(deps);
    deps.clock.advanceMinutes(120);
  }

  const abandoned = deps.log.entries.filter((e) => e.event === 'work_abandoned');
  assert.equal(abandoned.length, 2);
});

test('a handler that throws is treated as retryable, and the rest of the queue still runs', () => {
  const deps = buildDeps();
  seedLead(deps);

  const handlers = {
    send_acknowledgement() {
      throw new TypeError('boom');
    },
    notify_partners: ctx.defaultWorkHandlers().notify_partners,
  };
  const summary = runCycle(deps, handlers);

  assert.equal(summary.retried, 1);
  assert.equal(summary.succeeded, 1);
  assert.equal(deps.mail.sent.length, 1);
});

test('an unknown work kind is abandoned rather than retried forever', () => {
  const deps = buildDeps();
  seedLead(deps);
  const summary = runCycle(deps, {});
  assert.equal(summary.abandoned, 2);
});

test('a cycle claims no more than its bound', () => {
  const deps = buildDeps();
  for (let i = 0; i < 15; i += 1) {
    const id = `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`;
    seedLead(deps, fx.managementProposal({ submissionId: id }));
  }
  const summary = runCycle(deps);
  assert.equal(summary.claimed, ctx.WORKER_MAX_ITEMS_PER_RUN);
});

test('the cycle takes the lock', () => {
  const deps = buildDeps();
  seedLead(deps);
  const before = deps.lock.calls;
  runCycle(deps);
  assert.equal(deps.lock.calls, before + 1);
});

/* ── The honest limit ─────────────────────────────────────────────────────── */

test('a side effect that succeeded but was not acknowledged runs again', () => {
  // This is at-least-once, stated plainly. The email really was sent; the process
  // died before the item was marked done, so the next cycle sends it a second time.
  // No exactly-once claim is made anywhere, and this test exists so nobody adds one.
  const deps = buildDeps();
  seedLead(deps);

  const realMarkSucceeded = deps.work.markSucceeded.bind(deps.work);
  deps.work.markSucceeded = () => {
    throw new Error('CrashedBeforeAcknowledgement');
  };

  assert.throws(() => runCycle(deps));
  assert.equal(deps.mail.sent.length, 1, 'the side effect really happened');

  deps.work.markSucceeded = realMarkSucceeded;
  runCycle(deps);

  assert.equal(deps.mail.sent.length, 3, 'the unacknowledged item is delivered again');
});

/* ── Enqueue idempotency ──────────────────────────────────────────────────── */

test('enqueueing the same logical side effect twice yields one item', () => {
  const deps = buildDeps();
  const now = deps.clock.now();
  const build = (workId) =>
    ctx.buildWorkItem('send_acknowledgement', 'lead-1', {}, { workId, now, discriminator: 'ack' });

  deps.work.enqueue(build('w-1'));
  deps.work.enqueue(build('w-2'));

  assert.equal(deps.work.items.length, 1);
});

test('different leads get different items even for the same kind', () => {
  const deps = buildDeps();
  const now = deps.clock.now();
  deps.work.enqueue(ctx.buildWorkItem('send_acknowledgement', 'lead-1', {}, { workId: 'w-1', now, discriminator: 'ack' }));
  deps.work.enqueue(ctx.buildWorkItem('send_acknowledgement', 'lead-2', {}, { workId: 'w-2', now, discriminator: 'ack' }));
  assert.equal(deps.work.items.length, 2);
});

/* ── Acknowledgement rules ────────────────────────────────────────────────── */

test('a contact exchange with an email DOES get an acknowledgement', () => {
  // This supersedes the Pass 8 rule that a Contact Exchange never gets one. Somebody who
  // hands over their details and hears nothing has no way to know it worked, and no way
  // to correct a typo in their own address.
  const deps = buildDeps();
  const result = seedLead(deps, fx.contactExchange());
  runCycle(deps);

  const lead = delivery(deps, result);
  assert.equal(lead.ackEmailStatus, 'sent');
  assert.equal(deps.templates.qrAcknowledgements.length, 1);
  // It goes through the QR renderer, not the website one.
  assert.equal(deps.templates.acknowledgements.length, 0);
});

test('a phone-only contact exchange is valid and its acknowledgement is skipped', () => {
  // The Contact is fully valid and appears in the digest. There is simply nowhere to
  // write, and no SMS is designed. Skipped, not failed.
  const deps = buildDeps();
  const result = seedLead(deps, fx.contactExchange({ payload: { email: undefined } }));
  runCycle(deps);

  const lead = delivery(deps, result);
  assert.equal(lead.ackEmailStatus, 'skipped');
  assert.equal(lead.digestStatus, 'pending_digest', 'it still reaches the digest');
  assert.equal(deps.mail.sent.length, 0);
});

test('a suspected-spam contact exchange is stored and never acknowledged', () => {
  // Otherwise the form is a way to mail a third party from an address nobody owns.
  const deps = buildDeps();
  const result = seedLead(deps, fx.contactExchange({ clientSignals: { honeypot: 'bot' } }));
  runCycle(deps);

  const row = delivery(deps, result);
  assert.equal(row.ackEmailStatus, 'skipped');
  assert.equal(row.digestStatus, 'excluded_spam');
  assert.equal(deps.mail.sent.length, 0);

  // A QR exchange stores a Submission and a Contact, and no Lead.
  assert.equal(deps.submissions.store.rows.length, 1, 'submission still stored');
  assert.equal(deps.contacts.store.rows.length, 1, 'contact still stored');
  assert.equal(deps.leads.store.rows.length, 0, 'a handshake is not a Lead');
});

test('a failed QR acknowledgement never removes the stored record', () => {
  const deps = buildDeps({ mail: fakeMailService({ failTimes: 99 }) });
  const result = seedLead(deps, fx.contactExchange());
  runCycle(deps);

  assert.equal(deps.submissions.store.rows.length, 1);
  assert.equal(deps.contacts.store.rows.length, 1);
  assert.equal(deps.leads.store.rows.length, 0);
  assert.equal(delivery(deps, result).ackEmailStatus, 'failed');
});

test('a QR acknowledgement retry uses the existing bounded machinery', () => {
  const deps = buildDeps({ mail: fakeMailService({ failTimes: 1 }) });
  const result = seedLead(deps, fx.contactExchange());

  runCycle(deps);
  assert.equal(delivery(deps, result).ackEmailStatus, 'failed');

  deps.clock.advanceMinutes(10);
  runCycle(deps);
  assert.equal(delivery(deps, result).ackEmailStatus, 'sent');
  assert.equal(deps.mail.sent.length, 1, 'delivered once, not twice');
});

test('an unconfigured QR acknowledgement is recorded rather than silently dropped', () => {
  const deps = buildDeps({ config: { firmEmail: '', websiteUrl: '' } });
  const result = seedLead(deps, fx.contactExchange());
  runCycle(deps);

  assert.equal(delivery(deps, result).ackEmailStatus, 'not_configured');
});

test('a flagged submission gets no automated acknowledgement but partners are told', () => {
  const deps = buildDeps();
  const result = seedLead(deps, fx.managementProposal({ clientSignals: { honeypot: 'bot' } }));
  runCycle(deps);

  const lead = delivery(deps, result);
  assert.equal(lead.ackEmailStatus, 'skipped');
  assert.equal(lead.partnerNotifyStatus, 'sent');
});

test('an unlaunched follow-up locale is recorded but never fakes a translation', () => {
  // The visitor asked to be answered in Spanish. That preference is stored as an
  // operational fact, and the acknowledgement still goes out in English rather than in a
  // template pretending to be Spanish.
  const deps = buildDeps();
  const result = seedLead(deps, fx.investorServices());
  runCycle(deps);

  // The locale is a business fact, so it lives on the Lead and on the immutable
  // Submission, not on the delivery row.
  const lead = deps.leads.findLeadById(result.leadId);
  assert.equal(lead.preferredFollowUpLocale, 'es');
  assert.equal(lead.preferredFollowUpStated, true);
  assert.equal(deps.submissions.findBySubmissionId(result.submissionId).preferredFollowUpLocale, 'es');

  const outbound = ctx.resolveOutboundLocale(
    { preferredFollowUpLocale: 'es', pageLocale: 'en' },
    ctx.LAUNCH_READY_LOCALES,
  );
  assert.equal(outbound.locale, 'en');
  assert.equal(outbound.satisfied, false);
});

test('a missing service is recorded as not_configured, not as a silent success', () => {
  const deps = buildDeps({ config: { replyTo: '', fromName: '', partnerNotifyTo: [] } });
  const result = seedLead(deps);
  runCycle(deps);

  const lead = delivery(deps, result);
  assert.equal(lead.ackEmailStatus, 'not_configured');
  assert.equal(lead.partnerNotifyStatus, 'not_configured');
  assert.equal(deps.mail.sent.length, 0);
});

test('an unimplemented template fails permanently and is not retried', () => {
  const deps = buildDeps({ templates: ctx.notImplementedTemplates() });
  const result = seedLead(deps);
  const summary = runCycle(deps);

  assert.equal(summary.abandoned, 2);
  const lead = delivery(deps, result);
  assert.equal(lead.ackEmailStatus, 'failed');
  assert.equal(deps.mail.sent.length, 0);
});
