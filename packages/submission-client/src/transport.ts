/**
 * Transports.
 *
 * A transport takes an envelope and returns a `ClientResult`. That is the whole
 * interface, and it is the single boundary between this repository's frontends and any
 * network at all.
 *
 * TWO IMPLEMENTATIONS, AND THE CHOICE IS EXPLICIT, NEVER INFERRED.
 *
 *   simulatorTransport   returns fixtures. Makes no request of any kind.
 *   networkTransport     calls fetch. Requires BOTH an explicit opt-in and an endpoint.
 *
 * `createTransport` fails CLOSED. Production with no endpoint returns `NOT_CONFIGURED`,
 * never a simulated success, because a person who submitted their property details and
 * saw a confirmation screen that meant nothing is the worst outcome this code can produce.
 */

import { SCHEMA_VERSION } from './wire';
import type {
  BookingResponse,
  SubmissionEnvelope,
  SubmissionResponse,
  SubmissionSuccessResponse,
  WireEnvelope,
} from './wire';
import { BOOKING_ERROR } from './wire';
import type { ClientResult, ClientFailure } from './errors';
import { CLIENT_ERROR, classifyBackendError, networkFailure, notConfigured } from './errors';

export interface Transport {
  /** Names which implementation is in use. Surfaced in dev tooling and tests. */
  readonly kind: 'simulator' | 'network' | 'not_configured';
  /**
   * Sends a submission or a booking command.
   *
   * One transport carries both because there is one endpoint, discriminated by
   * `submissionKind`. The two have different response shapes, so the reply is validated
   * against the shape the request asked for rather than a shape that happens to parse.
   */
  send(envelope: WireEnvelope, signal?: AbortSignal): Promise<ClientResult>;
}

/* ── Simulator ────────────────────────────────────────────────────────────── */

/**
 * What the simulator should return next.
 *
 * These are FIXTURES, not a reimplementation of the backend. The simulator deliberately
 * does not validate the envelope, decide booking eligibility from the pathway, or model
 * spam screening: a second copy of those rules would drift from the real ones and give
 * false confidence. It returns what it is told to return.
 */
export type SimulatorFixture =
  | 'success'
  | 'success_bookable'
  | 'success_not_bookable'
  | 'recoverable_failure'
  | 'permanent_failure'
  | 'submission_id_conflict'
  | 'not_configured'
  /** Booking-only fixtures. A booking envelope resolves against these instead. */
  | 'booking_confirmed'
  | 'booking_slot_unavailable'
  | 'booking_rejected'
  | 'booking_failed';

export interface SimulatorOptions {
  fixture?: SimulatorFixture;
  /** Milliseconds before resolving, so the sending state is observable. */
  delayMs?: number;
  /** Records every envelope handed to it, for assertions. */
  onSend?: (envelope: WireEnvelope) => void;
}

const DEFAULT_SIMULATED_DELAY_MS = 700;

function simulatedSuccess(
  envelope: SubmissionEnvelope,
  bookingEligible: boolean,
): SubmissionSuccessResponse {
  const isInquiry = envelope.submissionKind === 'service_inquiry';
  return {
    schemaVersion: 1,
    ok: true,
    submissionKind: envelope.submissionKind,
    submissionId: envelope.submissionId,
    leadId: isInquiry ? 'simulated-lead-00000000-0000-4000-8000-000000000001' : null,
    contactId: isInquiry ? null : 'simulated-contact-00000000-0000-4000-8000-000000000002',
    slaDueAt: isInquiry ? '2026-08-04T22:00:00.000Z' : null,
    bookingEligible,
    replay: false,
  };
}

/**
 * A local transport that never touches the network.
 *
 * There is deliberately NO magic-value behaviour. An earlier simulation failed whenever
 * the email local part was `fail`, which meant a real person named in a demo could not be
 * used, a genuine address could trigger a fake failure, and the trigger was invisible in
 * the code that mattered. Fixtures are selected explicitly instead.
 */
