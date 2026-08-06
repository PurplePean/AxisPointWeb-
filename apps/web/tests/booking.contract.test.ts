import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGasV2Contract } from './helpers/gasV2';
import {
  BOOKING_MODES,
  BOOKING_RULES,
  BOOKING_TIME_ZONE,
  candidateDays,
  candidateSlots,
  toOffsetIso,
} from '../src/intake/booking/availability';

/*
 * Booking-rule drift detection.
 *
 * THE PROBLEM THIS SOLVES. The browser cannot ask the backend what its booking rules are:
 * V2 exposes no availability query. So `availability.ts` MIRRORS the backend's constants to
 * build its candidate grid. A mirror that drifts is worse than no mirror at all, because the
 * form quietly starts offering times the command refuses, and the visitor is the one who
 * finds out.
 *
 * Every constant below is therefore read out of the REAL backend source rather than
 * restated here, so moving either side fails this file loudly.
 */

const gas = loadGasV2Contract();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BOOKING_SRC = readFileSync(
  path.resolve(HERE, '../../../scripts/gas-v2/src/Booking.js'),
  'utf8',
);

/** Reads a `var NAME = <number>;` out of the backend source. */
function backendNumber(name: string): number {
  const match = BOOKING_SRC.match(new RegExp(`var\\s+${name}\\s*=\\s*(\\d+)\\s*;`));
  assert.notEqual(match, null, `${name} not found in Booking.js`);
  return Number((match as RegExpMatchArray)[1]);
}

/* ── The mirrored constants ───────────────────────────────────────────────── */

test('lead time matches the backend', () => {
  assert.equal(BOOKING_RULES.minLeadMinutes, backendNumber('BOOKING_MIN_LEAD_MINUTES'));
});

test('the booking horizon matches the backend', () => {
  assert.equal(BOOKING_RULES.maxAheadDays, backendNumber('BOOKING_MAX_AHEAD_DAYS'));
});

test('business hours match the backend', () => {
  assert.equal(BOOKING_RULES.businessStartHour, gas.BUSINESS_START_HOUR);
  assert.equal(BOOKING_RULES.businessEndHour, gas.BUSINESS_END_HOUR);
});

test('business days match the backend', () => {
  // The backend decides this through isBusinessDay rather than a list, so the mirror is
  // checked against the real predicate for all seven weekdays.
  const isBusinessDay = gas.isBusinessDay as (weekday: number) => boolean;
  for (let weekday = 0; weekday < 7; weekday += 1) {
    assert.equal(
      BOOKING_RULES.businessDays.includes(weekday as 1 | 2 | 3 | 4 | 5),
      isBusinessDay(weekday),
      `weekday ${weekday} disagrees with the backend`,
    );
  }
});

test('the booking modes are exactly the backend tokens', () => {
  // Array.from crosses the VM realm boundary; deepStrictEqual would otherwise fail on the
  // prototype while showing two identical-looking lists.
  const backend = Array.from(gas.BOOKING_MODES as unknown as string[]);
  assert.deepEqual(BOOKING_MODES.map((m) => m.value), backend);
});

test('the duration is inside the contract limit and matches the slot cadence', () => {
  // validateBookingRequest caps durationMinutes at 480 and requires it above zero.
  assert.equal(BOOKING_RULES.durationMinutes > 0, true);
  assert.equal(BOOKING_RULES.durationMinutes <= 480, true);
  assert.equal(BOOKING_RULES.slotMinutes, BOOKING_RULES.durationMinutes);
});

/* ── Every candidate is one the backend would accept ──────────────────────── */

test('every generated slotStart passes the backend timestamp format', () => {
  const isoOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  const now = new Date();

  for (const day of candidateDays(now).slice(0, 10)) {
    for (const slot of candidateSlots(day, now)) {
      assert.match(slot.slotStart, isoOffset, `bad slotStart: ${slot.slotStart}`);
    }
  }
});

