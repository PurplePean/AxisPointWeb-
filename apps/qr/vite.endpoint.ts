import { loadEnv } from 'vite';

/**
 * Submission endpoint resolution for `apps/qr`, mode-driven and deliberately fail-safe.
 *
 *   dev   (`vite`, mode=development)  -> endpoint is FORCED empty. Any value from .env.local,
 *                                        the shell, or any other generic env source is
 *                                        IGNORED, so the Contact Exchange runs the shared
 *                                        submission client's simulator and no request ever
 *                                        reaches a real backend.
 *   e2e   (`vite --mode e2e`)         -> endpoint is loaded ONLY from .env.e2e.local. A
 *                                        missing value is a HARD failure, never a silent
 *                                        fall back to simulated success.
 *   build (`vite build`, production)  -> endpoint passes through from the build environment.
 *
 * THE VARIABLE IS V2-SPECIFIC, AND THIS APP CHANGED IN CODE PASS 10B. It previously read
 * `VITE_FORM_ENDPOINT`, which names the **V1** deployment. The Contact Exchange submits a
 * `contact_exchange` envelope to the unified **V2** endpoint, so it now reads
 * `VITE_V2_SUBMISSION_ENDPOINT`, exactly like `apps/web`. Pointing a V2 envelope at the V1
 * deployment would fail in a way that reads as a backend bug rather than a configuration
 * mistake, so a lone V1 value is a hard error in e2e mode rather than a silent default.
 *
 * This lives in its own module so it can be unit-tested against fixture env directories
 * instead of by running e2e mode against the real machine-local secret.
 */

export const V2_ENDPOINT_VAR = 'VITE_V2_SUBMISSION_ENDPOINT';
export const V1_ENDPOINT_VAR = 'VITE_FORM_ENDPOINT';

export interface ResolvedEndpoint {
  endpoint: string;
  e2e: boolean;
}

export function resolveEndpoint(mode: string, cwd: string = process.cwd()): ResolvedEndpoint {
  if (mode === 'development') {
    return { endpoint: '', e2e: false };
  }

  const env = loadEnv(mode, cwd, '');
  const endpoint = env[V2_ENDPOINT_VAR] ?? '';

  if (mode === 'e2e') {
    if (!endpoint) {
      const v1Only = env[V1_ENDPOINT_VAR]
        ? `\nFound ${V1_ENDPOINT_VAR} instead. That is the V1 endpoint and it is NOT used by the\n` +
          'QR Contact Exchange, which submits a V2 contact_exchange envelope. Add the V2 value\n' +
          `under its own name (${V2_ENDPOINT_VAR}); leave the V1 entry alone if anything still\n` +
          'needs it.\n'
        : '';
      throw new Error(
        `\n[e2e] ${V2_ENDPOINT_VAR} is missing.\n` +
          'e2e mode talks to a REAL backend and must never silently fall back to simulated\n' +
          'success. Create apps/qr/.env.e2e.local from apps/qr/.env.e2e.example and set the\n' +
          'real V2 endpoint value.\n' +
          v1Only,
      );
    }
    return { endpoint, e2e: true };
  }

  return { endpoint, e2e: false };
}

/** The e2e terminal warning. Separate so a test can assert what it does and does not claim. */
export const E2E_WARNING =
  '\n\x1b[41m\x1b[97m  E2E MODE: a REAL backend is ENABLED. A submission may create live records and ' +
  'send real email. It does NOT create a Calendar event: booking is a separate command.  \x1b[0m\n';