export function simulatorTransport(options: SimulatorOptions = {}): Transport {
  const delayMs = options.delayMs ?? DEFAULT_SIMULATED_DELAY_MS;

  return {
    kind: 'simulator',
    async send(envelope: WireEnvelope): Promise<ClientResult> {
      options.onSend?.(envelope);
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

      if (envelope.submissionKind === 'booking_request') {
        // A booking envelope gets a booking-shaped reply. Returning a submission response
        // here would let the intake pass a test it should fail.
        switch (options.fixture) {
          case 'booking_slot_unavailable':
            return classifyBookingError('SLOT_UNAVAILABLE', 'unavailable');
          case 'booking_rejected':
            return classifyBookingError('BOOKING_ALREADY_ACTIVE', 'rejected');
          case 'booking_failed':
            return classifyBookingError('CALENDAR_CREATE_FAILED', 'failed');
          case 'not_configured':
            return notConfigured();
          case 'recoverable_failure':
            return networkFailure();
          default:
            return {
              outcome: 'ok',
              response: {
                schemaVersion: 1,
                ok: true,
                submissionKind: 'booking_request',
                bookingRequestId: envelope.bookingRequestId,
                bookingStatus: 'confirmed',
                replay: false,
              },
            };
        }
      }

      switch (options.fixture ?? 'success') {
        case 'success':
        case 'success_bookable':
          return { outcome: 'ok', response: simulatedSuccess(envelope, true) };
        case 'success_not_bookable':
          return { outcome: 'ok', response: simulatedSuccess(envelope, false) };
        case 'recoverable_failure':
          return networkFailure();
        case 'permanent_failure':
          return classifyBackendError('MISSING_REQUIRED', 'payload.contact.email');
        case 'submission_id_conflict':
          return classifyBackendError('SUBMISSION_ID_CONFLICT', null);
        case 'not_configured':
          return notConfigured();
        default:
          return { outcome: 'ok', response: simulatedSuccess(envelope, true) };
      }
    },
  };
}

/* ── Network ──────────────────────────────────────────────────────────────── */

export interface NetworkOptions {
  endpoint: string;
  /** Injected for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * The only code in this repository that may reach the network.
 *
 * The V2 endpoint answers HTTP 200 for every outcome, including every failure, because an
 * Apps Script exception returns an HTML error page a cross-origin fetch cannot read. A
 * non-200 therefore means something in front of the endpoint answered, not the endpoint.
 */
export function networkTransport(options: NetworkOptions): Transport {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    kind: 'network',
    async send(envelope: WireEnvelope, signal?: AbortSignal): Promise<ClientResult> {
      if (typeof doFetch !== 'function') return notConfigured();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      signal?.addEventListener('abort', () => controller.abort(), { once: true });

      let raw: Response;
      try {
        raw = await doFetch(options.endpoint, {
          method: 'POST',
          // text/plain avoids a CORS preflight against an Apps Script web app, which does
          // not answer OPTIONS. The body is still JSON.
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(envelope),
          signal: controller.signal,
        });
      } catch {
        // Offline, DNS, TLS, timeout, abort. The request never completed, so the same
        // bytes are worth sending again.
        return networkFailure();
      } finally {
        clearTimeout(timer);
      }

      if (!raw.ok) {
        return { outcome: 'retryable', code: CLIENT_ERROR.UNEXPECTED_STATUS, field: null, attemptExhausted: false };
      }

      let body: SubmissionResponse | BookingResponse;
      try {
        body = (await raw.json()) as SubmissionResponse | BookingResponse;
      } catch {
        return malformed();
      }

      if (!body || typeof body !== 'object' || typeof (body as { ok?: unknown }).ok !== 'boolean') {
        return malformed();
      }

      // The reply is checked against the shape the REQUEST asked for. A submission
      // response arriving for a booking command is not "close enough": it would mean the
      // endpoint answered a different question than the one asked.
      if (envelope.submissionKind === 'booking_request') {
        return readBookingResult(body as BookingResponse, envelope.bookingRequestId);
      }

      if (body.ok === true) {
        if (!isValidSuccess(body as SubmissionResponse, envelope)) return malformed();
        return { outcome: 'ok', response: body as SubmissionSuccessResponse };
      }

      const error = readError(body as SubmissionResponse);
      if (!error) return malformed();
      return classifyBackendError(error.code, error.field);
    },
  };
}

function malformed(): ClientFailure {
  return { outcome: 'retryable', code: CLIENT_ERROR.MALFORMED_RESPONSE, field: null, attemptExhausted: false };
}

