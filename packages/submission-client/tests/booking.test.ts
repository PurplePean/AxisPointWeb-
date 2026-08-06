import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBookingClient } from '../src/booking';
import { simulatorTransport, networkTransport } from '../src/transport';
import { CLIENT_ERROR, isBookingResponse } from '../src/errors';
import type { ClientFailure, ClientResult, ClientSuccess } from '../src/errors';
import type { BookingDraft } from '../src/booking';
import type { BookingRequestEnvelope, Transport } from '../src/index';

/*
 * The booking attempt.
 *
 * TWO RULES PULL IN OPPOSITE DIRECTIONS, and both matter:
 *
 *   an unchanged retry must reuse the bookingRequestId, or a timeout creates a second
 *   calendar hold for one person;
 *
 *   a changed slot must NOT reuse it, or the backend replays the old booking and confirms
 *   the visitor for the time they just moved away from.
 *
 * Every test below is about one of those, or about refusing to call something confirmed.
 */

const draft: BookingDraft = {
  leadId: '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d',
  slotStart: '2026-08-12T10:30:00-05:00',
  durationMinutes: 30,
  mode: 'phone_call',
};

function asFailure(result: ClientResult | null): ClientFailure {
  assert.notEqual(result, null, 'expected a result');
  assert.notEqual((result as ClientResult).outcome, 'ok', 'expected a failure');
  return result as ClientFailure;
}

function asSuccess(result: ClientResult | null): ClientSuccess {
  assert.notEqual(result, null, 'expected a result');
  assert.equal((result as ClientResult).outcome, 'ok', 'expected a success');
  return result as ClientSuccess;
}

/** Records every envelope, and answers with whatever the caller queues up. */
function recordingTransport(replies: ClientResult[]): { transport: Transport; seen: BookingRequestEnvelope[] } {
  const seen: BookingRequestEnvelope[] = [];
  let i = 0;
  const transport: Transport = {
    kind: 'simulator',
    async send(envelope) {
      assert.equal(envelope.submissionKind, 'booking_request');
      seen.push(envelope as BookingRequestEnvelope);
      const reply = replies[Math.min(i, replies.length - 1)];
      i += 1;
      return reply;
    },
  };
  return { transport, seen };
}

const retryable: ClientFailure = {
  outcome: 'retryable',
  code: 'CALENDAR_CREATE_FAILED',
  field: null,
  attemptExhausted: false,
};

const confirmed = (bookingRequestId: string): ClientResult => ({
  outcome: 'ok',
  response: {
    schemaVersion: 1,
    ok: true,
    submissionKind: 'booking_request',
    bookingRequestId,
    bookingStatus: 'confirmed',
    replay: false,
  },
});

/* ── Rule 1: an unchanged retry reuses the id ─────────────────────────────── */

test('a retry of an unchanged request reuses the same bookingRequestId', async () => {
  const { transport, seen } = recordingTransport([retryable, confirmed('ignored')]);
  const client = createBookingClient({ transport });

  await client.request(draft);
  await client.retry();

  assert.equal(seen.length, 2);
  assert.equal(seen[0].bookingRequestId, seen[1].bookingRequestId);
  // And the whole envelope is identical apart from nothing at all.
  assert.deepEqual(seen[0], seen[1]);
});

test('calling request again with an unchanged draft is still the same attempt', async () => {
  const { transport, seen } = recordingTransport([retryable, retryable]);
  const client = createBookingClient({ transport });

  await client.request(draft);
  await client.request({ ...draft });

  assert.equal(seen[0].bookingRequestId, seen[1].bookingRequestId);
});

test('a retryable failure is offered as retryable, and the snapshot keeps the id', async () => {
  const { transport } = recordingTransport([retryable]);
  const client = createBookingClient({ transport });

  const failure = asFailure(await client.request(draft));
  assert.equal(failure.outcome, 'retryable');

  const snapshot = client.getSnapshot();
  assert.equal(snapshot.status, 'failed');
  assert.equal(snapshot.retryable, true);
  assert.equal(typeof snapshot.bookingRequestId, 'string');
});

/* ── Rule 2: a material edit mints a new id ───────────────────────────────── */

test('changing the slot mints a NEW bookingRequestId', async () => {
  const { transport, seen } = recordingTransport([retryable, retryable]);
  const client = createBookingClient({ transport });

  await client.request(draft);
  await client.request({ ...draft, slotStart: '2026-08-12T14:00:00-05:00' });

  assert.equal(seen.length, 2);
  assert.notEqual(seen[0].bookingRequestId, seen[1].bookingRequestId);
  assert.equal(seen[1].slotStart, '2026-08-12T14:00:00-05:00');
});

