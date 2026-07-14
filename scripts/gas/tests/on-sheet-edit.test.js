'use strict';

/*
 * onSheetEdit — the unified-schema rewrite (migration Stage 4).
 *
 * onSheetEdit is the SOLE dispatcher for all three edit handlers. Its job is to
 * answer two questions and get both exactly right:
 *   1. Is this edit even on a lead? (the tab guard)
 *   2. WHICH watched column changed? (the routing)
 * Get (2) wrong and a Status edit runs the referral handler. That is why the
 * columns are resolved BY NAME and why most of this file is routing assertions.
 *
 * The change itself is small: legacy must ask "is this one of the NINE tabs a lead
 * can be duplicated onto?"; unified asks "is this the Leads table?". Everything
 * else is deliberately identical — that logic was already correct.
 *
 * WHAT THIS STAGE ACTUALLY WIRES UP (tested explicitly below, because "the
 * dispatcher is migrated" must not be read as "all three handlers work"):
 *   Status            → handleStatusEdit         ✅ migrated, fully wired
 *   Category          → handleCategoryEdit       ✅ works unchanged, no migration needed
 *   Referred By Email → handleManualReferralLink ❌ NOT migrated — refused, loudly
 *
 * FIXTURE RULE: hand-typed header, mangled a FOURTH distinct way. Four suites,
 * four scrambles.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

function makeScriptLock() {
  let held = false;
  return {
    tryLock() { if (held) return false; held = true; return true; },
    releaseLock() { held = false; },
    waitLock() { throw new Error('locked paths must use tryLock'); },
  };
}

function load(spreadsheet, unified) {
  const logs = [];
  const contactCalls = [];
  const groupAdds = [];
  const groupRemoves = [];
  const lock = makeScriptLock();

  const sandbox = {
    console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp,
    isNaN, parseInt, parseFloat,
    Logger: { log: (m) => logs.push(String(m)) },
    Utilities: {
      base64Decode: (s) => Buffer.from(String(s), 'base64'),
      newBlob: (d, t, n) => ({ _data: d, _type: t, _name: n }),
      formatDate: () => '07/14/2026',
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k === 'SPREADSHEET_ID' ? 'FAKE_ID' : ''),
        setProperty() {}, setProperties() {},
      }),
    },
    SpreadsheetApp: { openById: () => spreadsheet, flush() {} },
    LockService: { getScriptLock: () => lock },
    GmailApp: { sendEmail() {} },
    ContactsApp: {
      getContactsByEmailAddress(email) {
        contactCalls.push(email);
        return [{
          addToGroup: (g) => groupAdds.push({ email, group: g && g._name }),
          removeFromGroup: (g) => groupRemoves.push({ email, group: g && g._name }),
        }];
      },
      getContactGroup: (n) => ({ _name: n }),
      createContactGroup: (n) => ({ _name: n }),
    },
    Calendar: {}, CalendarApp: {}, ContentService: {}, HtmlService: {}, ScriptApp: {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE_SRC, sandbox, { filename: 'Code.gs' });
  sandbox.USE_UNIFIED_SCHEMA = !!unified;
  return { sandbox, logs, contactCalls, groupAdds, groupRemoves };
}

/** The Apps Script edit event: a range on a sheet, 1-indexed. */
function editEvent(sheet, row, col1Based, value) {
  return {
    range: {
      getSheet: () => sheet,
      getRow: () => row,
      getColumn: () => col1Based,
      getValue: () => value,
    },
  };
}

/* ── Mangled unified header, scramble #4 ── */
const MANGLED = [
  'Company',
  'Referred By Code',
  'Details',
  'Chain Depth',
  'timestamp',
  'Match Type',
  'Referral Chain',
  'Last Name',
  'REFERRED BY EMAIL',
  'Total  Downstream',
  'Role',
  'Lead ID',
  'Status',
  'Referral Code',
  'Heard About',
  'Last Referral Date',
  'Email',
  'Phone',
  'Referred By Name',
  'Direct Referrals',
  ' Category ',
  'Referred By Lead ID',
  'Reports Enabled',
  'First Name',
  'Source',
];

