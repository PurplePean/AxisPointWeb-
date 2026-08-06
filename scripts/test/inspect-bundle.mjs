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

const assets = path.join(dist, 'assets');
const jsFiles = readdirSync(assets).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  process.stderr.write('no JavaScript found in the bundle\n');
  process.exit(1);
}

const bundle = jsFiles.map((f) => readFileSync(path.join(assets, f), 'utf8')).join('\n');

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

process.stdout.write(`inspected ${jsFiles.length} bundle file(s) in ${assets}\n`);

if (findings.length === 0) {
  if (expectedEndpoint) {
    process.stdout.write('PASS: no development controls or fixtures in the bundle\n');
    process.stdout.write(`      the configured endpoint and the network transport are compiled in\n`);
  } else {
    process.stdout.write('PASS: no development controls, fixtures, or endpoints in the bundle\n');
    process.stdout.write('      the fail-closed NOT_CONFIGURED path is compiled in\n');
  }
} else {
  process.stdout.write(`FAIL: ${findings.length} finding(s)\n`);
  findings.forEach((f) => process.stdout.write(`  - ${f}\n`));
  process.exitCode = 1;
}
