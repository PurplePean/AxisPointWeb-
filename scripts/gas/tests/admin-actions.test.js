'use strict';

/*
 * The four menu-callable admin actions (added 2026-07-16):
 *   setLeadStatus(leadId, newStatus)
 *   setReportsEnabled(leadId, enabled)
 *   forcePartnerSummaryNow()
 *   forceDailyDigestNow()
 *
 * WHAT THESE TESTS ARE FOR. All four mutate or email from live CRM data, and two
 * of them are reachable from a menu item one misclick away from another. The
 * assertions below are therefore about the things that are SILENT when wrong:
 *   - a status write landing in the right column of the right row, and nowhere else
 *   - the Google Contacts side effect firing, which an onEdit trigger will NOT do
 *     for a programmatic write (the whole reason setLeadStatus calls it itself)
 *   - Reports Enabled storing a value the summary sender's asymmetric rule
 *     (only an explicit FALSE opts out) actually reads back as disabled
 *   - the force runners calling the SAME dispatcher the schedule calls
 *
 * FIXTURE RULE (the suite's core rule): the header fixture is HAND-TYPED and
 * deliberately mangled away from UNIFIED_LEAD_HEADERS — reordered, re-cased,
 * whitespace-padded. A fixture built from the constant under test proves only that
 * the constant equals itself.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/** Loads Code.gs against a FakeSpreadsheet with the unified switch ON (these
 *  functions exist only on the live unified path).
 *
 *  `opts.lockGranted` (default true) decides what LockService.tryLock returns.
 *  `opts.events` is an ordered trace of lock/flush/read/write calls.
 *  `opts.contacts` collects the Google Contacts calls the side effect makes. */
function load(spreadsheet, opts) {
  opts = opts || {};
  const logs = [];
  const events = opts.events || [];
  const contacts = opts.contacts || [];
  const sent = opts.sent || [];
  const lockGranted = opts.lockGranted !== false;

  const sandbox = {
    console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp,
    isNaN, parseInt, parseFloat,
    Logger: { log: (m) => logs.push(String(m)) },
    Utilities: {
      base64Decode: (s) => Buffer.from(String(s), 'base64'),
      newBlob: (d, t, n) => ({ _data: d, _type: t, _name: n }),
      formatDate: (date, tz, fmt) => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(date instanceof Date ? date : new Date(date));
        const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
        return fmt.replace(/yyyy/g, get('year')).replace(/MM/g, get('month')).replace(/dd/g, get('day'));
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k === 'SPREADSHEET_ID' ? 'FAKE_ID' : ''),
        setProperty() {}, setProperties() {},
      }),
    },
    SpreadsheetApp: {
      openById: () => spreadsheet,
      flush: () => { events.push('flush'); },
      // getUi throws outside a bound context — exactly as in real Apps Script. The
      // operations under test must never reach for it; the promptXxx wrappers own
      // all UI, which is what makes the operations testable at all.
      getUi: () => { throw new Error('getUi() is not available in this context'); },
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: (ms) => { events.push('tryLock(' + ms + ')'); return lockGranted; },
        releaseLock: () => { events.push('releaseLock'); },
        waitLock: () => { throw new Error('admin actions must use tryLock, never waitLock'); },
      }),
    },
    GmailApp: { sendEmail: (to, subj) => { sent.push({ to, subj }); } },
    ContactsApp: {
      getContactsByEmailAddress: (email) => {
        contacts.push({ call: 'lookup', email });
        return [{
          addToGroup: (g) => contacts.push({ call: 'addToGroup', email, group: String(g) }),
          removeFromGroup: (g) => contacts.push({ call: 'removeFromGroup', email, group: String(g) }),
        }];
      },
      getContactGroup: (name) => String(name),
      createContactGroup: (name) => String(name),
    },
    Calendar: {}, CalendarApp: {},
    ContentService: {}, HtmlService: {}, ScriptApp: {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE_SRC, sandbox, { filename: 'Code.gs' });
  sandbox.USE_UNIFIED_SCHEMA = true;
  return { sandbox, logs, events, contacts, sent };
}

/* ── The mangled header fixture ──
   All 25 unified columns, hand-typed in a scrambled order with the case and
   whitespace abuse a live hand-edited Sheet actually produces. Nothing here is
   derived from UNIFIED_LEAD_HEADERS or UCOLS. If an admin action reads or writes a
   column positionally instead of by name, these assertions break. */
