'use strict';

/*
 * Retention.
 *
 * WHAT THESE TESTS ARE FOR. Retention is the one subsystem whose bug is permanent. A
 * purge that takes too much cannot be undone by reverting a commit, and nobody notices
 * until somebody asks "have we spoken to this owner before" and the answer is gone.
 *
 * So the first group asserts a NEGATIVE, repeatedly and from several angles: no business
 * record is ever selected, whatever its age and whatever is passed in. The second group
 * asserts the other dangerous direction, which is deleting work that has not run yet: an
 * old pending item is a side effect that still needs to happen, and removing it drops the
 * acknowledgement while leaving the record looking complete.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const { buildDeps, fakeLogRepository, fakeWorkRepository } = require('./helpers/fakes.js');

const ctx = load();

const NOW = new Date('2026-08-02T12:00:00.000Z');
const OLD = '2026-01-01T12:00:00.000Z';   // 213 days before NOW
const RECENT = '2026-07-30T12:00:00.000Z'; // 3 days before NOW

function logRow(id, at) {
  return { logId: id, at: at, level: 'info', event: 'submission_accepted', detail: '' };
}

function workRow(id, state, completedAt, createdAt) {
  return {
    workId: id,
    createdAt: createdAt || OLD,
    kind: 'send_acknowledgement',
    leadId: 'lead-1',
    state: state,
    attempts: 1,
    nextAttemptAt: '',
    lastError: '',
    completedAt: completedAt || '',
  };
}

/* ── Business records never expire ────────────────────────────────────────── */

test('the plan has no key for any business record', () => {
  // The SHAPE of the plan is the policy. Adding a key would be a visible contract change
  // rather than a quiet behavioural drift.
  const plan = ctx.planRetention({ logs: [], work: [] }, NOW);
  assert.deepEqual(Object.keys(plan).sort(), ['businessRecords', 'counts', 'cutoff', 'logs', 'work']);
  assert.equal(plan.businessRecords.length, 0);
  assert.equal(plan.counts.businessRecords, 0);
});

test('business records are never selected, at any age', () => {
  const ancient = '2019-01-01T00:00:00.000Z';
  const plan = ctx.planRetention({
    logs: [],
    work: [],
    leads: [{ leadId: 'l-1', receivedAt: ancient }],
    contacts: [{ contactId: 'c-1', createdAt: ancient }],
    submissions: [{ submissionId: 's-1', receivedAt: ancient }],
  }, NOW);

  assert.equal(plan.businessRecords.length, 0);
  assert.equal(plan.counts.logs, 0);
  assert.equal(plan.counts.work, 0);
});

test('the maintenance run touches no lead or contact repository method', () => {
  const deps = buildDeps({ log: fakeLogRepository([logRow('g-1', OLD)]) });
  let leadWrites = 0;
  let contactWrites = 0;
  deps.leads.updateLeadFields = () => { leadWrites += 1; return true; };
  deps.contacts.updateContact = () => { contactWrites += 1; return true; };

  ctx.runRetentionMaintenance(deps);

  assert.equal(leadWrites, 0);
  assert.equal(contactWrites, 0);
  assert.equal(deps.leads.store.rows.length, 0);
});

test('there is no business-record purge function to call', () => {
  assert.equal(typeof ctx.purgeLeads, 'undefined');
  assert.equal(typeof ctx.purgeContacts, 'undefined');
  assert.equal(typeof ctx.selectExpiredLeads, 'undefined');
  assert.equal(typeof ctx.selectExpiredContacts, 'undefined');
});

/* ── Operational records expire at 90 days ────────────────────────────────── */

test('the operational window is 90 days', () => {
  assert.equal(ctx.OPERATIONAL_RETENTION_DAYS, 90);
});

test('a log line older than 90 days is selected', () => {
  const expired = ctx.selectExpiredLogs([logRow('a', OLD), logRow('b', RECENT)], NOW);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].logId, 'a');
});

test('the boundary is exact to the minute', () => {
  const cutoff = ctx.retentionCutoff(NOW);
  const justInside = new Date(cutoff.getTime() + 60000).toISOString();
  const justOutside = new Date(cutoff.getTime() - 60000).toISOString();

  const expired = ctx.selectExpiredLogs([logRow('in', justInside), logRow('out', justOutside)], NOW);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].logId, 'out');
});

