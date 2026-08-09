import { LOCALES } from '../i18n/locales';
import { EN, type Messages } from '../i18n/messages';
import type {
  GeneralTopic,
  Involvement,
  InvestorTopic,
  PropertyScope,
  PropertyType,
  Situation,
  Timing,
} from '@axispoint/submission-client';

/**
 * Typed frontend model for the approved V2 intake (design@2026-07-30).
 *
 * Source: `AxisPoint Form Design.dc.html` and its `AxisPointFormFlow.dc.html`
 * dependency. Every label, option, placeholder, and help string below is copied
 * from those sources rather than written here.
 *
 * This is a FRONTEND draft model, not the GAS contract. It deliberately carries no
 * V1 role values, no `qualData` bag, and no payload builder. Backend decisions that
 * remain open are listed at the bottom of this file.
 */

/* ── Pathways ──────────────────────────────────────────────────────────────── */

/**
 * Three active pathways this pass implements. The approved board inventories six;
 * Referral Partner and Submit a Referral are deferred for launch scope and are
 * deliberately not exposed as gateway choices. Recorded in docs/STATUS.md.
 */
export type Pathway = 'management-proposal' | 'investor-services' | 'general-inquiry';

/**
 * Service scope is the model's answer to "what is being asked for".
 *
 * Asset Management is NOT a pathway. Per docs/design-sources.md and the approved
 * board, it is a PM plus AM intent variant that enters the Management Proposal
 * pathway with asset-management interest identified. So `?intent=asset-management`
 * produces pathway `management-proposal` with scope `pm-plus-am`, never a separate
 * pathway or role.
 */
export type ServiceScope =
  | 'pm'
  | 'pm-plus-am'
  | 'undecided'
  | 'investor-services'
  | 'general-inquiry';

/** URL intent tokens. Public-facing only; they are not wire values. */
export type IntentToken =
  | 'property-management'
  | 'asset-management'
  | 'investor-services'
  | 'general';

export const INTENT_TOKENS: IntentToken[] = [
  'property-management',
  'asset-management',
  'investor-services',
  'general',
];

export function isIntentToken(v: string | null): v is IntentToken {
  return !!v && (INTENT_TOKENS as string[]).includes(v);
}

/* ── Draft ─────────────────────────────────────────────────────────────────── */

export interface PropertyDraft {
  /** "Multifamily" | "Retail" | "Mixed portfolio" | "Another property type" */
  type: string;
  /** "One property" | "Portfolio" */
  scope: string;
  /** City or market. No street address is collected. */
  location: string;
  /** Units, square feet, or a combined measure, depending on `type`. */
  scale: string;
  /** Number of properties, only when the scope is a portfolio. */
  propertyCount: string;
  /** True when the visitor selected "Not sure" instead of giving a scale. */
  scaleUnknown: boolean;
}

export interface SituationDraft {
  /** One of SITUATION_OPTIONS. */
  current: string;
  /** One of INVOLVEMENT_OPTIONS. Drives ServiceScope for the proposal pathway. */
  involvement: string;
  /** One of TIMING_OPTIONS. */
  timing: string;
  /** Optional free text. */
  notes: string;
}

export interface ContactDraft {
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  /**
   * A locale CODE from the canonical registry, or '' meaning "same as this page".
   *
   * Deliberately not a display label. Storing "Chinese (Simplified)" and matching it later
   * by name is what silently discarded both Chinese preferences.
   */
  followUpLanguage: string;
}

export interface BookingDraft {
  /** ISO date key of the chosen day, or '' when nothing is chosen. */
  dayKey: string;
  /**
   * The chosen slot as an ISO timestamp WITH an offset, ready for the wire.
   *
   * Stored resolved rather than as a "10:30 AM" label, because the label alone is
   * ambiguous: the backend needs a real instant, and deriving one at submit time would
   * mean re-running the time-zone arithmetic somewhere it is easy to get wrong.
   */
  slotStart: string;
  /** Display label for the chosen slot, e.g. "10:30 AM". */
  timeLabel: string;
  /** A backend token: `phone_call` or `video_meeting`. Never a display string. */
  mode: string;
}

export interface IntakeDraft {
  pathway: Pathway;
  scope: ServiceScope;
  /** Short-pathway topic. Empty for the management proposal pathway. */
  topic: string;
  property: PropertyDraft;
  situation: SituationDraft;
  contact: ContactDraft;
  booking: BookingDraft;
  /**
   * Referral code read from `?ref=`. Held in local draft state only.
   * Nothing is transmitted in this pass, and referral attribution is deferred.
   */
  referralCode: string;
}

