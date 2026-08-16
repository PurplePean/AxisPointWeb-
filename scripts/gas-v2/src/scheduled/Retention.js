/**
 * Retention.
 *
 * THE POLICY IN ONE LINE: business records never expire automatically, operational
 * records expire after 90 days.
 *
 * WHY BUSINESS RECORDS HAVE NO EXPIRY. A Lead, a Contact, a submission, its attribution,
 * its qualification history, and its proposal milestones are the firm's record of a
 * relationship. Deleting them on a timer destroys the answer to "have we spoken to this
 * owner before", which is the single question this whole system exists to answer. There
 * is no business-record purge job in this repository, and `selectExpired` will not
 * return one under any input, which is asserted by test rather than left to review.
 *
 * WHY OPERATIONAL RECORDS DO EXPIRE. Log lines and finished delivery bookkeeping are
 * diagnostics. Ninety days is long enough to investigate an incident and short enough
 * that the Sheet stays workable.
 *
 * WHAT IS NEVER PURGED, REGARDLESS OF AGE: pending or retryable work. An old queued item
 * is a side effect that has not happened yet. Deleting it because it is old would drop
 * the acknowledgement rather than deliver it, and the record would look complete.
 *
 * NOT AUTOMATED HERE, BY DESIGN: manual correction and deletion on request remain
 * possible and are performed by a person. Legal hold is an operational procedure, not a
 * flag this code honours. Any future business-record cleanup policy requires explicit
 * approval and its own tests before a line of it is written.
 */

/** The record classes this module is permitted to touch. Nothing else is eligible. */
var OPERATIONAL_RECORD_KINDS = ['log', 'work_completed'];

/** Work states that represent finished bookkeeping, and therefore may age out. */
var TERMINAL_WORK_STATES = ['succeeded', 'abandoned'];

/**
 * The cutoff instant. Anything strictly older than this is eligible.
 *
 * Pure, and takes `now` explicitly, so the boundary is testable to the minute rather
 * than by waiting ninety days.
 */
function retentionCutoff(now, days) {
  var d = typeof days === 'number' ? days : OPERATIONAL_RETENTION_DAYS;
  return new Date(new Date(now).getTime() - d * 24 * 60 * 60000);
}

/**
 * Selects log rows old enough to remove.
 *
 * A row with no readable timestamp is KEPT. Deleting a record because its date could not
 * be parsed would make a data problem into data loss.
 */
function selectExpiredLogs(rows, now, days) {
  var cutoff = retentionCutoff(now, days);
  return rows.filter(function (row) {
    var at = parseIso(row.at);
    if (!at) return false;
    return at.getTime() < cutoff.getTime();
  });
}

/**
 * Selects finished work items old enough to remove.
 *
 * Two guards, both load-bearing:
 *   - only terminal states are eligible, so a pending or retrying item is never removed
 *   - completion age is measured from `completedAt`, not `createdAt`, so an item that
 *     retried for a long time is judged by when it actually finished
 */
function selectExpiredWork(items, now, days) {
  var cutoff = retentionCutoff(now, days);
  return items.filter(function (item) {
    if (TERMINAL_WORK_STATES.indexOf(String(item.state)) === -1) return false;
    var done = parseIso(item.completedAt);
    if (!done) return false;
    return done.getTime() < cutoff.getTime();
  });
}

/**
 * The whole retention decision, as data.
 *
 * Returning a plan rather than performing deletions means the selection rules are
 * testable in isolation, and a caller can log exactly what is about to be removed before
 * anything is removed.
 */
function planRetention(snapshot, now, days) {
  var logs = selectExpiredLogs(snapshot.logs || [], now, days);
  var work = selectExpiredWork(snapshot.work || [], now, days);

  return {
    cutoff: toIso(retentionCutoff(now, days)),
    /* Named explicitly so the shape of this plan makes the policy legible: there is no
     * key for leads, contacts, submissions, or attribution, and adding one would be a
     * visible change to this contract rather than a quiet behavioural drift. */
    logs: logs,
    work: work,
    businessRecords: [],
    counts: { logs: logs.length, work: work.length, businessRecords: 0 }
  };
}

/**
 * Callable maintenance handler.
 *
 * Runs the plan and removes what it selected. NO TRIGGER IS INSTALLED IN THIS PASS;
 * scheduling it is a separate, deliberate operation against a real Apps Script project.
 *
 * `dryRun` reports what would be removed without removing it, which is how this should
 * be run the first time against real data.
 */
function runRetentionMaintenance(deps, options) {
  var opts = options || {};
  return deps.lock.withLock(function () {
    var now = deps.clock.now();
    var plan = planRetention({
      logs: deps.log.listAll ? deps.log.listAll() : [],
      work: deps.work.listAll ? deps.work.listAll() : []
    }, now, opts.days);

    if (opts.dryRun === true) {
      return { dryRun: true, cutoff: plan.cutoff, counts: plan.counts, removed: { logs: 0, work: 0 } };
    }

    var removedLogs = 0;
    var removedWork = 0;

    if (plan.logs.length > 0 && deps.log.removeByIds) {
      removedLogs = deps.log.removeByIds(plan.logs.map(function (r) { return r.logId; }));
    }
    if (plan.work.length > 0 && deps.work.removeByIds) {
      removedWork = deps.work.removeByIds(plan.work.map(function (r) { return r.workId; }));
    }

    tryLog(deps, {
      level: 'info',
      event: 'retention_run',
      detail: 'cutoff=' + plan.cutoff + ' logs=' + removedLogs + ' work=' + removedWork
    });

    return {
      dryRun: false,
      cutoff: plan.cutoff,
      counts: plan.counts,
      removed: { logs: removedLogs, work: removedWork }
    };
  });
}
