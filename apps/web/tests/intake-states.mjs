/**
 * Deterministic rendered baseline for every intake, validation, submission, and booking state.
 *
 * WHY THIS EXISTS SEPARATELY FROM `render-baseline.mjs`. That harness renders a route's
 * initial server-side output, which is enough for the marketing pages but reaches only the
 * first screen of the intake. Most of the surface PR 4 migrates is behind interaction: step 2
 * needs a click, `blocked` and `unavailable` need a submit against a simulator fixture, and a
 * booking failure needs a slot chosen and confirmed. A baseline that silently omitted those
 * would give false confidence over exactly the states that are hardest to migrate safely.
 *
 * So this drives a real browser over the DevTools Protocol, reaching each state the way a
 * visitor does, and records the rendered text. Isolation matches the other reviews: unique
 * temporary profile, unique debugging port, headless, and cleanup limited to the processes
 * and profile it creates.
 *
 * ── IT STARTS ITS OWN SERVER, AND IT RUNS ON CI ─────────────────────────────
 *
 * This used to hardcode a macOS Chrome path and assume somebody had already run `pnpm dev`
 * on port 3000. Both assumptions made it unrunnable in CI, which is why the 20 intake-state
 * baselines sat committed but ungated for a whole pass. Now it resolves a browser on macOS
 * and Linux, starts and stops its own Vite dev server on a port it knows is free, and picks
 * a free DevTools port rather than a fixed one that a second concurrent run would collide
 * with.
 *
 * WHY A DEV SERVER AND NOT `vite preview`. Every state below depends on a development seam:
 * `?state=` seeds the intake, `?submit=` selects a simulator fixture, and both are gated on
 * `import.meta.env.DEV`. A production preview has none of them by design, and
 * `scripts/test/inspect-bundle.mjs` proves it. A preview server would therefore capture 20
 * copies of the same first screen and call it a pass.
 *
 * WHY THE APP'S REAL CONFIG. Tailwind's output decides what `offsetParent !== null` reports,
 * so a hand-rolled inline config could quietly change which buttons this harness considers
 * visible. `mode: 'development'` also means `resolveEndpoint` returns before it reads
 * anything: no env file is loaded and `.env.e2e.local` is never in scope.
 *
 * NO NETWORK LEAVES THE BROWSER. Development compiles in no endpoint, so the shared
 * submission client simulates; `?submit=` selects which simulated answer comes back.
 *
 *   node apps/web/tests/intake-states.mjs            compare against the committed baseline
 *   node apps/web/tests/intake-states.mjs --write    rewrite it (review the diff)
 *
 * Set `CHROME_PATH` (or `CHROME_BIN`) to use a specific browser binary.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..'); // apps/web
const outDir = path.join(here, 'baseline-intake');
const write = process.argv.includes('--write');

/**
 * Every state, and how a visitor reaches it.
 *
 * `url` gets there directly where a dev seam allows it. `steps` are the interactions needed
 * for states no URL can express: step 2 of the proposal, and the three submit outcomes that
 * only exist as answers from the client.
 */
