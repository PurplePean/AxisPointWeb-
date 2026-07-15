'use strict';

/*
 * setupSpreadsheetUnified — the unified-schema rewrite (migration Stage 9).
 *
 * This is the manual admin function, run BY HAND from the Apps Script editor at
 * cutover, that makes the Leads tab exist for the first time. It is NOT a dispatcher
 * on USE_UNIFIED_SCHEMA (a switch-gated setup would create the LEGACY tabs while the
 * switch is still off — exactly backwards, since the Leads tab must exist BEFORE the
 * switch flips). It is a separate, explicitly-named entry point; legacy
 * setupSpreadsheet() is left untouched and still creates the 11 legacy tabs.
 *
 * The two things that matter here, and that this suite pins:
 *   1. It creates EXACTLY Leads + Referrals + Subscribers, with the right headers —
 *      Leads on the 25-column unified schema (Details included), Referrals and
 *      Subscribers on their own UNCHANGED schemas.
 *   2. It NEVER touches a tab that already holds data (the getLastRow() === 0 guard),
 *      the same Sheet-safety rule the legacy function has always followed.
 *
 * FIXTURE RULE: the expected headers are asserted against HAND-TYPED lists, not
 * imported from the sandbox constants — a header check built from the constant it is
 * checking proves only that the constant equals itself. (This is the write-side
 * mirror of every reader suite's mangled-header rule.) Sandbox values are lifted with
 * Array.from before deep comparison, per the cross-realm trap in load-code.js.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCode } = require('./helpers/load-code.js');

/* A minimal Spreadsheet fake that RECORDS tab creation and formatting, so the test
   can prove exactly what was created, in what order, with which header + styling —
   and, critically, what was left alone. Deliberately NOT the FakeSheet used by the
   reader suites: this function's surface is insertSheet / getSheetByName / appendRow /
   getLastRow / a formatting chain, and a purpose-built fake makes the assertions
   about "created vs skipped" direct. */
function makeSheet(name, grid) {
  const rows = (grid || []).map((r) => r.slice());
  const events = [];
  return {
    name,
    rows,
    events,
    getName: () => name,
    getLastRow: () => rows.length,
    appendRow(r) { rows.push(r.slice()); events.push('appendRow'); return this; },
    getRange() {
      // A chainable range whose formatting calls are recorded but inert.
      const chain = {
        setFontWeight() { events.push('setFontWeight'); return chain; },
        setBackground(c) { events.push('setBackground:' + c); return chain; },
        setFontColor() { events.push('setFontColor'); return chain; },
      };
      return chain;
    },
    setFrozenRows() { events.push('setFrozenRows'); return this; },
  };
}

function makeSpreadsheet(existing) {
  const sheets = {};
  const created = [];
  Object.keys(existing || {}).forEach((n) => { sheets[n] = existing[n]; });
  return {
    _sheets: sheets,
    _created: created,
    getSheetByName: (n) => sheets[n] || null,
    insertSheet(n) {
      const s = makeSheet(n, []);
      sheets[n] = s;
      created.push(n);
      return s;
    },
  };
}

/** Loads Code.gs wired to a given spreadsheet, with SPREADSHEET_ID set. */
function load(spreadsheet, opts) {
  opts = opts || {};
  const sandbox = loadCode();
  sandbox.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (k === 'SPREADSHEET_ID' ? (opts.id === undefined ? 'FAKE_ID' : opts.id) : ''),
      setProperty() {}, setProperties() {},
    }),
  };
  sandbox.SpreadsheetApp = { openById: () => spreadsheet };
  return sandbox;
}