/* ── Response validation ──────────────────────────────────────────────────── */

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';

/**
 * Decides whether an `ok: true` body may be shown to a person as a confirmed submission.
 *
 * WHY THIS IS STRICT. Success is the one outcome that cannot be taken back: it tells someone
 * their inquiry was received and stops them from trying again. A body that merely *says*
 * `ok: true` is not evidence of that. The realistic hazards are an intermediary returning a
 * cached or generic JSON 200, a future backend answering a different schema version, and a
 * response arriving for a different submission than the one in flight. Each would otherwise
 * be rendered as a confirmation.
 *
 * A rejected body becomes `MALFORMED_RESPONSE`, which is retryable: the request may well
 * have been stored, and the same `submissionId` is preserved, so a retry is a replay rather
 * than a duplicate.
 *
 * The identity checks are kind-specific because the backend creates exactly one business
 * record per submission: an inquiry produces a Lead and no Contact, an exchange produces a
 * Contact and no Lead. A success carrying both, or neither, contradicts the storage model
 * and is not a response this client understands.
 */
function isValidSuccess(body: SubmissionResponse, envelope: SubmissionEnvelope): boolean {
  if (body.ok !== true) return false;

  if (body.schemaVersion !== SCHEMA_VERSION) return false;

  // A response for a different attempt must never be applied to this one.
  if (body.submissionId !== envelope.submissionId) return false;
  if (body.submissionKind !== envelope.submissionKind) return false;

  if (typeof body.replay !== 'boolean') return false;
  // Coercing this would decide the booking question by accident.
  if (typeof body.bookingEligible !== 'boolean') return false;

  if (!isStringOrNull(body.leadId)) return false;
  if (!isStringOrNull(body.contactId)) return false;
  if (!isStringOrNull(body.slaDueAt)) return false;

  if (body.submissionKind === 'service_inquiry') {
    // A Lead, and no Contact. `slaDueAt` is allowed to be null: the replay path reads it
    // back off the stored Lead, and a stored row without one is a data question rather than
    // a reason to tell someone their inquiry failed.
    return isNonEmptyString(body.leadId) && body.contactId === null;
  }

  // A Contact, and no Lead. There is no Lead to book against, so no SLA applies.
  return isNonEmptyString(body.contactId) && body.leadId === null && body.slaDueAt === null;
}

/* ── Booking responses ────────────────────────────────────────────────────── */

/**
 * Reads a booking reply, which is a different shape from a submission reply.
 *
 * A confirmed booking carries no `submissionId`, `leadId`, `slaDueAt`, or
 * `bookingEligible`, so running it through the submission validator would reject a
 * perfectly correct response. It has its own required fields instead: the schema version,
 * the kind, the `bookingRequestId` that was sent, a boolean `replay`, and a `bookingStatus`
 * of exactly `confirmed`.
 *
 * A success body claiming any other status is rejected outright. `confirmed` is the only
 * value the backend ever pairs with `ok: true`, and treating "ok but unavailable" as a
 * confirmation is how somebody ends up waiting for a call that was never booked.
 */
function readBookingResult(body: BookingResponse, sentRequestId: string): ClientResult {
  if (body.schemaVersion !== SCHEMA_VERSION) return malformed();

  if (body.ok === true) {
    if (body.submissionKind !== 'booking_request') return malformed();
    if (body.bookingRequestId !== sentRequestId) return malformed();
    if (typeof body.replay !== 'boolean') return malformed();
    if (body.bookingStatus !== 'confirmed') return malformed();
    return { outcome: 'ok', response: body };
  }

  const error = readError(body as unknown as SubmissionResponse);
  if (!error) return malformed();
  return classifyBookingError(error.code, body.bookingStatus);
}

/**
 * Classifies a booking refusal.
 *
 * The distinction that matters to a person looking at the screen is whether picking a
 * different time helps. A taken slot is not a failure of anything; it is an ordinary answer
 * that asks for one more choice. A transport-level wobble is worth retrying unchanged. A
 * rejected request cannot be fixed by trying again at all.
 */