const STATES = [
  { name: 'gateway', url: '/contact' },
  { name: 'proposal-step1-pm', url: '/contact?intent=property-management' },
  { name: 'proposal-step1-pm-am', url: '/contact?intent=asset-management' },
  {
    name: 'proposal-step2',
    url: '/contact?intent=property-management',
    steps: [{ click: 'continue' }],
  },
  {
    name: 'proposal-step3',
    url: '/contact?intent=property-management',
    steps: [{ click: 'continue' }, { click: 'continue' }],
  },
  { name: 'proposal-step3-invalid', url: '/contact?intent=property-management&state=invalid' },
  { name: 'proposal-step3-sending', url: '/contact?intent=property-management&state=loading' },
  { name: 'proposal-step3-failed', url: '/contact?intent=property-management&state=failed' },
  {
    name: 'proposal-blocked',
    url: '/contact?intent=property-management&state=failed&submit=permanent_failure',
    steps: [{ fill: true }, { click: 'submit' }],
  },
  { name: 'short-investor', url: '/contact?intent=investor-services' },
  { name: 'short-general', url: '/contact?intent=general' },
  { name: 'short-invalid', url: '/contact?intent=general&state=invalid' },
  { name: 'short-sending', url: '/contact?intent=general&state=loading' },
  { name: 'short-failed', url: '/contact?intent=general&state=failed' },
  { name: 'confirmation-pm', url: '/contact?intent=property-management&state=success' },
  { name: 'confirmation-short', url: '/contact?intent=general&state=success' },
  { name: 'booking-picker', url: '/contact?intent=property-management&state=booking' },
  {
    name: 'booking-selected',
    url: '/contact?intent=property-management&state=booking',
    steps: [{ click: 'firstDay' }, { click: 'firstSlot' }, { click: 'firstMode' }],
  },
  { name: 'booking-scheduled', url: '/contact?intent=property-management&state=scheduled' },
  { name: 'booking-skipped', url: '/contact?intent=property-management&state=skipped' },
];

/**
 * A FROZEN CLOCK, injected before any application code runs.
 *
 * The booking picker derives its candidate days from `Date.now()` using the backend's own
 * rules, so a baseline captured today would legitimately differ tomorrow and the committed
 * file would rot within a day. The first capture proved it: it recorded "Wednesday, August
 * 12", which is only true for one day.
 *
 * Freezing `Date.now()` and the no-argument `new Date()` makes the candidate list
 * deterministic while leaving `new Date(value)` alone, so the real timezone offset arithmetic
 * that computes `slotStart` still runs exactly as it does in production. Timers are
 * untouched, so React scheduling is unaffected.
 *
 * 2026-08-11T15:00:00Z is a Tuesday, which puts several business days inside the horizon.
 */
const FROZEN_NOW = Date.UTC(2026, 7, 11, 15, 0, 0);

