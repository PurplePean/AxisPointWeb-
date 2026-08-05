import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTransport,
  networkTransport,
  simulatorTransport,
} from '../src/transport';
import { CLIENT_ERROR } from '../src/errors';
import type { ClientFailure, ClientResult, ClientSuccess } from '../src/errors';
import type { SubmissionEnvelope } from '../src/wire';
import type { SimulatorFixture } from '../src/transport';

/*
 * Operating modes.
 *
 * THE FAILURE THAT MATTERS MOST is a production build with no endpoint showing a
 * confirmation screen. Somebody types their property details, sees "we have your
 * details", and nothing was ever sent. They will not follow up, because as far as they
 * know they already did.
 *
 * So the tests below are mostly negatives: what must NOT happen, and what must never
 * reach the network.
 */

const envelope: SubmissionEnvelope = {
  schemaVersion: 1,
  submissionKind: 'service_inquiry',
  submissionId: '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d',
  locale: { page: 'en', preferredFollowUp: null },
  attribution: { sourceCategory: 'website', sourceDetail: '/contact' },
  payload: {
    pathway: 'general_inquiry',
    topic: 'press_or_media',
    contact: { fullName: 'Robin Slate', email: 'robin@example.test' },
  },
};

/** Narrows to a failure, asserting it really is one. Keeps each test to its own point. */
function asFailure(result: ClientResult): ClientFailure {
  assert.notEqual(result.outcome, 'ok', 'expected a failure');
  return result as ClientFailure;
}

/** Narrows to a success the same way. */
function asSuccess(result: ClientResult): ClientSuccess {
  assert.equal(result.outcome, 'ok', 'expected a success');
  return result as ClientSuccess;
}

/** Fails the test if anything calls it. Installed where no request may happen. */
function forbiddenFetch(): typeof fetch {
  return (() => {
    throw new Error('a network request was attempted');
  }) as unknown as typeof fetch;
}

/* ── The simulator never touches the network ──────────────────────────────── */

test('the simulator makes zero network requests', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = forbiddenFetch();

  try {
    const transport = simulatorTransport({ delayMs: 0 });
    const result = await transport.send(envelope);
    assert.equal(result.outcome, 'ok');
  } finally {
    globalThis.fetch = original;
  }
});

test('the simulator returns explicit fixtures, not derived product rules', async () => {
  const cases: Array<[SimulatorFixture, string]> = [
    ['success', 'ok'],
    ['success_bookable', 'ok'],
    ['success_not_bookable', 'ok'],
    ['recoverable_failure', 'retryable'],
    ['permanent_failure', 'permanent'],
    ['submission_id_conflict', 'permanent'],
    ['not_configured', 'not_configured'],
  ];

  for (const [fixture, expected] of cases) {
    const result = await simulatorTransport({ fixture, delayMs: 0 }).send(envelope);
    assert.equal(result.outcome, expected, `fixture ${fixture}`);
  }
});

test('the bookable and non-bookable fixtures differ only in bookingEligible', async () => {
  const yes = await simulatorTransport({ fixture: 'success_bookable', delayMs: 0 }).send(envelope);
  const no = await simulatorTransport({ fixture: 'success_not_bookable', delayMs: 0 }).send(envelope);

  assert.equal(asSuccess(yes).response.bookingEligible, true);
  assert.equal(asSuccess(no).response.bookingEligible, false);
});

test('the conflict fixture exhausts the attempt', async () => {
  const result = await simulatorTransport({ fixture: 'submission_id_conflict', delayMs: 0 }).send(envelope);
  const failure = asFailure(result);
  assert.equal(failure.outcome, 'permanent');
  assert.equal(failure.attemptExhausted, true);
  assert.equal(failure.code, 'SUBMISSION_ID_CONFLICT');
});

