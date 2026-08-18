import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

/**
 * Renders this app's real component tree to static markup, for tests.
 *
 * WHY VITE AND NOT A DIRECT IMPORT. Node's `--experimental-strip-types` erases types but does
 * not transform JSX, so a `.tsx` file cannot be imported by a test directly. Vite's
 * programmatic SSR API compiles it through the same `@vitejs/plugin-react` pipeline the app
 * builds with, which adds no dependency and no second toolchain. Same approach as
 * `apps/web/tests/render-baseline.mjs`.
 *
 * NO MACHINE-LOCAL ENV FILE IS READ. The server is created with an explicit inline config
 * rather than `apps/qr/vite.config.ts`, so `resolveEndpoint` never runs and `.env.e2e.local`
 * is never in scope. `__E2E_MODE__` is supplied directly, which is the point: a test can
 * exercise both values of the flag without needing either mode's real preconditions.
 *
 * EXTRACTED SO TWO TEST FILES SHARE ONE HARNESS. `e2eBanner.test.ts` proved the banner is
 * mounted and owned this code alone; `singlePage.test.ts` needs the same render to prove the
 * card shows both partners. Copying the harness would have created the one thing this
 * repository has been bitten by before, two copies of the same thing that drift apart.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const qrRoot = path.resolve(here, '../..');
const repoRoot = path.resolve(here, '../../../..');

/**
 * A minimal browser shim.
 *
 * Deliberately minimal: a fuller fake DOM would let the app quietly depend on something a
 * real render does not have. Effects do not run under `renderToStaticMarkup`, so Save
 * Contact never executes and nothing here needs to model a click.
 *
 * `window.location` no longer has a reader in the component tree. `App` used to read
 * `window.location.search` in a `useState` initialiser, which runs during render, to resolve
 * the `?profile=` key; the 2026-08-17 single-page collapse removed that. The shim keeps the
 * object anyway, because it costs nothing and the alternative is a test that fails for an
 * unrelated reason the first time any code reads `window`.
 */
export function installRenderGlobals(): void {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as Record<string, unknown>).window = {
      location: { search: '', pathname: '/', href: 'http://localhost/' },
    };
  }
}

/**
 * Renders the default export of one module path, as the app itself would mount it.
 *
 * `entry` is a root-relative path inside `apps/qr`, for example `/src/App.tsx`.
 */
export async function renderModule(entry: string, options: { e2e?: boolean } = {}): Promise<string> {
  const server: ViteDevServer = await createServer({
    configFile: false,
    root: qrRoot,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [react()],
    resolve: {
      alias: [
        { find: '@', replacement: path.join(qrRoot, 'src') },
        { find: '@brand', replacement: path.join(repoRoot, 'packages/brand/src') },
      ],
    },
    define: {
      __FORM_ENDPOINT__: JSON.stringify(''),
      __E2E_MODE__: JSON.stringify(options.e2e ?? false),
    },
  });

  try {
    const mod = (await server.ssrLoadModule(entry)) as { default: () => unknown };
    return renderToStaticMarkup(createElement(mod.default as never));
  } finally {
    // Without this the Vite server keeps the process alive after the tests pass.
    await server.close();
  }
}
