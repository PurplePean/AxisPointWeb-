/**
 * The retry attempt.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: a retry must reuse the SAME `submissionId` and a
 * materially identical envelope.
 *
 * The backend deduplicates on `submissionId`. A client that mints a fresh id on retry
 * creates a second Lead or Contact for one person, and nobody finds out because both
 * requests succeeded. A client that reuses an id while the answers changed gets
 * `SUBMISSION_ID_CONFLICT` and its new data is not stored. Both failures are silent from
 * the visitor's side, which is why the id is owned here rather than at each call site.
 *
 * MATERIAL CHANGE ENDS AN ATTEMPT. If the visitor goes back after a failure and edits an
 * answer, the old attempt is invalidated and a new id is issued, because the thing being
 * sent is no longer the thing the old id refers to. The fingerprint below deliberately
 * matches the backend's own `submissionFingerprint`: kind, payload, attribution, and
 * locale, excluding `submittedAt` and `clientSignals`. An honest retry carries a new clock
 * reading and a new fill-time measurement, and treating either as an edit would throw away
 * a perfectly good id on every retry.
 *
 * MEMORY ONLY. Nothing here writes to `localStorage`, `sessionStorage`, IndexedDB, or a
 * cookie. Form answers are personal data and this pass does not persist them anywhere.
 * **A page reload therefore ends the attempt**: the id is gone, and a resubmission after a
 * reload is a genuinely new submission. That is a deliberate trade, not an oversight, and
 * the practical consequence is that a reload after an unacknowledged send can produce a
 * duplicate record. Persisting an id across reloads is a later decision with its own
 * privacy question.
 */

import type { SubmissionEnvelope } from './wire';
import { SCHEMA_VERSION } from './wire';
import type { ClientResult, ClientFailure } from './errors';
import { canRetry, isSuccess } from './errors';
import { newSubmissionId } from './id';
import type { Transport } from './transport';

/** Everything the caller supplies. The client owns the id, version, and timestamp. */
export type EnvelopeDraft =
  | Omit<Extract<SubmissionEnvelope, { submissionKind: 'service_inquiry' }>,
      'schemaVersion' | 'submissionId' | 'submittedAt'>
  | Omit<Extract<SubmissionEnvelope, { submissionKind: 'contact_exchange' }>,
      'schemaVersion' | 'submissionId' | 'submittedAt'>;

export type AttemptStatus = 'idle' | 'sending' | 'failed' | 'succeeded';

export interface AttemptSnapshot {
  status: AttemptStatus;
  /** The id currently in flight or awaiting retry. Null when there is no live attempt. */
  submissionId: string | null;
  /** How many transport calls this attempt has made, including the first. */
  sends: number;
  /** The last failure, when the attempt is retryable or dead. */
  failure: ClientFailure | null;
  /** True only when the UI may offer "try again" for the current failure. */
  retryable: boolean;
}

export interface SubmissionClientOptions {
  transport: Transport;
  /**
   * Injected for tests. Defaults to the real clock. Only ever used for the advisory
   * `submittedAt`, which the backend records its own authoritative time alongside.
   */
  now?: () => Date;
}

const IDLE: AttemptSnapshot = {
  status: 'idle',
  submissionId: null,
  sends: 0,
  failure: null,
  retryable: false,
};

/**
 * A stable digest of the material content of a draft.
 *
 * Key order is normalized so that two drafts differing only in property insertion order
 * are recognised as the same request. `JSON.stringify` alone would call them different and
 * silently issue a new id on every retry.
 */