test('there is no magic-value behaviour keyed off submitted content', async () => {
  // An earlier simulation failed whenever the email local part was `fail`. That made a
  // real address able to trigger a fake failure and hid the trigger from the code that
  // mattered. The fixture is the only thing that decides.
  const hostile = JSON.parse(JSON.stringify(envelope)) as SubmissionEnvelope;
  (hostile.payload as { contact: { email: string } }).contact.email = 'fail@example.test';

  const result = await simulatorTransport({ delayMs: 0 }).send(hostile);
  assert.equal(result.outcome, 'ok');
});

/* ── createTransport fails closed ─────────────────────────────────────────── */

test('production with no endpoint returns NOT_CONFIGURED and never simulates', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = forbiddenFetch();

  try {
    const transport = createTransport({ networkEnabled: false, endpoint: '', isDevelopment: false });
    assert.equal(transport.kind, 'not_configured');

    const result = await transport.send(envelope);
    assert.equal(result.outcome, 'not_configured');
    assert.notEqual(result.outcome, 'ok', 'a person must never see a fake success');
  } finally {
    globalThis.fetch = original;
  }
});

test('production with an endpoint but no explicit opt-in stays closed', async () => {
  // Both are required. An endpoint sitting in the environment is not consent to use it.
  const original = globalThis.fetch;
  globalThis.fetch = forbiddenFetch();

  try {
    const transport = createTransport({
      networkEnabled: false,
      endpoint: 'https://example.test/exec',
      isDevelopment: false,
    });
    assert.equal(transport.kind, 'not_configured');
    assert.equal((await transport.send(envelope)).outcome, 'not_configured');
  } finally {
    globalThis.fetch = original;
  }
});

test('network mode opted in with no endpoint stays closed', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = forbiddenFetch();

  try {
    const transport = createTransport({ networkEnabled: true, endpoint: '', isDevelopment: false });
    assert.equal(transport.kind, 'not_configured');
    assert.equal((await transport.send(envelope)).outcome, 'not_configured');
  } finally {
    globalThis.fetch = original;
  }
});

test('development defaults to the simulator', async () => {
  const transport = createTransport({ networkEnabled: false, endpoint: '', isDevelopment: true });
  assert.equal(transport.kind, 'simulator');
});

test('development with an endpoint still simulates unless network mode is opted into', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = forbiddenFetch();

  try {
    const transport = createTransport({
      networkEnabled: false,
      endpoint: 'https://example.test/exec',
      isDevelopment: true,
      simulator: { delayMs: 0 },
    });
    assert.equal(transport.kind, 'simulator');
    assert.equal((await transport.send(envelope)).outcome, 'ok');
  } finally {
    globalThis.fetch = original;
  }
});

test('network mode requires BOTH the flag and an endpoint', () => {
  const both = createTransport({
    networkEnabled: true,
    endpoint: 'https://example.test/exec',
    isDevelopment: false,
  });
  assert.equal(both.kind, 'network');
});

/* ── The network transport ────────────────────────────────────────────────── */

function fakeFetch(body: unknown, init: { ok?: boolean; throws?: boolean } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, requestInit: RequestInit) => {
    calls.push({ url, init: requestInit });
    if (init.throws) throw new Error('offline');
    return {
      ok: init.ok ?? true,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('a successful response is passed through with its bookingEligible', async () => {
  const { impl, calls } = fakeFetch({
    schemaVersion: 1,
    ok: true,
    submissionKind: 'service_inquiry',
    submissionId: envelope.submissionId,
    leadId: 'lead-1',
    contactId: null,
    slaDueAt: '2026-08-05T22:00:00.000Z',
    bookingEligible: false,
    replay: false,
  });

  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);

  assert.equal(asSuccess(result).response.bookingEligible, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'POST');
});

test('success requires ok:true, not merely a 200', async () => {
  const { impl } = fakeFetch({
    schemaVersion: 1,
    ok: false,
    error: { code: 'MISSING_REQUIRED', field: 'payload.contact.email' },
  });

  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);

  const failure = asFailure(result);
  assert.equal(failure.outcome, 'permanent');
  assert.equal(failure.code, 'MISSING_REQUIRED');
  assert.equal(failure.field, 'payload.contact.email');
});

