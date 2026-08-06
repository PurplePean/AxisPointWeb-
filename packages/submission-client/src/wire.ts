/**
 * The canonical V2 wire contract, in TypeScript.
 *
 * EVERY TOKEN BELOW WAS READ OUT OF `scripts/gas-v2/src/Tokens.js`, not inferred from a
 * visible label. The backend rejects approved display strings as wire values with their
 * own error code precisely so the copy deck can never become the contract, and a type
 * declared from what a button says would defeat that on the first copy edit.
 *
 * `envelope.compat.test.ts` feeds envelopes built here through the real `parseEnvelope`
 * to prove the two agree. If a token changes on the backend, that test fails rather than
 * a real submission failing in production.
 *
 * This file is transport-agnostic and UI-agnostic. It contains no fetch, no React, and no
 * AxisPoint styling.
 */

export const SCHEMA_VERSION = 1 as const;

export type SubmissionKind = 'service_inquiry' | 'contact_exchange' | 'booking_request';

export type Pathway = 'management_proposal' | 'investor_services' | 'general_inquiry';

export type ServiceScope = 'pm' | 'pm_plus_am' | 'undecided';

export type IntentToken =
  | 'property_management'
  | 'asset_management'
  | 'investor_services'
  | 'general';

export type PropertyType = 'multifamily' | 'retail' | 'mixed_portfolio' | 'another_property_type';

export type PropertyScope = 'one_property' | 'portfolio';

export type Situation =
  | 'replace_current_management'
  | 'move_away_from_self_management'
  | 'recently_acquired_or_under_contract'
  | 'lease_up_or_turnaround'
  | 'operations_or_reporting_problems'
  | 'exploring_management_options'
  | 'something_else';

export type Involvement =
  | 'property_management'
  | 'property_management_plus_asset_management'
  | 'not_sure';

export type Timing =
  | 'immediately'
  | 'within_30_days'
  | 'days_30_to_60'
  | 'days_60_to_90'
  | 'still_exploring';

export type InvestorTopic =
  | 'exploring_first_acquisition'
  | 'under_contract_now'
  | 'actively_searching'
  | 'own_property_need_operating_team'
  | 'something_else';

export type GeneralTopic =
  | 'question_about_axispoint'
  | 'vendor_or_service_provider'
  | 'employment'
  | 'press_or_media'
  | 'something_else';

export type ContactCategory =
  | 'property_owner_operator'
  | 'broker_real_estate_advisor'
  | 'investor_capital_partner'
  | 'lender_financial_professional'
  | 'property_management_operations'
  | 'service_provider_vendor'
  | 'other';

/** BCP-47 identifiers, not project enums. Case and script subtags are exact. */
export type LocaleCode = 'en' | 'es' | 'zh-Hans' | 'zh-Hant' | 'vi' | 'hi' | 'ur' | 'gu' | 'pa';

export type SourceCategory = 'website' | 'qr';

export type BookingMode = 'phone_call' | 'video_meeting';

/**
 * `serviceScope` and `situation.involvement` describe the same decision, and the backend
 * REJECTS a mismatch rather than guessing which one the visitor meant. Mapping through
 * this table is the only safe way to populate both.
 */
export const SCOPE_TO_INVOLVEMENT: Record<ServiceScope, Involvement> = {
  pm: 'property_management',
  pm_plus_am: 'property_management_plus_asset_management',
  undecided: 'not_sure',
};

/* ── Envelope ─────────────────────────────────────────────────────────────── */

export interface WireLocale {
  /** Where the visitor was. */
  page: LocaleCode;
  /** How they asked to be answered. `null` when they did not say. */
  preferredFollowUp: LocaleCode | null;
}

export interface WireUtm {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
}

