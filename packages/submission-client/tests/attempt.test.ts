import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSubmissionClient } from '../src/attempt';
import { simulatorTransport } from '../src/transport';
import { isSubmissionId } from '../src/id';
import type { EnvelopeDraft, SubmissionEnvelope } from '../src/index';
import type { ClientResult, ClientSuccess } from '../src/errors';
import type { Transport } from '../src/transport';

/*
 * The retry attempt.
 *
 * WHAT THESE TESTS ARE FOR. Both ways of getting the submission id wrong are silent from
 * the visitor's side.
 *
 *   A fresh id on retry   creates a second Lead or Contact for one person. Both requests
 *                         succeeded, so nothing surfaces it.
 *   A reused id after an  earns SUBMISSION_ID_CONFLICT, and the edited answers are NOT
 *   edit                  stored, while the visitor believes they were.
 *
 * Everything below exists to pin one of those two.
 */

function draft(overrides: Partial<EnvelopeDraft> = {}): EnvelopeDraft {
  return {
    submissionKind: 'service_inquiry',
    locale: { page: 'en', preferredFollowUp: null },
    attribution: { sourceCategory: 'website', sourceDetail: '/contact' },
    payload: {
      pathway: 'general_inquiry',
      topic: 'press_or_media',
      contact: { fullName: 'Robin Slate', email: 'robin@example.test' },
    },
    ...overrides,
  } as EnvelopeDraft;
}

/** Records every envelope it is handed, so a test can compare attempt to attempt. */
function recordingTransport(results: ClientResult[]): Transport & { seen: SubmissionEnvelope[] } {
  const seen: SubmissionEnvelope[] = [];
  let call = 0;
  return {
    kind: 'simulator',
    seen,
    async send(envelope) {
      seen.push(JSON.parse(JSON.stringify(envelope)) as SubmissionEnvelope);
      const result = results[Math.min(call, results.length - 1)];
      call += 1;
      return result;
    },
  };
}

const ok = (bookingEligible = true): ClientSuccess => ({
  outcome: 'ok',
  response: {
    schemaVersion: 1,
    ok: true,
    submissionKind: 'service_inquiry',
    submissionId: 'assigned-by-test',
    leadId: 'lead-1',
    contactId: null,
    slaDueAt: '2026-08-05T22:00:00.000Z',
    bookingEligible,
    replay: false,
  },
});

const retryable: ClientResult = {
  outcome: 'retryable',
  code: 'NETWORK_UNAVAILABLE',
  field: null,
  attemptExhausted: false,
};

const conflict: ClientResult = {
  outcome: 'permanent',
  code: 'SUBMISSION_ID_CONFLICT',
  field: null,
  attemptExhausted: true,
};

/* ── One id per attempt ───────────────────────────────────────────────────── */

