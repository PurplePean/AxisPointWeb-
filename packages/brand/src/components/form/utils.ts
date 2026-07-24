/**
 * Shared contact form constants, helpers and payload builder.
 * Extracted verbatim from apps/web/src/pages/ContactPage.tsx.
 */
import type { Role, Step, MeetType, BookChoice, ContactFields, ReferredFields, PropertyDetails, EAOContact, Booking } from './types';

export const STEP_ORDER_INVESTOR = ['role', 'context', 'prefs', 'contact', 'booking', 'comms'] as const;
export const STEP_ORDER_OTHER = ['role', 'context', 'contact', 'booking', 'comms'] as const;
/* Existing Asset Owner: Who you are → Personal info → Property details → Current situation → Pressing issue → Schedule */
export const STEP_ORDER_EAO = ['role', 'personal', 'property', 'situation', 'issue', 'schedule'] as const;

/** Every valid wire role value. Used to validate an externally-supplied initial role. */
export const VALID_ROLES: readonly Role[] = ['investor', 'referral', 'pro', 'existing_asset_owner', 'submit_referral'];

/** True when `r` is a real wire role value (not just any string). */
export function isValidRole(r: unknown): r is Role {
  return typeof r === 'string' && (VALID_ROLES as readonly string[]).includes(r);
}

/** The step order for a given role. `null`/unknown roles use the generic order.
 *  Single definition site for the role → step-order mapping so ContactForm and any
 *  preselection logic stay in agreement. */
export function stepOrderForRole(role: Role | null): readonly Step[] {
  return role === 'investor' ? STEP_ORDER_INVESTOR
    : role === 'existing_asset_owner' ? STEP_ORDER_EAO
    : STEP_ORDER_OTHER;
}

/** The first step a role reaches AFTER the role-selection step. Used when a valid
 *  initial role is supplied so the form opens on the first relevant question. */
export function firstStepAfterRole(role: Role): Step {
  return stepOrderForRole(role)[1] ?? 'role';
}

export const STEP_LABELS_INVESTOR = ['Who you are', 'Background', 'Asset class', 'Your info', 'Book a call', 'Stay in the loop'];
export const STEP_LABELS_OTHER = ['Who you are', 'Background', 'Your info', 'Book a call', 'Stay in the loop'];
export const STEP_LABELS_EAO = ['Who you are', 'Your info', 'Property details', 'Current situation', 'Pressing issue', 'Schedule'];

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
/* Fixed intro-call slots (all Central Time). MUST stay in sync with BOOKING_SLOTS
   in scripts/gas/Code.gs — the availability endpoint keys its free/busy response by
   these exact labels. Real per-day availability is fetched from the backend at
   selection time (see ContactForm's availability effect); there is no static
   "taken" list anymore. */
export const SLOTS = ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM'];

