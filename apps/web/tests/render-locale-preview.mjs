/**
 * Rendered preview of the site chrome in all nine locales.
 *
 * WHO THIS IS FOR. The native readers who have to correct the audit-candidate catalogs. Asking
 * somebody to review translations by reading `catalogs/audit/ur.ts` is asking them to review a
 * TypeScript file; what they need is the text as a visitor meets it, in reading order, with the
 * document's language and direction stated. That is what this writes.
 *
 * WHY THE 404 ROUTE. It is the smallest page that contains every surface PR 2 migrated: the skip
 * link, the whole header including the menu affordances, the two 404 strings, and the entire
 * footer. The marketing pages would bury those twenty-one strings under a thousand lines of
 * English that PR 3 has not migrated yet.
 *
 * WHY IT INJECTS THE CATALOG. `LocaleProvider` loads an audit candidate asynchronously, and
 * effects do not run under `renderToStaticMarkup`, so a plain SSR render would show English for
 * every locale. `registerTestCatalog` is the existing development and test seam for exactly
 * this, and `verify:bundle` already asserts it cannot reach a production bundle.
 *
 * THIS IS NOT A BASELINE. `render-baseline.mjs` proves English did not move and fails on any
 * change. This one is documentation: it is expected to change whenever a translation is
 * corrected, which is the point.
 *
 * Usage:
 *   node apps/web/tests/render-locale-preview.mjs
 */

import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const root = path.resolve(here, '../../..');
const outDir = path.join(here, 'preview');

/** See `render-baseline.mjs`: `usePreviewMode` reads this during render. */
function installRenderGlobals() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { location: { search: '', pathname: '/', href: 'http://localhost/' } };
  }
}

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

async function main() {
  installRenderGlobals();

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

  let written = 0;

  try {
    const { default: App } = await server.ssrLoadModule('/src/App.tsx');
    const { LocaleProvider } = await server.ssrLoadModule('/src/i18n/LocaleProvider.tsx');
    const messages = await server.ssrLoadModule('/src/i18n/messages.ts');
    const { LOCALES } = await server.ssrLoadModule('/src/i18n/locales.ts');
    const audit = await server.ssrLoadModule('/src/i18n/catalogs/audit/active.ts');

    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    for (const locale of LOCALES) {
      messages.clearTestCatalogs();

      const candidate = await audit.loadAuditCandidate(locale.code);
      const status =
        locale.code === 'en'
          ? 'REVIEWED. This is the live locale.'
          : candidate
            ? 'AUDIT CANDIDATE. Model-generated, unreviewed, not approved, not live.'
            : 'NO CATALOG. Falls back to English.';

      if (candidate) {
        messages.registerTestCatalog(locale.code, messages.mergeCatalog(candidate));
      }

      const html = renderToStaticMarkup(
        createElement(
          LocaleProvider,
          { initial: locale.code },
          createElement(MemoryRouter, { initialEntries: ['/no-such-page'] }, createElement(App)),
        ),
      );

      const header = [
        `${locale.englishName} (${locale.code})`,
        `native name : ${locale.nativeName}`,
        `direction   : ${locale.direction}`,
        `font stack  : ${locale.fontStack}`,
        `line height : ${locale.lineHeight}`,
        `enabled     : ${locale.enabled}`,
        `review      : ${locale.review}`,
        `status      : ${status}`,
        '',
        'Rendered chrome, in reading order. Route: /no-such-page',
        '='.repeat(72),
        '',
      ].join('\n');

      writeFileSync(path.join(outDir, `${locale.code}.txt`), header + toText(html) + '\n', 'utf8');
      written += 1;
    }

    messages.clearTestCatalogs();
  } finally {
    await server.close();
  }

  process.stdout.write(`wrote ${written} locale preview file(s) to ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
