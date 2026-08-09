/**
 * Candidate booking times, derived from the backend's booking rules.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. These are CANDIDATES, not availability. The V2 backend
 * exposes no availability query: `listBusy` is internal to the booking command and `doGet`
 * is a health check. So the browser cannot know which times are genuinely free, and this
 * module does not pretend otherwise. It never marks a slot taken, never greys a date out
 * for an invented reason, and the UI copy must not claim these times are live availability.
 *
 * What it does guarantee is that every offered candidate is one the backend's own window
 * validation would accept, by mirroring the constants in `scripts/gas-v2`:
 *
 *   BOOKING_MIN_LEAD_MINUTES  60      a slot must start at least an hour out
 *   BOOKING_MAX_AHEAD_DAYS    60      and no further ahead than two months
 *   BUSINESS_START_HOUR       9       both ends of the meeting inside one business day
 *   BUSINESS_END_HOUR         17
 *   business days             Mon-Fri
 *
 * These are mirrored, not owned. `apps/web/tests/booking.contract.test.ts` reads the real
 * values out of the backend source and fails loudly if either side moves, because a silent
 * drift here shows up as a form offering times the command then refuses.
 *
 * This replaced a hard-coded fixture with a fixed "August 2026" month, invented taken-slots,
 * and a rule that greyed out every date before the 10th. Against a real backend those were
 * fabrications, and the fixed month would eventually fall outside the 60-day horizon and be
 * refused outright with SLOT_TOO_FAR_AHEAD.
 */

export const BOOKING_RULES = {
  minLeadMinutes: 60,
  maxAheadDays: 60,
  businessStartHour: 9,
  businessEndHour: 17,
  slotMinutes: 30,
  durationMinutes: 30,
  /** 0 = Sunday. Monday to Friday. */
  businessDays: [1, 2, 3, 4, 5],
} as const;

/**
 * The firm's operating zone.
 *
 * Fixed rather than read from the browser: the meeting happens in Houston whatever the
 * visitor's device thinks the time is, and the backend validates business hours in the
 * firm's zone. Someone booking from London must see the same slots a local would.
 */
export const BOOKING_TIME_ZONE = 'America/Chicago';
export const BOOKING_TIME_ZONE_LABEL = 'Central Time, Houston';

/** The approved modes, matching the backend's `BOOKING_MODES` tokens. */
export const BOOKING_MODES = [
  { value: 'phone_call', label: 'Phone call' },
  { value: 'video_meeting', label: 'Video meeting' },
] as const;

export type BookingModeValue = (typeof BOOKING_MODES)[number]['value'];

/* ── Time zone arithmetic ─────────────────────────────────────────────────── */

/**
 * The UTC offset of a zone at a given instant, in minutes.
 *
 * Computed rather than hard-coded because Houston is UTC-6 in winter and UTC-5 in summer.
 * A hard-coded offset produces bookings an hour off for half the year, which the backend
 * would accept as a valid timestamp and a partner would discover by missing a call.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  // 'en-US' here is NOT a display choice and must not be localized. This call reads numeric
  // date parts back out in a known, stable shape to compute an offset; a locale with
  // different numerals or ordering would break the arithmetic, not translate it.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  // What the wall clock in that zone reads, expressed as a UTC instant.
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return Math.round((asUtc - instant.getTime()) / 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Converts a wall-clock time in the booking zone into an ISO timestamp with a real offset.
 *
 * The backend requires an offset or `Z` (`ISO_OFFSET_RE`); a bare local timestamp is
 * rejected as `INVALID_TIMESTAMP`. Two passes are needed because the offset depends on the
 * instant, and the instant depends on the offset: the first guess picks a candidate, the
 * second confirms it against the offset actually in force then. This is what makes the hour
 * on either side of a DST transition come out right.
 */
