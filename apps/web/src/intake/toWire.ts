/**
 * Website intake to V2 wire contract.
 *
 * THE INTAKE DRAFT STORES DISPLAY STRINGS. `property.type` really is the literal
 * `'Multifamily'`, `situation.current` really is `'Replace current management'`, because
 * the approved UI binds radio inputs directly to the visible label. The backend REJECTS
 * approved display strings as wire values with their own error code, precisely so a copy
 * edit or a translation can never silently change a stored value.
 *
 * This file is the only place the two vocabularies meet. Every table below maps a label
 * this repository controls onto a token `scripts/gas-v2/src/Tokens.js` controls, and
 * `intake.wire.test.ts` feeds the output through the real `parseEnvelope` so the two
 * cannot drift apart unnoticed.
 *
 * An unmapped label is a BUG, not a value to pass through. `requireToken` throws rather
 * than sending the label, because sending it would earn a rejection at the boundary and
 * the visitor would see a failure they cannot act on.
 */

import type {
  ContactExchangePayload,
  EnvelopeDraft,
  GeneralTopic,
  Involvement,
  InvestorTopic,
  LocaleCode,
  PropertyScope,
  PropertyType,
  ServiceInquiryPayload,
  ServiceScope,
  Situation,
  Timing,
  WireAttribution,
  WireClientSignals,
} from '@axispoint/submission-client';
import { SCOPE_TO_INVOLVEMENT } from '@axispoint/submission-client';
import type { IntakeDraft, Pathway as UiPathway, ServiceScope as UiScope } from './model';

/* ── Label to token tables ────────────────────────────────────────────────── */

const PROPERTY_TYPE_BY_LABEL: Record<string, PropertyType> = {
  Multifamily: 'multifamily',
  Retail: 'retail',
  'Mixed portfolio': 'mixed_portfolio',
  'Another property type': 'another_property_type',
};

const PROPERTY_SCOPE_BY_LABEL: Record<string, PropertyScope> = {
  'One property': 'one_property',
  Portfolio: 'portfolio',
};

const SITUATION_BY_LABEL: Record<string, Situation> = {
  'Replace current management': 'replace_current_management',
  'Move away from self-management': 'move_away_from_self_management',
  'Recently acquired or under contract': 'recently_acquired_or_under_contract',
  'Lease-up or turnaround': 'lease_up_or_turnaround',
  'Operations or reporting problems': 'operations_or_reporting_problems',
  'Exploring management options': 'exploring_management_options',
  'Something else': 'something_else',
};

const TIMING_BY_LABEL: Record<string, Timing> = {
  Immediately: 'immediately',
  'Within 30 days': 'within_30_days',
  '30 to 60 days': 'days_30_to_60',
  '60 to 90 days': 'days_60_to_90',
  'Still exploring': 'still_exploring',
};

const INVESTOR_TOPIC_BY_LABEL: Record<string, InvestorTopic> = {
  'Exploring my first acquisition': 'exploring_first_acquisition',
  'Under contract now': 'under_contract_now',
  'Actively searching': 'actively_searching',
  'Own property, need an operating team': 'own_property_need_operating_team',
  'Something else': 'something_else',
};

const GENERAL_TOPIC_BY_LABEL: Record<string, GeneralTopic> = {
  'A question about AxisPoint': 'question_about_axispoint',
  'Vendor or service provider': 'vendor_or_service_provider',
  Employment: 'employment',
  'Press or media': 'press_or_media',
  'Something else': 'something_else',
};

/**
 * Follow-up language, by the English name the approved selector shows.
 *
 * All nine are accepted as a stated PREFERENCE even though English is the only locale
 * anything is sent in. Knowing somebody wants to be answered in Punjabi is useful to a
 * partner long before a translation exists.
 */
const LOCALE_BY_LANGUAGE_NAME: Record<string, LocaleCode> = {
  English: 'en',
  Spanish: 'es',
  'Simplified Chinese': 'zh-Hans',
  'Traditional Chinese': 'zh-Hant',
  Vietnamese: 'vi',
  Hindi: 'hi',
  Urdu: 'ur',
  Gujarati: 'gu',
  Punjabi: 'pa',
};

export class UnmappedIntakeValue extends Error {
  constructor(field: string, value: string) {
    super(`unmapped intake value for ${field}: ${JSON.stringify(value)}`);
    this.name = 'UnmappedIntakeValue';
  }
}

function requireToken<T extends string>(table: Record<string, T>, field: string, label: string): T {
  const token = table[label];
  if (!token) throw new UnmappedIntakeValue(field, label);
  return token;
}

/** Optional free text. Omitted from the payload when empty rather than sent as `''`. */
function optional(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? undefined : trimmed;
}

/* ── Pathway and scope ────────────────────────────────────────────────────── */

/**
 * The UI's `ServiceScope` union carries `'investor-services'` and `'general-inquiry'`,
 * which are PATHWAY markers rather than service scopes. The wire has only three real
 * scopes and accepts them only on the Management Proposal pathway, so those two are
 * dropped here instead of being sent as an invalid scope.
 */
const SERVICE_SCOPE_BY_UI: Record<string, ServiceScope> = {
  pm: 'pm',
  'pm-plus-am': 'pm_plus_am',
  undecided: 'undecided',
};

export function wirePathway(pathway: UiPathway) {
  if (pathway === 'management-proposal') return 'management_proposal' as const;
  if (pathway === 'investor-services') return 'investor_services' as const;
  return 'general_inquiry' as const;
}