test('changing the mode mints a NEW bookingRequestId', async () => {
  const { transport, seen } = recordingTransport([retryable, retryable]);
  const client = createBookingClient({ transport });

  await client.request(draft);
  await client.request({ ...draft, mode: 'video_meeting' });

  assert.notEqual(seen[0].bookingRequestId, seen[1].bookingRequestId);
});

test('changing the lead mints a NEW bookingRequestId', async () => {
  const { transport, seen } = recordingTransport([retryable, retryable]);
  const client = createBookingClient({ transport });

  await client.request(draft);
  await client.request({ ...draft, leadId: '11111111-2222-4333-8444-555555555555' });

  assert.notEqual(seen[0].bookingRequestId, seen[1].bookingRequestId);
});

test('a new booking after a confirmed one is a new attempt, not a replay', async () => {
  const { transport, seen } = recordingTransport([confirmed('a'), confirmed('b')]);
  const client = createBookingClient({ transport });

  await client.request(draft);
  await client.request(draft);

  assert.notEqual(seen[0].bookingRequestId, seen[1].bookingRequestId);
});

/* ── A taken slot is final for that request ───────────────────────────────── */

test('a taken slot is permanent and exhausts the attempt, so no retry is offered', async () => {
  const client = createBookingClient({
    transport: simulatorTransport({ fixture: 'booking_slot_unavailable', delayMs: 0 }),
  });

  const failure = asFailure(await client.request(draft));
  assert.equal(failure.outcome, 'permanent');
  assert.equal(failure.code, 'SLOT_UNAVAILABLE');
  assert.equal(failure.attemptExhausted, true);
  assert.equal(client.getSnapshot().retryable, false);
  // Retrying the same request cannot help, so the client refuses to send it.
  assert.equal(await client.retry(), null);
});

test('after a taken slot, choosing a different time DOES send again', async () => {
  const { transport, seen } = recordingTransport([
    { outcome: 'permanent', code: 'SLOT_UNAVAILABLE', field: null, attemptExhausted: true },
    confirmed('second'),
  ]);
  const client = createBookingClient({ transport });

  await client.request(draft);
  const second = await client.request({ ...draft, slotStart: '2026-08-12T15:00:00-05:00' });

  assert.notEqual(second, null, 'a different time must be sendable');
  assert.equal(seen.length, 2);
  assert.notEqual(seen[0].bookingRequestId, seen[1].bookingRequestId);
});

test('a rejected request is permanent and not retryable', async () => {
  const client = createBookingClient({
    transport: simulatorTransport({ fixture: 'booking_rejected', delayMs: 0 }),
  });
  const failure = asFailure(await client.request(draft));
  assert.equal(failure.outcome, 'permanent');
  assert.equal(client.getSnapshot().retryable, false);
});

test('a calendar failure IS retryable, because the same request may yet work', async () => {
  const client = createBookingClient({
    transport: simulatorTransport({ fixture: 'booking_failed', delayMs: 0 }),
  });
  const failure = asFailure(await client.request(draft));
  assert.equal(failure.outcome, 'retryable');
  assert.equal(client.getSnapshot().retryable, true);
});

test('an unconfigured calendar is reported as not_configured, never as confirmed', async () => {
  const client = createBookingClient({
    transport: simulatorTransport({ fixture: 'not_configured', delayMs: 0 }),
  });
  const failure = asFailure(await client.request(draft));
  assert.equal(failure.outcome, 'not_configured');
});

/* ── Envelope shape ───────────────────────────────────────────────────────── */

test('the envelope carries exactly the booking contract fields', async () => {
  const { transport, seen } = recordingTransport([confirmed('x')]);
  const client = createBookingClient({ transport });
  await client.request(draft);

  const sent = seen[0];
  assert.equal(sent.schemaVersion, 1);
  assert.equal(sent.submissionKind, 'booking_request');
  assert.equal(sent.leadId, draft.leadId);
  assert.equal(sent.slotStart, draft.slotStart);
  assert.equal(sent.durationMinutes, 30);
  assert.equal(sent.mode, 'phone_call');
  assert.match(sent.bookingRequestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  // Server-owned state is never claimed by the browser.
  for (const forbidden of ['calendarStatus', 'calendarEventId', 'bookingStatus', 'ownerPartner']) {
    assert.equal(forbidden in sent, false, `must not send ${forbidden}`);
  }
});

test('a double-tap while sending does not produce a second request', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const seen: BookingRequestEnvelope[] = [];
  const transport: Transport = {
    kind: 'simulator',
    async send(envelope) {
      seen.push(envelope as BookingRequestEnvelope);
      await gate;
      return confirmed('x');
    },
  };

  const client = createBookingClient({ transport });
  const first = client.request(draft);
  const second = await client.request(draft);

  assert.equal(second, null, 'the second tap must be ignored');
  release();
  await first;
  assert.equal(seen.length, 1);
});

