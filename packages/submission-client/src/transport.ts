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
import type { SubmissionEnvelope, SubmissionResponse, SubmissionSuccessResponse } from './wire';
import type { ClientResult, ClientFailure } from './errors';
import { CLIENT_ERROR, classifyBackendError, networkFailure, notConfigured } from './errors';

export interface Transport {
  /** Names which implementation is in use. Surfaced in dev tooling and tests. */
  readonly kind: 'simulator' | 'network' | 'not_configured';
  send(envelope: SubmissionEnvelope, signal?: AbortSignal): Promise<ClientResult>;
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
  | 'not_configured';

export interface SimulatorOptions {
  fixture?: SimulatorFixture;
  /** Milliseconds before resolving, so the sending state is observable. */
  delayMs?: number;
  /** Records every envelope handed to it, for assertions. */
  onSend?: (envelope: SubmissionEnvelope) => void;
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
    async send(envelope: SubmissionEnvelope): Promise<ClientResult> {
      options.onSend?.(envelope);
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

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
    async send(envelope: SubmissionEnvelope, signal?: AbortSignal): Promise<ClientResult> {
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

      let body: SubmissionResponse;
      try {
        body = (await raw.json()) as SubmissionResponse;
      } catch {
        return malformed();
      }

      if (!body || typeof body !== 'object' || typeof (body as { ok?: unknown }).ok !== 'boolean') {
        return malformed();
      }

      if (body.ok === true) {
        if (!isValidSuccess(body, envelope)) return malformed();
        return { outcome: 'ok', response: body };
      }

      const error = readError(body);
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
  /** True in a development build. Gates the simulator, never production. */
  isDevelopment: boolean;
  simulator?: SimulatorOptions;
  network?: Omit<NetworkOptions, 'endpoint'>;
}

/**
 * Chooses a transport, failing closed.
 *
 * The order is deliberate. Network mode requires BOTH the explicit flag AND an endpoint;
 * either one alone is a misconfiguration, not an invitation to guess. Simulation is
 * available only in a development build, so a production bundle with no endpoint cannot
 * fall through to it. What is left is an honest `not_configured` transport that returns a
 * truthful failure without contacting anything.
 */
export function createTransport(config: TransportConfig): Transport {
  if (config.networkEnabled && config.endpoint) {
    return networkTransport({ endpoint: config.endpoint, ...config.network });
  }

  if (config.isDevelopment && !config.networkEnabled) {
    return simulatorTransport(config.simulator);
  }

  return {
    kind: 'not_configured',
    async send(): Promise<ClientResult> {
      return notConfigured();
    },
  };
}