test('a success without a boolean bookingEligible is rejected as malformed', async () => {
  // Coercing a missing or string value would decide the booking question by accident.
  const { impl } = fakeFetch({
    schemaVersion: 1,
    ok: true,
    submissionKind: 'service_inquiry',
    submissionId: envelope.submissionId,
    leadId: 'lead-1',
    contactId: null,
    slaDueAt: null,
    replay: false,
  });

  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);
  const failure = asFailure(result);
  assert.equal(failure.outcome, 'retryable');
  assert.equal(failure.code, CLIENT_ERROR.MALFORMED_RESPONSE);
});

test('a dropped connection is retryable', async () => {
  const { impl } = fakeFetch(null, { throws: true });
  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);

  const failure = asFailure(result);
  assert.equal(failure.outcome, 'retryable');
  assert.equal(failure.code, CLIENT_ERROR.NETWORK_UNAVAILABLE);
});

test('a conflict from the backend is permanent and exhausts the attempt', async () => {
  const { impl } = fakeFetch({
    schemaVersion: 1,
    ok: false,
    error: { code: 'SUBMISSION_ID_CONFLICT', field: null },
  });

  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);
  const failure = asFailure(result);
  assert.equal(failure.outcome, 'permanent');
  assert.equal(failure.attemptExhausted, true);
});

test('BUSY_TRY_AGAIN is retryable', async () => {
  const { impl } = fakeFetch({ schemaVersion: 1, ok: false, error: { code: 'BUSY_TRY_AGAIN', field: null } });
  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);
  assert.equal(result.outcome, 'retryable');
});

test('SERVICE_NOT_CONFIGURED reads as unavailable rather than the visitor being wrong', async () => {
  const { impl } = fakeFetch({ schemaVersion: 1, ok: false, error: { code: 'SERVICE_NOT_CONFIGURED', field: null } });
  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);
  assert.equal(result.outcome, 'not_configured');
});

test('an unrecognised backend code is treated as permanent, not retried forever', async () => {
  // A denylist would put the visitor in a loop against a rejection that never changes.
  const { impl } = fakeFetch({ schemaVersion: 1, ok: false, error: { code: 'SOME_FUTURE_RULE', field: 'payload.x' } });
  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);
  assert.equal(result.outcome, 'permanent');
});

test('a non-JSON body is malformed rather than a crash', async () => {
  const impl = (async () => ({ ok: true, json: async () => { throw new Error('not json'); } } as unknown as Response)) as unknown as typeof fetch;
  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);

  const failure = asFailure(result);
  assert.equal(failure.outcome, 'retryable');
  assert.equal(failure.code, CLIENT_ERROR.MALFORMED_RESPONSE);
});

test('a non-2xx status is retryable and does not pretend to be a backend error', async () => {
  const { impl } = fakeFetch({}, { ok: false });
  const result = await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);

  const failure = asFailure(result);
  assert.equal(failure.outcome, 'retryable');
  assert.equal(failure.code, CLIENT_ERROR.UNEXPECTED_STATUS);
});

test('the request body is the envelope, unmodified', async () => {
  const { impl, calls } = fakeFetch({
    schemaVersion: 1, ok: true, submissionKind: 'service_inquiry',
    submissionId: envelope.submissionId, leadId: 'l', contactId: null,
    slaDueAt: null, bookingEligible: true, replay: false,
  });

  await networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(envelope);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), envelope);
});

/* ── Success-response validation ──────────────────────────────────────────── */

/*
 * Success is the one outcome that cannot be withdrawn: it tells someone their inquiry was
 * received and stops them retrying. `ok: true` alone is not evidence of that, so each test
 * below takes a body that is valid in every respect but one and asserts the client refuses
 * it, and refuses it as RETRYABLE, because the submission may genuinely have been stored.
 */