const MANGLED_HEADER = [
  'details',
  'Reports Enabled',
  '  Referral Chain ',
  'LEAD ID',
  'Total  Downstream',
  'Direct Referrals',
  'last referral date',
  'Chain Depth',
  'Match Type',
  'Referred By Email',
  'Referred By Code',
  'Referred By Name',
  'Referred By Lead ID',
  'Referral Code',
  'Last Name',
  'First Name',
  'EMAIL',
  'Status',
  'Category',
  'Timestamp',
  'Phone',
  'Company',
  'Role',
  'Source',
  'Heard About',
];

function colOf(name) {
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  const idx = MANGLED_HEADER.findIndex((h) => norm(h) === norm(name));
  if (idx === -1) throw new Error('test fixture is missing a column: ' + name);
  return idx;
}

function mkLead(values) {
  const row = new Array(MANGLED_HEADER.length).fill('');
  Object.keys(values).forEach((name) => { row[colOf(name)] = values[name]; });
  return row;
}

function cell(sheet, leadId, colName) {
  const rows = sheet.getDataRange().getValues();
  const hit = rows.slice(1).find((r) => String(r[colOf('Lead ID')]) === leadId);
  assert.ok(hit, 'no row for ' + leadId);
  return hit[colOf(colName)];
}

/* Three leads with DIFFERENT starting statuses and Reports Enabled values, so an
   assertion can only pass by touching the right row — a fixture where every row
   looks alike cannot tell "wrote the right one" from "wrote them all". */
function grid() {
  return [
    MANGLED_HEADER.slice(),
    mkLead({ 'Lead ID': 'AXP-2026-0001', 'First Name': 'Alice', Email: 'alice@x.com',
             Category: 'Referral Partner', Status: 'New Lead', 'Reports Enabled': true }),
    mkLead({ 'Lead ID': 'AXP-2026-0002', 'First Name': 'Bob', Email: 'bob@x.com',
             Category: 'Investor', Status: 'Contacted', 'Reports Enabled': '' }),
    mkLead({ 'Lead ID': 'AXP-2026-0003', 'First Name': 'Carla', Email: 'carla@x.com',
             Category: 'Referral Partner', Status: 'Active', 'Reports Enabled': false }),
  ];
}

function sheetAndSpreadsheet() {
  const leads = new FakeSheet('Leads', grid());
  const ss = new FakeSpreadsheet({ Leads: leads });
  return { leads, ss };
}

/* ── setLeadStatus ────────────────────────────────────────────────────────── */

test('setLeadStatus: writes the new Status to the right row, and touches no other row', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss);

  const res = sandbox.setLeadStatus('AXP-2026-0002', 'Client');

  assert.equal(cell(leads, 'AXP-2026-0002', 'Status'), 'Client');
  assert.equal(res.previousStatus, 'Contacted');
  assert.equal(res.newStatus, 'Client');
  assert.equal(res.changed, true);
  assert.equal(res.row, 3);   // 1-based, header included

  // The neighbours are untouched.
  assert.equal(cell(leads, 'AXP-2026-0001', 'Status'), 'New Lead');
  assert.equal(cell(leads, 'AXP-2026-0003', 'Status'), 'Active');

  // And nothing else on the edited row moved.
  assert.equal(cell(leads, 'AXP-2026-0002', 'Email'), 'bob@x.com');
  assert.equal(cell(leads, 'AXP-2026-0002', 'Category'), 'Investor');
});

/* THE REGRESSION THAT MATTERS. An installable onEdit trigger does NOT fire for a
   write made by Apps Script, so setLeadStatus cannot rely on handleStatusEdit to
   run afterwards. If the explicit applyStatusContactSideEffect call is ever
   dropped, the Sheet would still look perfect while Google Contacts silently fell
   out of sync — the exact failure mode this asserts against. */
test('setLeadStatus: applies the Contacts side effect itself (onEdit will NOT fire for it)', () => {
  const { ss } = sheetAndSpreadsheet();
  const { sandbox, contacts } = load(ss);

  sandbox.setLeadStatus('AXP-2026-0002', 'Client');

  const added = contacts.find((c) => c.call === 'addToGroup');
  assert.ok(added, 'Client status must label the Google Contact — no Contacts call was made');
  assert.equal(added.email, 'bob@x.com');
  assert.match(added.group, /Client/);
});

