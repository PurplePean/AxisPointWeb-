/**
 * Production-bundle inspection.
 *
 * WHAT THIS GUARDS. Development affordances that survive into a production bundle are a
 * real hazard, not untidiness: a fixture selector reachable from a query string could put
 * a real visitor on a fake success screen, and a compiled-in endpoint could send live
 * traffic somewhere nobody authorised.
 *
 * Run after `pnpm build`:
 *
 *   node scripts/test/inspect-bundle.mjs apps/web/dist
 *
 * And, for a build that is meant to talk to a backend (`apps/web` supplies it through
 * `VITE_V2_SUBMISSION_ENDPOINT`, never the V1 `VITE_FORM_ENDPOINT`):
 *
 *   node scripts/test/inspect-bundle.mjs apps/web/dist --expect-endpoint https://host/exec
 *
 * The second form exists because of a real defect. The website's `NETWORK_ENABLED` was bound
 * to the e2e flag, which is false for every `vite build`, so a production bundle with a real
 * endpoint compiled in silently kept the fail-closed transport and would have refused every
 * submission on the live site. Nothing caught it: the only bundle check ran against a
 * no-endpoint build, where that is the correct outcome. Asserting the endpoint-enabled build
 * separately is what closes that gap.
 *
 * Exits non-zero on any finding, so it can gate a release without anybody remembering to
 * read the output.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const dist = process.argv[2];
if (!dist || !existsSync(dist)) {
  process.stderr.write(
    'usage: node scripts/test/inspect-bundle.mjs <dist dir> [--expect-endpoint <url>]\n',
  );
  process.exit(1);
}

const expectIndex = process.argv.indexOf('--expect-endpoint');
const expectedEndpoint = expectIndex === -1 ? null : process.argv[expectIndex + 1];
if (expectIndex !== -1 && !expectedEndpoint) {
  process.stderr.write('--expect-endpoint requires a URL\n');
  process.exit(1);
}

/**
 * Every emitted file, recursively.
 *
 * THIS USED TO READ `dist/assets/*.js` ONLY, and that was checking less than it appeared to.
 * `apps/web/vite.config.ts` sets `sourcemap: true`, so a module that stays in the graph has
 * its FULL ORIGINAL SOURCE embedded in the adjacent `.map` file even when tree-shaking
 * removes it from the JavaScript. A JS-only scan can therefore pass while the content it is
 * looking for is sitting in the same directory, one file over.
 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push({ abs, rel: path.relative(dist, abs) });
  }
  return out;
}

const emitted = walk(dist);
const jsFiles = emitted.filter((f) => f.rel.endsWith('.js'));
if (jsFiles.length === 0) {
  process.stderr.write('no JavaScript found in the bundle\n');
  process.exit(1);
}

/*
 * Two different scopes, on purpose.
 *
 * `bundle` is executable output: the JavaScript, plus CSS and HTML that a browser also
 * consumes. That is the right scope for "did development machinery ship", because an
 * identifier appearing in a sourcemap is a debugging artifact rather than code that runs.
 *
 * `emitted` is EVERYTHING, including `.map`. That is the right scope for audit-candidate
 * translations, because the requirement there is not "it cannot execute", it is "it must not
 * exist in a deployable artifact at all". A reviewer reading an unreviewed Urdu sentence out
 * of a sourcemap is the outcome being prevented.
 */
const DELIVERABLE = ['.js', '.css', '.html'];
const bundle = emitted
  .filter((f) => DELIVERABLE.some((ext) => f.rel.endsWith(ext)))
  .map((f) => readFileSync(f.abs, 'utf8'))
  .join('\n');

