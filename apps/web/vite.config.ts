import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { E2E_WARNING, resolveEndpoint } from './vite.endpoint';

/**
 * Endpoint resolution lives in `./vite.endpoint`, which documents the full mode matrix and
 * the reason the variable is V2-specific. It is a separate module so it can be unit-tested
 * against fixture env directories rather than by running e2e mode against the real
 * machine-local secret.
 *
 * The app consumes the injected `__FORM_ENDPOINT__` define rather than reading
 * `import.meta.env` directly, so a stray endpoint sitting in the shell or a generic .env
 * file can never leak into a dev build.
 */
export default defineConfig(({ mode }) => {
  const { endpoint, e2e } = resolveEndpoint(mode);
  if (e2e) console.warn(E2E_WARNING);

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