export const emptyDraft = (pathway: Pathway, scope: ServiceScope): IntakeDraft => ({
  pathway,
  scope,
  topic: '',
  property: { type: '', scope: '', location: '', scale: '', propertyCount: '', scaleUnknown: false },
  situation: { current: '', involvement: '', timing: '', notes: '' },
  contact: { fullName: '', email: '', phone: '', organization: '', followUpLanguage: '' },
  booking: { dayKey: '', slotStart: '', timeLabel: '', mode: '' },
  referralCode: '',
});

/** Maps the approved involvement answer onto the model's service scope. */
/*
 * Scope and involvement convert through TOKENS, never through English labels.
 *
 * These two matched on the literal strings "Property Management" and
 * "Property Management + Asset Management". A translated radio label would have silently
 * produced scope `undecided` for every visitor, which the backend accepts, so the wrong
 * answer would have been stored with nothing failing anywhere.
 */
export function scopeFromInvolvement(involvement: string): ServiceScope {
  if (involvement === 'property_management_plus_asset_management') return 'pm-plus-am';
  if (involvement === 'property_management') return 'pm';
  return 'undecided';
}

export function involvementFromScope(scope: ServiceScope): string {
  if (scope === 'pm-plus-am') return 'property_management_plus_asset_management';
  if (scope === 'pm') return 'property_management';
  return '';
}

/* ── Approved content ──────────────────────────────────────────────────────── */

/**
 * A selectable choice: a STABLE value plus the catalog key that displays it.
 *
 * THIS SHAPE IS THE POINT OF THE PASS. Every one of these controls previously stored its
 * English label as the draft value, and `toWire` looked that label up in a table to find the
 * wire token. Translating the UI would therefore have broken every Management Proposal
 * submission outright, because the translated label would match no key. That is the same
 * defect class as the Chinese follow-up bug, one layer deeper and far more damaging.
 *
 * Now the value IS the wire token and the label is looked up in the catalog. A translation
 * changes `labelKey`'s content and cannot touch `value`, so the envelope is identical in
 * every language.
 */
export interface Choice<T extends string = string> {
  /** The wire token. Never translated, never derived from display text. */
  value: T;
  labelKey: keyof Messages;
  hintKey?: keyof Messages;
}

export const PROPERTY_TYPE_CHOICES: Choice<PropertyType>[] = [
  { value: 'multifamily', labelKey: 'propertyTypeMultifamily' },
  { value: 'retail', labelKey: 'propertyTypeRetail' },
  { value: 'mixed_portfolio', labelKey: 'propertyTypeMixedPortfolio' },
  { value: 'another_property_type', labelKey: 'propertyTypeAnother' },
];

export const PROPERTY_SCOPE_CHOICES: Choice<PropertyScope>[] = [
  { value: 'one_property', labelKey: 'propertyScopeOne' },
  { value: 'portfolio', labelKey: 'propertyScopePortfolio' },
];

export const SITUATION_CHOICES: Choice<Situation>[] = [
  { value: 'replace_current_management', labelKey: 'situationReplace' },
  { value: 'move_away_from_self_management', labelKey: 'situationMoveAway' },
  { value: 'recently_acquired_or_under_contract', labelKey: 'situationRecentlyAcquired' },
  { value: 'lease_up_or_turnaround', labelKey: 'situationLeaseUp' },
  { value: 'operations_or_reporting_problems', labelKey: 'situationOperations' },
  { value: 'exploring_management_options', labelKey: 'situationExploring' },
  { value: 'something_else', labelKey: 'situationSomethingElse' },
];

export const INVOLVEMENT_CHOICES: Choice<Involvement>[] = [
  { value: 'property_management', labelKey: 'involvementPm', hintKey: 'involvementPmHint' },
  {
    value: 'property_management_plus_asset_management',
    labelKey: 'involvementPmAm',
    hintKey: 'involvementPmAmHint',
  },
  { value: 'not_sure', labelKey: 'involvementNotSure', hintKey: 'involvementNotSureHint' },
];

export const TIMING_CHOICES: Choice<Timing>[] = [
  { value: 'immediately', labelKey: 'timingImmediately' },
  { value: 'within_30_days', labelKey: 'timingWithin30' },
  { value: 'days_30_to_60', labelKey: 'timing30to60' },
  { value: 'days_60_to_90', labelKey: 'timing60to90' },
  { value: 'still_exploring', labelKey: 'timingStillExploring' },
];