export function toOffsetIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = BOOKING_TIME_ZONE,
): string {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);

  let offset = zoneOffsetMinutes(new Date(naive), timeZone);
  const settled = zoneOffsetMinutes(new Date(naive - offset * 60000), timeZone);
  if (settled !== offset) offset = settled;

  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return (
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Today's date as it reads in the booking zone, not on the visitor's device. */
export function todayInZone(now: Date, timeZone: string = BOOKING_TIME_ZONE): {
  year: number;
  month: number;
  day: number;
} {
  const parts: Record<string, string> = {};
  // Same as above: stable numeric parts for arithmetic, never shown to anybody.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/* ── The candidate grid ───────────────────────────────────────────────────── */

export interface CandidateDay {
  year: number;
  month: number;
  day: number;
  /** 0 = Sunday. */
  weekday: number;
  /** ISO date, used as a stable key. */
  key: string;
  label: string;
}

export interface CandidateSlot {
  hour: number;
  minute: number;
  label: string;
  /** ISO 8601 with a real offset, ready for the wire. */
  slotStart: string;
}

/**
 * Day and time DISPLAY formatting, which is the only part of booking that is language
 * dependent.
 *
 * THE INSTANT IS NOT LOCALIZED, and that separation is the whole point. `slotStart` is
 * still computed from the firm's own zone with a real offset, so changing the display
 * language cannot move the meeting. What changes is the words around it: a Spanish reader
 * sees "lunes" where an English reader sees "Monday", and both are the same moment in
 * Central Time.
 *
 * Formatters are cached per locale because constructing `Intl.DateTimeFormat` is expensive
 * and the day list builds dozens of labels per render.
 */
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatterFor(displayLocale: string): Intl.DateTimeFormat {
  const cached = dayFormatters.get(displayLocale);
  if (cached) return cached;
  const made = new Intl.DateTimeFormat(displayLocale, {
    // UTC here is deliberate: the date parts were already resolved in the firm's zone, so
    // this call only turns known parts into words and must not shift them again.
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  dayFormatters.set(displayLocale, made);
  return made;
}

/**
 * Every bookable day inside the backend's horizon.
 *
 * Business days only, starting from today in the firm's zone and running to the
 * `maxAheadDays` limit. A day is included only if it still has at least one slot that
 * clears the minimum lead time, so today drops off the list late in the afternoon rather
 * than sitting there offering nothing.
 */
export function candidateDays(
  now: Date = new Date(),
  displayLocale: string = 'en-US',
): CandidateDay[] {
  const today = todayInZone(now);
  const days: CandidateDay[] = [];

  for (let i = 0; i <= BOOKING_RULES.maxAheadDays; i += 1) {
    const cursor = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const weekday = cursor.getUTCDay();
    if (!BOOKING_RULES.businessDays.includes(weekday as 1 | 2 | 3 | 4 | 5)) continue;

    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();

    if (candidateSlots({ year, month, day }, now).length === 0) continue;

    days.push({
      year,
      month,
      day,
      weekday,
      key: `${year}-${pad(month)}-${pad(day)}`,
      label: dayFormatterFor(displayLocale).format(cursor),
    });
  }

  return days;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * A slot's visible time.
 *
 * Rendered from the wall-clock hour and minute already resolved in the firm's zone, so the
 * label follows the reader's language while naming the same Central Time slot.
 */
function timeLabel(hour: number, minute: number, displayLocale: string): string {
  let formatter = timeFormatters.get(displayLocale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(displayLocale, {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: '2-digit',
    });
    timeFormatters.set(displayLocale, formatter);
  }
  return formatter.format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

/**
 * Every candidate slot on a given day.
 *
 * A slot is offered only when the whole meeting fits inside business hours, matching the
 * backend's rule that both ends fall in one business day, and only when it starts at least
 * `minLeadMinutes` from now.
 */
export function candidateSlots(
  date: { year: number; month: number; day: number },
  now: Date = new Date(),
  displayLocale: string = 'en-US',
): CandidateSlot[] {
  const earliest = now.getTime() + BOOKING_RULES.minLeadMinutes * 60000;
  const latest = now.getTime() + BOOKING_RULES.maxAheadDays * 24 * 60 * 60000;
  const slots: CandidateSlot[] = [];

  const lastStartMinutes = BOOKING_RULES.businessEndHour * 60 - BOOKING_RULES.durationMinutes;

  for (
    let minutes = BOOKING_RULES.businessStartHour * 60;
    minutes <= lastStartMinutes;
    minutes += BOOKING_RULES.slotMinutes
  ) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const slotStart = toOffsetIso(date.year, date.month, date.day, hour, minute);
    const startsAt = new Date(slotStart).getTime();

    if (startsAt < earliest || startsAt > latest) continue;

    slots.push({ hour, minute, label: timeLabel(hour, minute, displayLocale), slotStart });
  }

  return slots;
}