/** Development-only strings. Any occurrence means dead code shipped. */
const FORBIDDEN = [
  // Simulator fixture names, reachable in dev via ?submit=
  'success_bookable',
  'success_not_bookable',
  'recoverable_failure',
  'permanent_failure',
  'submission_id_conflict',
  'DEV_FIXTURES',
  // The simulator's own response bodies
  'simulated-lead-',
  'simulated-contact-',
  // A compiled-in Apps Script endpoint
  'script.google.com',
  '/macros/s/',

  /*
   * Development-only localization machinery.
   *
   * The synthetic catalog exists so the locale seam can be proven with a second language
   * without inventing a translation. Shipping any of it would be worse than shipping
   * nothing: a visitor could be shown placeholder text where real copy belongs, in a
   * language nobody has reviewed. These are verified absent, not assumed.
   */
  'registerTestCatalog',
  'clearTestCatalogs',
  '[qa]',
  // The preview-only webfont bundle for unreviewed scripts. Production ships English only,
  // so loading six Noto families would be pure cost for a language nobody can read yet.
  'PREVIEW_FONT_HREF',

  /*
   * The e2e warning banner's copy.
   *
   * `__E2E_MODE__` is false for every `vite build`, so `E2eBanner` folds to `return null`
   * and its text should be eliminated. Checked rather than assumed, because the failure is
   * ugly and public: a real visitor told the site is wired to a test backend. The banner
   * text legitimately survives in the adjacent `.map`, which is why this list is checked
   * against DELIVERABLE files only. See `apps/qr/tests/e2eBanner.test.ts`, which asserts
   * this same sentence is PRESENT when the flag is on, so the pair covers both directions.
   */
  'E2E MODE: a real backend is enabled',

  /*
   * The development website base URL.
   *
   * Both apps resolve their links from `import.meta.env.DEV ? 'http://localhost:3000' : ...`,
   * which the bundler folds away only while `import.meta.env.DEV` stays in its LITERAL form.
   * Read it through a variable, as in `const ENV = import.meta.env ?? {}`, and it becomes a
   * runtime property read: both branches survive and this string ships inside the production
   * bundle. That is not hypothetical. It was introduced during the 2026-08-17 QR single-page
   * collapse, to make the module importable by the Node test runner, and was caught by hand
   * from the built asset because nothing checked for it. The fix was to keep the env reads in
   * their own module (`apps/qr/src/webLinks.ts`) rather than to soften them.
   *
   * A shipped localhost link is not merely dead weight: whichever branch wins, a visitor's
   * route rows could point at a machine that is not theirs.
   */
  'localhost:3000',
];

/** Must be present: the honest failure path a production build depends on. */
const REQUIRED = ['NOT_CONFIGURED'];

const findings = [];

for (const needle of FORBIDDEN) {
  if (bundle.includes(needle)) findings.push(`forbidden string present: ${needle}`);
}

for (const needle of REQUIRED) {
  if (!bundle.includes(needle)) findings.push(`required string missing: ${needle}`);
}

/*
 * A marker unique to the network transport.
 *
 * `fetch(` is useless for this: Vite's module-preload polyfill contributes one to every
 * bundle. This content type is set only where the transport posts an envelope, so its
 * presence tracks the transport surviving tree-shaking. Verified in both directions: it
 * appears exactly once in an endpoint-enabled build and not at all without one.
 */
const NETWORK_TRANSPORT_MARKER = 'text/plain;charset=utf-8';

if (expectedEndpoint) {
  // The endpoint alone is not enough. A build carrying the URL while still selecting the
  // fail-closed transport is precisely the defect described at the top of this file.
  if (!bundle.includes(expectedEndpoint)) {
    findings.push(`endpoint expected but not compiled in: ${expectedEndpoint}`);
  }
  if (!bundle.includes(NETWORK_TRANSPORT_MARKER)) {
    findings.push('endpoint compiled in but the network transport was dropped from the bundle');
  }
}

/*
 * There is deliberately NO "the network transport must be absent" check for a no-endpoint
 * build.
 *
 * It existed, and it was over-claiming. `createTransport` references `networkTransport` on
 * one branch, so whether that code survives tree-shaking depends on whether the bundler
 * inlines `createTransport` — which it stops doing as soon as an app has more than one
 * client. Its absence therefore measured inlining, not safety, and it started failing the
 * moment the booking client was added even though nothing unsafe had changed.
 *
 * What actually keeps a no-endpoint build from posting anywhere is that there is no
 * endpoint to post to: `__FORM_ENDPOINT__` folds to an empty string, `createTransport`
 * returns the fail-closed transport, and the FORBIDDEN list above proves no Apps Script
 * endpoint was compiled in. Those are the checks worth keeping, and they are still here.
 */

/* ── Audit-candidate locale catalogs must not exist in any artifact ───────── */