function materialFingerprint(draft: EnvelopeDraft): string {
  return stableStringify({
    submissionKind: draft.submissionKind,
    payload: draft.payload,
    attribution: draft.attribution,
    locale: draft.locale,
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.keys(value as Record<string, unknown>)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);

  return `{${entries.join(',')}}`;
}

/**
 * Owns one submission at a time.
 *
 * Deliberately not a React hook and not a singleton. The website intake creates one, and
 * the QR surface will create its own; neither needs to know the other exists.
 */
export function createSubmissionClient(options: SubmissionClientOptions) {
  const now = options.now ?? (() => new Date());

  let snapshot: AttemptSnapshot = IDLE;
  let fingerprint: string | null = null;
  let envelope: SubmissionEnvelope | null = null;
  let inFlight = false;

  function buildEnvelope(draft: EnvelopeDraft, submissionId: string): SubmissionEnvelope {
    return {
      schemaVersion: SCHEMA_VERSION,
      submissionId,
      submittedAt: now().toISOString(),
      ...draft,
    } as SubmissionEnvelope;
  }

  /**
   * Sends, reusing the live attempt when the draft has not materially changed.
   *
   * A second call while a request is in flight is IGNORED and reports the current state.
   * That is the double-click guard, and it lives here rather than in a disabled button
   * because a disabled button is a rendering detail that a fast double-click, a synthetic
   * click, or a keyboard repeat can still race.
   */
  async function submit(draft: EnvelopeDraft): Promise<ClientResult | null> {
    if (inFlight) return null;

    const nextFingerprint = materialFingerprint(draft);

    // A new attempt whenever there is no live one, or the answers materially changed.
    // Reusing an id across an edit is what earns SUBMISSION_ID_CONFLICT.
    if (!envelope || fingerprint !== nextFingerprint || snapshot.status === 'succeeded') {
      const submissionId = newSubmissionId();
      envelope = buildEnvelope(draft, submissionId);
      fingerprint = nextFingerprint;
      snapshot = { status: 'idle', submissionId, sends: 0, failure: null, retryable: false };
    }

    // A dead attempt cannot be resent. Only a materially different draft, handled above,
    // gets past this.
    if (snapshot.failure?.attemptExhausted) return null;

    inFlight = true;
    snapshot = { ...snapshot, status: 'sending', sends: snapshot.sends + 1 };

    let result: ClientResult;
    try {
      // The SAME envelope object every time, including the same submissionId and the same
      // submittedAt. Rebuilding it here would change the timestamp, which is harmless to
      // the backend fingerprint but would make the bytes differ for no reason.
      result = await options.transport.send(envelope);
    } finally {
      inFlight = false;
    }

    if (isSuccess(result)) {
      // Confirmed. The attempt is cleared so a later submission starts clean, and the
      // envelope is released rather than lingering with the visitor's details in it.
      snapshot = { status: 'succeeded', submissionId: envelope.submissionId, sends: snapshot.sends, failure: null, retryable: false };
      envelope = null;
      fingerprint = null;
      return result;
    }

    snapshot = {
      status: 'failed',
      submissionId: snapshot.submissionId,
      sends: snapshot.sends,
      failure: result,
      retryable: canRetry(result),
    };
    return result;
  }

  /**
   * Retries the live attempt with the identical envelope.
   *
   * There is no automatic retry loop and no backoff timer anywhere in this client. A
   * retry happens when a person asks for one. An automatic loop against a public endpoint
   * turns one visitor's bad connection into repeated writes nobody asked for, and the
   * bounded at-least-once queue on the backend already handles the delivery side.
   */
  async function retry(): Promise<ClientResult | null> {
    if (inFlight || !envelope || !snapshot.retryable) return null;

    inFlight = true;
    snapshot = { ...snapshot, status: 'sending', sends: snapshot.sends + 1 };

    let result: ClientResult;
    try {
      result = await options.transport.send(envelope);
    } finally {
      inFlight = false;
    }

    if (isSuccess(result)) {
      snapshot = { status: 'succeeded', submissionId: envelope.submissionId, sends: snapshot.sends, failure: null, retryable: false };
      envelope = null;
      fingerprint = null;
      return result;
    }

    snapshot = {
      status: 'failed',
      submissionId: snapshot.submissionId,
      sends: snapshot.sends,
      failure: result,
      retryable: canRetry(result),
    };
    return result;
  }

  /** Abandons the live attempt. The next submit issues a new id. */
  function reset(): void {
    envelope = null;
    fingerprint = null;
    snapshot = IDLE;
  }

  return {
    submit,
    retry,
    reset,
    getSnapshot: (): AttemptSnapshot => snapshot,
    /** Test and dev-tooling seam. Returns the live envelope without copying PII around. */
    peekEnvelope: (): SubmissionEnvelope | null => envelope,
    transportKind: options.transport.kind,
  };
}

export type SubmissionClient = ReturnType<typeof createSubmissionClient>;
