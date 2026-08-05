import { loadEnv } from 'vite';

/**
 * Submission endpoint resolution for `apps/web`, mode-driven and deliberately fail-safe.
 *
 *   dev   (`vite`, mode=development)  -> endpoint is FORCED empty. Any value coming from
 *                                        .env.local, the shell, or any other generic env
 *                                        source is IGNORED, so the intake runs the shared
 *                                        submission client's simulator and no request ever
 *                                        reaches a real backend.
 *   e2e   (`vite --mode e2e`)         -> endpoint is loaded ONLY from .env.e2e.local
 *                                        (gitignored, machine-local). A missing value is a
 *                                        HARD failure, never a silent fall back to
 *                                        simulated success.
 *   build (`vite build`, production)  -> endpoint passes through from the build environment
 *                                        (a CI secret, or an explicit value supplied on the
 *                                        command line).
 *
 * THE VARIABLE IS V2-SPECIFIC ON PURPOSE. This app reads `VITE_V2_SUBMISSION_ENDPOINT` and
 * never `VITE_FORM_ENDPOINT`. The historical name still refers to the **V1** Apps Script
 * deployment, which speaks an entirely different payload shape; inheriting it would point
 * the V2 intake at the V1 backend, and the failure would look like a backend bug rather
 * than a configuration mistake. A V1 value present on its own is an error, not a default.
 *
 * This lives in its own module, separate from `vite.config.ts`, so it can be unit-tested
 * against fixture env directories. The alternative was verifying it by running e2e mode
 * against the real machine-local secret, which is exactly what should not happen.
 */

export const V2_ENDPOINT_VAR = 'VITE_V2_SUBMISSION_ENDPOINT';
export const V1_ENDPOINT_VAR = 'VITE_FORM_ENDPOINT';

export interface ResolvedEndpoint {
  endpoint: string;
  e2e: boolean;
}

export function resolveEndpoint(mode: string, cwd: string = process.cwd()): ResolvedEndpoint {
  if (mode === 'development') {
    // Ignore every source. Always the simulator in plain `pnpm dev`.
    return { endpoint: '', e2e: false };
  }

  // '' prefix => read the raw values regardless of the VITE_ prefix filter, so this module
  // validates presence itself rather than trusting Vite's filtering.
  const env = loadEnv(mode, cwd, '');
  const endpoint = env[V2_ENDPOINT_VAR] ?? '';

  if (mode === 'e2e') {
    if (!endpoint) {
      // Naming the V1 variable when it is the only one present turns a confusing
      // "it worked yesterday" into an obvious one-line fix.
      const v1Only = env[V1_ENDPOINT_VAR]
        ? `\nFound ${V1_ENDPOINT_VAR} instead. That is the V1 endpoint and it is NOT used by the\n` +
          'V2 intake: the two speak different payload shapes. Add the V2 value under its own\n' +
          `name (${V2_ENDPOINT_VAR}); leave the V1 entry alone if anything still needs it.\n`
        : '';
      throw new Error(
        `\n[e2e] ${V2_ENDPOINT_VAR} is missing.\n` +
          'e2e mode talks to a REAL backend and must never silently fall back to simulated\n' +
          'success. Create apps/web/.env.e2e.local from apps/web/.env.e2e.example and set the\n' +
          'real V2 endpoint value.\n' +
          v1Only,
      );
    }
    return { endpoint, e2e: true };
  }

  // build / production / preview.
  return { endpoint, e2e: false };
}

/** The e2e terminal warning. Separate so a test can assert what it does and does not claim. */
export const E2E_WARNING =
  '\n\x1b[41m\x1b[97m  E2E MODE: a REAL backend is ENABLED. A submission may create live records and ' +
  'send real email. It does NOT create a Calendar event: booking is a separate command.  \x1b[0m\n';