const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
function colOf(name) {
  const i = MANGLED.findIndex((h) => norm(h) === norm(name));
  if (i === -1) throw new Error('fixture is missing a column: ' + name);
  return i;
}
function col1(name) { return colOf(name) + 1; }   // 1-indexed, as the event reports
function mkLead(values) {
  const row = new Array(MANGLED.length).fill('');
  Object.keys(values).forEach((n) => { row[colOf(n)] = values[n]; });
  return row;
}

function leadsSheet(overrides) {
  return new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead(Object.assign({
      'Lead ID': 'AXP-2026-0001', Email: 'edited@x.com', 'First Name': 'Edited',
      'Last Name': 'Lead', Status: 'New Lead', Category: 'Investor', Role: 'investor',
      Timestamp: new Date().toISOString(),
    }, overrides || {})),
  ]);
}

test('fixture header is genuinely drifted from the constants', () => {
  const { sandbox } = load(new FakeSpreadsheet({}), true);
  const { UNIFIED_LEAD_HEADERS, UCOLS } = sandbox;
  assert.equal(MANGLED.length, UNIFIED_LEAD_HEADERS.length);
  assert.notDeepEqual(MANGLED, UNIFIED_LEAD_HEADERS);
  Object.keys(UCOLS).forEach((k) => {
    assert.notEqual(colOf(UNIFIED_LEAD_HEADERS[UCOLS[k]]), UCOLS[k],
      `"${UNIFIED_LEAD_HEADERS[UCOLS[k]]}" must not sit at its canonical index`);
  });
});

/* ── The guard ── */

test('unified guard: only the Leads table dispatches; every other sheet is ignored', () => {
  const leads = leadsSheet();
  // The legacy tabs still physically exist between cutover steps 3 and 5. An edit
  // on one of them must NOT dispatch under the unified schema.
  const stale = new FakeSheet('Active Leads', [MANGLED.slice(), mkLead({ Status: 'Cold', Email: 'old@x.com' })]);
  const subs = new FakeSheet('Subscribers', [['Email', 'First Name', 'Date Subscribed', 'Preferences', 'Active', 'Last Emailed']]);
  const refs = new FakeSheet('Referrals', [['Referral ID', 'Referrer Lead ID']]);

  const ss = new FakeSpreadsheet({ Leads: leads, 'Active Leads': stale, Subscribers: subs, Referrals: refs });
  const { sandbox, contactCalls } = load(ss, true);

  // A Status edit on the OLD Active Leads tab: ignored.
  sandbox.onSheetEdit(editEvent(stale, 2, col1('Status'), 'Cold'));
  assert.deepEqual(contactCalls, [], 'a legacy tab must not dispatch under the unified schema');

  // Subscribers / Referrals have their own schemas — resolveUnifiedCols would throw
  // on them, so the guard must reject them before it ever runs.
  assert.doesNotThrow(() => sandbox.onSheetEdit(editEvent(subs, 2, 5, 'false')));
  assert.doesNotThrow(() => sandbox.onSheetEdit(editEvent(refs, 2, 1, 'x')));
  assert.deepEqual(contactCalls, []);
});

test('unified guard: the header row and unwatched columns are ignored', () => {
  const leads = leadsSheet();
  const { sandbox, contactCalls, logs } = load(new FakeSpreadsheet({ Leads: leads }), true);

  // Row 1 is the header, not a lead.
  sandbox.onSheetEdit(editEvent(leads, 1, col1('Status'), 'Cold'));
  // Editing a column nobody watches (Company, Phone, Details) must do nothing.
  sandbox.onSheetEdit(editEvent(leads, 2, col1('Company'), 'Acme'));
  sandbox.onSheetEdit(editEvent(leads, 2, col1('Phone'), '555'));
  sandbox.onSheetEdit(editEvent(leads, 2, col1('Details'), '{}'));

  assert.deepEqual(contactCalls, [], 'no handler may fire');
  assert.deepEqual(logs, [], 'and nothing should be logged either');
});