/**
 * Model-generated translations that no native reader has checked.
 *
 * `apps/web/vite.config.ts` removes `src/i18n/catalogs/audit/` from the module graph for
 * every build by aliasing its loader to a stub. That is the mechanism; this is the proof, and
 * it is deliberately independent of it. If the alias is deleted, reordered, defeated by a
 * future Vite change, or bypassed by a second importer, the build still produces files and
 * this still reads them.
 *
 * Checked against EVERY emitted file, `.map` included. See the note above `DELIVERABLE`.
 */
const AUDIT_SENTINEL = 'AXP_AUDIT_CANDIDATE_UNREVIEWED';

/** One distinctive string per locale, lifted from each catalog's first key. */
const AUDIT_SAMPLES = [
  ['es', '¿Qué le gustaría tratar?'],
  ['zh-Hans', '您想咨询哪方面的事务？'],
  ['zh-Hant', '您想諮詢哪方面的事務？'],
  ['vi', 'Quý vị muốn trao đổi về điều gì?'],
  ['hi', 'आप किस विषय पर बात करना चाहेंगे?'],
  ['ur', 'آپ کس بارے میں بات کرنا چاہیں گے؟'],
  ['gu', 'તમે શેના વિશે વાત કરવા માંગો છો?'],
  ['pa', 'ਤੁਸੀਂ ਕਿਸ ਬਾਰੇ ਗੱਲ ਕਰਨੀ ਚਾਹੋਗੇ?'],
];

/**
 * Bundlers may emit non-ASCII as `\uXXXX` escapes rather than literal characters, and esbuild
 * does exactly that under its default ASCII charset. A raw substring search would then miss
 * the very content it is looking for and report a false PASS, which is the worst possible
 * failure mode for this particular check. So each needle is searched in both forms.
 */
function escapeNonAscii(s) {
  return [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0);
      if (cp < 0x80) return ch;
      return [...ch]
        .map((u) => '\\u' + u.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('');
    })
    .join('');
}

function occursIn(text, needle) {
  if (text.includes(needle)) return true;
  const escaped = escapeNonAscii(needle);
  if (escaped === needle) return false;
  return text.includes(escaped) || text.includes(escaped.toUpperCase());
}

for (const file of emitted) {
  // A catalog chunk would name itself. Cheap, and it catches a leak before any text search.
  if (/catalog/i.test(file.rel)) {
    findings.push(`emitted file name suggests a locale catalog chunk: ${file.rel}`);
  }

  let text;
  try {
    text = readFileSync(file.abs, 'utf8');
  } catch {
    continue; // Binary asset (a font, an image). Cannot carry a catalog.
  }

  if (occursIn(text, AUDIT_SENTINEL)) {
    findings.push(`audit-candidate sentinel present in ${file.rel}`);
  }

  for (const [code, sample] of AUDIT_SAMPLES) {
    if (occursIn(text, sample)) {
      findings.push(`audit-candidate ${code} content present in ${file.rel}`);
    }
  }

  /*
   * Sourcemaps name their inputs in `sources`, so a module that reached the graph is listed
   * there even when its content was minified away. This catches the case where the catalog
   * was compiled but produced no recognisable string in the output.
   */
  if (file.rel.endsWith('.map')) {
    let sources = [];
    try {
      sources = JSON.parse(text).sources ?? [];
    } catch {
      findings.push(`sourcemap could not be parsed, so it could not be cleared: ${file.rel}`);
    }
    for (const source of sources) {
      if (String(source).includes('catalogs/audit')) {
        findings.push(`sourcemap ${file.rel} names an audit catalog: ${source}`);
      }
    }
  }
}

process.stdout.write(`inspected ${emitted.length} emitted file(s) in ${dist}\n`);
emitted.forEach((f) => process.stdout.write(`  ${f.rel}\n`));

if (findings.length === 0) {
  if (expectedEndpoint) {
    process.stdout.write('PASS: no development controls or fixtures in the bundle\n');
    process.stdout.write(`      the configured endpoint and the network transport are compiled in\n`);
  } else {
    process.stdout.write('PASS: no development controls, fixtures, or endpoints in the bundle\n');
    process.stdout.write('      the fail-closed NOT_CONFIGURED path is compiled in\n');
  }
  process.stdout.write(
    '      no audit-candidate catalog content in any emitted file, sourcemaps included\n',
  );
} else {
  process.stdout.write(`FAIL: ${findings.length} finding(s)\n`);
  findings.forEach((f) => process.stdout.write(`  - ${f}\n`));
  process.exitCode = 1;
}