function classifyBookingError(code: string, status?: string): ClientFailure {
  const base = { code, field: null as string | null };

  // The slot is gone. Retrying THIS request would only be refused again; the visitor has
  // to choose another time, which mints a new request.
  if (status === 'unavailable') {
    return { outcome: 'permanent', ...base, attemptExhausted: true };
  }

  // The request itself is not allowed: wrong pathway, unknown lead, already booked.
  if (status === 'rejected') {
    return { outcome: 'permanent', ...base, attemptExhausted: true };
  }

  // No calendar to book against. Honest, and not the visitor's problem to retry.
  if (status === 'not_configured' || code === BOOKING_ERROR.CALENDAR_NOT_CONFIGURED) {
    return { outcome: 'not_configured', ...base, attemptExhausted: true };
  }

  // `failed` means the calendar service was reachable and did not succeed, and an
  // unreadable calendar is explicitly NOT an available one. The same request is worth
  // sending again, with the same id so a hold that did get created is not duplicated.
  if (status === 'failed') {
    return { outcome: 'retryable', ...base, attemptExhausted: false };
  }

  return { outcome: 'permanent', ...base, attemptExhausted: true };
}

/**
 * Reads the error out of an `ok: false` body, or returns null if it is not a real one.
 *
 * Previously a missing or malformed `error` defaulted to `INTERNAL_ERROR`, which invented a
 * backend verdict that no backend gave. The distinction matters because the codes are
 * classified: inventing a retryable server error out of an unreadable body could send the
 * client into retries against something that never answered the contract at all.
 *
 * `field` must be PRESENT, and either a string or null. An absent `field` is not quietly
 * read as null: the contract says every error carries the key, so a body without it did not
 * come from a backend speaking this contract, and treating "the key is missing" as "no
 * particular field is at fault" is a guess dressed up as a fact. `null` still has to be
 * written down.
 */
function readError(body: SubmissionResponse): { code: string; field: string | null } | null {
  if (body.ok !== false) return null;
  if (body.schemaVersion !== SCHEMA_VERSION) return null;

  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return null;
  if (!('field' in error)) return null;

  const { code, field } = error as { code?: unknown; field?: unknown };
  if (!isNonEmptyString(code)) return null;
  if (field !== null && typeof field !== 'string') return null;

  return { code, field };
}

/* ── Selection ────────────────────────────────────────────────────────────── */

export interface TransportConfig {
  /** True only when the build explicitly opted into real network mode. */
  networkEnabled: boolean;
  /** The configured endpoint, or an empty string when none was supplied. */
  endpoint: string;
  /**
   * Accepted and ignored. Kept so existing callers do not silently change meaning; the
   * simulator is no longer reachable from here at all. See the note below.
   */
  isDevelopment?: boolean;
  network?: Omit<NetworkOptions, 'endpoint'>;
}

/**
 * Chooses between the network and failing closed. It can NEVER return the simulator.
 *
 * THE SIMULATOR BRANCH WAS REMOVED FROM THIS FUNCTION DELIBERATELY, and the reason is a
 * real defect this caught. It used to return `simulatorTransport(...)` when
 * `isDevelopment` was true, which meant that in a production build the elimination of the
 * simulator depended on the bundler inlining this function and folding the flag away.
 * That held while there was one call site. The moment a second appeared (the booking
 * client), inlining stopped, the reference survived, and the simulator's fake lead ids and
 * every fixture name reappeared in the production bundle. `verify:bundle` caught it.
 *
 * Now the guarantee is structural rather than incidental: nothing production reaches can
 * mention `simulatorTransport`, so it is dropped because it is genuinely unreferenced. A
 * caller that wants the simulator imports it directly, behind its own
 * `import.meta.env.DEV` check, where the bundler can see a literal.
 *
 * Network mode still requires BOTH the explicit flag AND an endpoint; either alone is a
 * misconfiguration, not an invitation to guess. What is left is an honest `not_configured`
 * transport that returns a truthful failure without contacting anything.
 */
export function createTransport(config: TransportConfig): Transport {
  if (config.networkEnabled && config.endpoint) {
    return networkTransport({ endpoint: config.endpoint, ...config.network });
  }

  return {
    kind: 'not_configured',
    async send(): Promise<ClientResult> {
      return notConfigured();
    },
  };
}
