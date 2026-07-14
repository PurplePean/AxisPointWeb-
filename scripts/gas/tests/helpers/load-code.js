'use strict';

/*
 * Loads the REAL scripts/gas/Code.gs into a vm sandbox with the Google Apps
 * Script globals stubbed, and returns the sandbox so tests can call the actual
 * production functions rather than reimplementations of them.
 *
 * WHY vm, not require(): Code.gs is not a module — it declares everything at top
 * level with `var` / `function`, which is exactly how Apps Script expects it. In
 * a vm context those top-level declarations attach to the context's global
 * object, so the sandbox object below ends up carrying every function and
 * constant defined in the file. (This only works because Code.gs has NO
 * top-level `const`/`let`, which would be block-scoped and invisible here — a
 * guard test asserts that stays true.)
 *
 * Only the globals actually touched at load time or by the pure functions under
 * test are stubbed with real behavior (Utilities.newBlob / base64Decode, used by
 * the module-level LOGO_BLOB). The rest are inert stubs: present so a reference
 * doesn't throw, doing nothing, because the pure functions never call them. A
 * test that needs real Sheet/Gmail/Calendar behavior must build its own richer
 * stub and is out of scope for this suite.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CODE_PATH = path.join(__dirname, '..', '..', 'Code.gs');

function noop() {}

/** A do-nothing proxy: any property access returns another callable no-op, so an
 *  accidental call into an un-stubbed GAS surface fails loudly-ish (returns
 *  undefined-ish) rather than throwing a ReferenceError that masks the real
 *  test failure. Used only for services the pure functions don't touch. */
function inertService() {
  const handler = {
    get() {
      return inertCallable;
    },
  };
  function inertCallable() {
    return new Proxy(inertCallable, handler);
  }
  return new Proxy(inertCallable, handler);
}

function buildSandbox() {
  const logs = [];

  const sandbox = {
    console,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    isNaN,
    parseInt,
    parseFloat,

    // Logger: capture, so a test can assert on what a function logged.
    Logger: {
      log(msg) {
        logs.push(String(msg));
      },
      _logs: logs,
    },

    // Utilities: the only service exercised at module-load time (LOGO_BLOB) and
    // the only one the pure functions genuinely need real behavior from
    // (formatDate is used by a couple, base64Decode/newBlob by the logo).
    Utilities: {
      base64Decode(s) {
        return Buffer.from(String(s), 'base64');
      },
      newBlob(data, type, name) {
        return { _data: data, _type: type, _name: name, getBytes: () => data };
      },
      // Real-enough formatDate for the America/Chicago cases the pure functions
      // use. Implemented via Intl so tests don't depend on the host timezone.
      formatDate(date, tz, fmt) {
        return formatDateImpl(date, tz, fmt);
      },
    },

    // Services the pure functions never call. Present so any stray reference is
    // inert rather than a ReferenceError.
    PropertiesService: inertService(),
    SpreadsheetApp: inertService(),
    ContactsApp: inertService(),
    GmailApp: inertService(),
    CalendarApp: inertService(),
    Calendar: inertService(),
    ContentService: inertService(),
    HtmlService: inertService(),
    LockService: inertService(),
    ScriptApp: inertService(),
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

/* Minimal Utilities.formatDate covering the format tokens Code.gs actually uses:
   'MM/dd/yyyy', 'MMM', 'd', 'EEE', "yyyyMMdd'T'HHmmss", "yyyyMMdd'T'HHmmss'Z'".
   Uses Intl with an explicit timeZone so results don't depend on where the test
   runs. Good enough for assertions; not a general date library. */
function formatDateImpl(date, tz, fmt) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(d);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
  const monShort = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' }).format(d);
  const dayNum = String(parseInt(get('day'), 10));
  let hour = get('hour');
  if (hour === '24') hour = '00';

  let out = fmt;
  out = out.replace(/'T'/g, 'T').replace(/'Z'/g, 'Z');
  out = out
    .replace(/yyyy/g, get('year'))
    .replace(/MMM/g, monShort)
    .replace(/MM/g, get('month'))
    .replace(/dd/g, get('day'))
    .replace(/HH/g, hour)
    .replace(/mm/g, get('minute'))
    .replace(/ss/g, get('second'))
    .replace(/EEE/g, get('weekday'))
    .replace(/\bd\b/g, dayNum);
  return out;
}

/* ── THE CROSS-REALM TRAP — read this before writing a deepEqual against Code.gs ──
 *
 * Code.gs runs in a vm context with its OWN intrinsics. An array or object created
 * inside it (LEAD_HEADERS, UNIFIED_LEAD_HEADERS, anything buildLeadRow returns)
 * carries that context's Array.prototype, NOT the host's. `assert/strict`'s
 * deepEqual is deepStrictEqual, which compares prototypes with ===, so:
 *
 *   assert.deepEqual(hostArray, vmArray)      // THROWS even when the contents match
 *   assert.notDeepEqual(hostArray, vmArray)   // PASSES even when the contents are IDENTICAL
 *
 * The first is loud and self-correcting. The second is the dangerous one: it is
 * exactly the tautology this suite's core rule exists to prevent. A fixture-drift
 * guard written as `assert.notDeepEqual(myHandTypedFixture, UNIFIED_LEAD_HEADERS)`
 * passes whether or not the fixture is drifted — including when it is a byte-for-byte
 * copy of the constant it is supposed to differ from. It looks like coverage and is
 * not.
 *
 * NOTE the asymmetry that makes this easy to miss: a fixture built by TRANSFORMING a
 * sandbox constant (`LEAD_HEADERS.slice(5).concat(...)`) stays in the vm realm, so it
 * compares correctly. A fixture typed out BY HAND in the test file is a host array,
 * and does not. Same-looking assertions, opposite behavior.
 *
 * THE RULE: lift the sandbox value into the host realm before any deep comparison —
 * `Array.from(sandbox.LEAD_HEADERS)`, or `JSON.parse(JSON.stringify(x))` for a nested
 * object. Every deep comparison against a sandbox value in this suite does this.
 */

/** Loads Code.gs fresh into a new sandbox and returns it. Each call is isolated. */
function loadCode() {
  const source = fs.readFileSync(CODE_PATH, 'utf8');
  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'Code.gs' });
  return sandbox;
}

module.exports = { loadCode, CODE_PATH };
