/**
 * The website's booking client.
 *
 * Shares the ONE transport with the submission client: same endpoint, same mode rules, same
 * fail-closed guarantee. There is no second transport and no second endpoint anywhere in
 * this app, which is why this module builds its client from `createTransport` rather than
 * carrying any endpoint knowledge of its own.
 *
 * In a plain `pnpm dev` build the transport is the simulator, so booking makes no network
 * request at all. In a production build with no endpoint it is `not_configured`, and a
 * booking attempt returns a truthful refusal rather than a confirmation nobody honoured.
 */

import {
  createBookingClient,
  createTransport,
  simulatorTransport,
  type BookingClient,
  type SimulatorFixture,
} from '@axispoint/submission-client';

declare const __FORM_ENDPOINT__: string;
declare const __E2E_MODE__: boolean;

const ENDPOINT = typeof __FORM_ENDPOINT__ !== 'undefined' ? __FORM_ENDPOINT__ : '';
const E2E = typeof __E2E_MODE__ !== 'undefined' ? __E2E_MODE__ : false;

/** Anything except a plain dev build. See `submissionClient.ts` for why this is not E2E. */
const NETWORK_ENABLED = E2E || !import.meta.env.DEV;

const DEV_BOOKING_FIXTURES: readonly SimulatorFixture[] = [
  'booking_confirmed',
  'booking_slot_unavailable',
  'booking_rejected',
  'booking_failed',
  'recoverable_failure',
  'not_configured',
];

/**
 * Development-only fixture selection for the booking outcome.
 *
 * Separate from `?submit=` so a reviewer can drive a successful submission into a failed
 * booking, which is the interesting combination and the one that used to be unreachable.
 */
function devFixture(): SimulatorFixture | undefined {
  if (!import.meta.env.DEV) return undefined;
  if (typeof window === 'undefined') return undefined;

  const requested = new URLSearchParams(window.location.search).get('book');
  if (!requested) return undefined;

  return DEV_BOOKING_FIXTURES.includes(requested as SimulatorFixture)
    ? (requested as SimulatorFixture)
    : undefined;
}

let client: BookingClient | null = null;

/**
 * Builds the transport with the simulator branch STATICALLY removed from a production
 * bundle.
 *
 * The obvious version passes `isDevelopment: import.meta.env.DEV` into `createTransport`
 * and lets it decide. That relied on the bundler inlining `createTransport` to prove the
 * simulator branch dead, which stopped happening the moment a second call site existed:
 * the fixture names and the simulator's fake ids reappeared in the production bundle, and
 * `verify:bundle` caught it. Branching on the literal here means the simulator is
 * unreferenced in production and is dropped outright, rather than dropped by luck.
 */
function buildTransport() {
  if (import.meta.env.DEV && !NETWORK_ENABLED) {
    return simulatorTransport({ fixture: devFixture() });
  }
  return createTransport({
    networkEnabled: NETWORK_ENABLED,
    endpoint: ENDPOINT,
    // Never the simulator from here. A production build with no endpoint must fail closed.
    isDevelopment: false,
  });
}

export function getBookingClient(): BookingClient {
  if (!client) client = createBookingClient({ transport: buildTransport() });
  return client;
}

/** Test seam. Drops the memoized client so a test can rebuild it under new conditions. */
export function resetBookingClientForTests(): void {
  client = null;
}