export interface WireAttribution {
  sourceCategory: SourceCategory;
  /** Required and non-empty. A page path for the website, a card slug for QR. */
  sourceDetail: string;
  landingPage?: string;
  intentToken?: IntentToken | null;
  /**
   * Carried verbatim and INERT. The backend never resolves it, never builds a referral
   * chain from it, never notifies anybody because of it, and never reports on it.
   */
  refToken?: string;
  utm?: Partial<WireUtm>;
}

export interface WireInquiryContact {
  fullName: string;
  email: string;
  phone?: string;
  organization?: string;
}

export interface WireProperty {
  type: PropertyType;
  scope: PropertyScope;
  location: string;
  scale?: string;
  scaleUnknown?: boolean;
  propertyCount?: string;
}

export interface WireSituation {
  current: Situation;
  involvement: Involvement;
  timing: Timing;
  notes?: string;
}

export interface ManagementProposalPayload {
  pathway: 'management_proposal';
  serviceScope: ServiceScope;
  property: WireProperty;
  situation: WireSituation;
  contact: WireInquiryContact;
}

export interface InvestorServicesPayload {
  pathway: 'investor_services';
  topic: InvestorTopic;
  contact: WireInquiryContact;
}

export interface GeneralInquiryPayload {
  pathway: 'general_inquiry';
  topic: GeneralTopic;
  contact: WireInquiryContact;
}

export type ServiceInquiryPayload =
  | ManagementProposalPayload
  | InvestorServicesPayload
  | GeneralInquiryPayload;

export interface ContactExchangePayload {
  fullName: string;
  /** At least one of `email` or `phone` must be present. */
  email?: string;
  phone?: string;
  company?: string;
  contactCategory: ContactCategory;
  roleOrTitle?: string;
}

/**
 * Advisory only. The backend treats these as evidence that can add to a spam
 * determination and never as evidence that clears one, because a bot controls what it
 * sends.
 */
export interface WireClientSignals {
  /** Seconds between the form opening and the send. */
  fillSeconds?: number;
  /** Populated only by a bot. Any non-empty value flags the submission. */
  honeypot?: string;
}

interface WireEnvelopeBase {
  schemaVersion: typeof SCHEMA_VERSION;
  /** UUID v4, generated ONCE per attempt. See `attempt.ts`. */
  submissionId: string;
  submittedAt?: string;
  locale: WireLocale;
  attribution: WireAttribution;
  clientSignals?: WireClientSignals;
}

export interface ServiceInquiryEnvelope extends WireEnvelopeBase {
  submissionKind: 'service_inquiry';
  payload: ServiceInquiryPayload;
}

export interface ContactExchangeEnvelope extends WireEnvelopeBase {
  submissionKind: 'contact_exchange';
  payload: ContactExchangePayload;
}

export type SubmissionEnvelope = ServiceInquiryEnvelope | ContactExchangeEnvelope;

/**
 * The booking command. A SEPARATE request issued after a submission, never a block inside
 * one. The Lead must already exist, which is why this carries `leadId`: it REFERENCES a
 * stored Lead rather than claiming to create one, and it is the single server-owned name a
 * request from a browser is allowed to name.
 */
export interface BookingRequestEnvelope {
  schemaVersion: typeof SCHEMA_VERSION;
  submissionKind: 'booking_request';
  bookingRequestId: string;
  leadId: string;
  /** ISO 8601 WITH an offset or `Z`. A bare local timestamp is rejected. */
  slotStart: string;
  durationMinutes: number;
  mode: BookingMode;
  submittedAt?: string;
}

/** Anything this client can put on the wire. */
export type WireEnvelope = SubmissionEnvelope | BookingRequestEnvelope;

/* ── Responses ────────────────────────────────────────────────────────────── */

export interface SubmissionSuccessResponse {
  schemaVersion: number;
  ok: true;
  submissionKind: SubmissionKind;
  submissionId: string;
  /** Populated for a service inquiry, `null` for a contact exchange. */
  leadId: string | null;
  /** Populated for a contact exchange, `null` for a service inquiry. */
  contactId: string | null;
  slaDueAt: string | null;
  /**
   * Decided by the backend and forwarded on the response. Always present, always a strict
   * boolean. **The frontend must trust this and must never implement its own booking
   * policy**: that duplicate definition is what the backend deleted to keep one rule.
   */
  bookingEligible: boolean;
  replay: boolean;
}

