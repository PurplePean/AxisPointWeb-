/**
 * Shared contact form constants, helpers and payload builder.
 * Extracted verbatim from apps/web/src/pages/ContactPage.tsx.
 */
import type { Role, MeetType, BookChoice, ContactFields, ReferredFields } from './types';

export const STEP_ORDER_INVESTOR = ['role', 'context', 'prefs', 'contact', 'booking', 'comms'] as const;
export const STEP_ORDER_OTHER = ['role', 'context', 'contact', 'booking', 'comms'] as const;

export const STEP_LABELS_INVESTOR = ['Who you are', 'Background', 'Asset class', 'Your info', 'Book a call', 'Stay in the loop'];
export const STEP_LABELS_OTHER = ['Who you are', 'Background', 'Your info', 'Book a call', 'Stay in the loop'];

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const SLOTS = ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM'];
export const TAKEN = new Set(['9:00 AM', '11:00 AM', '2:00 PM', '3:30 PM']);

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
  curiousSel: Set<string>;
  journeySel: string | null;
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
  } else if (s.role !== 'refer' && s.isReferred && s.referralInput.trim()) {
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
      curious: [...s.curiousSel],
      journey: s.journeySel,
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
    source: opts.source ?? (s.sourceSel ?? ''),
    timestamp: new Date().toISOString(),
    page: opts.page ?? 'axispoint.llc',
    referralCode,
    referredByEmail,
    referredByName,
    ...(opts.source ? { heardAbout: s.sourceSel ?? '' } : {}),
    ...(s.role === 'refer' ? { referred: s.referredFields } : {}),
  };
}