const FREEZE_CLOCK = `
  (() => {
    const FIXED = ${FROZEN_NOW};
    const RealDate = Date;
    function FrozenDate(...args) {
      return args.length === 0 ? new RealDate(FIXED) : new RealDate(...args);
    }
    FrozenDate.prototype = RealDate.prototype;
    FrozenDate.now = () => FIXED;
    FrozenDate.parse = RealDate.parse;
    FrozenDate.UTC = RealDate.UTC;
    window.Date = FrozenDate;
  })();
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Where a headless Chrome or Chromium is likely to be, per platform.
 *
 * Absolute paths first because they are unambiguous, then bare names resolved against `PATH`
 * for installs this list does not know about. Chromium is accepted as well as Chrome: this
 * harness uses nothing outside the DevTools Protocol, and CI images vary in which one they
 * ship.
 */
const BROWSER_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ],
};

/** A bare name resolved against `PATH`, without shelling out. */
function onPath(name) {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * The browser binary to drive.
 *
 * `CHROME_PATH` wins outright and fails loudly if it is wrong, because a configured path that
 * silently falls back to some other browser is how a CI run ends up proving nothing. `CHROME_BIN`
 * is accepted as the second spelling other tools use.
 */
function resolveBrowser() {
  const configured = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (configured) {
    const resolved = configured.includes(path.sep) ? configured : onPath(configured);
    if (resolved && existsSync(resolved)) return resolved;
    throw new Error(
      `CHROME_PATH is set to ${JSON.stringify(configured)} but no executable is there.\n` +
        'Unset it to fall back to the per-platform search, or point it at a real binary.',
    );
  }

  const candidates = BROWSER_CANDIDATES[process.platform] ?? [];
  for (const candidate of candidates) {
    const resolved = candidate.includes(path.sep) ? candidate : onPath(candidate);
    if (resolved && existsSync(resolved)) return resolved;
  }

  throw new Error(
    `no Chrome or Chromium found on ${process.platform}. Tried:\n` +
      candidates.map((c) => `  ${c}`).join('\n') +
      '\nSet CHROME_PATH to the executable to use.',
  );
}

/**
 * A port nothing is listening on.
 *
 * The DevTools port used to be the constant 9881, which two concurrent runs would fight over
 * and which a CI runner is free to have already taken. Asking the kernel for an ephemeral port
 * and immediately releasing it leaves a theoretical race, but it is the standard approach and
 * strictly better than a constant: the alternative, holding the socket open, is exactly what
 * would stop the real listener from binding it.
 */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('websocket failed'));
    });
    const c = new CDP(ws);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && c.pending.has(m.id)) {
        const { resolve, reject } = c.pending.get(m.id);
        c.pending.delete(m.id);
        if (m.error) reject(new Error(JSON.stringify(m.error)));
        else resolve(m.result);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
}

async function fetchJson(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error(`no devtools at ${url}`);
}

/**
 * In-page helpers. Buttons are found by their accessible text rather than by a test id,
 * deliberately: a test id would be production markup existing only for a harness, and this
 * whole pass has avoided shipping test-only machinery.
 */
const HELPERS = `
  window.__axp = {
    visibleButtons() {
      return [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
    },
    clickText(fragment) {
      const b = window.__axp.visibleButtons().find((x) => x.textContent.trim().startsWith(fragment));
      if (!b) return 'not found: ' + fragment;
      b.click();
      return 'ok';
    },
    /*
     * Selectors are explicit about WHICH group they mean. An earlier version used
     * ':nth-of-type(1)' to distinguish the date and time pickers; that counts element type
     * among siblings, not among matches, so it selected the date group twice and the booking
     * never became ready. The captured state looked plausible and was wrong, which is why
     * the capture is spot-checked rather than trusted.
     */
    clickFirstIn(selector) {
      const b = document.querySelector(selector);
      if (!b) return 'no control for ' + selector;
      b.click();
      return 'ok';
    },
    fillRequired() {
      const set = (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const name = document.querySelector('input[autocomplete="name"]');
      const email = document.querySelector('input[autocomplete="email"]');
      if (name) set(name, 'Baseline Tester');
      if (email) set(email, 'baseline@example.test');
      return 'ok';
    },
    text() {
      const main = document.querySelector('main');
      return (main ? main.innerText : document.body.innerText)
        .split('\\n')
        .map((l) => l.replace(/\\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\\n');
    },
  };
  'installed';
`;

async function main() {
  const browser = resolveBrowser();
  process.stdout.write(`browser: ${browser}\n`);

  /*
   * The app's own config, in development mode, on a port picked because it is free.
   *
   * `strictPort` is on deliberately: silently sliding to the next port would make ORIGIN
   * disagree with where the server actually listens, and every navigation below would then
   * capture a connection error that looks like a rendering change.
   */
  /*
   * RUN FROM `apps/web`, the way `pnpm dev:web` does.
   *
   * Tailwind resolves the `content` globs in `tailwind.config.js` against the WORKING
   * DIRECTORY, not against the config file, so from the repository root `./src/**` matches
   * nothing. Tailwind then emits no utilities, `@apply bg-v2-surface` fails, and the page
   * arrives unstyled. That is not a cosmetic problem here: `visibleButtons()` filters on
   * `offsetParent !== null`, so an unstyled page changes which controls this harness can
   * even see. Every path it writes to is absolute, so the change of directory affects
   * nothing else.
   */
  process.chdir(webRoot);

  const appPort = await freePort();
  const server = await createServer({
    configFile: path.join(webRoot, 'vite.config.ts'),
    root: webRoot,
    mode: 'development',
    logLevel: 'error',
    server: { host: '127.0.0.1', port: appPort, strictPort: true },
  });
  await server.listen();
  const ORIGIN = `http://127.0.0.1:${appPort}`;
  process.stdout.write(`dev server: ${ORIGIN}\n`);

  const debugPort = await freePort();
  const profile = mkdtempSync(path.join(tmpdir(), 'axp-intake-baseline-'));

  /*
   * `--no-sandbox` is added on Linux only. Chrome's sandbox needs kernel namespaces that
   * container-based CI runners commonly do not grant, and the failure mode is a browser that
   * exits immediately with no DevTools endpoint. It is not added on macOS, where the sandbox
   * works and there is no reason to give a local run less isolation than it can have.
   */
  const linuxCiFlags =
    process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];

  const chrome = spawn(
    browser,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--hide-scrollbars',
      ...linuxCiFlags,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  /*
   * Synchronous cleanup, so it is still valid from an `exit` handler. The Vite server needs an
   * await and is therefore closed in the `finally` below instead; a hard kill releases its
   * port to the kernel anyway.
   */
  const cleanup = () => {
    try {
      if (chrome.pid) process.kill(chrome.pid, 'SIGTERM');
    } catch {
      /* gone */
    }
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  };
  process.on('exit', cleanup);

  const captured = new Map();

  try {
    const reachable = await fetch(ORIGIN).catch(() => null);
    if (!reachable || !reachable.ok) throw new Error(`dev server did not answer at ${ORIGIN}`);

    await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    const cdp = await CDP.connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FREEZE_CLOCK });
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1512,
      height: 950,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const state of STATES) {
      await cdp.send('Page.navigate', { url: ORIGIN + state.url });
      await sleep(900);
      await cdp.evaluate(HELPERS);

      for (const step of state.steps ?? []) {
        if (step.fill) await cdp.evaluate('window.__axp.fillRequired()');
        if (step.click === 'continue') await cdp.evaluate("window.__axp.clickText('Continue')");
        if (step.click === 'submit') {
          await cdp.evaluate("window.__axp.clickText('Send')");
          await sleep(600);
        }
        if (step.click === 'firstDay') {
          const r = await cdp.evaluate(
            'window.__axp.clickFirstIn(\'[role="group"][aria-label="Select a date"] button\')',
          );
          if (r !== 'ok') throw new Error(`${state.name}: firstDay ${r}`);
        }
        if (step.click === 'firstSlot') {
          await sleep(200); // slots only exist once a day is chosen
          const r = await cdp.evaluate(
            'window.__axp.clickFirstIn(\'[role="group"][aria-label="Select a time"] button\')',
          );
          if (r !== 'ok') throw new Error(`${state.name}: firstSlot ${r}`);
        }
        if (step.click === 'firstMode') {
          const r = await cdp.evaluate(
            "window.__axp.clickFirstIn('fieldset input[type=radio]')",
          );
          if (r !== 'ok') throw new Error(`${state.name}: firstMode ${r}`);
        }
        await sleep(300);
      }

      captured.set(state.name, await cdp.evaluate('window.__axp.text()'));
    }
  } finally {
    cleanup();
    // Deterministic teardown. Without this the Vite server keeps the process alive.
    await server.close();
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const findings = [];
  for (const [name, text] of captured) {
    const file = path.join(outDir, `${name}.txt`);
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
          `    baseline: ${JSON.stringify(a[at] ?? '<end>')}\n` +
          `    rendered: ${JSON.stringify(b[at] ?? '<end>')}`,
      );
    }
  }

  if (write) {
    process.stdout.write(`wrote ${captured.size} intake state baseline(s) to ${outDir}\n`);
    return;
  }
  process.stdout.write(`compared ${captured.size} intake state(s) against ${outDir}\n`);
  if (findings.length === 0) {
    process.stdout.write('PASS: rendered English is identical for every intake state\n');
    return;
  }
  process.stdout.write(`FAIL: ${findings.length} finding(s)\n`);
  findings.forEach((f) => process.stdout.write(`  - ${f}\n`));
  process.exitCode = 1;
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(1);
});
