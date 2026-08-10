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
/**
 * Audit-candidate locale catalogs are included ONLY when Vite is serving.
 *
 * WHY `command` AND NOT `mode`. The catalogs under `src/i18n/catalogs/audit/` are
 * model-generated text that no native reader has checked. Gating on `mode !== 'production'`
 * would fail open: any other build mode, now or invented later, would quietly ship them.
 * Gating on `command === 'build'` fails closed instead, because every artifact-producing run
 * is a build regardless of its mode, including `--mode e2e` and anything added in future.
 *
 * The consequence, accepted deliberately: there is no built preview of an unreviewed locale.
 * A built preview would be a deployable directory full of unreviewed translations, which is
 * the exact object this boundary exists to prevent from existing. Preview them with
 * `pnpm dev:web` and `?locale-preview=all`.
 *
 * HOW IT WORKS. `src/i18n/messages.ts` imports `./catalogs/audit/active`, and in a build that
 * specifier resolves to `./catalogs/none.ts` instead, which returns null and imports nothing.
 * The eight catalogs are then unreachable from every entry, so Rollup never puts them in the
 * graph and cannot emit them, in JavaScript or in a sourcemap. This is structural rather than
 * a dead-code-elimination optimization we hope holds.
 *
 * The stub is OUTSIDE `catalogs/audit/` on purpose. It legitimately stays in the graph, so
 * leaving it in that directory forced the bundle gate to carry an exception for it, and an
 * exception is where a real leak eventually hides. `catalogs/audit/` now holds unreviewed
 * content only.
 *
 * The regex is anchored to the exact specifier. `messages.ts` is its only importer, and a
 * second importer elsewhere would silently pick up the same substitution, so add one only
 * deliberately.
 *
 * PROVEN, NOT ASSERTED: `scripts/test/inspect-bundle.mjs` walks every emitted file, including
 * `.map` sourcemaps and their `sources` arrays, and fails on any audit-candidate trace.
 */
function auditCatalogAlias(command: 'build' | 'serve') {
  if (command === 'serve') return [];
  return [
    {
      find: /^\.\/catalogs\/audit\/active$/,
      replacement: path.resolve(__dirname, './src/i18n/catalogs/none.ts'),
    },
  ];
}

export default defineConfig(({ command, mode }) => {
  const { endpoint, e2e } = resolveEndpoint(mode);
  if (e2e) console.warn(E2E_WARNING);

  return {
    plugins: [react()],
    define: {
      __FORM_ENDPOINT__: JSON.stringify(endpoint),
      __E2E_MODE__: JSON.stringify(e2e),
    },
    resolve: {
      /*
       * Array form so the audit-catalog entry can use a regex. Order matters: the specific
       * entry is first, and the two prefix aliases follow unchanged. `@` still matches only
       * `@` and `@/...`, so scoped packages like `@axispoint/brand` are untouched.
       */
      alias: [
        ...auditCatalogAlias(command),
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: '@brand', replacement: path.resolve(__dirname, '../../packages/brand/src') },
      ],
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
