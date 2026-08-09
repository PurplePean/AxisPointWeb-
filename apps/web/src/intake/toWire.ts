/**
 * Website intake to V2 wire contract.
 *
 * THE INTAKE DRAFT STORES WIRE TOKENS, not display strings. `property.type` really is
 * `'multifamily'`, `situation.current` really is `'replace_current_management'`, because
 * every choice control binds to a stable value and renders its label from the message
 * catalog. The backend rejects display strings as wire values with their own error code, and
 * this arrangement means a translation cannot produce one.
 *
 * It was the other way round until the localization pass: the draft held English labels and
 * six tables here converted them. `intake.wire.test.ts` still feeds the output through the
 * real `parseEnvelope`, so the two vocabularies cannot drift apart unnoticed.
 *
 * A value that was never offered is a BUG, not something to pass through. `requireChoice`
 * throws rather than sending it, because sending it would earn a rejection at the boundary
 * and the visitor would see a failure they cannot act on.
 */

import type {
  ContactExchangePayload,
  EnvelopeDraft,
  Involvement,
  LocaleCode,
  ServiceInquiryPayload,
  ServiceScope,
  WireAttribution,
  WireClientSignals,
} from '@axispoint/submission-client';
import { SCOPE_TO_INVOLVEMENT } from '@axispoint/submission-client';
import { LOCALES } from '../i18n/locales';
import {
  GENERAL_TOPIC_CHOICES,
  INVESTOR_TOPIC_CHOICES,
  PROPERTY_SCOPE_CHOICES,
  PROPERTY_TYPE_CHOICES,
  SITUATION_CHOICES,
  TIMING_CHOICES,
  type Choice,
} from './model';
import type { IntakeDraft, Pathway as UiPathway, ServiceScope as UiScope } from './model';

/* ── Token validation ─────────────────────────────────────────────────────── */

/*
 * THE SIX LABEL TABLES ARE GONE, and their absence is the substance of this pass.
 *
 * They mapped English display text onto wire tokens: `'Multifamily' -> 'multifamily'`,
 * `'Immediately' -> 'immediately'`, and four more. That worked only while the UI was
 * English. Translate a single radio label and the lookup misses, so a Management Proposal
 * either throws on an unmapped value or, for involvement, silently resolves to the wrong
 * service scope and stores an answer the visitor never gave.
 *
 * The draft now holds the token itself. What remains is a membership check against the same
 * choice definitions the UI renders from, so a value that was never offered still cannot
 * reach the wire.
 */

function requireChoice<T extends string>(choices: Choice<T>[], field: string, value: string): T {
  const found = choices.find((c) => c.value === value);
  if (!found) throw new UnmappedIntakeValue(field, value);
  return found.value;
}

/**
 * Follow-up language, validated against the canonical registry by CODE.
 *
 * There is no name-to-code table any more, and that is the point. The previous one matched
 * on English display names, the select offered different names than the table held, and
 * both Chinese preferences silently became `null`. Codes cannot drift from themselves.
 *
 * All nine are accepted as a stated PREFERENCE even though English is the only locale
 * anything is sent in. Knowing somebody wants to be answered in Punjabi is useful to a
 * partner long before a translation exists.
 */
function toPreferredFollowUp(value: string): LocaleCode | null {
  const code = value.trim();
  if (code === '') return null;
  const known = LOCALES.find((l) => l.code === code);
  if (!known) {
    // An unknown code is a wiring bug, not a visitor input: the select is built from the
    // same registry. Throwing surfaces it in development rather than dropping the
    // preference the way the old lookup did.
    throw new UnmappedIntakeValue('followUpLanguage', value);
  }
  return known.code;
}

export class UnmappedIntakeValue extends Error {
  constructor(field: string, value: string) {
    super(`unmapped intake value for ${field}: ${JSON.stringify(value)}`);
    this.name = 'UnmappedIntakeValue';
  }
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
        type: requireChoice(PROPERTY_TYPE_CHOICES, 'property.type', draft.property.type),
        scope: requireChoice(PROPERTY_SCOPE_CHOICES, 'property.scope', draft.property.scope),
        location: draft.property.location.trim(),
        scale: draft.property.scaleUnknown ? undefined : optional(draft.property.scale),
        scaleUnknown: draft.property.scaleUnknown === true,
        propertyCount: optional(draft.property.propertyCount),
      },
      situation: {
        current: requireChoice(SITUATION_CHOICES, 'situation.current', draft.situation.current),
        involvement,
        timing: requireChoice(TIMING_CHOICES, 'situation.timing', draft.situation.timing),
        notes: optional(draft.situation.notes),
      },
      contact: inquiryContact(draft),
    };
  }

  if (pathway === 'investor_services') {
    return {
      pathway,
      topic: requireChoice(INVESTOR_TOPIC_CHOICES, 'topic', draft.topic),
      contact: inquiryContact(draft),
    };
  }

  return {
    pathway,
    topic: requireChoice(GENERAL_TOPIC_CHOICES, 'topic', draft.topic),
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
  const preferredFollowUp = toPreferredFollowUp(draft.contact.followUpLanguage);

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