export interface SubmissionErrorResponse {
  schemaVersion: number;
  ok: false;
  error: { code: string; field: string | null };
  bookingStatus?: string;
}

export type SubmissionResponse = SubmissionSuccessResponse | SubmissionErrorResponse;

/**
 * The booking command's final status.
 *
 * `confirmed` is reachable from exactly one place in the backend: a successful calendar
 * `createEvent`. Every other value is a truthful refusal, and the difference between them
 * is what lets the UI say something specific instead of "something went wrong".
 */
export type BookingStatus = 'confirmed' | 'unavailable' | 'rejected' | 'failed' | 'not_configured';

export const BOOKING_STATUS: Record<string, BookingStatus> = {
  CONFIRMED: 'confirmed',
  UNAVAILABLE: 'unavailable',
  REJECTED: 'rejected',
  FAILED: 'failed',
  NOT_CONFIGURED: 'not_configured',
};

/**
 * A confirmed booking.
 *
 * Note what is NOT here: no `submissionId`, no `leadId`, no `slaDueAt`, no
 * `bookingEligible`. A booking response is a different shape from a submission response,
 * which is why it is validated separately rather than squeezed through the submission
 * validator.
 */
export interface BookingSuccessResponse {
  schemaVersion: number;
  ok: true;
  submissionKind: 'booking_request';
  bookingRequestId: string;
  bookingStatus: 'confirmed';
  replay: boolean;
}

/** A refusal. `bookingStatus` says which kind, `error.code` says exactly why. */
export interface BookingErrorResponse {
  schemaVersion: number;
  ok: false;
  error: { code: string; field: string | null };
  bookingStatus?: BookingStatus;
}

export type BookingResponse = BookingSuccessResponse | BookingErrorResponse;

/**
 * Backend refusal codes for the booking command.
 *
 * Listed so the UI can distinguish "pick another time" from "this cannot work", not so the
 * frontend can re-decide anything. Eligibility remains the backend's call.
 */
export const BOOKING_ERROR = {
  /** The slot is genuinely taken. The visitor picks another time. */
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  SLOT_TOO_SOON: 'SLOT_TOO_SOON',
  SLOT_TOO_FAR_AHEAD: 'SLOT_TOO_FAR_AHEAD',
  SLOT_OUTSIDE_BUSINESS_HOURS: 'SLOT_OUTSIDE_BUSINESS_HOURS',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  /** The calendar could not be read. Not the same as "free". */
  AVAILABILITY_UNAVAILABLE: 'AVAILABILITY_UNAVAILABLE',
  CALENDAR_CREATE_FAILED: 'CALENDAR_CREATE_FAILED',
  CALENDAR_NOT_CONFIGURED: 'CALENDAR_NOT_CONFIGURED',
  LEAD_NOT_FOUND: 'LEAD_NOT_FOUND',
  PATHWAY_NOT_BOOKABLE: 'PATHWAY_NOT_BOOKABLE',
  BOOKING_ALREADY_ACTIVE: 'BOOKING_ALREADY_ACTIVE',
} as const;

/**
 * Backend error codes this client reasons about by name.
 *
 * Anything not listed is still handled; it is classified by the rules in `errors.ts`
 * rather than by being enumerated here, so an unrecognised code from a newer backend
 * degrades to a sensible class instead of crashing.
 */
export const BACKEND_ERROR = {
  SUBMISSION_ID_CONFLICT: 'SUBMISSION_ID_CONFLICT',
  SERVICE_NOT_CONFIGURED: 'SERVICE_NOT_CONFIGURED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BUSY_TRY_AGAIN: 'BUSY_TRY_AGAIN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
