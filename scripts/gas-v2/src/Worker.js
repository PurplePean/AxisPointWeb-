/**
 * The deferred-work state machine.
 *
 * WHY WORK IS DEFERRED AT ALL. A submission's durable record is the only part that
 * cannot be reconstructed later. Email and calendar can be retried, resent, or done
 * by hand. So the request path writes the record and returns; everything else is
 * queued and executed by a trigger. A failing mail quota then costs a delayed
 * notification, not a lost lead.
 *
 * DELIVERY GUARANTEE, STATED HONESTLY. This is BOUNDED AT-LEAST-ONCE. A handler can
 * run more than once for the same item: the side effect happens, the process dies
 * before the item is marked done, and the next cycle retries it. There is no
 * exactly-once guarantee here and none is claimed. What IS guaranteed is that
 * attempts are bounded, so a permanently failing item stops after
 * WORKER_MAX_ATTEMPTS instead of resending forever.
 *
 * The idempotency key narrows the duplicate window rather than closing it. It stops
 * the same logical side effect from being enqueued twice; it cannot stop a crash
 * between the side effect and the acknowledgement.
 */

var WORK_STATES = ['pending', 'succeeded', 'failed', 'abandoned'];

var WORK_KINDS = [
  'send_acknowledgement',
  'notify_partners',
  'create_booking_event'
];

/**
 * Creates a work item. `idempotencyKey` makes the same logical side effect for the
 * same lead collapse to one item no matter how many times enqueue is called.
 */
function buildWorkItem(kind, leadId, payload, ctx) {
  return {
    workId: ctx.workId,
    createdAt: toIso(ctx.now),
    kind: kind,
    leadId: leadId,
    state: 'pending',
    attempts: 0,
    nextAttemptAt: toIso(ctx.now),
    lastError: '',
    completedAt: '',
    idempotencyKey: kind + ':' + leadId + ':' + (ctx.discriminator || ''),
    payload: payload || {}
  };
}

/** Backoff for the attempt about to be scheduled, given how many have already run. */
function backoffMinutesFor(attemptsMade) {
  var i = Math.min(attemptsMade, WORKER_BACKOFF_MINUTES.length - 1);
  return WORKER_BACKOFF_MINUTES[i];
}

/**
 * Decides what happens to an item after one attempt. Pure, so retry policy is
 * testable without running a single side effect.
 */
function nextWorkState(item, result, now) {
  if (result && result.ok) {
    return { state: 'succeeded', attempts: item.attempts + 1, nextAttemptAt: '', lastError: '', completedAt: toIso(now) };
  }

  // A permanent failure is not worth three more attempts. A missing configuration or
  // a rejected address will fail identically every time.
  if (result && result.permanent) {
    return {
      state: 'abandoned',
      attempts: item.attempts + 1,
      nextAttemptAt: '',
      lastError: String((result && result.reason) || 'permanent_failure'),
      completedAt: toIso(now)
    };
  }

  var attempts = item.attempts + 1;
  if (attempts >= WORKER_MAX_ATTEMPTS) {
    return {
      state: 'abandoned',
      attempts: attempts,
      nextAttemptAt: '',
      lastError: String((result && result.reason) || 'max_attempts_exhausted'),
      completedAt: toIso(now)
    };
  }

  return {
    state: 'pending',
    attempts: attempts,
    nextAttemptAt: toIso(addMinutes(now, backoffMinutesFor(attempts))),
    lastError: String((result && result.reason) || 'unknown_error'),
    completedAt: ''
  };
}

/**
 * Runs one worker cycle.
 *
 * `handlers` maps a work kind to a function (item, deps) that returns
 * { ok } or { ok: false, reason, permanent? }. A handler that throws is treated as a
 * retryable failure: one bad item must not stop the rest of the queue.
 *
 * The whole cycle takes the lock, because two overlapping trigger executions working
 * the same rows is how duplicate emails get sent.
 */
function runWorkerCycle(deps, handlers) {
  return deps.lock.withLock(function () {
    var now = deps.clock.now();
    var claimed = deps.work.claimDue(toIso(now), WORKER_MAX_ITEMS_PER_RUN);
    var summary = { claimed: claimed.length, succeeded: 0, retried: 0, abandoned: 0 };

    for (var i = 0; i < claimed.length; i++) {
      var item = claimed[i];
      var handler = handlers[item.kind];
      var result;

      if (typeof handler !== 'function') {
        // An unknown kind is a deployment mismatch, not a transient fault. Retrying it
        // every five minutes forever accomplishes nothing.
        result = { ok: false, permanent: true, reason: 'unknown_work_kind' };
      } else {
        try {
          result = handler(item, deps);
        } catch (e) {
          result = { ok: false, reason: 'handler_threw:' + safeErrorCode(e) };
        }
      }

      var next = nextWorkState(item, result, now);

      if (next.state === 'succeeded') {
        deps.work.markSucceeded(item.workId, next);
        summary.succeeded++;
      } else if (next.state === 'abandoned') {
        deps.work.markAbandoned(item.workId, next);
        summary.abandoned++;
        tryLog(deps, {
          level: 'error',
          event: 'work_abandoned',
          leadId: item.leadId,
          detail: item.kind + ':' + next.lastError
        });
      } else {
        deps.work.markFailed(item.workId, next);
        summary.retried++;
      }
    }

    return summary;
  });
}

/**
 * Error text can carry a visitor's address or a Sheet id. Only a short, stable code
 * ever reaches the log.
 */
function safeErrorCode(e) {
  var name = e && e.name ? String(e.name) : 'Error';
  return name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || 'Error';
}
