/**
 * The website's one submission client.
 *
 * This is where the shared package meets this app's build configuration. It is the only
 * file in `apps/web` that decides which transport is in use, and no component chooses for
 * itself.
 *
 * MODE SELECTION REUSES THE ESTABLISHED CONVENTION. `vite.config.ts` already resolves the
 * endpoint by mode and injects two defines, and this pass adds no second mechanism:
 *
 *   pnpm dev              mode=development. `__FORM_ENDPOINT__` is FORCED empty by the
 *                         config, whatever sits in the shell or a generic .env file.
 *                         `__E2E_MODE__` is false. Result: the simulator.
 *   pnpm dev:e2e          mode=e2e. The config loads `VITE_V2_SUBMISSION_ENDPOINT` from
 *                         `.env.e2e.local` and fails loudly if it is missing, including
 *                         when only the historical V1 `VITE_FORM_ENDPOINT` is present.
 *                         `__E2E_MODE__` is true. Result: the real network transport.
 *   pnpm build            production. The endpoint comes from the build environment. With an
 *                         endpoint supplied the real network transport is used; with none
 *                         supplied the transport is `not_configured` and every submission
 *                         returns a truthful failure rather than a simulated success.
 *
 * A production build can therefore never simulate success: `createTransport` only reaches
 * the simulator when `isDevelopment` is true, and `import.meta.env.DEV` is false in a
 * production bundle.
 */

import {
  createSubmissionClient,
  createTransport,
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
 * NOT the same thing as `__E2E_MODE__`. E2E is one way to reach the network, but a normal
 * production build is the other, and binding this to the e2e flag alone was a real defect:
 * `__E2E_MODE__` is false for every `vite build`, so a production bundle with a real
 * endpoint compiled in would still have fallen through to `not_configured` and refused every
 * submission on the live site.
 *
 * The rule is "anything except a plain dev build". Combined with `createTransport` requiring
 * a non-empty endpoint, the four cases resolve as intended: dev simulates, e2e talks to the
 * configured endpoint, a production build with an endpoint sends, and a production build
 * without one fails closed.
 */
const NETWORK_ENABLED = E2E || !import.meta.env.DEV;

/**
 * Development-only fixture selection.
 *
 * `?submit=recoverable_failure` and friends let a reviewer inspect every submission state
 * without a backend and without a magic email address. The whole function is behind
 * `import.meta.env.DEV`, so the query parameter does nothing in a production build and the
 * fixture names are dead code the bundler drops.
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
export function getSubmissionClient(): SubmissionClient {
  if (!client) {
    client = createSubmissionClient({
      transport: createTransport({
        networkEnabled: NETWORK_ENABLED,
        endpoint: ENDPOINT,
        isDevelopment: import.meta.env.DEV,
        simulator: { fixture: devFixture() },
      }),
    });
  }
  return client;
}

/** Which transport is live. Used by the dev banner and by tests, never by product logic. */
export function transportKind(): string {
  return getSubmissionClient().transportKind;
}

/** Test seam. Drops the memoized client so a test can rebuild it under new conditions. */
export function resetSubmissionClientForTests(): void {
  client = null;
}