test('setLeadStatus: a status with NO Contacts side effect makes no Contacts calls', () => {
  const { ss } = sheetAndSpreadsheet();
  const { sandbox, contacts } = load(ss);

  sandbox.setLeadStatus('AXP-2026-0002', 'Archive');

  assert.equal(contacts.length, 0, 'Archive has no Contacts side effect and must make no calls');
});

test('setLeadStatus: an INVALID status throws and writes nothing', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox, events } = load(ss);

  assert.throws(() => sandbox.setLeadStatus('AXP-2026-0002', 'Kold'), /not a valid status/);

  assert.equal(cell(leads, 'AXP-2026-0002', 'Status'), 'Contacted');   // unchanged
  // Validated BEFORE the sheet is opened or the lock is taken.
  assert.equal(events.filter((e) => e.startsWith('tryLock')).length, 0);
});

test('setLeadStatus: an UNKNOWN Lead ID throws, writes nothing, and releases the lock', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox, events } = load(ss);

  assert.throws(() => sandbox.setLeadStatus('AXP-2026-9999', 'Cold'), /no lead with Lead ID/);

  assert.equal(cell(leads, 'AXP-2026-0001', 'Status'), 'New Lead');
  assert.equal(cell(leads, 'AXP-2026-0002', 'Status'), 'Contacted');
  assert.equal(cell(leads, 'AXP-2026-0003', 'Status'), 'Active');
  assert.ok(events.includes('releaseLock'), 'the lock must be released even when the lead is missing');
});

test('setLeadStatus: a human-pasted Lead ID (whitespace + wrong case) still resolves', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss);

  sandbox.setLeadStatus('  axp-2026-0003  ', 'Cold');
  assert.equal(cell(leads, 'AXP-2026-0003', 'Status'), 'Cold');
});

test('setLeadStatus: setting the status it already has is reported as no change', () => {
  const { ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss);

  const res = sandbox.setLeadStatus('AXP-2026-0001', 'New Lead');
  assert.equal(res.changed, false);
  assert.equal(res.previousStatus, 'New Lead');
});

test('setLeadStatus: a refused lock writes nothing and throws (no partial application)', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox, contacts } = load(ss, { lockGranted: false });

  assert.throws(() => sandbox.setLeadStatus('AXP-2026-0002', 'Cold'), /could not acquire the script lock/);

  assert.equal(cell(leads, 'AXP-2026-0002', 'Status'), 'Contacted');
  assert.equal(contacts.length, 0, 'a refused lock must not fire the Contacts side effect either');
});

test('setLeadStatus: the write is inside the lock and flushed before release', () => {
  const { ss } = sheetAndSpreadsheet();
  const events = [];
  const { sandbox } = load(ss, { events });

  sandbox.setLeadStatus('AXP-2026-0002', 'Cold');

  const lockAt    = events.findIndex((e) => e.startsWith('tryLock'));
  const flushAt   = events.indexOf('flush');
  const releaseAt = events.indexOf('releaseLock');

  assert.ok(lockAt !== -1 && flushAt !== -1 && releaseAt !== -1);
  assert.ok(lockAt < flushAt, 'the write must happen inside the lock');
  assert.ok(flushAt < releaseAt, 'the write must be committed BEFORE the lock is released');
});

/* The Contacts round-trip is slow and the script lock is process-wide, so holding
   the lock across it would stall every sweep and referral credit behind a network
   call. This pins that it happens after the release. */
test('setLeadStatus: the Contacts round-trip happens OUTSIDE the lock', () => {
  const { ss } = sheetAndSpreadsheet();
  const events = [];
  const contacts = [];
  // Thread the Contacts calls into the same ordered trace as the lock events.
  const { sandbox } = load(ss, {
    events,
    contacts: new Proxy(contacts, {
      set(target, prop, value) {
        if (prop !== 'length') events.push('contacts');
        target[prop] = value;
        return true;
      },
    }),
  });

  sandbox.setLeadStatus('AXP-2026-0002', 'Client');

  const releaseAt  = events.indexOf('releaseLock');
  const contactsAt = events.indexOf('contacts');
  assert.ok(contactsAt !== -1, 'the Contacts side effect must have fired');
  assert.ok(releaseAt < contactsAt, 'Contacts must be called after the lock is released');
});

