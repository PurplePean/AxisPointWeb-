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

  const lead = deps.leads.findLeadById(result.leadId);
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
  const lead = deps.leads.findLeadById(result.leadId);
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

test('a contact exchange gets no automated acknowledgement', () => {
  // It is a handshake record. An unsolicited automated email to somebody who just
  // swapped a card is the wrong move.
  const deps = buildDeps();
  const result = seedLead(deps, fx.contactExchange());
  runCycle(deps);

  const lead = deps.leads.findLeadById(result.leadId);
  assert.equal(lead.ackEmailStatus, 'skipped');
  assert.equal(deps.templates.acknowledgements.length, 0);
});

test('a flagged submission gets no automated acknowledgement but partners are told', () => {
  const deps = buildDeps();
  const result = seedLead(deps, fx.managementProposal({ clientSignals: { honeypot: 'bot' } }));
  runCycle(deps);

  const lead = deps.leads.findLeadById(result.leadId);
  assert.equal(lead.ackEmailStatus, 'skipped');
  assert.equal(lead.partnerNotifyStatus, 'sent');
});

test('an unlaunched follow-up locale falls back to English rather than faking a translation', () => {
  const templates = fakeTemplates();
  const deps = buildDeps({ templates });
  seedLead(deps, fx.investorServices());
  runCycle(deps);

  assert.equal(templates.acknowledgements[0].locale, 'en');
});

test('a missing service is recorded as not_configured, not as a silent success', () => {
  const deps = buildDeps({ config: { replyTo: '', fromName: '', partnerNotifyTo: [] } });
  const result = seedLead(deps);
  runCycle(deps);

  const lead = deps.leads.findLeadById(result.leadId);
  assert.equal(lead.ackEmailStatus, 'not_configured');
  assert.equal(lead.partnerNotifyStatus, 'not_configured');
  assert.equal(deps.mail.sent.length, 0);
});

test('an unimplemented template fails permanently and is not retried', () => {
  const deps = buildDeps({ templates: ctx.notImplementedTemplates() });
  const result = seedLead(deps);
  const summary = runCycle(deps);

  assert.equal(summary.abandoned, 2);
  const lead = deps.leads.findLeadById(result.leadId);
  assert.equal(lead.ackEmailStatus, 'failed');
  assert.equal(deps.mail.sent.length, 0);
});