/* ── The routing: WHICH column changed ── */

test('unified: a Status edit routes to handleStatusEdit — and to nothing else', () => {
  const leads = leadsSheet({ Status: 'Cold' });   // the human already wrote the cell
  const { sandbox, contactCalls, groupAdds, logs } =
    load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.onSheetEdit(editEvent(leads, 2, col1('Status'), 'Cold'));

  // The Cold path of handleStatusEditUnified: contact moved to the Cold group.
  assert.deepEqual(contactCalls, ['edited@x.com']);
  assert.deepEqual(groupAdds.map((g) => g.group), ['AxisPoint Cold']);
  // And the Stage-3 guarantee still holds through the dispatcher: no row moves.
  assert.equal(leads.appended.length, 0);
  assert.equal(leads.deletedRows.length, 0);
  // It must NOT have been mistaken for a referral edit.
  assert.ok(!logs.join('\n').includes('Referred By Email'));
});

test('unified: a Category edit routes to handleCategoryEdit, which needs no migration', () => {
  // handleCategoryEdit reads NO tab. Its only inputs are rowData and a column map,
  // and the only column it touches is EMAIL — a key present in both COLS and UCOLS.
  // So it is schema-agnostic and works unchanged. This test is the proof.
  const leads = leadsSheet({ Category: 'Referral Partner' });
  const { sandbox, contactCalls, groupAdds, groupRemoves } =
    load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.onSheetEdit(editEvent(leads, 2, col1('Category'), 'Referral Partner'));

  assert.deepEqual(contactCalls, ['edited@x.com'], 'the contact was looked up by the right email');
  // Every category group is cleared, then the new one applied.
  assert.deepEqual(groupAdds, [{ email: 'edited@x.com', group: 'AxisPoint Referral Partners' }]);
  assert.ok(groupRemoves.length >= 4, 'the other category groups are cleared first');
  assert.ok(groupRemoves.some((g) => g.group === 'AxisPoint Investors'));
});

test('unified: a Referred By Email edit is REFUSED LOUDLY, not silently swallowed', () => {
  /* THE POINT OF THIS TEST. handleManualReferralLink still scans Lifetime Leads,
     which does not exist under the unified schema. Its own guard returns SILENTLY
     when the tab is missing — so wiring it up here would produce a handler that
     looks connected and does nothing: the human types a referrer's email, watches
     it be accepted, and no referral is ever linked. Refusing out loud is the only
     honest option until Stage 5 migrates it. */
  const leads = leadsSheet();
  const { sandbox, contactCalls, logs } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.onSheetEdit(editEvent(leads, 2, col1('Referred By Email'), 'referrer@x.com'));

  const log = logs.join('\n');
  assert.match(log, /was NOT processed/);
  assert.match(log, /referrer@x\.com/, 'the log must name the value that was dropped');
  assert.match(log, /Stage 5/, 'and say what will fix it');
  assert.match(log, /no referrer notified/i, 'and spell out exactly what did not happen');

  // Nothing was half-done: no referral columns back-filled, no contact touched.
  const row = leads.getDataRange().getValues()[1];
  assert.equal(row[colOf('Referred By Lead ID')], '', 'no referral column may be back-filled');
  assert.equal(row[colOf('Match Type')], '');
  assert.equal(row[colOf('Referral Chain')], '');
  assert.deepEqual(contactCalls, []);
});

