'use strict';

/*
 * updateReferrerStats — the unified-schema rewrite (migration Stage 1).
 *
 * This is the highest-risk function in the migration: it read-modify-writes a
 * counter, it now writes to MANY rows per submission (one per ancestor), and if
 * it is wrong the referral stats — the number the whole referral product is
 * measured by — are silently wrong. So the tests assert EXACT counter values on
 * EVERY row, never "something incremented".
 *
 * The two counters mean different things and the whole point of this suite is to
 * keep them apart:
 *   Direct Referrals  → immediate referrer ONLY, never propagates up the chain.
 *   Total Downstream  → EVERY ancestor in the Referral Chain, at any depth.
 *
 * FIXTURE RULE (the suite's core rule, restated because it is the one that
 * matters): the header fixture below is HAND-TYPED and deliberately mangled away
 * from UNIFIED_LEAD_HEADERS — reordered, re-cased, whitespace-padded. A fixture
 * built from the constant under test proves only that the constant equals itself.
 * That tautology is what let the 2026-07-08 REPORTS_ENABLED_COL bug through a
 * "passing" harness.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/** Loads Code.gs against a FakeSpreadsheet. `unified` flips USE_UNIFIED_SCHEMA,
 *  the migration's single switch, so both branches of the dispatcher are
 *  testable: the legacy one proves production is still intact today, the unified
 *  one proves the migration is right before it ships. */
function load(spreadsheet, unified) {
  const logs = [];
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
    SpreadsheetApp: { openById: () => spreadsheet },
    GmailApp: { sendEmail() {} },
    ContactsApp: {}, Calendar: {}, CalendarApp: {},
    ContentService: {}, HtmlService: {}, LockService: {}, ScriptApp: {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE_SRC, sandbox, { filename: 'Code.gs' });
  sandbox.USE_UNIFIED_SCHEMA = !!unified;
  return { sandbox, logs };
}

/* ── The mangled header fixture ──
   All 25 unified columns, typed out by hand in a scrambled order, with the case
   and whitespace abuse a live hand-edited Sheet actually produces. Nothing here
   is derived from UNIFIED_LEAD_HEADERS or UCOLS. If the code under test reads a
   column positionally instead of by name, every assertion below breaks. */
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

/** Column index of a header, matched the way a human would (case/space blind).
 *  Independent of the code under test — this is the test's own lookup. */
function colOf(name) {
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  const idx = MANGLED_HEADER.findIndex((h) => norm(h) === norm(name));
  if (idx === -1) throw new Error('test fixture is missing a column: ' + name);
  return idx;
}

/** A Leads row addressed by clean column names, laid out against the mangled header. */
function mkLead(values) {
  const row = new Array(MANGLED_HEADER.length).fill('');
  Object.keys(values).forEach((name) => { row[colOf(name)] = values[name]; });
  return row;
}

/** Reads one cell of one lead row out of the fake sheet, by Lead ID + column name. */
function cell(sheet, leadId, colName) {
  const rows = sheet.getDataRange().getValues();
  const hit = rows.slice(1).find((r) => String(r[colOf('Lead ID')]) === leadId);
  assert.ok(hit, 'no row for ' + leadId);
  return hit[colOf(colName)];
}