test('the booking time zone is the backend business time zone', () => {
  // If the firm's zone ever moves, the candidate grid must move with it. This is the one
  // constant that would otherwise drift silently and produce bookings an hour out.
  assert.equal(BOOKING_TIME_ZONE, gas.BUSINESS_TIMEZONE);
});

/**
 * An offset resolver equivalent to the backend's.
 *
 * The real `makeOffsetResolver` calls `Utilities.formatDate`, an Apps Script global that
 * does not exist in the VM. This computes the same thing with `Intl`, so the backend's
 * OWN `isWithinBusinessHours` can be run against real generated slots.
 */
function offsetResolverFor(timeZone: string) {
  return (date: Date): number => {
    const parts: Record<string, string> = {};
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour === '24' ? '0' : parts.hour), Number(parts.minute), Number(parts.second),
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  };
}

test('every generated slot falls inside the backend business-hours window', () => {
  const now = new Date();
  const isWithin = gas.isWithinBusinessHours as (
    start: Date,
    durationMinutes: number,
    offsetResolver: (d: Date) => number,
  ) => boolean;

  const offsetResolver = offsetResolverFor(gas.BUSINESS_TIMEZONE as unknown as string);

  let checked = 0;
  for (const day of candidateDays(now).slice(0, 5)) {
    for (const slot of candidateSlots(day, now)) {
      assert.equal(
        isWithin(new Date(slot.slotStart), BOOKING_RULES.durationMinutes, offsetResolver),
        true,
        `backend would refuse ${slot.slotStart}`,
      );
      checked += 1;
    }
  }
  assert.equal(checked > 0, true, 'no slots were generated to check');
});

test('no candidate is inside the lead time or beyond the horizon', () => {
  const now = new Date();
  const earliest = now.getTime() + BOOKING_RULES.minLeadMinutes * 60000;
  const latest = now.getTime() + BOOKING_RULES.maxAheadDays * 24 * 60 * 60000;

  for (const day of candidateDays(now)) {
    for (const slot of candidateSlots(day, now)) {
      const at = new Date(slot.slotStart).getTime();
      assert.equal(at >= earliest, true, `${slot.slotStart} is inside the lead time`);
      assert.equal(at <= latest, true, `${slot.slotStart} is beyond the horizon`);
    }
  }
});

test('no weekend day is ever offered', () => {
  for (const day of candidateDays(new Date())) {
    assert.notEqual(day.weekday, 0, 'Sunday was offered');
    assert.notEqual(day.weekday, 6, 'Saturday was offered');
  }
});

/* ── Time-zone correctness ────────────────────────────────────────────────── */

test('the offset follows daylight saving rather than being hard-coded', () => {
  // Houston is UTC-5 in summer and UTC-6 in winter. A fixed offset would put half the
  // year's bookings an hour out, and the backend would accept them as valid timestamps.
  const summer = toOffsetIso(2026, 7, 15, 10, 30);
  const winter = toOffsetIso(2026, 1, 15, 10, 30);

  assert.match(summer, /-05:00$/, `summer offset wrong: ${summer}`);
  assert.match(winter, /-06:00$/, `winter offset wrong: ${winter}`);
});

test('a generated timestamp resolves to the intended wall-clock time', () => {
  const iso = toOffsetIso(2026, 7, 15, 10, 30);
  const readBack = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

  assert.equal(readBack, '10:30');
});

/* ── The frontend states no availability it cannot know ───────────────────── */

test('candidate slots carry no availability claim', () => {
  const now = new Date();
  const day = candidateDays(now)[0];
  assert.notEqual(day, undefined, 'expected at least one candidate day');

  for (const slot of candidateSlots(day, now)) {
    // No `taken`, `busy`, `available`, or `unavailable` field exists to be believed.
    assert.deepEqual(Object.keys(slot).sort(), ['hour', 'label', 'minute', 'slotStart']);
  }
});