/* ── HAND-TYPED expected headers (not imported) ── */
const EXPECTED_LEADS = [
  'Lead ID', 'Timestamp', 'Category', 'Status', 'Email', 'First Name', 'Last Name',
  'Referral Code', 'Referred By Lead ID', 'Referred By Name', 'Referred By Email',
  'Referred By Code', 'Match Type', 'Referral Chain', 'Chain Depth',
  'Direct Referrals', 'Total Downstream', 'Last Referral Date', 'Phone', 'Company',
  'Role', 'Source', 'Heard About', 'Reports Enabled', 'Details',
];
const EXPECTED_REFERRALS = [
  'Referral ID', 'Referrer Lead ID', 'Referrer Name', 'Referrer Email', 'Referrer Code',
  'Referred Lead ID', 'Referred Name', 'Referred Email',
  'Match Type', 'Chain Depth', 'Full Chain', 'Date', 'Status',
];
const EXPECTED_SUBSCRIBERS = ['Email', 'First Name', 'Date Subscribed', 'Preferences', 'Active', 'Last Emailed'];

test('creates EXACTLY Leads + Referrals + Subscribers — three tabs, no lead tabs', () => {
  const ss = makeSpreadsheet({});
  const sandbox = load(ss);

  sandbox.setupSpreadsheetUnified();

  assert.deepEqual(ss._created, ['Leads', 'Referrals', 'Subscribers'],
    'exactly these three, in this order');

  // None of the nine legacy lead tabs may be created.
  ['Active Leads', 'Lifetime Leads', 'Cold Leads', 'Investors', 'Referral Partners',
   'RE Professionals', 'Existing Asset Owners', 'Clients', 'Archive'].forEach((legacy) => {
    assert.equal(ss.getSheetByName(legacy), null, legacy + ' must not be created');
  });
});

test('the Leads tab gets the 25-column unified header, Details included, in order', () => {
  const ss = makeSpreadsheet({});
  const sandbox = load(ss);
  sandbox.setupSpreadsheetUnified();

  const header = Array.from(ss.getSheetByName('Leads').rows[0]);
  assert.deepEqual(header, EXPECTED_LEADS);
  assert.equal(header.length, 25);
  assert.equal(header[header.length - 1], 'Details', 'the JSON blob column is last');
  assert.ok(!header.includes('Message'), 'no top-level Message column');
  assert.ok(!header.includes('Asset Class'), 'no Asset Class column');

  // And it matches the code's own constant, checked separately (hand-typed vs const).
  assert.deepEqual(EXPECTED_LEADS, Array.from(sandbox.UNIFIED_LEAD_HEADERS));
});

test('Referrals and Subscribers keep their OWN unchanged schemas', () => {
  const ss = makeSpreadsheet({});
  const sandbox = load(ss);
  sandbox.setupSpreadsheetUnified();

  assert.deepEqual(Array.from(ss.getSheetByName('Referrals').rows[0]), EXPECTED_REFERRALS);
  assert.deepEqual(Array.from(ss.getSheetByName('Subscribers').rows[0]), EXPECTED_SUBSCRIBERS);

  // Proven equal to the code's constants too — these were never part of the migration.
  assert.deepEqual(EXPECTED_REFERRALS, Array.from(sandbox.REFERRAL_HEADERS));
  assert.deepEqual(EXPECTED_SUBSCRIBERS, Array.from(sandbox.SUBSCRIBER_HEADERS));
});

test('each created tab is styled and frozen (header actually written, not just the tab made)', () => {
  const ss = makeSpreadsheet({});
  const sandbox = load(ss);
  sandbox.setupSpreadsheetUnified();

  ['Leads', 'Referrals', 'Subscribers'].forEach((n) => {
    const ev = ss.getSheetByName(n).events;
    assert.ok(ev.includes('appendRow'), n + ': header row written');
    assert.ok(ev.includes('setFontWeight'), n + ': header bolded');
    assert.ok(ev.some((e) => e.startsWith('setBackground:')), n + ': header colored');
    assert.ok(ev.includes('setFrozenRows'), n + ': header frozen');
  });
});