test('a log line with an unreadable date is kept, not removed', () => {
  // Deleting a record because its date could not be parsed turns a data problem into
  // data loss.
  const expired = ctx.selectExpiredLogs([logRow('bad', 'not-a-date'), logRow('blank', '')], NOW);
  assert.equal(expired.length, 0);
});

test('a completed work item older than 90 days is selected', () => {
  const expired = ctx.selectExpiredWork([workRow('w1', 'succeeded', OLD)], NOW);
  assert.equal(expired.length, 1);
});

test('a permanently exhausted work item is also selected', () => {
  const expired = ctx.selectExpiredWork([workRow('w1', 'abandoned', OLD)], NOW);
  assert.equal(expired.length, 1);
});

/* ── Pending work is never removed ────────────────────────────────────────── */

test('an old pending item is never removed', () => {
  // It is a side effect that has not happened yet. Removing it drops the
  // acknowledgement while leaving the record looking complete.
  const expired = ctx.selectExpiredWork([workRow('w1', 'pending', '', OLD)], NOW);
  assert.equal(expired.length, 0);
});

test('an old retrying item is never removed', () => {
  const item = workRow('w1', 'pending', '', OLD);
  item.attempts = 2;
  item.nextAttemptAt = '2026-08-02T13:00:00.000Z';
  assert.equal(ctx.selectExpiredWork([item], NOW).length, 0);
});

test('age is measured from completion, not creation', () => {
  // An item created long ago that retried for weeks and finished yesterday is young.
  const item = workRow('w1', 'succeeded', RECENT, OLD);
  assert.equal(ctx.selectExpiredWork([item], NOW).length, 0);
});

test('a terminal item with no completion timestamp is kept', () => {
  assert.equal(ctx.selectExpiredWork([workRow('w1', 'succeeded', '')], NOW).length, 0);
});

/* ── The maintenance handler ──────────────────────────────────────────────── */

test('the handler removes exactly what the plan selected', () => {
  const log = fakeLogRepository([logRow('old-1', OLD), logRow('new-1', RECENT)]);
  const work = fakeWorkRepository([
    workRow('done-old', 'succeeded', OLD),
    workRow('done-new', 'succeeded', RECENT),
    workRow('still-pending', 'pending', '', OLD),
  ]);
  const deps = buildDeps({ log, work, clock: { now: () => NOW } });

  const result = ctx.runRetentionMaintenance(deps);

  assert.equal(result.removed.logs, 1);
  assert.equal(result.removed.work, 1);
  assert.deepEqual(log.entries.map((e) => e.logId).filter(Boolean), ['new-1']);
  assert.deepEqual(
    Array.from(work.items).map((i) => i.workId).sort(),
    ['done-new', 'still-pending'],
  );
});

test('a dry run reports what would go without removing anything', () => {
  // How this should be run the first time against real data.
  const log = fakeLogRepository([logRow('old-1', OLD)]);
  const deps = buildDeps({ log, clock: { now: () => NOW } });

  const result = ctx.runRetentionMaintenance(deps, { dryRun: true });

  assert.equal(result.dryRun, true);
  assert.equal(result.counts.logs, 1);
  assert.equal(result.removed.logs, 0);
  assert.equal(log.entries.length, 1, 'nothing was actually removed');
});

test('a run with nothing eligible removes nothing and does not fail', () => {
  const deps = buildDeps({
    log: fakeLogRepository([logRow('new-1', RECENT)]),
    clock: { now: () => NOW },
  });
  const result = ctx.runRetentionMaintenance(deps);
  assert.equal(result.removed.logs, 0);
});

test('the maintenance run takes the lock', () => {
  const deps = buildDeps({ clock: { now: () => NOW } });
  ctx.runRetentionMaintenance(deps);
  assert.equal(deps.lock.calls, 1);
});

test('a custom window is honoured, and still only for operational records', () => {
  const plan = ctx.planRetention({
    logs: [logRow('a', RECENT)],
    work: [],
    leads: [{ leadId: 'l-1', receivedAt: '2019-01-01T00:00:00.000Z' }],
  }, NOW, 1);

  assert.equal(plan.counts.logs, 1);
  assert.equal(plan.counts.businessRecords, 0);
});

/* ── No trigger is installed ──────────────────────────────────────────────── */

test('the handler is callable but this repository schedules nothing', () => {
  assert.equal(typeof ctx.runRetentionMaintenance, 'function');
  assert.equal(typeof ctx.runRetentionMaintenanceTrigger, 'function');
});