function todayCT() {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('month')}/${g('day')}/${g('year')}`;
}

/* A four-generation chain, seeded with NON-ZERO, ALL-DIFFERENT counters so an
   assertion can only pass by incrementing the right row by exactly one. A
   fixture seeded with zeros cannot tell "+1" apart from "= 1".

   ORIGIN ──▶ ALICE ──▶ BOB ──▶ CARLA ──▶ (DANA, the new lead)
   Dana's Referral Chain therefore reads: ORIGIN|ALICE|BOB|CARLA
   and her immediate referrer is CARLA. */
const CHAIN_4 = 'AXP-2026-0001|AXP-2026-0002|AXP-2026-0003|AXP-2026-0004';

function fourDeepSheet() {
  return new FakeSheet('Leads', [
    MANGLED_HEADER.slice(),
    mkLead({ 'Lead ID': 'AXP-2026-0001', 'First Name': 'Origin', Email: 'origin@x.com',
             'Referral Chain': '', 'Chain Depth': 0, 'Direct Referrals': 2, 'Total Downstream': 7 }),
    mkLead({ 'Lead ID': 'AXP-2026-0002', 'First Name': 'Alice', Email: 'alice@x.com',
             'Referral Chain': 'AXP-2026-0001', 'Chain Depth': 1, 'Direct Referrals': 1, 'Total Downstream': 5 }),
    mkLead({ 'Lead ID': 'AXP-2026-0003', 'First Name': 'Bob', Email: 'bob@x.com',
             'Referral Chain': 'AXP-2026-0001|AXP-2026-0002', 'Chain Depth': 2,
             'Direct Referrals': 3, 'Total Downstream': 3 }),
    mkLead({ 'Lead ID': 'AXP-2026-0004', 'First Name': 'Carla', Email: 'carla@x.com',
             'Referral Chain': 'AXP-2026-0001|AXP-2026-0002|AXP-2026-0003', 'Chain Depth': 3,
             'Direct Referrals': 4, 'Total Downstream': 4 }),
    // Dana: the newly-appended lead whose submission triggers the credit. Her own
    // counters must not move — she has referred nobody.
    mkLead({ 'Lead ID': 'AXP-2026-0005', 'First Name': 'Dana', Email: 'dana@x.com',
             'Referral Chain': CHAIN_4, 'Chain Depth': 4, 'Direct Referrals': 0, 'Total Downstream': 0 }),
  ]);
}

test('fixture header is genuinely drifted from the constants it is testing', () => {
  const { sandbox } = load(new FakeSpreadsheet({}), true);
  const { UNIFIED_LEAD_HEADERS, UCOLS } = sandbox;

  assert.equal(MANGLED_HEADER.length, UNIFIED_LEAD_HEADERS.length, 'fixture must cover every column');
  assert.notDeepEqual(MANGLED_HEADER, UNIFIED_LEAD_HEADERS, 'fixture must not equal the constant');

  // And no column happens to sit at its canonical index, so a positional read
  // cannot accidentally pass any test in this file.
  Object.keys(UCOLS).forEach((key) => {
    const canonicalIdx = UCOLS[key];
    assert.notEqual(colOf(UNIFIED_LEAD_HEADERS[canonicalIdx]), canonicalIdx,
      `column "${UNIFIED_LEAD_HEADERS[canonicalIdx]}" must not sit at its canonical index in the fixture`);
  });
});

test('Total Downstream: a 4-deep chain credits EVERY ancestor exactly +1', () => {
  const leads = fourDeepSheet();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.updateReferrerStats('AXP-2026-0004', CHAIN_4);   // Carla is Dana's immediate referrer

  // Every ancestor, all the way to the origin, +1 — not just the last link.
  assert.equal(cell(leads, 'AXP-2026-0001', 'Total Downstream'), 8, 'Origin 7 → 8');
  assert.equal(cell(leads, 'AXP-2026-0002', 'Total Downstream'), 6, 'Alice 5 → 6');
  assert.equal(cell(leads, 'AXP-2026-0003', 'Total Downstream'), 4, 'Bob 3 → 4');
  assert.equal(cell(leads, 'AXP-2026-0004', 'Total Downstream'), 5, 'Carla 4 → 5');

  // Dana referred nobody. Crediting the lead that triggered the credit would be
  // the off-by-one this asserts against: the chain must not contain her own ID.
  assert.equal(cell(leads, 'AXP-2026-0005', 'Total Downstream'), 0, 'Dana must not credit herself');
});

test('Direct Referrals REGRESSION: only the immediate referrer, never up the chain', () => {
  // The obvious implementation slip is crediting Direct Referrals to the whole
  // chain alongside Total Downstream. This test exists to catch exactly that.
  const leads = fourDeepSheet();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.updateReferrerStats('AXP-2026-0004', CHAIN_4);

  assert.equal(cell(leads, 'AXP-2026-0004', 'Direct Referrals'), 5, 'Carla (immediate) 4 → 5');

  // The three ancestors above her: untouched. They got Total Downstream, and
  // nothing else.
  assert.equal(cell(leads, 'AXP-2026-0003', 'Direct Referrals'), 3, 'Bob unchanged');
  assert.equal(cell(leads, 'AXP-2026-0002', 'Direct Referrals'), 1, 'Alice unchanged');
  assert.equal(cell(leads, 'AXP-2026-0001', 'Direct Referrals'), 2, 'Origin unchanged');

  // Last Referral Date follows Direct Referrals, for the same reason: a lead
  // referred three levels below you is not YOUR referral.
  assert.equal(cell(leads, 'AXP-2026-0004', 'Last Referral Date'), todayCT());
  assert.equal(cell(leads, 'AXP-2026-0001', 'Last Referral Date'), '', 'origin gets no referral date');
  assert.equal(cell(leads, 'AXP-2026-0002', 'Last Referral Date'), '');
  assert.equal(cell(leads, 'AXP-2026-0003', 'Last Referral Date'), '');
});

test('boundary: a 1-deep chain credits the single ancestor once, on both counters', () => {
  const leads = new FakeSheet('Leads', [
    MANGLED_HEADER.slice(),
    mkLead({ 'Lead ID': 'AXP-2026-0001', 'First Name': 'Solo',
             'Direct Referrals': 9, 'Total Downstream': 9 }),
    mkLead({ 'Lead ID': 'AXP-2026-0002', 'First Name': 'New',
             'Referral Chain': 'AXP-2026-0001', 'Chain Depth': 1,
             'Direct Referrals': 0, 'Total Downstream': 0 }),
  ]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.updateReferrerStats('AXP-2026-0001', 'AXP-2026-0001');

  assert.equal(cell(leads, 'AXP-2026-0001', 'Direct Referrals'), 10);
  assert.equal(cell(leads, 'AXP-2026-0001', 'Total Downstream'), 10);
  assert.equal(cell(leads, 'AXP-2026-0001', 'Last Referral Date'), todayCT());
});

test('boundary: no referrer → nothing is written at all', () => {
  const leads = fourDeepSheet();
  const before = JSON.stringify(leads.getDataRange().getValues());
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.updateReferrerStats('', '');
  sandbox.updateReferrerStats(null, null);
  sandbox.updateReferrerStats(undefined, CHAIN_4);   // a chain with no referrer credits nobody

  assert.equal(JSON.stringify(leads.getDataRange().getValues()), before, 'sheet must be untouched');
});

test('a referrer with no chain passed still gets credited (defensive fallback)', () => {
  const leads = fourDeepSheet();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.updateReferrerStats('AXP-2026-0004', '');

  assert.equal(cell(leads, 'AXP-2026-0004', 'Direct Referrals'), 5);
  assert.equal(cell(leads, 'AXP-2026-0004', 'Total Downstream'), 5);
  // Without a chain there are no known ancestors, so nobody above her moves.
  assert.equal(cell(leads, 'AXP-2026-0003', 'Total Downstream'), 3);
  assert.equal(cell(leads, 'AXP-2026-0001', 'Total Downstream'), 7);
});

test('a chain that repeats an ancestor credits that ancestor exactly once', () => {
  const leads = fourDeepSheet();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  // A hand-edited / malformed chain. Total Downstream counts downstream LEADS,
  // not chain entries, so a duplicate must not double-credit.
  sandbox.updateReferrerStats('AXP-2026-0004', 'AXP-2026-0001|AXP-2026-0002|AXP-2026-0001|AXP-2026-0003|AXP-2026-0004');

  assert.equal(cell(leads, 'AXP-2026-0001', 'Total Downstream'), 8, 'credited once despite appearing twice');
  assert.equal(cell(leads, 'AXP-2026-0002', 'Total Downstream'), 6);
  assert.equal(cell(leads, 'AXP-2026-0004', 'Direct Referrals'), 5);
});

test('a chain naming a lead with no row credits the ancestors that DO exist, and logs', () => {
  const leads = fourDeepSheet();
  const { sandbox, logs } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.updateReferrerStats('AXP-2026-0004', 'AXP-2026-0001|AXP-9999-9999|AXP-2026-0003|AXP-2026-0004');

  assert.equal(cell(leads, 'AXP-2026-0001', 'Total Downstream'), 8, 'real ancestor still credited');
  assert.equal(cell(leads, 'AXP-2026-0003', 'Total Downstream'), 4, 'real ancestor still credited');
  assert.equal(cell(leads, 'AXP-2026-0004', 'Direct Referrals'), 5, 'immediate referrer still credited');
  assert.ok(logs.some((l) => l.includes('AXP-9999-9999')), 'the broken chain link must be logged, not swallowed');
});

test('a mangled header MISSING a required column throws — it never writes to a guessed cell', () => {
  const broken = MANGLED_HEADER.filter((h) => h.trim().toLowerCase() !== 'total  downstream');
  const row = new Array(broken.length).fill('');
  row[broken.findIndex((h) => h.trim().toLowerCase() === 'lead id')] = 'AXP-2026-0001';

  const leads = new FakeSheet('Leads', [broken, row]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  assert.throws(
    () => sandbox.updateReferrerStats('AXP-2026-0001', 'AXP-2026-0001'),
    /Total Downstream/,
    'resolveUnifiedCols must fail loud on a real header miss',
  );
});

test('an absent Leads tab logs and writes nothing (it does not exist pre-cutover)', () => {
  const { sandbox, logs } = load(new FakeSpreadsheet({}), true);
  assert.doesNotThrow(() => sandbox.updateReferrerStats('AXP-2026-0001', 'AXP-2026-0001'));
  assert.ok(logs.some((l) => l.includes('Leads')));
});

/* ── The legacy branch: proof that production, which is still on the nine-tab
   schema, is untouched by this migration stage. This is the test that says the
   dispatcher is safe to merge today. Delete it at cutover, with the legacy body. */
test('legacy branch (flag off): still updates the per-tab duplicates, Direct Referrals only', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;

  // Rotate the legacy header so nothing sits at its COLS index either.
  const header = LEAD_HEADERS.slice(7).concat(LEAD_HEADERS.slice(0, 7));
  const at = (name) => header.indexOf(name);
  assert.notDeepEqual(header, LEAD_HEADERS);

  const mk = (vals) => {
    const r = new Array(header.length).fill('');
    Object.keys(vals).forEach((n) => { r[at(n)] = vals[n]; });
    return r;
  };
  const rowFor = () => mk({ 'Lead ID': 'AXP-2026-0001', Email: 'ref@x.com', 'Direct Referrals': 4, 'Total Downstream': 0 });

  const lifetime = new FakeSheet('Lifetime Leads', [header.slice(), rowFor()]);
  const active = new FakeSheet('Active Leads', [header.slice(), rowFor()]);
  const { sandbox } = load(new FakeSpreadsheet({
    'Lifetime Leads': lifetime, 'Active Leads': active,
  }), false);

  sandbox.updateReferrerStats('AXP-2026-0001', 'AXP-2026-0001');

  // The referrer's duplicated row is updated on BOTH tabs — the behavior the
  // unified schema exists to delete, still correct until it does.
  [lifetime, active].forEach((sheet) => {
    const r = sheet.getDataRange().getValues()[1];
    assert.equal(r[at('Direct Referrals')], 5);
    assert.equal(r[at('Last Referral Date')], todayCT());
    // Legacy never wrote Total Downstream, and this stage does not change that.
    assert.equal(r[at('Total Downstream')], 0);
  });
});
