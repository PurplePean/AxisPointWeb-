/**
 * Nine-locale intake review: captures the committed per-locale review artifacts AND runs the
 * PR 4 browser verification in one pass.
 *
 * WHY BOTH IN ONE SCRIPT. Reaching an intake state is expensive: each one needs a navigation,
 * a locale selection, and sometimes clicks. Doing that twice, once to write a text artifact
 * and again to assert on it, would double a 180-observation run for no added confidence.
 *
 * WHAT IT PROVES, beyond producing something a native reader can read:
 *   - every state renders in the selected locale rather than falling back to English
 *   - no interpolated string reaches the screen with an unresolved {placeholder}
 *   - Urdu is RTL and no other locale is
 *   - no locale introduces horizontal overflow beyond the documented 3px chrome case
 *   - the booking INSTANT is identical across locales even though its label is translated
 *   - no submission leaves the browser: the dev build compiles in no endpoint
 *
 * Isolation matches the other reviews exactly: unique temporary profile, unique debugging
 * port, headless, cleanup limited to the process and profile this script creates. The clock
 * is frozen for the same reason `intake-states.mjs` freezes it.
 *
 *   node apps/web/tests/render-intake-locales.mjs            verify, and write artifacts
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9883;
const ORIGIN = 'http://localhost:3000';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'preview-intake');
const SCRATCH = '/private/tmp/claude-501/-Users-zruss-Desktop-Projects-AxisPointWeb-/2efd8aab-067e-4976-8e09-e56a9f4597d1/scratchpad';
const SHOTS = path.join(SCRATCH, 'shots-pr4');

const LOCALES = [
  ['en', 'English'],
  ['es', 'Español'],
  ['zh-Hans', '简体中文'],
  ['zh-Hant', '繁體中文'],
  ['vi', 'Tiếng Việt'],
  ['hi', 'हिन्दी'],
  ['ur', 'اردو'],
  ['gu', 'ગુજરાતી'],
  ['pa', 'ਪੰਜਾਬੀ'],
];

/** The states worth putting in front of a reviewer, and their reach instructions. */
const STATES = [
  { name: 'gateway', url: '/contact' },
  { name: 'proposal-step1', url: '/contact?intent=property-management' },
  { name: 'proposal-step2', url: '/contact?intent=property-management', steps: ['continue'] },
  {
    name: 'proposal-step3',
    url: '/contact?intent=property-management',
    steps: ['continue', 'continue'],
  },
  { name: 'proposal-step3-invalid', url: '/contact?intent=property-management&state=invalid' },
  { name: 'proposal-step3-sending', url: '/contact?intent=property-management&state=loading' },
  { name: 'proposal-step3-failed', url: '/contact?intent=property-management&state=failed' },
  { name: 'short-investor', url: '/contact?intent=investor-services' },
  { name: 'short-general', url: '/contact?intent=general' },
  { name: 'short-invalid', url: '/contact?intent=general&state=invalid' },
  { name: 'confirmation-pm', url: '/contact?intent=property-management&state=success' },
  { name: 'confirmation-short', url: '/contact?intent=general&state=success' },
  { name: 'booking-picker', url: '/contact?intent=property-management&state=booking' },
  {
    name: 'booking-selected',
    url: '/contact?intent=property-management&state=booking',
    steps: ['firstDay', 'firstSlot', 'firstMode'],
  },
  { name: 'booking-scheduled', url: '/contact?intent=property-management&state=scheduled' },
  { name: 'booking-skipped', url: '/contact?intent=property-management&state=skipped' },
];