/* ── Response validation, against a stubbed network ───────────────────────── */

function jsonFetch(body: unknown) {
  const impl = (async () => ({ ok: true, json: async () => body }) as Response) as unknown as typeof fetch;
  return impl;
}

async function sendBooking(body: unknown, requestId = 'fixed') {
  const transport = networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: jsonFetch(body) });
  const envelope: BookingRequestEnvelope = {
    schemaVersion: 1,
    submissionKind: 'booking_request',
    bookingRequestId: requestId,
    leadId: draft.leadId,
    slotStart: draft.slotStart,
    durationMinutes: 30,
    mode: 'phone_call',
  };
  return transport.send(envelope);
}

test('a confirmed booking response is accepted and reported as a booking', async () => {
  const result = asSuccess(await sendBooking({
    schemaVersion: 1, ok: true, submissionKind: 'booking_request',
    bookingRequestId: 'fixed', bookingStatus: 'confirmed', replay: false,
  }));
  assert.equal(isBookingResponse(result.response), true);
});

test('a replayed confirmation is accepted and says so', async () => {
  const result = asSuccess(await sendBooking({
    schemaVersion: 1, ok: true, submissionKind: 'booking_request',
    bookingRequestId: 'fixed', bookingStatus: 'confirmed', replay: true,
  }));
  assert.equal((result.response as { replay: boolean }).replay, true);
});

const REJECTED_BOOKING_BODIES: Array<[string, unknown]> = [
  ['a bookingRequestId for a different request', {
    schemaVersion: 1, ok: true, submissionKind: 'booking_request',
    bookingRequestId: 'someone-else', bookingStatus: 'confirmed', replay: false,
  }],
  ['ok true with a non-confirmed status', {
    schemaVersion: 1, ok: true, submissionKind: 'booking_request',
    bookingRequestId: 'fixed', bookingStatus: 'unavailable', replay: false,
  }],
  ['a missing bookingStatus', {
    schemaVersion: 1, ok: true, submissionKind: 'booking_request',
    bookingRequestId: 'fixed', replay: false,
  }],
  ['a non-boolean replay', {
    schemaVersion: 1, ok: true, submissionKind: 'booking_request',
    bookingRequestId: 'fixed', bookingStatus: 'confirmed', replay: 'no',
  }],
  ['the wrong submissionKind', {
    schemaVersion: 1, ok: true, submissionKind: 'service_inquiry',
    bookingRequestId: 'fixed', bookingStatus: 'confirmed', replay: false,
  }],
  ['a wrong schema version', {
    schemaVersion: 2, ok: true, submissionKind: 'booking_request',
    bookingRequestId: 'fixed', bookingStatus: 'confirmed', replay: false,
  }],
  ['a submission response answering a booking request', {
    schemaVersion: 1, ok: true, submissionKind: 'service_inquiry',
    submissionId: 'x', leadId: 'l', contactId: null, slaDueAt: null,
    bookingEligible: true, replay: false,
  }],
];

for (const [description, body] of REJECTED_BOOKING_BODIES) {
  test(`a booking reply with ${description} is malformed, never a confirmation`, async () => {
    const failure = asFailure(await sendBooking(body));
    assert.equal(failure.code, CLIENT_ERROR.MALFORMED_RESPONSE);
  });
}

test('a refusal is classified by its bookingStatus, not guessed', async () => {
  const taken = asFailure(await sendBooking({
    schemaVersion: 1, ok: false, bookingStatus: 'unavailable',
    error: { code: 'SLOT_UNAVAILABLE', field: null },
  }));
  assert.equal(taken.outcome, 'permanent');
  assert.equal(taken.attemptExhausted, true);

  const transient = asFailure(await sendBooking({
    schemaVersion: 1, ok: false, bookingStatus: 'failed',
    error: { code: 'CALENDAR_CREATE_FAILED', field: null },
  }));
  assert.equal(transient.outcome, 'retryable');

  const unconfigured = asFailure(await sendBooking({
    schemaVersion: 1, ok: false, bookingStatus: 'not_configured',
    error: { code: 'CALENDAR_NOT_CONFIGURED', field: null },
  }));
  assert.equal(unconfigured.outcome, 'not_configured');
});