export const INVESTOR_TOPIC_CHOICES: Choice<InvestorTopic>[] = [
  { value: 'exploring_first_acquisition', labelKey: 'investorTopicFirstAcquisition' },
  { value: 'under_contract_now', labelKey: 'investorTopicUnderContract' },
  { value: 'actively_searching', labelKey: 'investorTopicActivelySearching' },
  { value: 'own_property_need_operating_team', labelKey: 'investorTopicOwnProperty' },
  { value: 'something_else', labelKey: 'investorTopicSomethingElse' },
];

export const GENERAL_TOPIC_CHOICES: Choice<GeneralTopic>[] = [
  { value: 'question_about_axispoint', labelKey: 'generalTopicQuestion' },
  { value: 'vendor_or_service_provider', labelKey: 'generalTopicVendor' },
  { value: 'employment', labelKey: 'generalTopicEmployment' },
  { value: 'press_or_media', labelKey: 'generalTopicPress' },
  { value: 'something_else', labelKey: 'generalTopicSomethingElse' },
];

/** Renders a choice list for a select or radio group, in the active language. */
export function choiceOptions<T extends string>(
  choices: Choice<T>[],
  t: Messages,
): { value: T; text: string }[] {
  return choices.map((c) => ({ value: c.value, text: t[c.labelKey] }));
}

/** The display label for a stored token, for summaries and confirmations. */
export function choiceLabel<T extends string>(choices: Choice<T>[], value: string, t: Messages): string {
  const found = choices.find((c) => c.value === value);
  return found ? t[found.labelKey] : '';
}

/**
 * The scale field adapts to the property type, per the approved source.
 *
 * Keyed by the property-type TOKEN, not by its English label. Keying this by display text
 * was the quietest instance of the same defect: a translated "Multifamily" would have fallen
 * through to the generic fallback copy, so the form would still submit but would silently
 * ask the wrong question.
 */
export function scaleCopyFor(
  type: string,
  t: Messages,
): { label: string; placeholder: string; help: string } {
  if (type === 'multifamily') {
    return { label: t.scaleUnitsLabel, placeholder: t.scaleUnitsPlaceholder, help: t.scaleUnitsHelp };
  }
  if (type === 'retail') {
    return { label: t.scaleSqftLabel, placeholder: t.scaleSqftPlaceholder, help: t.scaleSqftHelp };
  }
  if (type === 'mixed_portfolio') {
    return { label: t.scaleMixedLabel, placeholder: t.scaleMixedPlaceholder, help: t.scaleMixedHelp };
  }
  if (type === 'another_property_type') {
    return { label: t.scaleOtherLabel, placeholder: t.scaleOtherPlaceholder, help: t.scaleOtherHelp };
  }
  return { label: t.scaleFallbackLabel, placeholder: t.scaleFallbackPlaceholder, help: t.scaleFallbackHelp };
}

export const SCALE_FALLBACK = {
  label: 'Approximate scale',
  placeholder: 'Units or square feet',
  help: 'Choose a property type above and this adapts to the right measure.',
};

/*
 * The nine approved languages are NOT redeclared here.
 *
 * There used to be a second list in this file, and a third English-name-to-code mapping in
 * `toWire.ts`, alongside the canonical registry in `i18n/locales.ts`. Three copies of one
 * list drifted exactly as you would expect: this file wrote "Chinese (Simplified)" while
 * the mapper matched on "Simplified Chinese", so both Chinese follow-up preferences hit an
 * unmatched lookup, became `null`, and were silently dropped on the way to the wire. A
 * visitor asked to be answered in Chinese and nothing recorded it.
 *
 * The registry in `i18n/locales.ts` is now the only source, and the select stores locale
 * CODES rather than display labels, so no name matching happens anywhere.
 */

/** Copy for the two short pathways, from the approved `paths` map. */
export interface ShortPathCopy {
  kicker: string;
  title: string;
  lead: string;
  topicLabel: string;
  /** Token-valued choices. The label is resolved from the catalog, the value never is. */
  topics: Choice<InvestorTopic | GeneralTopic>[];
  organizationLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  action: string;
}

/**
 * Copy for the two short pathways, resolved against the active catalog.
 *
 * A function rather than a constant because the strings are now language dependent while the
 * topic VALUES are not. The topic list is the shared choice definition, so the select and
 * the wire mapping cannot disagree about what a topic is.
 */
