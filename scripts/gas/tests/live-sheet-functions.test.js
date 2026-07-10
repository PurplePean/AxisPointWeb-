'use strict';

/*
 * Integration tests for the live-sheet functions threaded through resolveCols.
 * These are the real proof the refactor works: each scenario gives a tab a
 * header row DELIBERATELY DRIFTED from LEAD_HEADERS (columns reordered), seeds
 * rows against that drifted layout, runs the real function, and asserts it acted
 * on the right cells. With the old compile-time COLS reads these would act on the
 * wrong columns; with resolveCols they act correctly.
 *
 * To run a live-sheet function we re-load Code.gs into a sandbox whose GAS
 * services (SpreadsheetApp, GmailApp, ContactsApp, Utilities.formatDate) are
 * backed by the in-memory FakeSpreadsheet, then call the function off the sandbox.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/** Loads Code.gs into a sandbox wired to a specific FakeSpreadsheet, capturing
 *  sent emails and contact-group moves so tests can assert on side effects. */
function loadWithSpreadsheet(spreadsheet, opts) {
  opts = opts || {};
  const sentEmails = [];
  const contactCalls = [];

  function formatDateImpl(date, tz, fmt) {
    const d = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(d);
    const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
    let hour = get('hour'); if (hour === '24') hour = '00';
    return fmt
      .replace(/yyyy/g, get('year')).replace(/MM/g, get('month')).replace(/dd/g, get('day'))
      .replace(/HH/g, hour).replace(/mm/g, get('minute')).replace(/ss/g, get('second'));
  }

  const sandbox = {
    console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, isNaN, parseInt, parseFloat,
    Logger: { log() {} },
    Utilities: {
      base64Decode: (s) => Buffer.from(String(s), 'base64'),
      newBlob: (d, t, n) => ({ _data: d, _type: t, _name: n }),
      formatDate: formatDateImpl,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k === 'SPREADSHEET_ID' ? 'FAKE_ID' : ''),
        setProperty() {},
        setProperties() {},
      }),
    },
    SpreadsheetApp: {
      openById: () => spreadsheet,
    },
    GmailApp: {
      sendEmail(to, subject, body, options) {
        sentEmails.push({ to, subject, body, options });
      },
    },
    ContactsApp: {
      getContactsByEmailAddress(email) {
        contactCalls.push(email);
        return (opts.contacts && opts.contacts[email]) || [];
      },
      getContactGroup: () => null,
      createContactGroup: (n) => ({ _name: n, addToGroup() {}, removeFromGroup() {} }),
    },
    Calendar: {}, CalendarApp: {}, ContentService: {}, HtmlService: {}, LockService: {}, ScriptApp: {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE_SRC, sandbox, { filename: 'Code.gs' });

  return { sandbox, sentEmails, contactCalls };
}

/* Build a DRIFTED lead-tab header: same 31 columns, but with a block of them
   rotated so no column sits at its COLS index. Returns { header, indexOf }. */
function driftedHeader(LEAD_HEADERS) {
  // Rotate the whole header by 5 positions — every column moves, all still present.
  const k = 5;
  const header = LEAD_HEADERS.slice(k).concat(LEAD_HEADERS.slice(0, k));
  const indexOf = (name) => header.indexOf(name);
  return { header, indexOf };
}

test('moveColdLeads: acts on the right cells despite a drifted Active Leads header', () => {
  // First load just to read the canonical constants.
  const probe = loadWithSpreadsheet(new FakeSpreadsheet({}));
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;
  const COLD_DAYS = probe.sandbox.CONFIG.COLD_LEAD_DAYS;

  const { header, indexOf } = driftedHeader(LEAD_HEADERS);
  assert.notDeepEqual(header, LEAD_HEADERS, 'fixture header must be drifted');

  // Build two Active rows against the DRIFTED layout.
  const oldIso = new Date(Date.now() - (COLD_DAYS + 10) * 86400000).toISOString();
  const freshIso = new Date(Date.now() - 3 * 86400000).toISOString();

  const mkRow = (vals) => {
    const r = new Array(header.length).fill('');
    Object.entries(vals).forEach(([name, v]) => { r[indexOf(name)] = v; });
    return r;
  };
  const staleRow = mkRow({
    Timestamp: oldIso, 'Lead ID': 'AXP-2026-0001', Email: 'stale@x.com',
    'First Name': 'Stale', 'Last Name': 'Lead', Role: 'investor', Category: 'Investor', Status: 'New Lead',
  });
  const freshRow = mkRow({
    Timestamp: freshIso, 'Lead ID': 'AXP-2026-0002', Email: 'fresh@x.com',
    'First Name': 'Fresh', 'Last Name': 'Lead', Role: 'investor', Category: 'Investor', Status: 'New Lead',
  });

  const active = new FakeSheet('Active Leads', [header.slice(), staleRow, freshRow]);
  const cold = new FakeSheet('Cold Leads', [header.slice()]);
  const investors = new FakeSheet('Investors', [header.slice(), mkRow({ Email: 'stale@x.com', Status: 'New Lead' })]);

  const ss = new FakeSpreadsheet({
    'Active Leads': active, 'Cold Leads': cold, 'Investors': investors,
  });
  const { sandbox, sentEmails } = loadWithSpreadsheet(ss);

  sandbox.moveColdLeads();

  // The stale lead moved to Cold; the fresh one stayed.
  const coldEmails = cold.getDataRange().getValues().slice(1).map((r) => r[indexOf('Email')]);
  assert.deepEqual(coldEmails, ['stale@x.com']);

  const activeEmails = active.getDataRange().getValues().slice(1).map((r) => r[indexOf('Email')]);
  assert.deepEqual(activeEmails, ['fresh@x.com']);

  // The moved row's Status cell (at the DRIFTED position) is 'Cold'.
  const movedColdRow = cold.getDataRange().getValues()[1];
  assert.equal(movedColdRow[indexOf('Status')], 'Cold');

  // Category tab (Investors) status updated at its own drifted Status position.
  const invRow = investors.getDataRange().getValues()[1];
  assert.equal(invRow[indexOf('Status')], 'Cold');

  // Summary email sent, naming the stale lead.
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].body, /AXP-2026-0001/);
  assert.match(sentEmails[0].body, /stale@x.com/);
  // And NOT the fresh one.
  assert.ok(!/AXP-2026-0002/.test(sentEmails[0].body));
});

test('moveColdLeads: throws-safe on a drifted-empty tab is not needed — resolves or logs', () => {
  // A header missing a required column must not silently mis-move. resolveCols
  // throws inside the try, moveColdLeads logs and moves nothing.
  const probe = loadWithSpreadsheet(new FakeSpreadsheet({}));
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;
  const brokenHeader = LEAD_HEADERS.filter((h) => h !== 'Status'); // required by moveColdLeads

  const active = new FakeSheet('Active Leads', [brokenHeader, new Array(brokenHeader.length).fill('x')]);
  const ss = new FakeSpreadsheet({ 'Active Leads': active, 'Cold Leads': new FakeSheet('Cold Leads', [brokenHeader.slice()]) });
  const { sandbox } = loadWithSpreadsheet(ss);

  // Must not throw out of moveColdLeads (its own try/catch swallows+logs), and
  // must not have deleted or moved anything.
  assert.doesNotThrow(() => sandbox.moveColdLeads());
  assert.equal(active.deletedRows.length, 0);
});
