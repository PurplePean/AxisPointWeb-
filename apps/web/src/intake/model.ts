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
  /** English name of an approved language, or '' meaning "same as this page". */
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
export function scopeFromInvolvement(involvement: string): ServiceScope {
  if (involvement === 'Property Management + Asset Management') return 'pm-plus-am';
  if (involvement === 'Property Management') return 'pm';
  return 'undecided';
}

export function involvementFromScope(scope: ServiceScope): string {
  if (scope === 'pm-plus-am') return 'Property Management + Asset Management';
  if (scope === 'pm') return 'Property Management';
  return '';
}

/* ── Approved content ──────────────────────────────────────────────────────── */

export const PROPERTY_TYPES = ['Multifamily', 'Retail', 'Mixed portfolio', 'Another property type'];
export const PROPERTY_SCOPES = ['One property', 'Portfolio'];

export const SITUATION_OPTIONS = [
  'Replace current management',
  'Move away from self-management',
  'Recently acquired or under contract',
  'Lease-up or turnaround',
  'Operations or reporting problems',
  'Exploring management options',
  'Something else',
];

export const INVOLVEMENT_OPTIONS: { label: string; hint: string }[] = [
  { label: 'Property Management', hint: 'Run the property day to day.' },
  {
    label: 'Property Management + Asset Management',
    hint: 'Run the property and help direct the investment strategy.',
  },
  { label: 'Not Sure', hint: 'Help me determine the appropriate level of involvement.' },
];

export const TIMING_OPTIONS = [
  'Immediately',
  'Within 30 days',
  '30 to 60 days',
  '60 to 90 days',
  'Still exploring',
];

/** Scale field adapts to the property type, per the approved source. */
export const SCALE_BY_TYPE: Record<string, { label: string; placeholder: string; help: string }> = {
  Multifamily: {
    label: 'Approximate units',
    placeholder: 'For example 184',
    help: 'A round number is fine. We are sizing the operating team, not auditing the rent roll.',
  },
  Retail: {
    label: 'Approximate square footage',
    placeholder: 'For example 42,000',
    help: 'Gross leasable area is the most useful figure here.',
  },
  'Mixed portfolio': {
    label: 'Approximate combined scale',
    placeholder: 'For example 300 units and 40,000 sq ft',
    help: 'Units, square footage, or both. Tell us in whatever terms you track it.',
  },
  'Another property type': {
    label: 'Approximate scale',
    placeholder: 'Units, square feet, or another measure',
    help: 'Describe the size in the terms that make sense for this property type.',
  },
};

export const SCALE_FALLBACK = {
  label: 'Approximate scale',
  placeholder: 'Units or square feet',
  help: 'Choose a property type above and this adapts to the right measure.',
};

/** The nine approved languages. The site itself remains English-only in this pass. */
export const APPROVED_LANGUAGES: { code: string; native: string; english: string }[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'zh-Hans', native: '简体中文', english: 'Chinese (Simplified)' },
  { code: 'zh-Hant', native: '繁體中文', english: 'Chinese (Traditional)' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'ur', native: 'اردو', english: 'Urdu' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
];

/** Copy for the two short pathways, from the approved `paths` map. */
export interface ShortPathCopy {
  kicker: string;
  title: string;
  lead: string;
  topicLabel: string;
  topics: string[];
  organizationLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  action: string;
}

export const SHORT_PATHS: Record<'investor-services' | 'general-inquiry', ShortPathCopy> = {
  'investor-services': {
    kicker: 'Investor Services',
    title: 'Tell us where you are in the process.',
    lead: 'A short note is enough to start. We will follow up to arrange a conversation.',
    topicLabel: 'Where are you in the process?',
    topics: [
      'Exploring my first acquisition',
      'Under contract now',
      'Actively searching',
      'Own property, need an operating team',
      'Something else',
    ],
    organizationLabel: 'Company',
    noteLabel: 'What are you looking at?',
    notePlaceholder: 'Asset type, market, or timeline',
    action: 'Send Inquiry',
  },
  'general-inquiry': {
    kicker: 'General inquiry',
    title: 'What can we help with?',
    lead: 'Tell us who you are and what you need. We will route it to the right partner.',
    topicLabel: 'What is this about?',
    topics: [
      'A question about AxisPoint',
      'Vendor or service provider',
      'Employment',
      'Press or media',
      'Something else',
    ],
    organizationLabel: 'Company',
    noteLabel: 'Your message',
    notePlaceholder: 'A few sentences is plenty',
    action: 'Send Inquiry',
  },
};

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
export const BOOKING_COPY = {
  durationLabel: '30 minutes',
  /**
   * Neutral until a backend actually assigns someone. Naming a specific partner would be
   * an invented assignment, and no assignment logic exists.
   */
  withLabel: 'AxisPoint Partners',
  /** Says what these times are, and what they are not. */
  candidateNote:
    'Times are shown in Central Time, Houston. Availability is confirmed when you book.',
  /** The approved neutral refusal for a slot that was taken between choosing and booking. */
  slotTaken: 'That time is no longer available. Please choose another.',
  failed: 'We could not confirm that time. Nothing was booked. Try again.',
  refused: 'We could not book that time, and trying again would not help.',
  unavailable: 'Scheduling is unavailable right now. Nothing was booked.',
} as const;

/* ── Validation ────────────────────────────────────────────────────────────── */

/** The approved email test, copied verbatim from the design source. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export interface FieldErrors {
  fullName?: string;
  email?: string;
  /** Short-pathway topic. Required by the backend, so it is required here too. */
  topic?: string;
}

export const NAME_HELP = 'As you would like us to address you.';
export const NAME_ERROR = 'Enter the name we should ask for when we call.';
export const EMAIL_HELP = 'Where we’ll send our reply and any follow-up details.';
export const EMAIL_ERROR =
  'This address is missing the part after the @ sign. Add the full address, for example name@company.com.';

export const TOPIC_ERROR = 'Choose the option that best describes your inquiry.';

export function validateContact(contact: ContactDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.fullName.trim()) errors.fullName = NAME_ERROR;
  if (!EMAIL_RE.test(contact.email)) errors.email = EMAIL_ERROR;
  return errors;
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
export function validateDraft(draft: IntakeDraft): FieldErrors {
  const errors = validateContact(draft.contact);
  const needsTopic =
    draft.pathway === 'investor-services' || draft.pathway === 'general-inquiry';

  if (needsTopic && !draft.topic.trim()) errors.topic = TOPIC_ERROR;
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