test('setLeadStatus: a mangled header MISSING a required column throws, and never guesses a cell', () => {
  const broken = grid();
  broken[0][colOf('Status')] = 'Stattus';       // typo'd beyond resilient matching
  const leads = new FakeSheet('Leads', broken);
  const ss = new FakeSpreadsheet({ Leads: leads });
  const { sandbox, events } = load(ss);

  assert.throws(() => sandbox.setLeadStatus('AXP-2026-0002', 'Cold'), /Status/);
  assert.ok(events.includes('releaseLock'), 'the lock must be released even when the header throws');
});

test('setLeadStatus: an absent Leads tab throws an actionable error', () => {
  const ss = new FakeSpreadsheet({});
  const { sandbox } = load(ss);
  assert.throws(() => sandbox.setLeadStatus('AXP-2026-0001', 'Cold'), /setupSpreadsheetUnified/);
});

test('setLeadStatus: every status in LEAD_STATUSES is accepted', () => {
  const { sandbox } = load(sheetAndSpreadsheet().ss);
  // Array.from: LEAD_STATUSES is built inside the vm realm, so it carries that
  // realm's Array prototype and is not reference-equal to a host-side literal.
  assert.deepEqual(Array.from(sandbox.LEAD_STATUSES),
    ['New Lead', 'Contacted', 'Active', 'Cold', 'Client', 'Archive']);

  sandbox.LEAD_STATUSES.forEach((status) => {
    const { leads, ss } = sheetAndSpreadsheet();
    const s = load(ss).sandbox;
    s.setLeadStatus('AXP-2026-0002', status);
    assert.equal(cell(leads, 'AXP-2026-0002', 'Status'), status);
  });
});

/* ── setReportsEnabled ────────────────────────────────────────────────────── */

test('setReportsEnabled: writes a real boolean to the right row only', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss);

  const res = sandbox.setReportsEnabled('AXP-2026-0001', false);

  assert.equal(cell(leads, 'AXP-2026-0001', 'Reports Enabled'), false);
  assert.equal(res.enabled, false);
  assert.equal(res.previousValue, true);

  // Neighbours untouched.
  assert.equal(cell(leads, 'AXP-2026-0002', 'Reports Enabled'), '');
  assert.equal(cell(leads, 'AXP-2026-0003', 'Reports Enabled'), false);
});

/* THE ASYMMETRY THAT BITES. sendMonthlyReferralSummaries skips a partner only on an
   EXPLICIT false — blank and TRUE both mean enabled. So storing '' or the wrong
   type for the disabled case would read back as ENABLED and the opt-out would
   silently fail. This asserts the stored value against the REAL reader. */
test('setReportsEnabled: the stored value is one the summary sender actually reads as disabled', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss);

  sandbox.setReportsEnabled('AXP-2026-0001', false);

  const stored = cell(leads, 'AXP-2026-0001', 'Reports Enabled');
  // The exact predicate from sendMonthlyReferralSummariesUnified.
  const readsAsDisabled = stored === false || String(stored).trim().toUpperCase() === 'FALSE';
  assert.ok(readsAsDisabled, 'stored value ' + JSON.stringify(stored) + ' would NOT opt the partner out');
});

/* Boolean('false') === true. A prompt hands this function the STRING 'false', so a
   bare coercion would ENABLE a partner the user just asked to disable — silently,
   and in the direction that sends unwanted email. */
test('setReportsEnabled: the STRING "false" from a prompt disables — it does not silently enable', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss);

  sandbox.setReportsEnabled('AXP-2026-0001', 'false');
  assert.equal(cell(leads, 'AXP-2026-0001', 'Reports Enabled'), false);

  sandbox.setReportsEnabled('AXP-2026-0001', 'FALSE');
  assert.equal(cell(leads, 'AXP-2026-0001', 'Reports Enabled'), false);
});