test('an attempt generates exactly one submission id, in valid UUID v4 form', async () => {
  const transport = recordingTransport([ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());

  assert.equal(transport.seen.length, 1);
  assert.equal(isSubmissionId(transport.seen[0].submissionId), true);
});

test('the envelope carries the schema version and an advisory timestamp', async () => {
  const transport = recordingTransport([ok()]);
  const client = createSubmissionClient({
    transport,
    now: () => new Date('2026-08-04T12:00:00.000Z'),
  });

  await client.submit(draft());

  assert.equal(transport.seen[0].schemaVersion, 1);
  assert.equal(transport.seen[0].submittedAt, '2026-08-04T12:00:00.000Z');
});

/* ── Retry reuses the identical id and envelope ───────────────────────────── */

test('a retry sends the identical id and the identical envelope', async () => {
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  assert.equal(client.getSnapshot().retryable, true);

  await client.retry();

  assert.equal(transport.seen.length, 2);
  assert.equal(transport.seen[1].submissionId, transport.seen[0].submissionId);
  assert.deepEqual(transport.seen[1], transport.seen[0], 'byte-identical, timestamp included');
});

test('several retries all reuse the one id', async () => {
  const transport = recordingTransport([retryable, retryable, retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  await client.retry();
  await client.retry();
  await client.retry();

  const ids = new Set(transport.seen.map((e) => e.submissionId));
  assert.equal(transport.seen.length, 4);
  assert.equal(ids.size, 1, 'one id across every send');
});

test('a resubmit with an unchanged draft continues the same attempt', async () => {
  // A visitor pressing the primary button again after a failure, rather than a dedicated
  // retry control, must not start a second submission.
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  await client.submit(draft());

  assert.equal(transport.seen[1].submissionId, transport.seen[0].submissionId);
});

test('key order in the draft does not start a new attempt', async () => {
  // Two objects with the same content but different insertion order are the same request.
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit({
    submissionKind: 'service_inquiry',
    locale: { page: 'en', preferredFollowUp: null },
    attribution: { sourceDetail: '/contact', sourceCategory: 'website' },
    payload: {
      contact: { email: 'robin@example.test', fullName: 'Robin Slate' },
      topic: 'press_or_media',
      pathway: 'general_inquiry',
    },
  } as EnvelopeDraft);

  await client.submit(draft());

  assert.equal(transport.seen[1].submissionId, transport.seen[0].submissionId);
});

/* ── A material edit ends the attempt ─────────────────────────────────────── */

test('editing an answer after a failure creates a new attempt and a new id', async () => {
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());

  const edited = draft({
    payload: {
      pathway: 'general_inquiry',
      topic: 'employment',
      contact: { fullName: 'Robin Slate', email: 'robin@example.test' },
    },
  } as Partial<EnvelopeDraft>);
  await client.submit(edited);

  assert.notEqual(transport.seen[1].submissionId, transport.seen[0].submissionId);
  const edittedPayload = transport.seen[1].payload as { topic?: string };
  assert.equal(edittedPayload.topic, 'employment');
});

test('a changed contact detail is a material edit', async () => {
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  await client.submit(draft({
    payload: {
      pathway: 'general_inquiry',
      topic: 'press_or_media',
      contact: { fullName: 'Robin Slate', email: 'a-different@example.test' },
    },
  } as Partial<EnvelopeDraft>));

  assert.notEqual(transport.seen[1].submissionId, transport.seen[0].submissionId);
});

test('a changed follow-up language is a material edit', async () => {
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  await client.submit(draft({ locale: { page: 'en', preferredFollowUp: 'es' } }));

  assert.notEqual(transport.seen[1].submissionId, transport.seen[0].submissionId);
});

test('a new client signal is NOT a material edit', async () => {
  // An honest retry carries a fresh fill-time measurement. Treating that as an edit would
  // throw away a perfectly good id on every retry, matching the backend's own rule that
  // excludes clientSignals from its fingerprint.
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft({ clientSignals: { fillSeconds: 40 } }));
  await client.submit(draft({ clientSignals: { fillSeconds: 95 } }));

  assert.equal(transport.seen[1].submissionId, transport.seen[0].submissionId);
});

/* ── Double-click suppression ─────────────────────────────────────────────── */

test('a second submit while one is in flight is ignored', async () => {
  // The guard lives in the client, not in a disabled button. A disabled button is a
  // rendering detail that a fast double-click or a keyboard repeat can still race.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const seen: SubmissionEnvelope[] = [];

  const transport: Transport = {
    kind: 'simulator',
    async send(envelope) {
      seen.push(envelope);
      await gate;
      return ok();
    },
  };
  const client = createSubmissionClient({ transport });

  const first = client.submit(draft());
  const second = await client.submit(draft());

  assert.equal(second, null, 'the second call is refused while in flight');
  release();
  await first;

  assert.equal(seen.length, 1, 'exactly one request left the client');
});

test('a retry while one is in flight is ignored', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;

  const transport: Transport = {
    kind: 'simulator',
    async send() {
      calls += 1;
      if (calls === 1) return retryable;
      await gate;
      return ok();
    },
  };
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  const inFlight = client.retry();
  const blocked = await client.retry();

  assert.equal(blocked, null);
  release();
  await inFlight;
  assert.equal(calls, 2);
});

/* ── Success clears the attempt ───────────────────────────────────────────── */

