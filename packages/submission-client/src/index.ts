/**
 * `@axispoint/submission-client`
 *
 * THE SINGLE FRONTEND TRANSPORT BOUNDARY for AxisPoint V2. Both the website intake and,
 * later, the QR Contact Exchange submit through this package and nothing else. No app
 * calls `fetch` for a submission directly.
 *
 * It owns the wire contract, the submission id, the retry attempt, and the choice between
 * simulating and calling a real endpoint. It owns no UI: there is no React, no component,
 * and no AxisPoint styling here, which is why it does not live in `packages/brand`.
 *
 * Three operating modes, and the choice is always explicit:
 *
 *   development, default      simulator. Zero network requests.
 *   explicit network opt-in   requires BOTH the flag and a configured endpoint.
 *   production, unconfigured  a truthful NOT_CONFIGURED failure, never a fake success.
 */

export {
  SCHEMA_VERSION,
  SCOPE_TO_INVOLVEMENT,
  BACKEND_ERROR,
} from './wire';

export type {
  SubmissionKind,
  Pathway,
  ServiceScope,
  IntentToken,
  PropertyType,
  PropertyScope,
  Situation,
  Involvement,
  Timing,
  InvestorTopic,
  GeneralTopic,
  ContactCategory,
  LocaleCode,
  SourceCategory,
  BookingMode,
  WireLocale,
  WireUtm,
  WireAttribution,
  WireInquiryContact,
  WireProperty,
  WireSituation,
  WireClientSignals,
  ManagementProposalPayload,
  InvestorServicesPayload,
  GeneralInquiryPayload,
  ServiceInquiryPayload,
  ContactExchangePayload,
  ServiceInquiryEnvelope,
  ContactExchangeEnvelope,
  SubmissionEnvelope,
  BookingRequestEnvelope,
  WireEnvelope,
  SubmissionSuccessResponse,
  SubmissionErrorResponse,
  SubmissionResponse,
  BookingStatus,
  BookingSuccessResponse,
  BookingErrorResponse,
  BookingResponse,
} from './wire';

export { BOOKING_STATUS, BOOKING_ERROR } from './wire';

export {
  CLIENT_ERROR,
  classifyBackendError,
  canRetry,
  isSuccess,
  isSubmissionResponse,
  isBookingResponse,
} from './errors';
export type { ClientResult, ClientSuccess, ClientFailure, ClientOutcome } from './errors';

export { newSubmissionId, isSubmissionId } from './id';

export { createTransport, simulatorTransport, networkTransport } from './transport';
export type {
  Transport,
  TransportConfig,
  SimulatorFixture,
  SimulatorOptions,
  NetworkOptions,
} from './transport';

export { createSubmissionClient } from './attempt';
export type {
  SubmissionClient,
  SubmissionClientOptions,
  AttemptSnapshot,
  AttemptStatus,
  EnvelopeDraft,
} from './attempt';

export { createBookingClient } from './booking';
export type {
  BookingClient,
  BookingClientOptions,
  BookingDraft,
  BookingSnapshot,
  BookingAttemptStatus,
} from './booking';