test('unified: routing is BY NAME — a drifted header cannot send a Status edit to the wrong handler', () => {
  // The whole reason the columns are resolved rather than assumed. In this fixture
  // Status sits at index 12 and Category at 20 — neither at its canonical index —
  // so a positional dispatcher would route both to the wrong place.
  const leads = leadsSheet({ Status: 'Client' });
  const { sandbox, groupAdds } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.onSheetEdit(editEvent(leads, 2, col1('Status'), 'Client'));

  // Routed to handleStatusEdit's Client path (labels the contact a Client), NOT to
  // handleCategoryEdit (which would have cleared every group first).
  assert.deepEqual(groupAdds, [{ email: 'edited@x.com', group: 'AxisPoint Clients' }]);
});

test('unified: a mangled header missing a watched column refuses to dispatch at all', () => {
  const broken = MANGLED.filter((h) => norm(h) !== 'status');
  const row = new Array(broken.length).fill('');
  row[broken.findIndex((h) => norm(h) === 'email')] = 'x@x.com';
  const leads = new FakeSheet('Leads', [broken, row]);

  const { sandbox, contactCalls, logs } = load(new FakeSpreadsheet({ Leads: leads }), true);

  // resolveUnifiedCols throws; onSheetEdit's own try/catch logs it. Refusing to run
  // on a broken header is the intended outcome — dispatching positionally would
  // route edits to arbitrary handlers.
  assert.doesNotThrow(() => sandbox.onSheetEdit(editEvent(leads, 2, 1, 'Cold')));
  assert.deepEqual(contactCalls, []);
  assert.match(logs.join('\n'), /onSheetEdit error/);
});

/* ── The legacy branch: byte-for-byte production dispatch ── */

test('legacy branch (flag off): dispatches on the nine-tab guard, exactly as production does', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;

  // Rotate the legacy 31-column header so nothing sits at its COLS index.
  const header = LEAD_HEADERS.slice(23).concat(LEAD_HEADERS.slice(0, 23));
  const at = (n) => header.indexOf(n);
  const at1 = (n) => at(n) + 1;
  assert.notDeepEqual(header, LEAD_HEADERS);

  const mk = (vals) => {
    const r = new Array(header.length).fill('');
    Object.keys(vals).forEach((n) => { r[at(n)] = vals[n]; });
    return r;
  };

  const active = new FakeSheet('Active Leads', [header.slice(),
    mk({ 'Lead ID': 'AXP-1', Email: 'legacy@x.com', Status: 'Cold', Role: 'investor', Category: 'Investor' })]);
  const cold = new FakeSheet('Cold Leads', [header.slice()]);
  const subs = new FakeSheet('Subscribers', [['Email', 'First Name', 'Date Subscribed', 'Preferences', 'Active', 'Last Emailed']]);

  const ss = new FakeSpreadsheet({ 'Active Leads': active, 'Cold Leads': cold, Subscribers: subs });
  const { sandbox, contactCalls } = load(ss, false);

  // A Status→Cold edit on a LEGACY lead tab still relocates the row.
  sandbox.onSheetEdit(editEvent(active, 2, at1('Status'), 'Cold'));
  assert.equal(cold.appended.length, 1, 'legacy still appends the row to Cold Leads');
  assert.deepEqual(active.deletedRows, [2], 'and still deletes it from Active');
  assert.deepEqual(contactCalls, ['legacy@x.com']);

  // A non-lead tab is still ignored.
  assert.doesNotThrow(() => sandbox.onSheetEdit(editEvent(subs, 2, 5, 'false')));

  // And the Leads table is NOT a legacy lead tab, so legacy must ignore it — the
  // two schemas never both dispatch.
  const leads = new FakeSheet('Leads', [MANGLED.slice(), mkLead({ Status: 'Cold', Email: 'unified@x.com' })]);
  const ss2 = new FakeSpreadsheet({ 'Active Leads': active, 'Cold Leads': cold, Leads: leads });
  const ctx2 = load(ss2, false);
  ctx2.sandbox.onSheetEdit(editEvent(leads, 2, col1('Status'), 'Cold'));
  assert.deepEqual(ctx2.contactCalls, [], 'the legacy dispatcher must ignore the Leads table');
});