test('a confirmed success clears the attempt and releases the envelope', async () => {
  const transport = recordingTransport([ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());

  assert.equal(client.getSnapshot().status, 'succeeded');
  assert.equal(client.peekEnvelope(), null, 'the visitor details are not held after success');
});

test('submitting again after success starts a genuinely new attempt', async () => {
  const transport = recordingTransport([ok(), ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  await client.submit(draft());

  assert.notEqual(transport.seen[1].submissionId, transport.seen[0].submissionId);
});

test('a retry after success does nothing', async () => {
  const transport = recordingTransport([ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  assert.equal(await client.retry(), null);
  assert.equal(transport.seen.length, 1);
});

/* ── Permanent failures and the conflict ──────────────────────────────────── */

test('SUBMISSION_ID_CONFLICT exhausts the attempt and refuses further sends', async () => {
  const transport = recordingTransport([conflict]);
  const client = createSubmissionClient({ transport });

  const result = await client.submit(draft());

  assert.equal(result?.outcome, 'permanent');
  assert.equal(client.getSnapshot().retryable, false, 'the UI must not offer try again');
  assert.equal(await client.retry(), null);
  assert.equal(await client.submit(draft()), null, 'the same draft cannot be resent');
  assert.equal(transport.seen.length, 1);
});

test('after a conflict, a materially different draft may still be submitted', async () => {
  // The attempt is dead, not the visitor's ability to correct and send.
  const transport = recordingTransport([conflict, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  const retryWithEdit = await client.submit(draft({
    payload: {
      pathway: 'general_inquiry',
      topic: 'employment',
      contact: { fullName: 'Robin Slate', email: 'robin@example.test' },
    },
  } as Partial<EnvelopeDraft>));

  assert.equal(retryWithEdit?.outcome, 'ok');
  assert.notEqual(transport.seen[1].submissionId, transport.seen[0].submissionId);
});

test('a permanent validation failure is not retryable but does not kill the attempt', async () => {
  const permanent: ClientResult = {
    outcome: 'permanent',
    code: 'MISSING_REQUIRED',
    field: 'payload.contact.email',
    attemptExhausted: false,
  };
  const transport = recordingTransport([permanent]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());

  const snapshot = client.getSnapshot();
  assert.equal(snapshot.retryable, false);
  assert.equal(snapshot.failure?.field, 'payload.contact.email');
});

/* ── No automatic retry ───────────────────────────────────────────────────── */

test('a failure never retries itself', async () => {
  // There is no loop and no backoff timer anywhere in this client. A retry happens when a
  // person asks for one.
  const transport = recordingTransport([retryable]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(transport.seen.length, 1);
  assert.equal(client.getSnapshot().status, 'failed');
});

/* ── No persistence ───────────────────────────────────────────────────────── */

test('the client never touches web storage', async () => {
  // Form answers are personal data and this pass persists none of it. A page reload
  // therefore ends the attempt, which is a deliberate trade recorded in the contract.
  const touched: string[] = [];
  const trap = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop) => { touched.push(String(prop)); return () => undefined; },
    set: (_t, prop) => { touched.push(String(prop)); return true; },
  }) as unknown as Storage;

  const g = globalThis as Record<string, unknown>;
  g.localStorage = trap;
  g.sessionStorage = trap;

  try {
    const client = createSubmissionClient({ transport: simulatorTransport({ delayMs: 0 }) });
    await client.submit(draft());
    await client.submit(draft());
  } finally {
    delete g.localStorage;
    delete g.sessionStorage;
  }

  assert.deepEqual(touched, []);
});

/* ── Reset ────────────────────────────────────────────────────────────────── */

test('reset abandons the attempt so the next submit gets a new id', async () => {
  const transport = recordingTransport([retryable, ok()]);
  const client = createSubmissionClient({ transport });

  await client.submit(draft());
  client.reset();

  assert.equal(client.getSnapshot().status, 'idle');
  await client.submit(draft());

  assert.notEqual(transport.seen[1].submissionId, transport.seen[0].submissionId);
});