/**
 * Asset Management is NOT a pathway.
 *
 * `?intent=asset-management` enters the Management Proposal flow with the PM plus AM
 * involvement preselected, and that is what reaches the wire: pathway
 * `management_proposal`, scope `pm_plus_am`. The intent token records how they arrived.
 */
export function wireServiceScope(scope: UiScope): ServiceScope {
  return SERVICE_SCOPE_BY_UI[scope] ?? 'undecided';
}

const INTENT_BY_UI: Record<string, WireAttribution['intentToken']> = {
  'property-management': 'property_management',
  'asset-management': 'asset_management',
  'investor-services': 'investor_services',
  general: 'general',
};

export function wireIntentToken(intent: string | null | undefined): WireAttribution['intentToken'] {
  if (!intent) return null;
  return INTENT_BY_UI[intent] ?? null;
}

/* ── Payload ──────────────────────────────────────────────────────────────── */

function inquiryContact(draft: IntakeDraft) {
  return {
    fullName: draft.contact.fullName.trim(),
    email: draft.contact.email.trim(),
    phone: optional(draft.contact.phone),
    organization: optional(draft.contact.organization),
  };
}

export function toServiceInquiryPayload(draft: IntakeDraft): ServiceInquiryPayload {
  const pathway = wirePathway(draft.pathway);

  if (pathway === 'management_proposal') {
    const serviceScope = wireServiceScope(draft.scope);

    // `serviceScope` and `situation.involvement` describe one decision, and the backend
    // rejects a mismatch rather than guessing. Deriving the involvement from the scope
    // through the shared table is the only way to guarantee they agree, and it is why the
    // approved involvement LABEL is not mapped independently.
    const involvement: Involvement = SCOPE_TO_INVOLVEMENT[serviceScope];

    return {
      pathway,
      serviceScope,
      property: {
        type: requireToken(PROPERTY_TYPE_BY_LABEL, 'property.type', draft.property.type),
        scope: requireToken(PROPERTY_SCOPE_BY_LABEL, 'property.scope', draft.property.scope),
        location: draft.property.location.trim(),
        scale: draft.property.scaleUnknown ? undefined : optional(draft.property.scale),
        scaleUnknown: draft.property.scaleUnknown === true,
        propertyCount: optional(draft.property.propertyCount),
      },
      situation: {
        current: requireToken(SITUATION_BY_LABEL, 'situation.current', draft.situation.current),
        involvement,
        timing: requireToken(TIMING_BY_LABEL, 'situation.timing', draft.situation.timing),
        notes: optional(draft.situation.notes),
      },
      contact: inquiryContact(draft),
    };
  }

  if (pathway === 'investor_services') {
    return {
      pathway,
      topic: requireToken(INVESTOR_TOPIC_BY_LABEL, 'topic', draft.topic),
      contact: inquiryContact(draft),
    };
  }

  return {
    pathway,
    topic: requireToken(GENERAL_TOPIC_BY_LABEL, 'topic', draft.topic),
    contact: inquiryContact(draft),
  };
}

/* ── Envelope ─────────────────────────────────────────────────────────────── */

export interface WireContext {
  /** The locale the page was rendered in. English only in this pass. */
  pageLocale: LocaleCode;
  /** `?intent=` as the UI recorded it. */
  intent?: string | null;
  /** The path the visitor submitted from, used as `sourceDetail`. */
  sourceDetail: string;
  landingPage?: string;
  utm?: Partial<Record<'source' | 'medium' | 'campaign' | 'content' | 'term', string>>;
  clientSignals?: WireClientSignals;
}

/**
 * Builds the envelope draft. The client owns `schemaVersion`, `submissionId`, and
 * `submittedAt`; nothing here invents them.
 *
 * BOOKING IS NEVER INCLUDED. The draft carries a local booking selection for the
 * post-submission screen, and the backend rejects `payload.booking` outright, because a
 * calendar conflict must never be able to reject a stored inquiry. Booking is a separate
 * command that this pass does not send.
 */
export function toEnvelopeDraft(draft: IntakeDraft, context: WireContext): EnvelopeDraft {
  const preferredFollowUp = LOCALE_BY_LANGUAGE_NAME[draft.contact.followUpLanguage.trim()] ?? null;

  return {
    submissionKind: 'service_inquiry',
    locale: {
      page: context.pageLocale,
      // Two separate facts, never collapsed. Somebody can read the English page and ask to
      // be called back in Spanish, and both halves matter operationally.
      preferredFollowUp,
    },
    attribution: {
      sourceCategory: 'website',
      sourceDetail: context.sourceDetail,
      landingPage: optional(context.landingPage),
      intentToken: wireIntentToken(context.intent),
      // Carried verbatim and INERT. The backend never resolves it, never builds a chain
      // from it, and never notifies anybody because of it.
      refToken: optional(draft.referralCode),
      utm: context.utm,
    },
    payload: toServiceInquiryPayload(draft),
    clientSignals: context.clientSignals,
  };
}

/**
 * The QR Contact Exchange payload shape.
 *
 * Declared here so the contract is complete and testable, and deliberately NOT wired to
 * any UI: the Contact Exchange frontend is a later pass. Nothing in `apps/qr` imports it.
 */
export function toContactExchangePayload(input: ContactExchangePayload): ContactExchangePayload {
  return {
    fullName: input.fullName.trim(),
    email: optional(input.email),
    phone: optional(input.phone),
    company: optional(input.company),
    contactCategory: input.contactCategory,
    roleOrTitle: optional(input.roleOrTitle),
  };
}