/** A response that must be accepted. Each test below breaks exactly one field of it. */
function goodInquiryResponse(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    ok: true,
    submissionKind: 'service_inquiry',
    submissionId: envelope.submissionId,
    leadId: 'lead-0001',
    contactId: null,
    slaDueAt: '2026-08-06T17:00:00.000Z',
    bookingEligible: true,
    replay: false,
    ...overrides,
  };
}

async function sendAndGet(body: unknown, sent: SubmissionEnvelope = envelope) {
  const { impl } = fakeFetch(body);
  return networkTransport({ endpoint: 'https://example.test/exec', fetchImpl: impl }).send(sent);
}

/** Every one of these must be rejected, and rejected the same way. */
const REJECTED_SUCCESS_BODIES: Array<[string, unknown]> = [
  ['a different schema version', goodInquiryResponse({ schemaVersion: 2 })],
  ['a missing schema version', goodInquiryResponse({ schemaVersion: undefined })],
  ['a submissionId for a different attempt', goodInquiryResponse({ submissionId: '00000000-0000-4000-8000-00000000dead' })],
  ['a submissionKind that does not match what was sent', goodInquiryResponse({ submissionKind: 'contact_exchange' })],
  ['a non-boolean replay', goodInquiryResponse({ replay: 'false' })],
  ['a missing replay', goodInquiryResponse({ replay: undefined })],
  ['a non-boolean bookingEligible', goodInquiryResponse({ bookingEligible: 'TRUE' })],
  ['a missing bookingEligible', goodInquiryResponse({ bookingEligible: undefined })],
  ['a numeric leadId', goodInquiryResponse({ leadId: 12345 })],
  ['a numeric slaDueAt', goodInquiryResponse({ slaDueAt: 1754499600000 })],
  ['an inquiry with no leadId', goodInquiryResponse({ leadId: null })],
  ['an inquiry with an empty leadId', goodInquiryResponse({ leadId: '' })],
  ['an inquiry that also carries a contactId', goodInquiryResponse({ contactId: 'contact-0001' })],
  ['a generic JSON 200 from an intermediary', { ok: true }],
  ['an empty object', {}],
];

for (const [description, body] of REJECTED_SUCCESS_BODIES) {
  test(`a success with ${description} is malformed, not a confirmation`, async () => {
    const failure = asFailure(await sendAndGet(body));
    assert.equal(failure.code, CLIENT_ERROR.MALFORMED_RESPONSE);
    // Retryable on purpose: the request may have been stored, and the attempt keeps its id.
    assert.equal(failure.outcome, 'retryable');
    assert.equal(failure.attemptExhausted, false);
  });
}

test('a valid service inquiry success is still accepted', async () => {
  const success = asSuccess(await sendAndGet(goodInquiryResponse()));
  assert.equal(success.response.leadId, 'lead-0001');
  assert.equal(success.response.bookingEligible, true);
});

test('a valid inquiry success with a null slaDueAt is accepted', async () => {
  // The replay path reads this back off the stored Lead. A row without one is a data
  // question, not a reason to tell somebody their inquiry failed.
  const success = asSuccess(await sendAndGet(goodInquiryResponse({ slaDueAt: null })));
  assert.equal(success.response.slaDueAt, null);
});

test('a replay is accepted and reported as one', async () => {
  const success = asSuccess(await sendAndGet(goodInquiryResponse({ replay: true })));
  assert.equal(success.response.replay, true);
});

/* ── Contact exchange identity shape ──────────────────────────────────────── */

const exchangeEnvelope: SubmissionEnvelope = {
  ...envelope,
  submissionKind: 'contact_exchange',
  payload: {
    partnerKey: 'alex_rivera',
    contact: { fullName: 'Robin Slate', email: 'robin@example.test' },
  },
} as unknown as SubmissionEnvelope;

