/**
 * The QR app's one submission client.
 *
 * Mirrors `apps/web/src/intake/submissionClient.ts` deliberately: same shared package, same
 * mode rules, same fail-closed guarantee. There is no second transport and no second
 * wire-token list anywhere in this app.
 *
 *   pnpm dev              mode=development. `__FORM_ENDPOINT__` is FORCED empty by the
 *                         config. Result: the simulator. Zero network.
 *   pnpm dev:e2e:qr       mode=e2e. The config loads `VITE_V2_SUBMISSION_ENDPOINT` from
 *                         `.env.e2e.local` and fails loudly if it is missing, including
 *                         when only the historical V1 name is present.
 *   pnpm build            production. With an endpoint the real network transport is used;
 *                         with none the transport is `not_configured` and every submission
 *                         returns a truthful failure rather than a simulated success.
 *
 * A production build can never simulate success: the simulator requires
 * `import.meta.env.DEV`, and the fixture names are dead code the bundler drops.
 */

import {
  createSubmissionClient,
  createTransport,
  simulatorTransport,
  type SimulatorFixture,
  type SubmissionClient,
} from '@axispoint/submission-client';

/** Injected by vite.config.ts. See the block comment above. */
declare const __FORM_ENDPOINT__: string;
declare const __E2E_MODE__: boolean;

const ENDPOINT = typeof __FORM_ENDPOINT__ !== 'undefined' ? __FORM_ENDPOINT__ : '';
const E2E = typeof __E2E_MODE__ !== 'undefined' ? __E2E_MODE__ : false;

/**
 * Whether the network transport may be selected at all.
 *
 * NOT the same thing as `__E2E_MODE__`, which is false for every `vite build`. Binding it to
 * the e2e flag alone was a real defect in `apps/web` (Pass 10A): a production bundle with a
 * real endpoint compiled in still fell through to `not_configured` and refused every
 * submission. The rule is "anything except a plain dev build".
 */
const NETWORK_ENABLED = E2E || !import.meta.env.DEV;

/**
 * Development-only fixture selection.
 *
 * `?submit=recoverable_failure` and friends let a reviewer inspect every submission state
 * without a backend. The whole function is behind `import.meta.env.DEV`, so the query
 * parameter does nothing in a production build and the fixture names are dropped.
 */
const DEV_FIXTURES: readonly SimulatorFixture[] = [
  'success',
  'success_bookable',
  'success_not_bookable',
  'recoverable_failure',
  'permanent_failure',
  'submission_id_conflict',
  'not_configured',
];

function devFixture(): SimulatorFixture | undefined {
  if (!import.meta.env.DEV) return undefined;
  if (typeof window === 'undefined') return undefined;

  const requested = new URLSearchParams(window.location.search).get('submit');
  if (!requested) return undefined;

  return DEV_FIXTURES.includes(requested as SimulatorFixture)
    ? (requested as SimulatorFixture)
    : undefined;
}

let client: SubmissionClient | null = null;

/**
 * One client per page load, created lazily.
 *
 * Shared rather than per-component so a retry reaches the same live attempt, which is the
 * whole point of the same-id contract.
 */
/**
 * Builds the transport with the simulator branch STATICALLY removed from production.
 *
 * Branching on the `import.meta.env.DEV` literal here, rather than passing it into
 * `createTransport` and trusting the bundler to inline and fold, is what makes the removal
 * reliable instead of incidental. See `apps/web/src/intake/booking/bookingClient.ts`.
 */
function buildTransport() {
  if (import.meta.env.DEV && !NETWORK_ENABLED) {
    return simulatorTransport({ fixture: devFixture() });
  }
  return createTransport({
    networkEnabled: NETWORK_ENABLED,
    endpoint: ENDPOINT,
    isDevelopment: false,
  });
}

export function getSubmissionClient(): SubmissionClient {
  if (!client) client = createSubmissionClient({ transport: buildTransport() });
  return client;
}

/** Which transport is live. Used by dev tooling and tests, never by product logic. */
export function transportKind(): string {
  return getSubmissionClient().transportKind;
}

/** Test seam. Drops the memoized client so a test can rebuild it under new conditions. */
export function resetSubmissionClientForTests(): void {
  client = null;
}