test('SAFETY: a tab that already holds data is NOT touched', () => {
  // Leads already exists with a data row (and a deliberately DRIFTED header, to prove
  // the guard is about data presence, not header shape). It must be left exactly as
  // is — no re-header, no styling, no clobber.
  const drifted = ['Email', 'Lead ID', 'Details', 'Status'];   // nothing like the canonical order
  const existingLeads = makeSheet('Leads', [drifted, ['a@x.com', 'AXP-1', '{}', 'Active']]);
  const ss = makeSpreadsheet({ Leads: existingLeads });
  const sandbox = load(ss);

  sandbox.setupSpreadsheetUnified();

  // Leads was pre-existing, so it is not in _created; and nothing was written to it.
  assert.ok(!ss._created.includes('Leads'), 'the existing Leads tab must not be recreated');
  assert.deepEqual(Array.from(existingLeads.rows[0]), drifted, 'its header is untouched');
  assert.equal(existingLeads.rows.length, 2, 'its data row is untouched');
  assert.deepEqual(existingLeads.events, [], 'no append, no styling, no freeze on a populated tab');

  // The two absent tabs are still created normally.
  assert.deepEqual(ss._created, ['Referrals', 'Subscribers']);
});

test('idempotent: a second run is all no-ops', () => {
  const ss = makeSpreadsheet({});
  const sandbox = load(ss);

  sandbox.setupSpreadsheetUnified();
  const createdFirst = ss._created.slice();
  ['Leads', 'Referrals', 'Subscribers'].forEach((n) => { ss.getSheetByName(n).events.length = 0; });

  sandbox.setupSpreadsheetUnified();   // again

  assert.deepEqual(ss._created, createdFirst, 'no tab created twice');
  ['Leads', 'Referrals', 'Subscribers'].forEach((n) => {
    assert.deepEqual(ss.getSheetByName(n).events, [], n + ': second run wrote nothing');
    assert.equal(ss.getSheetByName(n).rows.length, 1, n + ': still just the header');
  });
});

test('throws clearly when SPREADSHEET_ID is not configured', () => {
  const ss = makeSpreadsheet({});
  const sandbox = load(ss, { id: '' });
  assert.throws(() => sandbox.setupSpreadsheetUnified(), /setProperties/);
});

test('legacy setupSpreadsheet is UNTOUCHED — still creates the 11 legacy tabs', () => {
  // Needed until cutover. This pins that Stage 9 did not disturb it.
  const ss = makeSpreadsheet({});
  const sandbox = load(ss);

  sandbox.setupSpreadsheet();

  const expected = [
    'Active Leads', 'Lifetime Leads', 'Cold Leads', 'Investors', 'Referral Partners',
    'RE Professionals', 'Existing Asset Owners', 'Clients', 'Archive',
    'Referrals', 'Subscribers',
  ];
  assert.equal(ss._created.length, 11, 'all 11 legacy tabs');
  assert.deepEqual(ss._created.slice().sort(), expected.slice().sort());

  // A legacy lead tab carries the 31-column LEAD_HEADERS, not the unified 25.
  assert.equal(ss.getSheetByName('Investors').rows[0].length, sandbox.LEAD_HEADERS.length);
  assert.equal(sandbox.LEAD_HEADERS.length, 31);
  // Referral Partners gets the extra Reports Enabled column past the 31.
  assert.equal(ss.getSheetByName('Referral Partners').rows[0].length, 32);
});

test('the registry still carries .tab / .tabColor — legacy + delete-at-cutover code reads them', () => {
  // Stage 9 deliberately did NOT remove these: the legacy branch and the §4
  // delete-at-cutover functions still read them, and both survive until cutover.
  // If a well-meaning cleanup removes them early, the legacy tests break — this
  // asserts they are still present so that removal is a conscious cutover step.
  const sandbox = loadCode();
  const LEAD_TYPES = sandbox.LEAD_TYPES;

  assert.equal(LEAD_TYPES.investor.tab, 'Investors');
  assert.equal(LEAD_TYPES.referral.tab, 'Referral Partners');
  assert.ok(LEAD_TYPES.investor.tabColor, 'tabColor still present');
  // submit_referral's tab is null BY DESIGN (asserted here so a cleanup that drops the
  // whole field is distinguishable from the deliberate null).
  assert.equal(LEAD_TYPES.submit_referral.tab, null);

  // And the derived helper still yields the nine legacy lead tabs.
  const names = Array.from(sandbox.leadTabConfigs().map((c) => c.name));
  assert.equal(names.length, 9);
  assert.ok(names.includes('Investors') && names.includes('Archive'));
});