function goodExchangeResponse(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    ok: true,
    submissionKind: 'contact_exchange',
    submissionId: exchangeEnvelope.submissionId,
    leadId: null,
    contactId: 'contact-0001',
    slaDueAt: null,
    bookingEligible: false,
    replay: false,
    ...overrides,
  };
}

test('a valid contact exchange success is accepted', async () => {
  const success = asSuccess(await sendAndGet(goodExchangeResponse(), exchangeEnvelope));
  assert.equal(success.response.contactId, 'contact-0001');
  assert.equal(success.response.leadId, null);
});

const REJECTED_EXCHANGE_BODIES: Array<[string, unknown]> = [
  ['no contactId', goodExchangeResponse({ contactId: null })],
  ['an empty contactId', goodExchangeResponse({ contactId: '' })],
  ['a leadId as well', goodExchangeResponse({ leadId: 'lead-0001' })],
  ['an slaDueAt, which no exchange has', goodExchangeResponse({ slaDueAt: '2026-08-06T17:00:00.000Z' })],
];

for (const [description, body] of REJECTED_EXCHANGE_BODIES) {
  test(`a contact exchange success with ${description} is malformed`, async () => {
    const failure = asFailure(await sendAndGet(body, exchangeEnvelope));
    assert.equal(failure.code, CLIENT_ERROR.MALFORMED_RESPONSE);
  });
}

/* ── Error-response validation ────────────────────────────────────────────── */

/*
 * An unreadable error body used to default to INTERNAL_ERROR, which invented a verdict no
 * backend gave, and a retryable one at that. An unreadable body is a malformed response.
 */

test('a real backend error is classified by its own code', async () => {
  const failure = asFailure(await sendAndGet({
    schemaVersion: 1,
    ok: false,
    error: { code: 'MISSING_REQUIRED', field: 'payload.contact.email' },
  }));
  assert.equal(failure.code, 'MISSING_REQUIRED');
  assert.equal(failure.field, 'payload.contact.email');
  assert.equal(failure.outcome, 'permanent');
});

test('a null field on a real error is preserved as null', async () => {
  const failure = asFailure(await sendAndGet({
    schemaVersion: 1, ok: false, error: { code: 'BUSY_TRY_AGAIN', field: null },
  }));
  assert.equal(failure.code, 'BUSY_TRY_AGAIN');
  assert.equal(failure.field, null);
  assert.equal(failure.outcome, 'retryable');
});

const REJECTED_ERROR_BODIES: Array<[string, unknown]> = [
  ['no error object at all', { schemaVersion: 1, ok: false }],
  ['a null error', { schemaVersion: 1, ok: false, error: null }],
  ['a string error', { schemaVersion: 1, ok: false, error: 'something went wrong' }],
  ['an error with no code', { schemaVersion: 1, ok: false, error: { field: 'x' } }],
  ['an error with an empty code', { schemaVersion: 1, ok: false, error: { code: '', field: null } }],
  ['an error with a numeric code', { schemaVersion: 1, ok: false, error: { code: 500, field: null } }],
  ['an error with a non-string field', { schemaVersion: 1, ok: false, error: { code: 'X', field: 7 } }],
  // `field` must be written down, even as null. Absent is not the same as "nothing to blame".
  ['an error with no field property at all', { schemaVersion: 1, ok: false, error: { code: 'X' } }],
  ['an error with an explicitly undefined field', { schemaVersion: 1, ok: false, error: { code: 'X', field: undefined } }],
  ['a wrong schema version', { schemaVersion: 2, ok: false, error: { code: 'MISSING_REQUIRED', field: null } }],
];

for (const [description, body] of REJECTED_ERROR_BODIES) {
  test(`an error response with ${description} is malformed, not INTERNAL_ERROR`, async () => {
    const failure = asFailure(await sendAndGet(body));
    assert.equal(failure.code, CLIENT_ERROR.MALFORMED_RESPONSE);
    assert.notEqual(failure.code, 'INTERNAL_ERROR');
  });
}