export function buildCalendar(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

export function fmtDate(y: number, m: number, d: number) {
  return `${MONTHS[m]} ${d}, ${y}`;
}

export function parseReferralInput(input: string): { referralCode: string | null; referredByEmail: string | null; referredByName: string | null } {
  const t = input.trim();
  if (!t) return { referralCode: null, referredByEmail: null, referredByName: null };
  if (t.includes('@')) return { referralCode: null, referredByEmail: t, referredByName: null };
  if (/^AXP-[A-Z0-9]{6}$/i.test(t)) return { referralCode: t.toUpperCase(), referredByEmail: null, referredByName: null };
  return { referralCode: null, referredByEmail: null, referredByName: t };
}

/**
 * Snapshot of all answers needed to build the submission payload.
 */
export interface FormSnapshot {
  role: Role | null;
  expSel: Set<string>;
  aumSel: string | null;
  profSel: string | null;
  clientsSel: Set<string>;
  refIntentSel: string | null;
  proRoleSel: string | null;
  marketSel: Set<string>;
  proIntentSel: string | null;
  relSel: string | null;
  fitSel: Set<string>;
  assetSel: Set<string>;
  timelineSel: string | null;
  awareSel: string | null;
  sourceSel: string | null;
  contactFields: ContactFields;
  prefsSel: Set<string>;
  msgField: string;
  referredFields: ReferredFields;
  bookChoice: BookChoice;
  selDay: number | null;
  selSlot: string | null;
  calMonth: number;
  calYear: number;
  meetType: MeetType;
  bookingPhone: string;
  urlRef: string | null;
  isReferred: boolean;
  referralInput: string;
}

export interface BuildPayloadOptions {
  /** App-level source identifier (e.g. 'qr'). Overrides the payload `source`. */
  source?: string;
  /** Page identifier the backend uses to route the submission. */
  page?: string;
}

export function buildPayload(s: FormSnapshot, opts: BuildPayloadOptions = {}) {
  const booking = s.bookChoice === 'yes' && s.selDay !== null && s.selSlot ? {
    date: `${MONTHS[s.calMonth]} ${s.selDay}, ${s.calYear}`,
    slot: s.selSlot,
    meetType: s.meetType,
    phone: s.bookingPhone,
  } : null;

  /* Build referral fields for payload */
  let referralCode: string | null = null;
  let referredByEmail: string | null = null;
  let referredByName: string | null = null;

  if (s.urlRef) {
    referralCode = s.urlRef;
  } else if (s.role !== 'submit_referral' && s.isReferred && s.referralInput.trim()) {
    const parsed = parseReferralInput(s.referralInput);
    referralCode = parsed.referralCode;
    referredByEmail = parsed.referredByEmail;
    referredByName = parsed.referredByName;
  }

  return {
    role: s.role,
    qualData: {
      experience: [...s.expSel],
      aum: s.aumSel,
      profession: s.profSel,
      clients: [...s.clientsSel],
      referralIntent: s.refIntentSel,
      proRole: s.proRoleSel,
      markets: [...s.marketSel],
      proIntent: s.proIntentSel,
      relationship: s.relSel,
      fit: [...s.fitSel],
      assetClasses: [...s.assetSel],
      timeline: s.timelineSel,
      awareness: s.awareSel,
    },
    person: s.contactFields,
    preferences: [...s.prefsSel],
    booking,
    message: s.msgField,
    // `source` is the real origin/channel only (e.g. 'qr' from the QR app, or ''
    // for a direct site visit). The visitor's "How did you hear about us?"
    // answer is a SEPARATE datum sent as `heardAbout` — it must never be written
    // into `source`, or it corrupts the CRM's Source column (e.g. stamping
    // "LinkedIn" as the submission origin).
    source: opts.source ?? '',
    timestamp: new Date().toISOString(),
    page: opts.page ?? 'axispoint.llc',
    referralCode,
    referredByEmail,
    referredByName,
    heardAbout: s.sourceSel ?? '',
    ...(s.role === 'submit_referral' ? { referred: s.referredFields } : {}),
  };
}

/**
 * Builds the Existing Asset Owner submission payload. Shape is shared verbatim
 * with the backend rebuild — spreads the assembled property object (which already
 * carries portfolio_type / property_type / units|sqft / asset_breakdown)
 * at the top level, then adds situation, issue, contact, booking and schema_version.
 *
 * `booking` holds the same structured object the Investor / RE Professional
 * payload uses ({ date, slot, meetType, phone }) — see buildPayload. The real
 * Google Meet URL is NOT set here — the backend creates it when it actually
 * books the calendar event.
 *
 * NO `heardAbout` FIELD, DELIBERATELY. buildPayload sends `heardAbout: s.sourceSel`,
 * but `sourceSel` is only ever set by Step4Contact, and STEP_ORDER_EAO does not
 * include that step — the EAO flow never asks "How did you hear about us?". Adding
 * `heardAbout: ''` here would not fix anything: the backend's leadHeardAbout()
 * already yields '' for a missing field, so the Heard About cell is blank either
 * way. It would only make a hardcoded blank look like a captured answer.
 *
 * To actually populate Heard About for EAO, the fix is a PRODUCT one: add a
 * "how did you hear about us" question to the EAO step order, then thread its
 * answer through here. Do that, or leave the column blank on purpose — but do not
 * split the difference with a field that is always ''.
 */
export function buildEAOPayload(args: {
  property: PropertyDetails;
  situation: string | null;
  issue: string;
  contact: EAOContact;
  booking: Booking | null;
}) {
  const { property, situation, issue, contact, booking } = args;
  return {
    role: 'existing_asset_owner' as const,
    ...property,
    current_situation: situation,
    pressing_issue: issue,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    booking,
    schema_version: 1 as const,
  };
}
