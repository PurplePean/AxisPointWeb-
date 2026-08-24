'use strict';

/*
 * Deployability.
 *
 * WHAT THESE TESTS ARE FOR. Everything here guards a failure that a passing unit
 * suite would not catch and that only shows up as a live outage or a leaked value.
 *
 * THE OUTAGE. Apps Script evaluates every pushed file's top-level statements in one
 * shared global scope on every invocation. A pushed Node test file opens with
 * require(), which GAS has no definition for, and from then on every doPost and every
 * trigger throws. That is a full backend outage caused entirely by files that are not
 * source. .claspignore is therefore an ALLOWLIST, and these tests assert it stays one.
 *
 * THE LEAK. No project id, Sheet id, deployment id, calendar id, endpoint, or address
 * belongs in this directory. Configuration is read by NAME at runtime.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execSync } = require('node:child_process');
const { load, listSourceFiles, SRC_DIR } = require('./helpers/load.js');

const ROOT = path.join(__dirname, '..');
const SOURCES = listSourceFiles();

function readSrc(file) {
  return fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
}

function readRoot(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* ── .claspignore is an allowlist ─────────────────────────────────────────── */

test('.claspignore denies everything before re-allowing anything', () => {
  const lines = readRoot('.claspignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));

  assert.equal(lines[0], '**/**', 'the first rule must deny everything');
  lines.slice(1).forEach((line) => {
    assert.ok(line.startsWith('!'), `every rule after the deny must be a re-allow, found "${line}"`);
  });
});

test('.claspignore re-allows only the deployable set', () => {
  const allows = readRoot('.claspignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('!'));

  assert.deepEqual(allows.sort(), ['!appsscript.json', '!src/**/*.js']);
});

test('the allow rule reaches every grouped source file, at every depth', () => {
  /*
   * The grouping into entrypoints/, core/, platform/, scheduled/, emails/, and shared/ is
   * exactly the change that would break a single-segment `src/*.js` rule: it matches
   * nothing nested, so a push would upload the manifest and no code at all, and every
   * doPost would 404 rather than fail loudly. Assert the rule is recursive AND that the
   * source it has to cover really is nested, so this cannot pass by both sides going flat.
   */
  const allows = readRoot('.claspignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('!'));

  assert.ok(allows.indexOf('!src/**/*.js') !== -1, 'the source allow must be recursive');
  assert.ok(
    SOURCES.every((file) => file.indexOf('/') !== -1),
    'every source file is expected to live in a group folder under src',
  );
});

test('the tests directory is not reachable through any allow rule', () => {
  // This is the specific outage the allowlist exists to prevent.
  const allows = readRoot('.claspignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('!'));

  allows.forEach((rule) => {
    assert.equal(rule.indexOf('tests') === -1, true, `rule "${rule}" could reach the tests directory`);
    assert.notEqual(rule, '!**/*.js', 'a blanket js allow would sweep the tests back in');
  });
});

/* ── Source files are Apps Script, not Node ───────────────────────────────── */

test('no source file uses a Node module system', () => {
  SOURCES.forEach((file) => {
    const code = readSrc(file);
    assert.equal(/\brequire\s*\(/.test(code), false, `${file} calls require()`);
    assert.equal(/\bmodule\.exports\b/.test(code), false, `${file} assigns module.exports`);
    assert.equal(/^\s*(import|export)\s/m.test(code), false, `${file} uses ES module syntax`);
  });
});

test('no source file references a Node global', () => {
  SOURCES.forEach((file) => {
    const code = readSrc(file);
    ['process.', 'Buffer.', '__dirname', '__filename', 'globalThis.'].forEach((token) => {
      assert.equal(code.indexOf(token), -1, `${file} references ${token}`);
    });
  });
});

test('src loads in a context with no Node globals at all', () => {
  // The loader supplies only what Apps Script does. If src ever grows a Node
  // dependency it fails here rather than after a push.
  assert.doesNotThrow(() => load());
});

/* ── Load order safety ────────────────────────────────────────────────────── */

test('no file reads another file value at load time, in any order', () => {
  // Apps Script decides file evaluation order, not this repository. A top-level
  // `var X = SOME_OTHER_FILES_CONSTANT` throws for EVERY request if the order is not
  // what the author assumed. Loading in reverse proves nothing depends on order.
  const sandbox = { JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat };
  const context = vm.createContext(sandbox);

  assert.doesNotThrow(() => {
    SOURCES.slice()
      .reverse()
      .forEach((file) => {
        vm.runInContext(readSrc(file), context, { filename: file });
      });
  });
});

test('no top-level name is declared in two files', () => {
  // Apps Script concatenates every pushed file into ONE global scope, so a second
  // declaration of the same function silently wins or loses depending on file order
  // rather than being a harmless duplicate. This nearly shipped during Pass 9B when a
  // helper was copied into a new file instead of being called across files.
  const seen = new Map();
  const duplicates = [];

  SOURCES.forEach((file) => {
    const code = readSrc(file);
    const names = new Set();
    const declaration = /^(?:function\s+([A-Za-z_$][\w$]*)|var\s+([A-Za-z_$][\w$]*)\s*=)/gm;
    let match = declaration.exec(code);
    while (match) {
      names.add(match[1] || match[2]);
      match = declaration.exec(code);
    }
    names.forEach((name) => {
      if (seen.has(name)) duplicates.push(`${name}: ${seen.get(name)} and ${file}`);
      else seen.set(name, file);
    });
  });

  assert.deepEqual(duplicates, [], 'a top-level name is declared twice');
});

test('every entry point Apps Script calls by name exists after loading', () => {
  const ctx = load();
  ['doPost', 'doGet', 'runWorkerTrigger'].forEach((name) => {
    assert.equal(typeof ctx[name], 'function', `${name} must be a top-level function`);
  });
});

/* ── Google services are confined to one adapter file ─────────────────────── */

test('only the adapter files name a Google service', () => {
  const services = [
    'SpreadsheetApp',
    'MailApp',
    'GmailApp',
    'CalendarApp',
    'LockService',
    'PropertiesService',
    'Utilities',
    'ContentService',
    'ScriptApp',
    // The People advanced service is covered by its own test, which matches the call
    // form rather than the bare word so prose about it does not trip this check.
  ];
  const allowed = { 'platform/GoogleServices.js': true, 'entrypoints/Entry.js': true };

  SOURCES.forEach((file) => {
    if (allowed[file]) return;
    const code = readSrc(file);
    services.forEach((service) => {
      // Match the member-access form, not the bare word: several files legitimately
      // NAME these services in prose explaining why they are confined to the adapter.
      assert.equal(
        new RegExp(`\\b${service}\\s*\\.`).test(code),
        false,
        `${file} references ${service}; it belongs behind a port`,
      );
    });
  });
});

test('Google People synchronization is not implemented anywhere', () => {
  // Scoped to a later pass. contactSyncStatus reports not_configured rather than
  // implying a sync that nobody wrote.
  SOURCES.forEach((file) => {
    const code = readSrc(file);
    assert.equal(/People\.|PeopleApi|peopleService/.test(code), false, `${file} touches Google People`);
  });
});

/* ── No environment values in the repository ──────────────────────────────── */

test('no source file contains an email address', () => {
  SOURCES.forEach((file) => {
    const code = readSrc(file);
    const found = code.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    assert.deepEqual(found, [], `${file} contains an address: ${found.join(', ')}`);
  });
});

test('no source file contains a Google resource id or a script URL', () => {
  SOURCES.forEach((file) => {
    const code = readSrc(file);
    assert.equal(/script\.google\.com/.test(code), false, `${file} contains a script URL`);
    assert.equal(/AKfycb[A-Za-z0-9_-]+/.test(code), false, `${file} contains a deployment id`);
    assert.equal(/\b1[A-Za-z0-9_-]{40,}\b/.test(code), false, `${file} contains a Drive-style id`);
    assert.equal(/@group\.calendar\.google\.com/.test(code), false, `${file} contains a calendar id`);
  });
});

test('.clasp.json is gitignored and never tracked', () => {
  /*
   * The problem is not filesystem presence — during active staging work the file
   * legitimately exists on disk. The actual failure mode is accidental commitment:
   * a committed .clasp.json would expose the Script ID in the public repository and
   * lock every clasp operation to the staging project.
   *
   * Two conditions must hold:
   *   1. The .gitignore pattern exists. Without it, `git add .` would silently track
   *      the file the next time anyone stages a broad set of changes.
   *   2. The file is not currently tracked. A tracked file is not subject to .gitignore,
   *      so the pattern alone is not sufficient once the file has been added.
   */
  const repoRoot = execSync('git rev-parse --show-toplevel', { cwd: ROOT, encoding: 'utf8' }).trim();

  const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  assert.ok(
    gitignore.includes('scripts/gas-v2/.clasp.json'),
    'scripts/gas-v2/.clasp.json must be listed in the root .gitignore — without this, a broad git add would track it',
  );

  const tracked = execSync('git ls-files -- scripts/gas-v2/.clasp.json', { cwd: repoRoot, encoding: 'utf8' }).trim();
  assert.equal(tracked, '', '.clasp.json must not be tracked by git (git ls-files returned a result)');
});

test('configuration is read by property name, with no defaults standing in', () => {
  const ctx = load();
  const config = ctx.readConfig({ get: () => '' });

  assert.equal(config.sheetId, '');
  assert.equal(config.calendarId, '');
  assert.equal(config.replyTo, '');
  assert.deepEqual(Object.keys(config.partnerEmailMap), []);
  // An unset run mode must not default to live.
  assert.equal(config.runMode, 'dry_run');
});

test('every capability reports itself unconfigured on an empty environment', () => {
  const ctx = load();
  const config = ctx.readConfig({ get: () => '' });
  ['intake', 'notify', 'acknowledge', 'booking'].forEach((capability) => {
    assert.equal(ctx.isConfigured(config, capability), false, `${capability} claimed to be configured`);
  });
});

/* ── The manifest ─────────────────────────────────────────────────────────── */

test('the manifest is valid JSON and runs on V8', () => {
  const manifest = JSON.parse(readRoot('appsscript.json'));
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.ok(manifest.timeZone);
});

test('the manifest requests no scope the code does not use', () => {
  const manifest = JSON.parse(readRoot('appsscript.json'));
  const scopes = manifest.oauthScopes || [];
  const allSource = SOURCES.map(readSrc).join('\n');

  const requires = {
    'https://www.googleapis.com/auth/spreadsheets': /SpreadsheetApp/,
    'https://www.googleapis.com/auth/calendar': /CalendarApp/,
    'https://www.googleapis.com/auth/script.send_mail': /MailApp/,
  };

  Object.keys(requires).forEach((scope) => {
    if (scopes.indexOf(scope) === -1) return;
    assert.equal(requires[scope].test(allSource), true, `scope ${scope} is requested but unused`);
  });
});

test('the manifest does not request a contacts scope', () => {
  // Contact sync is a later pass. Asking for the scope now would prompt the owner to
  // grant access to something nothing uses.
  const manifest = JSON.parse(readRoot('appsscript.json'));
  (manifest.oauthScopes || []).forEach((scope) => {
    assert.equal(scope.indexOf('contacts') === -1, true, `unused contacts scope requested: ${scope}`);
  });
});

/* ── The scope set is pinned, not merely plausible ────────────────────────── */

/**
 * The exact scopes this backend may request.
 *
 * Kept as an explicit list rather than derived, because the point is to make widening it
 * a deliberate edit that a reviewer sees. Each entry names the only API that justifies it.
 */
const ALLOWED_SCOPES = [
  // SpreadsheetApp: the six storage tabs.
  'https://www.googleapis.com/auth/spreadsheets',
  // CalendarApp: availability reads and booking events.
  'https://www.googleapis.com/auth/calendar',
  // MailApp.sendEmail, and nothing more.
  'https://www.googleapis.com/auth/script.send_mail',
];

test('the manifest requests EXACTLY the minimal scope set', () => {
  /*
   * WHY THIS IS AN EXACT-SET TEST. The prior check only validated scopes it already knew
   * about, so an extra scope simply fell through its loop unexamined. The manifest carried
   * `https://mail.google.com/` — full read, send, and delete access to the deploying
   * account's entire mailbox — and every suite passed. A test that cannot fail on an
   * unexpected entry is not guarding the thing it appears to guard.
   */
  const manifest = JSON.parse(readRoot('appsscript.json'));
  const scopes = (manifest.oauthScopes || []).slice().sort();

  assert.deepEqual(scopes, ALLOWED_SCOPES.slice().sort());
});

test('no broad mail scope is ever requested', () => {
  // Named separately so the failure says what is wrong rather than printing two lists.
  // MailApp.sendEmail needs script.send_mail; it never needs mailbox access.
  const manifest = JSON.parse(readRoot('appsscript.json'));
  (manifest.oauthScopes || []).forEach((scope) => {
    assert.equal(
      scope === 'https://mail.google.com/',
      false,
      'https://mail.google.com/ grants full mailbox access; MailApp only needs script.send_mail',
    );
    assert.equal(scope.indexOf('gmail') === -1, true, `unexpected Gmail scope: ${scope}`);
  });
});

test('every requested scope is backed by an API the code actually calls', () => {
  const manifest = JSON.parse(readRoot('appsscript.json'));
  const allSource = SOURCES.map(readSrc).join('\n');

  const backedBy = {
    'https://www.googleapis.com/auth/spreadsheets': /\bSpreadsheetApp\b/,
    'https://www.googleapis.com/auth/calendar': /\bCalendarApp\b/,
    'https://www.googleapis.com/auth/script.send_mail': /\bMailApp\b/,
  };

  (manifest.oauthScopes || []).forEach((scope) => {
    const pattern = backedBy[scope];
    assert.ok(pattern, `scope ${scope} has no documented justification`);
    assert.equal(pattern.test(allSource), true, `scope ${scope} is requested but unused`);
  });
});

test('scopes for APIs the code does not call are absent', () => {
  /*
   * The removed three, each verified unused before removal:
   *   script.scriptapp        ScriptApp: 0 occurrences. Triggers are created by hand in
   *                           the UI, which does not require the script to hold it.
   *   script.external_request UrlFetchApp: 0 occurrences. Nothing calls out.
   *   calendar.events         redundant: a strict subset of the calendar scope above.
   */
  const manifest = JSON.parse(readRoot('appsscript.json'));
  const scopes = manifest.oauthScopes || [];
  const allSource = SOURCES.map(readSrc).join('\n');

  const removed = {
    'https://www.googleapis.com/auth/script.scriptapp': /\bScriptApp\b/,
    'https://www.googleapis.com/auth/script.external_request': /\bUrlFetchApp\b/,
  };

  Object.keys(removed).forEach((scope) => {
    assert.equal(scopes.indexOf(scope), -1, `${scope} was removed and must stay removed`);
    // And it must stay unused: reintroducing the API without the scope is also a defect.
    assert.equal(
      removed[scope].test(allSource),
      false,
      `${scope} is absent from the manifest but its API is now used`,
    );
  });

  assert.equal(
    scopes.indexOf('https://www.googleapis.com/auth/calendar.events'),
    -1,
    'calendar.events is redundant alongside the calendar scope',
  );
});

test('the Advanced Calendar service is enabled and its symbol is used', () => {
  /*
   * Calendar.Events.insert (the Advanced Calendar API v3) is required to request a
   * Google Meet link via conferenceData.createRequest. The service is enabled here and
   * used in GoogleServices.js; the old test asserted the opposite, when the manifest
   * had enabled it while the code still used only CalendarApp. That inverse is now wrong.
   *
   * The rule that remains: an advanced service must be enabled if its symbol appears,
   * and its symbol must appear if it is enabled. Both directions are checked.
   */
  const manifest = JSON.parse(readRoot('appsscript.json'));
  const advanced = (manifest.dependencies || {}).enabledAdvancedServices || [];
  const allSource = SOURCES.map(readSrc).join('\n');

  // The Advanced Calendar service must be in the manifest.
  const calService = advanced.find((s) => s.serviceId === 'calendar');
  assert.ok(calService, 'the Advanced Calendar service (calendar v3) must be enabled in appsscript.json');
  assert.equal(calService.userSymbol, 'Calendar', 'userSymbol must be "Calendar"');
  assert.equal(calService.version, 'v3', 'version must be "v3"');

  // The symbol must also appear in source — enabled-but-unused is its own failure.
  assert.equal(
    /\bCalendar\s*\.\s*[A-Z]/.test(allSource),
    true,
    'the Advanced Calendar service is enabled but its symbol is not used in any source file',
  );

  // No other advanced service is enabled; widening it further is a deliberate decision.
  assert.equal(advanced.length, 1, `only the Calendar advanced service should be enabled, found: ${JSON.stringify(advanced)}`);
});

/* ── V1 is untouched ──────────────────────────────────────────────────────── */

test('the V1 backend is a separate directory that this pass does not import', () => {
  SOURCES.forEach((file) => {
    const code = readSrc(file);
    assert.equal(code.indexOf('scripts/gas/'), -1, `${file} references the V1 directory`);
    assert.equal(code.indexOf('Code.gs'), -1, `${file} references Code.gs`);
  });
});