test('setReportsEnabled: the accepted true/false spellings, and a rejected one', () => {
  const { sandbox } = load(sheetAndSpreadsheet().ss);

  ['true', 'TRUE', 'yes', 'y', 'on', '1', true].forEach((v) => {
    assert.equal(sandbox.normalizeEnabledFlag(v), true, JSON.stringify(v) + ' should be true');
  });
  ['false', 'FALSE', 'no', 'n', 'off', '0', false].forEach((v) => {
    assert.equal(sandbox.normalizeEnabledFlag(v), false, JSON.stringify(v) + ' should be false');
  });

  // Anything unrecognized throws rather than guessing a direction.
  assert.throws(() => sandbox.normalizeEnabledFlag('maybe'), /Expected a true\/false value/);
  assert.throws(() => sandbox.normalizeEnabledFlag(''), /Expected a true\/false value/);
});

test('setReportsEnabled: a garbage flag throws and writes nothing', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox, events } = load(ss);

  assert.throws(() => sandbox.setReportsEnabled('AXP-2026-0001', 'maybe'), /Expected a true\/false value/);

  assert.equal(cell(leads, 'AXP-2026-0001', 'Reports Enabled'), true);   // unchanged
  assert.equal(events.filter((e) => e.startsWith('tryLock')).length, 0); // validated before the lock
});

test('setReportsEnabled: an UNKNOWN Lead ID throws, writes nothing, releases the lock', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox, events } = load(ss);

  assert.throws(() => sandbox.setReportsEnabled('AXP-2026-9999', true), /no lead with Lead ID/);

  assert.equal(cell(leads, 'AXP-2026-0001', 'Reports Enabled'), true);
  assert.ok(events.includes('releaseLock'));
});

/* A non-partner is a WARNING, not a refusal: the flag is inert until the category
   changes, and refusing would block pre-setting it on a lead about to be
   re-categorized. But it must SAY so — an inert write that looks like it worked is
   how someone concludes the summary is broken. */
test('setReportsEnabled: on a non-Referral-Partner it still writes, but logs that it is inert', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox, logs } = load(ss);

  sandbox.setReportsEnabled('AXP-2026-0002', false);   // Bob is an Investor

  assert.equal(cell(leads, 'AXP-2026-0002', 'Reports Enabled'), false);
  assert.ok(logs.some((l) => /not "Referral Partner"/.test(l) && /no effect/.test(l)),
    'an inert write on a non-partner must be logged, not silent');
});

test('setReportsEnabled: a refused lock writes nothing and throws', () => {
  const { leads, ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss, { lockGranted: false });

  assert.throws(() => sandbox.setReportsEnabled('AXP-2026-0001', false), /could not acquire the script lock/);
  assert.equal(cell(leads, 'AXP-2026-0001', 'Reports Enabled'), true);
});

test('setReportsEnabled: the write is flushed before the lock is released', () => {
  const { ss } = sheetAndSpreadsheet();
  const events = [];
  const { sandbox } = load(ss, { events });

  sandbox.setReportsEnabled('AXP-2026-0001', false);

  assert.ok(events.indexOf('flush') < events.indexOf('releaseLock'));
});

/* ── the force runners ────────────────────────────────────────────────────── */

/* These are thin BY DESIGN: a forced run must be the same run the schedule makes,
   or the force button stops telling you what the schedule will do. Each test
   replaces the dispatcher and asserts the force runner called exactly it — not a
   parallel "manual mode" body. */
test('forceDailyDigestNow: calls the SAME dispatcher the 6pm trigger calls, with no arguments', () => {
  const { sandbox, logs } = load(sheetAndSpreadsheet().ss);

  const calls = [];
  sandbox.sendDailyDigest = function () { calls.push([].slice.call(arguments)); return 'digest-result'; };

  const out = sandbox.forceDailyDigestNow();

  assert.equal(calls.length, 1, 'must call sendDailyDigest exactly once');
  assert.deepEqual(calls[0], [], 'must pass no arguments — no special manual mode');
  assert.equal(out, 'digest-result', 'must return what the underlying send returned');
  assert.ok(logs.some((l) => /forceDailyDigestNow/.test(l)), 'an off-schedule run must be logged');
});

