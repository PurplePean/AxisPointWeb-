/**
 * The booking attempt.
 *
 * Booking is a SEPARATE command issued after a submission, never a block inside one. The
 * Lead must already exist, and its `leadId` comes from the submission response rather than
 * from anything the browser decided.
 *
 * THE TWO RULES THIS FILE ENFORCES, and they pull in opposite directions:
 *
 *   1. A retry of an UNCHANGED request reuses the same `bookingRequestId`. The backend
 *      treats a repeat of the same id on the same Lead as a replay and reports the outcome
 *      already recorded, so a retry after a timeout cannot create a second calendar hold.
 *   2. Changing the slot or the mode is a MATERIAL EDIT and mints a new
 *      `bookingRequestId`. Reusing the id across an edit would ask the backend to replay
 *      the old booking, and the visitor would be confirmed for the time they just changed
 *      away from.
 *
 * Eligibility is never decided here. The backend re-evaluates it against the stored Lead at
 * the moment somebody tries to book, and `bookingEligible` on the submission response is
 * what the frontend is allowed to know. There is no pathway list in this file for the same
 * reason there is none in the backend's `Booking.js`: a second copy of the policy drifts.
 */

import { SCHEMA_VERSION } from './wire';
import type { BookingMode, BookingRequestEnvelope } from './wire';
import type { ClientFailure, ClientResult } from './errors';
import { isSuccess } from './errors';
import { newSubmissionId } from './id';
import type { Transport } from './transport';

/** Everything the caller supplies. The client owns the id, version, and timestamp. */
export interface BookingDraft {
  /** From the submission response. Never invented, never derived. */
  leadId: string;
  /** ISO 8601 WITH an offset. The backend rejects a bare local timestamp. */
  slotStart: string;
  durationMinutes: number;
  mode: BookingMode;
}

export type BookingAttemptStatus = 'idle' | 'sending' | 'failed' | 'confirmed';

export interface BookingSnapshot {
  status: BookingAttemptStatus;
  /** The id currently in flight or awaiting retry. Null when there is no live attempt. */
  bookingRequestId: string | null;
  sends: number;
  failure: ClientFailure | null;
  /** True only when the UI may offer "try again" for the current failure. */
  retryable: boolean;
}

const IDLE: BookingSnapshot = {
  status: 'idle',
  bookingRequestId: null,
  sends: 0,
  failure: null,
  retryable: false,
};

export interface BookingClientOptions {
  transport: Transport;
  now?: () => Date;
}

export interface BookingClient {
  /** Sends, or resends the live attempt when nothing material changed. */
  request(draft: BookingDraft): Promise<ClientResult | null>;
  /** Resends the SAME request. Null when there is nothing retryable. */
  retry(): Promise<ClientResult | null>;
  reset(): void;
  getSnapshot(): BookingSnapshot;
  /** Test seam. The envelope currently in flight or awaiting retry. */
  peekEnvelope(): BookingRequestEnvelope | null;
}

/**
 * What counts as "the same booking".
 *
 * Deliberately excludes `submittedAt`: an honest retry carries a new clock reading, and
 * treating that as a different request would mint a fresh id on every retry, which is
 * exactly the duplicate-hold behaviour rule 1 exists to prevent.
 */
function materialFingerprint(draft: BookingDraft): string {
  return JSON.stringify([draft.leadId, draft.slotStart, draft.durationMinutes, draft.mode]);
}

export function createBookingClient(options: BookingClientOptions): BookingClient {
  const now = options.now ?? (() => new Date());

  let snapshot: BookingSnapshot = IDLE;
  let fingerprint: string | null = null;
  let envelope: BookingRequestEnvelope | null = null;
  let inFlight = false;

  function build(draft: BookingDraft, bookingRequestId: string): BookingRequestEnvelope {
    return {
      schemaVersion: SCHEMA_VERSION,
      submissionKind: 'booking_request',
      bookingRequestId,
      leadId: draft.leadId,
      slotStart: draft.slotStart,
      durationMinutes: draft.durationMinutes,
      mode: draft.mode,
      submittedAt: now().toISOString(),
    };
  }

  async function send(): Promise<ClientResult> {
    inFlight = true;
    snapshot = { ...snapshot, status: 'sending', sends: snapshot.sends + 1 };

    let result: ClientResult;
    try {
      // The SAME envelope object every time, including the same bookingRequestId and the
      // same submittedAt. Rebuilding it would change the timestamp for no reason.
      result = await options.transport.send(envelope as BookingRequestEnvelope);
    } finally {
      inFlight = false;
    }

    if (isSuccess(result)) {
      snapshot = {
        status: 'confirmed',
        bookingRequestId: (envelope as BookingRequestEnvelope).bookingRequestId,
        sends: snapshot.sends,
        failure: null,
        retryable: false,
      };
      // The attempt is finished. The envelope is released rather than lingering.
      envelope = null;
      fingerprint = null;
      return result;
    }

    const failure = result as ClientFailure;
    snapshot = {
      status: 'failed',
      bookingRequestId: (envelope as BookingRequestEnvelope).bookingRequestId,
      sends: snapshot.sends,
      failure,
      retryable: failure.outcome === 'retryable' && !failure.attemptExhausted,
    };
    return result;
  }

  async function request(draft: BookingDraft): Promise<ClientResult | null> {
    // A second call while one is in flight is ignored. The guard lives here rather than in
    // a disabled button, which a fast double-tap or a keyboard repeat can still race.
    if (inFlight) return null;

    const next = materialFingerprint(draft);

    // Rule 2: a changed slot or mode is a new booking and gets a new id. Also covers the
    // first attempt, and re-booking after a confirmed one.
    if (!envelope || fingerprint !== next || snapshot.status === 'confirmed') {
      const bookingRequestId = newSubmissionId();
      envelope = build(draft, bookingRequestId);
      fingerprint = next;
      snapshot = { status: 'idle', bookingRequestId, sends: 0, failure: null, retryable: false };
    } else if (snapshot.failure?.attemptExhausted) {
      // Unchanged and already exhausted: a taken slot stays taken, so resending the same
      // request cannot help. Only a material edit, handled above, gets past this.
      return null;
    }

    return send();
  }

  /** Rule 1: the same id and the same envelope. Never a fresh one. */
  async function retry(): Promise<ClientResult | null> {
    if (inFlight) return null;
    if (!envelope || !snapshot.retryable) return null;
    return send();
  }

  return {
    request,
    retry,
    reset() {
      snapshot = IDLE;
      fingerprint = null;
      envelope = null;
    },
    getSnapshot: () => snapshot,
    peekEnvelope: () => envelope,
  };
}