export function shortPathCopy(
  pathway: 'investor-services' | 'general-inquiry',
  t: Messages,
): ShortPathCopy {
  if (pathway === 'investor-services') {
    return {
      kicker: t.investorKicker,
      title: t.investorTitle,
      lead: t.investorLead,
      topicLabel: t.investorTopicLabel,
      topics: INVESTOR_TOPIC_CHOICES,
      organizationLabel: t.organizationLabel,
      noteLabel: t.investorNoteLabel,
      notePlaceholder: t.investorNotePlaceholder,
      action: t.submitLabel,
    };
  }
  return {
    kicker: t.generalKicker,
    title: t.generalTitle,
    lead: t.generalLead,
    topicLabel: t.generalTopicLabel,
    topics: GENERAL_TOPIC_CHOICES,
    organizationLabel: t.organizationLabel,
    noteLabel: t.generalNoteLabel,
    notePlaceholder: t.generalNotePlaceholder,
    action: t.submitLabel,
  };
}

/* ── Booking presentation ──────────────────────────────────────────────────── */

/**
 * Copy for the booking surface.
 *
 * The fixture calendar that used to live here is gone. It hard-coded "August 2026",
 * invented two taken slots, and greyed out every date before the 10th, none of which the
 * browser can actually know: V2 exposes no availability query. Candidate times are now
 * derived from the backend's own booking rules in `booking/availability.ts`, and the copy
 * below is careful never to describe them as live availability.
 */
/*
 * Booking copy now lives in the message catalog (`i18n/messages.ts`), not here.
 *
 * It briefly existed in both, which is the same duplication this pass deleted elsewhere.
 * The strings are unchanged; only their home moved, so a future locale supplies them the
 * same way it supplies every other visitor-facing string.
 */

/* ── Validation ────────────────────────────────────────────────────────────── */

/** The approved email test, copied verbatim from the design source. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export interface FieldErrors {
  fullName?: string;
  email?: string;
  /** Short-pathway topic. Required by the backend, so it is required here too. */
  topic?: string;
}

/**
 * Validation messages come from the active catalog.
 *
 * `t` defaults to English so every existing caller and test keeps working unchanged, and so
 * a validator called outside a React tree still produces real sentences rather than keys.
 * The constants that used to live here are gone: they were duplicated into the catalog, and
 * two homes for one string is how the follow-up language labels drifted in the first place.
 */
export function validateContact(contact: ContactDraft, t: Messages = EN): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.fullName.trim()) errors.fullName = t.nameError;
  if (!EMAIL_RE.test(contact.email)) errors.email = t.emailError;
  return errors;
}

/**
 * The follow-up language options, in ONE place.
 *
 * Exported so `Intake.tsx` and the regression test consume the same value. A test that
 * rebuilt this list itself could pass while the real control reverted to display-name
 * values, which is exactly how the Chinese defect survived its own test suite.
 */
export function followUpOptions(t: Messages = EN): { value: string; text: string }[] {
  return [
    { value: '', text: t.followUpSameAsPage },
    ...LOCALES.map((l) => ({ value: l.code, text: `${l.nativeName} · ${l.englishName}` })),
  ];
}

/**
 * Validates everything the submission needs, not just the contact block.
 *
 * The short pathways carry a required `topic`, and until Pass 10A nothing checked it: the
 * select defaults to an empty "Select one" and the send button accepted it. That was
 * invisible while submission was simulated, because the simulation succeeded regardless.
 * The backend requires the token, so an empty topic is a rejection the visitor cannot see
 * or act on, which is exactly the failure this catches at the point they can fix it.
 */
export function validateDraft(draft: IntakeDraft, t: Messages = EN): FieldErrors {
  const errors = validateContact(draft.contact, t);
  const needsTopic =
    draft.pathway === 'investor-services' || draft.pathway === 'general-inquiry';

  if (needsTopic && !draft.topic.trim()) errors.topic = t.topicError;
  return errors;
}

export function errorCount(errors: FieldErrors): number {
  return Object.keys(errors).length;
}

/* ── Open backend decisions ────────────────────────────────────────────────────

  Not invented here. Carried into the Pass 5 backend-contract work:

  - Which of these fields are required by the backend, versus required only in the UI.
  - Whether `scope` ('pm' | 'pm-plus-am' | 'undecided') is stored as its own column,
    folded into a details blob, or derived from the involvement answer.
  - How `followUpLanguage` is stored and whether it drives template selection.
  - Real booking availability rules. The fixture above is a frontend placeholder.
  - Whether the referral code captured from `?ref=` is transmitted at all once the
    deferred referral pathways return.
  - Dedupe and merge semantics for a resubmitted inquiry.
  - Lead identifier format for V2.
──────────────────────────────────────────────────────────────────────────────── */
