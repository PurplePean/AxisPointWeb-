/**
 * Rendered preview of the site chrome in all nine locales.
 *
 * WHO THIS IS FOR. The native readers who have to correct the audit-candidate catalogs. Asking
 * somebody to review translations by reading `catalogs/audit/ur.ts` is asking them to review a
 * TypeScript file; what they need is the text as a visitor meets it, in reading order, with the
 * document's language and direction stated. That is what this writes.
 *
 * WHAT EACH FILE CONTAINS. One file per locale, holding the site chrome once and then each of
 * the five marketing pages. A reviewer opens ONE file and reads everything in their language,
 * rather than opening nine files per page or reading TypeScript.
 *
 * THE CHROME IS RENDERED ONCE, from the 404 route: the smallest page carrying the skip link,
 * the whole header, and the entire footer. For the marketing pages only the `<main>` landmark
 * is extracted, because repeating the identical header and footer five times per file would
 * bury the page copy a reviewer is actually there to read.
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

/** The five approved marketing routes, in the order the navigation presents them. */
const PAGES = [
  ['Home', '/'],
  ['Property Management', '/property-management'],
  ['Asset Management', '/asset-management'],
  ['Investor Services', '/investor-services'],
  ['Partners', '/partners'],
];

/**
 * The `<main>` landmark only.
 *
 * `Layout` renders `<main id="main" tabIndex={-1}>`, so this is stable. Falling back to the
 * whole document rather than to an empty section: a reviewer seeing the header twice is a
 * cosmetic problem, a reviewer seeing nothing is a missing page they cannot review.
 */
function mainOnly(html) {
  const start = html.indexOf('<main');
  if (start === -1) return html;
  const open = html.indexOf('>', start);
  const end = html.lastIndexOf('</main>');
  if (open === -1 || end === -1 || end < open) return html;
  return html.slice(open + 1, end);
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

      const render = (route) =>
        renderToStaticMarkup(
          createElement(
            LocaleProvider,
            { initial: locale.code },
            createElement(MemoryRouter, { initialEntries: [route] }, createElement(App)),
          ),
        );

      const sections = [
        [
          `${locale.englishName} (${locale.code})`,
          `native name : ${locale.nativeName}`,
          `direction   : ${locale.direction}`,
          `font stack  : ${locale.fontStack}`,
          `line height : ${locale.lineHeight}`,
          `enabled     : ${locale.enabled}`,
          `review      : ${locale.review}`,
          `status      : ${status}`,
          '',
          'Rendered text in reading order. Site chrome first, then each marketing page.',
          'Proper nouns (AxisPoint, partner names, place names) are intentionally not translated.',
        ].join('\n'),
        '',
        '='.repeat(72),
        'SITE CHROME  (header, skip link, 404 copy, footer)  route: /no-such-page',
        '='.repeat(72),
        '',
        toText(render('/no-such-page')),
      ];

      for (const [label, route] of PAGES) {
        sections.push(
          '',
          '='.repeat(72),
          `PAGE: ${label}  route: ${route}`,
          '='.repeat(72),
          '',
          toText(mainOnly(render(route))),
        );
      }

      writeFileSync(path.join(outDir, `${locale.code}.txt`), sections.join('\n') + '\n', 'utf8');
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
