/**
 * Rendered English baseline.
 *
 * WHY THIS EXISTS. The Multilingual Content Rollout pass moves roughly 320 hardcoded strings
 * out of JSX and into the message catalog. The previous pass attempted part of that as a bulk
 * substitution and it was reverted on review, because a bulk replace leaves a partial rewrite
 * wherever a mapping misses, and one of its corrections would have silently changed a visible
 * short-pathway label. Type-checking cannot catch that: both the before and after compile.
 *
 * What catches it is comparing what the page actually renders. This script captures the
 * rendered text of every route and writes it to a committed snapshot. Every later PR in the
 * pass must reproduce that snapshot byte for byte, which is what "the English did not move"
 * means as a claim somebody can check rather than a promise.
 *
 * WHY VITE AND NOT `node --test`. The repository's test runner is
 * `node --test --experimental-strip-types`, and Node's type-stripping erases TypeScript types
 * without transforming JSX. Verified on Node v25.3.0: a `.ts` file loads, a `.tsx` file fails
 * outright with "Unknown file extension". Every existing web test imports only `.ts` modules,
 * which is why none of them has ever rendered a component. Vite's programmatic SSR API
 * compiles JSX through the same `@vitejs/plugin-react` pipeline the app builds with, so this
 * adds no dependency and no second toolchain.
 *
 * WHAT IT DOES NOT TOUCH. No machine-local env file is read: the server is created with an
 * explicit inline config rather than the app's, so `.env.e2e.local` is never in scope. No
 * request leaves the process. The server is closed in a `finally`, so no watcher survives.
 *
 * WHY IT LIVES HERE AND NOT IN `scripts/test/`, where the other harnesses are. Node resolves
 * a bare specifier from the importing FILE's location, not the working directory, and `vite`,
 * `react-dom`, and `@vitejs/plugin-react` are `apps/web` devDependencies rather than root
 * ones. A copy under `scripts/test/` cannot import them from anywhere. This is test code
 * outside `src`, so it is still outside production source: `apps/web/tsconfig.json` compiles
 * `src` only, and nothing in the app imports it.
 *
 * Usage:
 *   node apps/web/tests/render-baseline.mjs            compare against the committed baseline
 *   node apps/web/tests/render-baseline.mjs --write    rewrite the baseline (review the diff)
 */

import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
// `MemoryRouter` from the main entry rather than `StaticRouter` from `react-router-dom/server`:
// the subpath is not resolvable under this install's exports map, and for a single static
// render with no navigation the two produce identical markup.
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/web/tests
const webRoot = path.resolve(here, '..'); // apps/web
const root = path.resolve(here, '../../..'); // repository root
const baselineDir = path.join(here, 'baseline');

const write = process.argv.includes('--write');

/** The approved public routes. `/share/:code` is excluded: it is retained V1 and untouched. */
const ROUTES = [
  ['home', '/'],
  ['property-management', '/property-management'],
  ['asset-management', '/asset-management'],
  ['investor-services', '/investor-services'],
  ['partners', '/partners'],
  ['contact', '/contact'],
  ['not-found', '/no-such-page'],
];

/**
 * Markup to comparable text.
 *
 * Tags, attributes, and class names are stripped on purpose. This baseline is about COPY: a
 * Tailwind class changing is not a content regression, and including it would make the
 * snapshot churn on every layout tweak until nobody read the diff. Entities are decoded so
 * that a curly apostrophe compares equal to itself however React chose to encode it.
 */
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * The single browser global the app reads during render.
 *
 * `usePreviewMode` in `LanguageSelector.tsx` reads `window.location.search` inside a
 * `useState` initialiser, which runs during render rather than in an effect. It is guarded by
 * `import.meta.env.DEV`, and Vite's SSR module runner sets that to true, so the guard does not
 * short-circuit here the way it does in a build.
 *
 * Shimmed rather than fixed in the component: the production code is correct in a browser,
 * and changing app source so a harness can run it would be the harness dictating the app.
 * An empty search string is also the state the baseline wants, since it resolves preview mode
 * to off and the selector to English alone.
 *
 * Deliberately minimal. A fuller fake DOM would let a component silently depend on something
 * that does not exist in the real server-less app, and nothing else here needs one: effects
 * do not run under `renderToStaticMarkup`, so `useDocumentMeta` and the font loader never
 * execute.
 */
function installRenderGlobals() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { location: { search: '', pathname: '/', href: 'http://localhost/' } };
  }
}

async function main() {
  installRenderGlobals();

  /*
   * An explicit inline config, NOT `apps/web/vite.config.ts`.
   *
   * The app's config resolves the submission endpoint, which reads env files. This harness
   * has no business touching those, and `configFile: false` guarantees it cannot. It also
   * means the audit-catalog alias is absent here, which is correct: this renders English.
   */
  const server = await createServer({
    configFile: false,
    root: webRoot,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [react()],
    resolve: {
      alias: [
        { find: '@', replacement: path.join(webRoot, 'src') },
        { find: '@brand', replacement: path.join(root, 'packages/brand/src') },
      ],
    },
    define: {
      __FORM_ENDPOINT__: JSON.stringify(''),
      __E2E_MODE__: JSON.stringify(false),
    },
  });

  const results = new Map();

  try {
    const { default: App } = await server.ssrLoadModule('/src/App.tsx');
    const { LocaleProvider } = await server.ssrLoadModule('/src/i18n/LocaleProvider.tsx');

    for (const [name, route] of ROUTES) {
      /*
       * THE ROUTER WRAPS THE PROVIDER since PR 5, matching `main.tsx`. The locale now comes
       * from the URL rather than from a prop, so English is simply the unprefixed route.
       */
      const html = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: [route] },
          createElement(LocaleProvider, null, createElement(App)),
        ),
      );
      results.set(name, toText(html));
    }
  } finally {
    // Deterministic teardown. Without this the Vite server keeps the process alive.
    await server.close();
  }

  if (!existsSync(baselineDir)) mkdirSync(baselineDir, { recursive: true });

  const findings = [];
  for (const [name, text] of results) {
    const file = path.join(baselineDir, `${name}.txt`);
    if (write) {
      writeFileSync(file, text + '\n', 'utf8');
      continue;
    }
    if (!existsSync(file)) {
      findings.push(`no baseline for ${name}. Run with --write to create it.`);
      continue;
    }
    const expected = readFileSync(file, 'utf8').replace(/\n$/, '');
    if (expected !== text) {
      const a = expected.split('\n');
      const b = text.split('\n');
      const at = a.findIndex((line, i) => line !== b[i]);
      findings.push(
        `${name} changed at line ${at + 1}\n` +
          `    baseline: ${JSON.stringify(a[at] ?? '<end of file>')}\n` +
          `    rendered: ${JSON.stringify(b[at] ?? '<end of file>')}`,
      );
    }
  }

  if (write) {
    process.stdout.write(`wrote ${results.size} baseline file(s) to ${baselineDir}\n`);
    return;
  }

  process.stdout.write(`compared ${results.size} route(s) against ${baselineDir}\n`);
  if (findings.length === 0) {
    process.stdout.write('PASS: rendered English is identical to the baseline\n');
  } else {
    process.stdout.write(`FAIL: ${findings.length} finding(s)\n`);
    findings.forEach((f) => process.stdout.write(`  - ${f}\n`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
