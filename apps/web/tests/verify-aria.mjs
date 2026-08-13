/**
 * Rendered assertion for the chrome's assistive labels.
 *
 * WHY THIS EXISTS. PR 2 moved six `aria-label` values into the catalog. Neither existing gate
 * covers them: `verify:baseline` compares rendered TEXT with attributes stripped, and the
 * no-orphan-key test only proves a key name appears somewhere in source. Both would pass if a
 * label were bound to the wrong key, or if `{language}` were never substituted and a screen
 * reader announced the placeholder aloud. This renders the real component tree and reads the
 * real attributes.
 *
 * ── WHAT STATIC RENDERING CAN AND CANNOT REACH ──────────────────────────────
 *
 * Three of the six labels are inside `{open && (...)}` branches: the mobile menu dialog, its
 * close button, and the language listbox. `renderToStaticMarkup` renders initial state, and
 * initial state is closed, so those three are NOT in the output and cannot be asserted here at
 * any effort. They need an interactive render, which means a browser.
 *
 * This script therefore asserts the three reachable labels and PRINTS the three it cannot
 * reach, rather than quietly checking half the surface and reporting a pass. A gate that
 * silently covers less than its name suggests is the specific failure this repository has
 * already had once, in the bundle inspector.
 *
 * Usage: node apps/web/tests/verify-aria.mjs
 */

import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const root = path.resolve(here, '../../..');

/** Labels that live behind an `open` branch and cannot appear in a static render. */
const INTERACTIVE_ONLY = ['navMenuDialogAria', 'navCloseMenu', 'languageListAria'];

/** Locales exercised. English plus one Latin, one CJK, one Indic, and the RTL one. */
const CHECKED = ['en', 'es', 'zh-Hans', 'hi', 'ur'];

function installRenderGlobals() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { location: { search: '', pathname: '/', href: 'http://localhost/' } };
  }
}

function ariaLabelsIn(html) {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) =>
    m[1]
      .replace(/&#x27;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))),
  );
}

async function main() {
  installRenderGlobals();

  const findings = [];

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

  try {
    const { default: App } = await server.ssrLoadModule('/src/App.tsx');
    const { LocaleProvider } = await server.ssrLoadModule('/src/i18n/LocaleProvider.tsx');
    const messages = await server.ssrLoadModule('/src/i18n/messages.ts');
    const { buildLocalePath } = await server.ssrLoadModule('/src/i18n/route.ts');
    const audit = await server.ssrLoadModule('/src/i18n/catalogs/audit/active.ts');

    for (const code of CHECKED) {
      messages.clearTestCatalogs();

      const candidate = code === 'en' ? null : await audit.loadAuditCandidate(code);
      const catalog = messages.mergeCatalog(candidate);
      if (candidate) messages.registerTestCatalog(code, catalog);

      /*
       * Router outside provider, and the locale carried by the URL, matching `main.tsx`
       * since PR 5. A non-English locale needs its prefix and the development preview gate,
       * or the launch gate correctly refuses the route.
       */
      const url =
        code === 'en'
          ? '/no-such-page'
          : `${buildLocalePath(code, '/no-such-page')}?locale-preview=all`;
      const html = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: [url] },
          createElement(LocaleProvider, null, createElement(App)),
        ),
      );

      const labels = ariaLabelsIn(html);

      /*
       * The selector advertises only launch-ready locales, so the ACTIVE locale it names is
       * always English today even when the page locale is not. That is the approved rule, and
       * asserting it here is the point: it proves the TEMPLATE is translated while the
       * substituted language name is correctly still English.
       */
      const expectedTrigger = catalog.languageChooseAria.replace('{language}', 'English');

      const required = [
        ['navHomeAria', catalog.navHomeAria],
        ['navPrimaryAria', catalog.navPrimaryAria],
        ['languageChooseAria', expectedTrigger],
      ];

      for (const [key, value] of required) {
        if (!labels.includes(value)) {
          findings.push(
            `${code}: ${key} not found in rendered aria-labels.\n` +
              `    expected: ${JSON.stringify(value)}\n` +
              `    rendered: ${JSON.stringify(labels)}`,
          );
        }
      }

      // The placeholder must never survive into the document. A screen reader would say it.
      if (html.includes('{language}')) {
        findings.push(`${code}: the literal {language} placeholder reached the rendered output`);
      }

      // A non-English locale must not be announcing the English template.
      if (code !== 'en' && labels.includes('Choose language. Current language: English.')) {
        findings.push(`${code}: the selector is still announcing the untranslated English label`);
      }

      process.stdout.write(
        `  ${code.padEnd(8)} ${required.length} label(s) verified` +
          (code === 'en' ? '' : ' (translated)') +
          '\n',
      );
    }

    messages.clearTestCatalogs();
  } finally {
    await server.close();
  }

  process.stdout.write(
    `\n  NOT COVERED by this gate, because they render only when a menu is open:\n` +
      INTERACTIVE_ONLY.map((k) => `    - ${k}`).join('\n') +
      `\n  These require an interactive browser check. See docs/STATUS.md.\n\n`,
  );

  if (findings.length === 0) {
    process.stdout.write(`PASS: chrome assistive labels render translated in ${CHECKED.length} locales\n`);
    return;
  }
  process.stdout.write(`FAIL: ${findings.length} finding(s)\n`);
  findings.forEach((f) => process.stdout.write(`  - ${f}\n`));
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
