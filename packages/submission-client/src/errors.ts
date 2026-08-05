/**
 * Normalized client results and error classification.
 *
 * THE DISTINCTION THAT MATTERS is retryable versus permanent, and it is not the same
 * question as "did it fail". A dropped connection and a rejected field both failed; only
 * one of them will behave differently if you send the identical bytes again.
 *
 * Retrying a permanent failure wastes the visitor's time and, for
 * `SUBMISSION_ID_CONFLICT`, cannot ever succeed for that attempt no matter how many times
 * it is tried.
 */

import type { SubmissionSuccessResponse } from './wire';
import { BACKEND_ERROR } from './wire';

export type ClientOutcome = 'ok' | 'retryable' | 'permanent' | 'not_configured';

export interface ClientSuccess {
  outcome: 'ok';
  response: SubmissionSuccessResponse;
}

export interface ClientFailure {
  outcome: 'retryable' | 'permanent' | 'not_configured';
  /** A stable code for branching. Backend codes pass through unchanged. */
  code: string;
  /** The offending field path, when the backend named one. */
  field: string | null;
  /**
   * True only for `SUBMISSION_ID_CONFLICT`. The attempt is dead: the same id can never be
   * accepted with this payload, so the UI must not offer "try again" for it.
   */
  attemptExhausted: boolean;
}

export type ClientResult = ClientSuccess | ClientFailure;

/** Codes this client raises itself, distinct from anything the backend sends. */
export const CLIENT_ERROR = {
  /** No endpoint, or network mode was not explicitly enabled. Never simulated away. */
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  /** The request never completed: offline, DNS, TLS, abort, timeout. */
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  /** A 2xx body that is not JSON, or JSON that is not a V2 response. */
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  /** A non-2xx HTTP status. The V2 backend always answers 200, so this is a proxy. */
  UNEXPECTED_STATUS: 'UNEXPECTED_STATUS',
} as const;

/**
 * Backend codes that are worth sending the identical bytes again for.
 *
 * Deliberately a SHORT ALLOWLIST rather than a denylist. An unrecognised code is treated
 * as permanent, so a new validation error from a future backend stops the visitor rather
 * than putting them in a retry loop against a rejection that will never change.
 */
const RETRYABLE_BACKEND_CODES: readonly string[] = [
  BACKEND_ERROR.BUSY_TRY_AGAIN,
  BACKEND_ERROR.INTERNAL_ERROR,
  BACKEND_ERROR.SERVICE_UNAVAILABLE,
];

export function classifyBackendError(code: string, field: string | null): ClientFailure {
  if (code === BACKEND_ERROR.SUBMISSION_ID_CONFLICT) {
    // The stored submission has different data under this id. Nothing about resending the
    // same bytes changes that, and the visitor's answers were NOT stored.
    return { outcome: 'permanent', code, field, attemptExhausted: true };
  }

  if (code === BACKEND_ERROR.SERVICE_NOT_CONFIGURED) {
    // The deployment is not wired. Truthfully unavailable rather than the visitor's fault.
    return { outcome: 'not_configured', code, field, attemptExhausted: false };
  }

  if (RETRYABLE_BACKEND_CODES.indexOf(code) !== -1) {
    return { outcome: 'retryable', code, field, attemptExhausted: false };
  }

  // Everything else is a validation rejection: the payload is wrong and will stay wrong.
  return { outcome: 'permanent', code, field, attemptExhausted: false };
}

export function notConfigured(code: string = CLIENT_ERROR.NOT_CONFIGURED): ClientFailure {
  return { outcome: 'not_configured', code, field: null, attemptExhausted: false };
}

export function networkFailure(code: string = CLIENT_ERROR.NETWORK_UNAVAILABLE): ClientFailure {
  return { outcome: 'retryable', code, field: null, attemptExhausted: false };
}

export function isSuccess(result: ClientResult): result is ClientSuccess {
  return result.outcome === 'ok';
}

/**
 * Whether the UI may offer "try again" for this result.
 *
 * A conflict is excluded even though it is a failure, because retrying it is guaranteed to
 * fail again in exactly the same way.
 */
export function canRetry(result: ClientResult): boolean {
  return result.outcome === 'retryable';
}