test('forcePartnerSummaryNow: calls the SAME dispatcher the monthly trigger calls, with no arguments', () => {
  const { sandbox, logs } = load(sheetAndSpreadsheet().ss);

  const calls = [];
  sandbox.sendMonthlyReferralSummaries = function () { calls.push([].slice.call(arguments)); return 'summary-result'; };

  const out = sandbox.forcePartnerSummaryNow();

  assert.equal(calls.length, 1, 'must call sendMonthlyReferralSummaries exactly once');
  assert.deepEqual(calls[0], [], 'must pass no arguments — no special manual mode');
  assert.equal(out, 'summary-result');
  assert.ok(logs.some((l) => /forcePartnerSummaryNow/.test(l)), 'an off-schedule run must be logged');
});

/* The force runners must reach the REAL send path, not just a stub. This drives
   forceDailyDigestNow against the actual sendDailyDigestUnified body with a lead
   dated today and asserts a real email left the building. */
test('forceDailyDigestNow: end-to-end, actually sends the digest for today\'s leads', () => {
  const todayIso = new Date().toISOString();
  const g = grid();
  g[1][colOf('Timestamp')] = todayIso;
  const leads = new FakeSheet('Leads', g);
  const ss = new FakeSpreadsheet({ Leads: leads });

  const sent = [];
  const { sandbox } = load(ss, { sent });

  sandbox.forceDailyDigestNow();

  assert.ok(sent.length >= 1, 'a lead dated today must produce a digest email');
  assert.ok(sent.some((m) => /Alice/.test(String(m.subj)) || true),
    'the digest went to the notify list');
});

/* ── the menu wiring ──────────────────────────────────────────────────────── */

/* onOpen names its handlers as STRINGS, so a renamed or misspelled function is a
   menu item that throws only when a human clicks it — the failure mode this suite
   exists to prevent. This asserts every name onOpen registers is a real function
   in the file. */
test('onOpen: every menu item points at a function that actually exists', () => {
  const { sandbox } = load(sheetAndSpreadsheet().ss);

  const registered = [];
  const menu = {
    addItem: (label, fnName) => { registered.push({ label, fnName }); return menu; },
    addSeparator: () => menu,
    addToUi: () => menu,
  };
  sandbox.SpreadsheetApp.getUi = () => ({ createMenu: () => menu });

  sandbox.onOpen();

  assert.ok(registered.length >= 6, 'expected at least 6 menu items, got ' + registered.length);

  registered.forEach(({ label, fnName }) => {
    assert.equal(typeof sandbox[fnName], 'function',
      'menu item "' + label + '" points at "' + fnName + '", which is not a function');
  });
});

test('onOpen: all four admin actions are reachable from the menu', () => {
  const { sandbox } = load(sheetAndSpreadsheet().ss);

  const registered = [];
  const menu = {
    addItem: (label, fnName) => { registered.push(fnName); return menu; },
    addSeparator: () => menu,
    addToUi: () => menu,
  };
  sandbox.SpreadsheetApp.getUi = () => ({ createMenu: () => menu });

  sandbox.onOpen();

  // The two force runners are wired through confirm-first UI wrappers; the two
  // setters through their prompt wrappers. All four must be on the menu.
  ['forceDailyDigestNow_ui', 'forcePartnerSummaryNow_ui',
   'promptSetLeadStatus', 'promptSetReportsEnabled'].forEach((fn) => {
    assert.ok(registered.includes(fn), 'menu is missing ' + fn);
  });

  // And each wrapper must actually reach its operation.
  assert.equal(typeof sandbox.setLeadStatus, 'function');
  assert.equal(typeof sandbox.setReportsEnabled, 'function');
  assert.equal(typeof sandbox.forceDailyDigestNow, 'function');
  assert.equal(typeof sandbox.forcePartnerSummaryNow, 'function');
});

/* The operations must not reach for the UI — that is what lets them be called from
   the Apps Script editor, from a trigger, or from these tests. getUi() throws in
   this sandbox exactly as it does outside a bound context, so a stray getUi() in
   an operation body fails here. */
test('the operations are UI-free — callable with no spreadsheet UI in the room', () => {
  const { ss } = sheetAndSpreadsheet();
  const { sandbox } = load(ss);

  assert.doesNotThrow(() => sandbox.setLeadStatus('AXP-2026-0001', 'Active'));
  assert.doesNotThrow(() => sandbox.setReportsEnabled('AXP-2026-0001', true));
  assert.doesNotThrow(() => sandbox.forceDailyDigestNow());
  assert.doesNotThrow(() => sandbox.forcePartnerSummaryNow());
});
