import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Form endpoint resolution is mode-driven and deliberately fail-safe.
 *
 *   dev   (`vite`, mode=development)  -> endpoint is FORCED empty. Any VITE_FORM_ENDPOINT
 *                                        coming from .env.local, the shell, or any other
 *                                        generic env source is IGNORED. The shared
 *                                        <ContactForm> runs its simulated-success fallback,
 *                                        so no request ever reaches the real backend.
 *   e2e   (`vite --mode e2e`)         -> endpoint is loaded ONLY from .env.e2e.local
 *                                        (gitignored, machine-local). A missing value is a
 *                                        HARD failure — never a silent fall back to
 *                                        simulated success. The real GAS backend is live,
 *                                        so a loud terminal warning is printed.
 *   build (`vite build`, production)  -> endpoint passes through from the build environment
 *                                        (CI `VITE_FORM_ENDPOINT` secret, or an explicit
 *                                        sentinel supplied on the command line).
 *
 * The app consumes the injected `__FORM_ENDPOINT__` define instead of reading
 * import.meta.env.VITE_FORM_ENDPOINT directly, so a stray endpoint sitting in the shell or
 * a generic .env file can never leak into a dev build. This file is the single place that
 * decides which endpoint (if any) is compiled in.
 */
function resolveEndpoint(mode: string): { endpoint: string; e2e: boolean } {
  if (mode === 'development') {
    // Ignore every source. Always simulated success in plain `pnpm dev`.
    return { endpoint: '', e2e: false };
  }

  if (mode === 'e2e') {
    // '' prefix => read the raw file values (.env.e2e.local / .env.e2e) regardless of the
    // VITE_ prefix filter, so we can validate presence ourselves.
    const env = loadEnv(mode, process.cwd(), '');
    const endpoint = env.VITE_FORM_ENDPOINT ?? '';
    if (!endpoint) {
      throw new Error(
        '\n[e2e] VITE_FORM_ENDPOINT is missing.\n' +
          'e2e mode talks to the REAL production backend and must never silently fall back to\n' +
          'simulated success. Create apps/web/.env.e2e.local from apps/web/.env.e2e.example and\n' +
          'set the real endpoint value.\n',
      );
    }
    console.warn(
      '\n\x1b[41m\x1b[97m  E2E MODE: the REAL production backend is ENABLED. Form submissions hit live GAS (Sheet + email + Calendar).  \x1b[0m\n',
    );
    return { endpoint, e2e: true };
  }

  // build / production / preview: pass the endpoint through from the environment.
  const env = loadEnv(mode, process.cwd(), '');
  return { endpoint: env.VITE_FORM_ENDPOINT ?? '', e2e: false };
}

export default defineConfig(({ mode }) => {
  const { endpoint, e2e } = resolveEndpoint(mode);

  return {
    plugins: [react()],
    define: {
      __FORM_ENDPOINT__: JSON.stringify(endpoint),
      __E2E_MODE__: JSON.stringify(e2e),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@brand': path.resolve(__dirname, '../../packages/brand/src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
    server: {
      port: 3000,
    },
  };
});