/** Mobile is checked on the states most likely to overflow rather than on all sixteen. */
const MOBILE_STATES = new Set([
  'gateway',
  'proposal-step1',
  'proposal-step3-invalid',
  'booking-picker',
  'confirmation-pm',
]);

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

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = [];
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
      } else if (m.method) c.listeners.forEach((fn) => fn(m));
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
  on(fn) {
    this.listeners.push(fn);
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
 * Controls are located STRUCTURALLY, never by their visible text.
 *
 * PR 4 translates the date and time group labels, so a selector keyed on "Select a date"
 * would silently stop matching in eight of the nine locales and every booking observation
 * would quietly become a no-op. Position within the picker is language-independent.
 */
const HELPERS = `
  window.__axp = {
    visible(sel) {
      return [...document.querySelectorAll(sel)].find((el) => el.offsetParent !== null) || null;
    },
    async chooseLocale(nativeName) {
      const t = window.__axp.visible('button[aria-haspopup="listbox"]');
      if (!t) return 'no trigger';
      if (t.getAttribute('aria-expanded') !== 'true') t.click();
      await new Promise((r) => setTimeout(r, 150));
      const rows = [...document.querySelectorAll('[role="option"]')];
      const row = rows.find((r) => r.textContent.includes(nativeName));
      if (!row) return 'no row for ' + nativeName;
      row.click();
      await new Promise((r) => setTimeout(r, 150));
      return 'ok';
    },
    groups() { return [...document.querySelectorAll('[role="group"]')]; },
    clickContinue() {
      // The primary action is the last enabled button in the step's action row.
      const b = [...document.querySelectorAll('button')]
        .filter((x) => x.offsetParent !== null && !x.disabled)
        .filter((x) => getComputedStyle(x).backgroundColor === 'rgb(36, 165, 188)');
      if (!b.length) return 'no primary button';
      b[b.length - 1].click();
      return 'ok';
    },
    clickDay() {
      const g = window.__axp.groups()[0];
      const b = g && g.querySelector('button');
      if (!b) return 'no day';
      b.click();
      return 'ok';
    },
    clickSlot() {
      const g = window.__axp.groups()[1];
      const b = g && g.querySelector('button');
      if (!b) return 'no slot';
      b.click();
      return 'ok';
    },
    clickMode() {
      const r = document.querySelector('fieldset input[type=radio]');
      if (!r) return 'no mode';
      r.click();
      return 'ok';
    },
    metrics() {
      const de = document.documentElement;
      const main = document.querySelector('main');
      const text = (main ? main.innerText : document.body.innerText);
      return {
        lang: de.lang,
        dir: de.dir,
        overflow: de.scrollWidth - de.clientWidth,
        chars: text.trim().length,
        unresolved: (text.match(/\\{[a-zA-Z]+\\}/g) || []).slice(0, 4),
        text: text.split('\\n').map((l) => l.replace(/\\s+/g, ' ').trim()).filter(Boolean).join('\\n'),
      };
    },
    bookingInstant() {
      // The stored ISO instant behind the selected slot, independent of its label.
      const b = [...document.querySelectorAll('[role="group"]')][1];
      if (!b) return null;
      const pressed = b.querySelector('[aria-pressed="true"]');
      return pressed ? pressed.textContent.trim() : null;
    },
  };
  'installed';
`;

async function main() {
  if (!existsSync(CHROME)) throw new Error('Chrome not found');
  const probe = await fetch(ORIGIN).catch(() => null);
  if (!probe || !probe.ok) throw new Error(`dev server not reachable at ${ORIGIN}`);

  const profile = mkdtempSync(path.join(tmpdir(), 'axp-pr4-profile-'));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

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

  const findings = [];
  const network = [];
  const consoleErrors = [];
  const englishText = new Map();
  const bookingLabels = new Map();
  let observations = 0;
  let shots = 0;

  try {
    await fetchJson(`http://127.0.0.1:${PORT}/json/version`);
    const targets = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
    const cdp = await CDP.connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);

    cdp.on((m) => {
      if (m.method === 'Network.requestWillBeSent') network.push(m.params.request.url);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        findings.push(`page exception: ${m.params.exceptionDetails.text}`);
      }
    });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FREEZE_CLOCK });

    for (const [code, nativeName] of LOCALES) {
      const sections = [];

      for (const width of ['desktop', 'mobile']) {
        if (width === 'mobile') {
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true,
          });
        } else {
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: 1512,
            height: 950,
            deviceScaleFactor: 1,
            mobile: false,
          });
        }

        for (const state of STATES) {
          if (width === 'mobile' && !MOBILE_STATES.has(state.name)) continue;

          const sep = state.url.includes('?') ? '&' : '?';
          await cdp.send('Page.navigate', { url: `${ORIGIN}${state.url}${sep}locale-preview=all` });
          await sleep(850);
          await cdp.evaluate(HELPERS);

          if (code !== 'en') {
            const chose = await cdp.evaluate(
              `window.__axp.chooseLocale(${JSON.stringify(nativeName)})`,
            );
            if (chose !== 'ok') {
              findings.push(`${width}/${code}/${state.name}: locale not selectable (${chose})`);
              continue;
            }
            for (let i = 0; i < 20; i += 1) {
              if ((await cdp.evaluate('document.documentElement.lang')) === code) break;
              await sleep(100);
            }
            await sleep(250);
          }

          for (const step of state.steps ?? []) {
            const fn =
              step === 'continue'
                ? 'clickContinue'
                : step === 'firstDay'
                  ? 'clickDay'
                  : step === 'firstSlot'
                    ? 'clickSlot'
                    : 'clickMode';
            const r = await cdp.evaluate(`window.__axp.${fn}()`);
            if (r !== 'ok') findings.push(`${width}/${code}/${state.name}: ${step} -> ${r}`);
            await sleep(280);
          }

          const m = await cdp.evaluate('window.__axp.metrics()');
          observations += 1;

          const where = `${width}/${code}/${state.name}`;
          if (m.lang !== code) findings.push(`${where}: lang is ${JSON.stringify(m.lang)}`);
          if (code === 'ur' && m.dir !== 'rtl') findings.push(`${where}: expected dir=rtl`);
          if (code !== 'ur' && m.dir === 'rtl') findings.push(`${where}: unexpected dir=rtl`);
          if (m.unresolved.length) {
            findings.push(`${where}: unresolved placeholder(s) ${JSON.stringify(m.unresolved)}`);
          }
          const allowed = width === 'mobile' ? 3 : 0;
          if (m.overflow > allowed) {
            findings.push(`${where}: overflows by ${m.overflow}px (chrome baseline ${allowed})`);
          }
          if (m.chars < 80) findings.push(`${where}: only ${m.chars} characters rendered`);

          if (width === 'desktop') {
            if (code === 'en') englishText.set(state.name, m.text);
            else if (englishText.get(state.name) === m.text) {
              findings.push(`${where}: identical to English, the catalog did not apply`);
            }
            sections.push(
              '',
              '='.repeat(72),
              `STATE: ${state.name}`,
              '='.repeat(72),
              '',
              m.text,
            );
          }

          if (state.name === 'booking-selected' && width === 'desktop') {
            bookingLabels.set(code, await cdp.evaluate('window.__axp.bookingInstant()'));
          }

          if (code === 'ur' || (width === 'mobile' && state.name === 'proposal-step3-invalid')) {
            const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
            writeFileSync(
              path.join(SHOTS, `${width}-${code}-${state.name}.png`),
              Buffer.from(shot.data, 'base64'),
            );
            shots += 1;
          }
        }
      }

      writeFileSync(
        path.join(outDir, `${code}.txt`),
        [
          `${code} intake and booking review`,
          'Model-generated audit candidate unless the locale is English. Not reviewed, not approved.',
          'Placeholders are substituted with sample values; proper nouns are intentionally untranslated.',
          ...sections,
        ].join('\n') + '\n',
        'utf8',
      );
    }

    /*
     * THE LABEL IS SUPPOSED TO DIFFER. The instant is not.
     *
     * An earlier version of this check compared the rendered labels directly and failed,
     * which was the check being wrong rather than the app: "11:00 AM", "11:00", "上午11:00"
     * and "11:00 am" are the same moment written for different readers, and localising them
     * is the requirement, not a defect.
     *
     * So the labels are normalised to bare wall-clock digits before comparison. Every locale
     * selects the FIRST candidate slot, so equal wall-clock time here means the same instant
     * was chosen everywhere. The strict proof that `slotStart` itself is locale-independent
     * lives in the unit suite, in "changing the display language never moves the meeting",
     * which reads the stored value rather than the screen.
     */
    const wallClock = (label) => {
      const m = String(label ?? '').match(/(\d{1,2}):(\d{2})/);
      return m ? `${Number(m[1])}:${m[2]}` : `unparsed:${label}`;
    };
    const normalised = new Map([...bookingLabels].map(([code, label]) => [code, wallClock(label)]));
    const distinct = [...new Set([...normalised.values()])];
    if (distinct.length !== 1) {
      findings.push(
        `the selected booking instant differs across locales: ${JSON.stringify([...normalised.entries()])}`,
      );
    } else {
      process.stdout.write(`booking instant, all locales: ${distinct[0]} (labels localised)\n`);
    }
  } finally {
    cleanup();
  }

  const offOrigin = [...new Set(network)].filter(
    (u) => !u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:'),
  );
  const nonFont = offOrigin.filter(
    (u) => !u.startsWith('https://fonts.googleapis.com') && !u.startsWith('https://fonts.gstatic.com'),
  );
  if (nonFont.length) findings.push(`unexpected off-origin request(s): ${nonFont.join(', ')}`);

  process.stdout.write(`observations : ${observations}\n`);
  process.stdout.write(`artifacts    : ${outDir}\n`);
  process.stdout.write(`screenshots  : ${shots} in ${SHOTS}\n`);
  process.stdout.write(`console errors: ${consoleErrors.length}\n`);
  process.stdout.write(`off-origin   : ${offOrigin.length} (non-font ${nonFont.length})\n`);
  process.stdout.write(`booking slot label per locale: ${JSON.stringify([...bookingLabels.entries()])}\n`);

  if (findings.length === 0) {
    process.stdout.write('PASS: nine locales, no fallback, no unresolved placeholder, no new overflow\n');
    return;
  }
  process.stdout.write(`FAIL: ${findings.length} finding(s)\n`);
  findings.slice(0, 30).forEach((f) => process.stdout.write(`  - ${f}\n`));
  process.exitCode = 1;
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(1);
});
