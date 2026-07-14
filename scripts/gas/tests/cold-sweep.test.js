'use strict';

/*
 * moveColdLeads — the unified-schema rewrite (migration Stage 2).
 *
 * The legacy sweep is one of only two functions in the file that DELETE rows: it
 * appends the lead to Cold Leads, deleteRow()s it out of Active Leads, and
 * re-syncs the duplicate on the category tab. Three writes across three tabs to
 * express one status change. The unified sweep sets ONE cell — Status = 'Cold' —
 * because with one row per lead there is nowhere to move it to.
 *
 * So the assertions that matter here are as much about what must NOT happen (no
 * deletion, no append, no row reordering, no lead lost) as about what must.
 *
 * FIXTURE RULE: the header below is HAND-TYPED and deliberately mangled away from
 * UNIFIED_LEAD_HEADERS — and it is a DIFFERENT mangling from the one in
 * referrer-stats.test.js, on purpose. Two fixtures that scramble identically are
 * one fixture; varying them proves the code resolves by name rather than having
 * been tuned to one arrangement.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/** Loads Code.gs against a FakeSpreadsheet, capturing emails, Contacts calls, and
 *  an ordered trace of lock/flush events. `unified` flips USE_UNIFIED_SCHEMA. */
function load(spreadsheet, unified, opts) {
  opts = opts || {};
  const logs = [];
  const sentEmails = [];
  const contactMoves = [];
  const events = opts.events || [];
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
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: (ms) => { events.push('tryLock(' + ms + ')'); return lockGranted; },
        releaseLock: () => { events.push('releaseLock'); },
        waitLock: () => { throw new Error('moveColdLeads must use tryLock, never waitLock'); },
      }),
    },
    GmailApp: {
      sendEmail(to, subject, body, options) { sentEmails.push({ to, subject, body, options }); },
    },
    ContactsApp: {
      getContactsByEmailAddress(email) {
        contactMoves.push(email);
        return [{ addToGroup() {}, removeFromGroup() {} }];
      },
      getContactGroup: () => null,
      createContactGroup: (n) => ({ _name: n }),
    },
    Calendar: {}, CalendarApp: {}, ContentService: {}, HtmlService: {}, ScriptApp: {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE_SRC, sandbox, { filename: 'Code.gs' });
  sandbox.USE_UNIFIED_SCHEMA = !!unified;
  return { sandbox, logs, sentEmails, contactMoves, events };
}

/** A FakeSheet that traces reads and writes, so a test can prove WHERE they sit
 *  relative to the lock. */
function recordingSheet(name, grid, events) {
  const sheet = new FakeSheet(name, grid);
  const realGetRange = sheet.getRange.bind(sheet);
  const realGetDataRange = sheet.getDataRange.bind(sheet);
  sheet.getDataRange = () => { events.push('read'); return realGetDataRange(); };
  sheet.getRange = (...args) => {
    const range = realGetRange(...args);
    const realSetValue = range.setValue.bind(range);
    range.setValue = (v) => { events.push('write'); return realSetValue(v); };
    return range;
  };
  return sheet;
}

/* ── The mangled unified header ──
   All 25 columns, hand-typed, scrambled DIFFERENTLY from referrer-stats.test.js,
   with the case and whitespace abuse a hand-edited Sheet actually produces. */
const MANGLED = [
  'Status',
  'heard about',
  'Company',
  'Timestamp',
  'Details',
  'Role',
  'Referral  Chain',
  'Chain Depth',
  ' Lead ID ',
  'Direct  Referrals',
  'Match Type',
  'Total Downstream',
  'Source',
  'Referred By Name',
  'referred by lead id',
  'Last Referral Date',
  'Referred By Code',
  'First  Name',
  'Referral Code',
  'Category',
  'Email',
  'Referred By Email',
  'reports enabled',
  'Phone',
  'LAST NAME',
];

const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
function colOf(name) {
  const i = MANGLED.findIndex((h) => norm(h) === norm(name));
  if (i === -1) throw new Error('fixture is missing a column: ' + name);
  return i;
}
function mkLead(values) {
  const row = new Array(MANGLED.length).fill('');
  Object.keys(values).forEach((n) => { row[colOf(n)] = values[n]; });
  return row;
}
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

/* COLD_LEAD_DAYS is 60. The fixture is written against the LIVE constant read off
   the sandbox rather than a re-typed 60, so a change to the config cannot leave
   these tests quietly asserting the old threshold. The AGES, though, are chosen
   by hand relative to it. */
function coldDays(sandbox) { return sandbox.CONFIG.COLD_LEAD_DAYS; }

function leadsGrid(sandbox) {
  const D = coldDays(sandbox);
  return [
    MANGLED.slice(),
    // Stale + active → must go Cold.
    mkLead({ 'Lead ID': 'AXP-2026-0001', Timestamp: daysAgo(D + 30), Status: 'New Lead',
             Email: 'stale.new@x.com', 'First Name': 'Stale', 'Last Name': 'New',
             Category: 'Investor', Role: 'investor' }),
    // Fresh + active → must NOT move.
    mkLead({ 'Lead ID': 'AXP-2026-0002', Timestamp: daysAgo(3), Status: 'Active',
             Email: 'fresh@x.com', 'First Name': 'Fresh', 'Last Name': 'Lead',
             Category: 'Investor', Role: 'investor' }),
    // Ancient but ALREADY Cold → not an active status, must not be re-swept
    // (and must not appear in the summary email as if it just went cold).
    mkLead({ 'Lead ID': 'AXP-2026-0003', Timestamp: daysAgo(D + 400), Status: 'Cold',
             Email: 'already.cold@x.com', 'First Name': 'Already', 'Last Name': 'Cold',
             Category: 'Investor', Role: 'investor' }),
    // Ancient but a CLIENT → the whole point of the status guard. Sweeping a
    // paying client to Cold because they signed up a year ago would be a disaster.
    mkLead({ 'Lead ID': 'AXP-2026-0004', Timestamp: daysAgo(D + 400), Status: 'Client',
             Email: 'client@x.com', 'First Name': 'Paying', 'Last Name': 'Client',
             Category: 'Client', Role: 'investor' }),
    // Stale + Contacted → also an active status, must go Cold.
    mkLead({ 'Lead ID': 'AXP-2026-0005', Timestamp: daysAgo(D + 1), Status: 'Contacted',
             Email: 'stale.contacted@x.com', 'First Name': 'Stale', 'Last Name': 'Contacted',
             Category: 'Referral Partner', Role: 'referral' }),
  ];
}

function statusOf(sheet, leadId) {
  const rows = sheet.getDataRange().getValues();
  const hit = rows.slice(1).find((r) => norm(r[colOf('Lead ID')]) === norm(leadId));
  assert.ok(hit, 'no row for ' + leadId);
  return hit[colOf('Status')];
}

test('fixture header is genuinely drifted, and differs from the Stage 1 fixture', () => {
  const { sandbox } = load(new FakeSpreadsheet({}), true);
  const { UNIFIED_LEAD_HEADERS, UCOLS } = sandbox;

  assert.equal(MANGLED.length, UNIFIED_LEAD_HEADERS.length);
  assert.notDeepEqual(MANGLED, UNIFIED_LEAD_HEADERS);
  Object.keys(UCOLS).forEach((key) => {
    const canonical = UCOLS[key];
    assert.notEqual(colOf(UNIFIED_LEAD_HEADERS[canonical]), canonical,
      `"${UNIFIED_LEAD_HEADERS[canonical]}" must not sit at its canonical index`);
  });
});

test('unified: stale active leads go Cold IN PLACE — nothing is deleted, appended, or reordered', () => {
  const probe = load(new FakeSpreadsheet({}), true);
  const leads = new FakeSheet('Leads', leadsGrid(probe.sandbox));
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  const idsBefore = leads.getDataRange().getValues().slice(1).map((r) => r[colOf('Lead ID')]);

  sandbox.moveColdLeads();

  // The two stale active leads flipped.
  assert.equal(statusOf(leads, 'AXP-2026-0001'), 'Cold');
  assert.equal(statusOf(leads, 'AXP-2026-0005'), 'Cold');

  // Everyone else is exactly as they were.
  assert.equal(statusOf(leads, 'AXP-2026-0002'), 'Active', 'a fresh lead must not be swept');
  assert.equal(statusOf(leads, 'AXP-2026-0003'), 'Cold', 'an already-cold lead is left alone');
  assert.equal(statusOf(leads, 'AXP-2026-0004'), 'Client', 'an ancient CLIENT must never be swept');

  // The row-deletion path is gone. This is the assertion the whole stage exists for.
  assert.equal(leads.deletedRows.length, 0, 'the unified sweep must never delete a row');
  assert.equal(leads.appended.length, 0, 'and must never append one');
  assert.equal(leads.getLastRow(), 6, 'header + 5 leads, unchanged');
  assert.deepEqual(
    leads.getDataRange().getValues().slice(1).map((r) => r[colOf('Lead ID')]),
    idsBefore,
    'no lead may be lost, duplicated, or reordered',
  );
});

test('unified: the age threshold — just under COLD_LEAD_DAYS is kept, just over is swept', () => {
  const probe = load(new FakeSpreadsheet({}), true);
  const D = coldDays(probe.sandbox);
  const leads = new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead({ 'Lead ID': 'AXP-UNDER', Timestamp: daysAgo(D - 0.5), Status: 'New Lead', Email: 'under@x.com' }),
    mkLead({ 'Lead ID': 'AXP-OVER', Timestamp: daysAgo(D + 0.5), Status: 'New Lead', Email: 'over@x.com' }),
  ]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.moveColdLeads();

  assert.equal(statusOf(leads, 'AXP-UNDER'), 'New Lead', 'a lead under the threshold is not yet cold');
  assert.equal(statusOf(leads, 'AXP-OVER'), 'Cold');

  /* A note on what is NOT asserted, because the first draft of this test got it
     wrong and the failure was instructive. Both implementations skip on
     `age <= COLD_LEAD_DAYS`, so `<=` vs `<` differs ONLY for a lead whose age is
     exactly 60.000000 days. That is unobservable with real timestamps: the clock
     advances between the row being written and the sweep reading it, so a lead
     seeded at "exactly 60 days ago" is already 60-days-plus-some-milliseconds by
     the time the comparison runs, and BOTH forms sweep it. A test asserting
     behavior at exact equality would be asserting something the code can never
     encounter — so this pins the threshold where it is actually observable
     instead of inventing a boundary that does not exist in the running system. */
});

test('unified: an unreadable Timestamp is skipped, not treated as infinitely old', () => {
  const leads = new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead({ 'Lead ID': 'AXP-JUNK', Timestamp: 'not a date', Status: 'New Lead', Email: 'junk@x.com' }),
    mkLead({ 'Lead ID': 'AXP-BLANK', Timestamp: '', Status: 'New Lead', Email: 'blank@x.com' }),
  ]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true);

  assert.doesNotThrow(() => sandbox.moveColdLeads());

  // A garbage date must never become "swept it, it was 56 years old".
  assert.equal(statusOf(leads, 'AXP-JUNK'), 'New Lead');
  assert.equal(statusOf(leads, 'AXP-BLANK'), 'New Lead');
  assert.equal(sentEmails.length, 0, 'nothing moved, so no summary email');
});

test('unified: the summary email names exactly the swept leads, and the Contacts move runs per lead', () => {
  const probe = load(new FakeSpreadsheet({}), true);
  const leads = new FakeSheet('Leads', leadsGrid(probe.sandbox));
  const { sandbox, sentEmails, contactMoves } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.moveColdLeads();

  assert.equal(sentEmails.length, 1);
  const body = sentEmails[0].body;
  assert.match(sentEmails[0].subject, /moved to cold/i);
  assert.match(body, /2 leads were moved to Cold\./);
  assert.match(body, /AXP-2026-0001/);
  assert.match(body, /AXP-2026-0005/);
  // The leads that did NOT move must not be reported as if they had.
  assert.ok(!body.includes('AXP-2026-0002'), 'the fresh lead must not appear');
  assert.ok(!body.includes('AXP-2026-0004'), 'the client must not appear');
  assert.ok(!body.includes('already.cold@x.com'), 'the already-cold lead must not appear');

  assert.deepEqual(contactMoves, ['stale.new@x.com', 'stale.contacted@x.com'],
    'the Contacts move runs once per swept lead, and only for swept leads');
});

test('unified: nothing stale → no writes, no email', () => {
  const leads = new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead({ 'Lead ID': 'AXP-FRESH', Timestamp: daysAgo(1), Status: 'New Lead', Email: 'f@x.com' }),
  ]);
  const { sandbox, sentEmails, logs } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.moveColdLeads();

  assert.equal(statusOf(leads, 'AXP-FRESH'), 'New Lead');
  assert.equal(sentEmails.length, 0);
  assert.ok(logs.some((l) => l.includes('nothing to move')));
});

test('unified: a mangled header MISSING Status sweeps nothing and logs — it never guesses a column', () => {
  const broken = MANGLED.filter((h) => norm(h) !== 'status');
  const row = new Array(broken.length).fill('');
  row[broken.findIndex((h) => norm(h) === 'timestamp')] = daysAgo(999);

  const leads = new FakeSheet('Leads', [broken, row]);
  const { sandbox, logs, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true);

  // moveColdLeads' outer try/catch logs rather than throwing (it is a trigger
  // entry point), but the important part is that resolveUnifiedCols refused to
  // run at all rather than stamping 'Cold' into whatever column happened to be
  // at that index.
  assert.doesNotThrow(() => sandbox.moveColdLeads());
  assert.equal(leads.appended.length, 0);
  assert.equal(leads.deletedRows.length, 0);
  assert.equal(sentEmails.length, 0);
  assert.ok(logs.some((l) => /Status/.test(l) && /moveColdLeads error/.test(l)));
});

/* ════════════════════════════════════════════════════════════
   THE SCRIPT LOCK — and, as in Stage 1, an honest statement of its limits.

   WHY IT IS HERE: moveColdLeads has TWO entry points — the Monday trigger and the
   "Run Cold Lead Sweep Now" menu item — so two sweeps can genuinely be in flight
   at once. Both would read the same snapshot, sweep the same leads, and send TWO
   summary emails claiming the same leads went cold.

   WHAT THESE TESTS CANNOT PROVE: that Apps Script's LockService actually delivers
   mutual exclusion. There is no concurrency in a Node harness and a stubbed lock
   is not a lock; a test "proving" two racing sweeps get serialized would be
   testing the stub. That guarantee is Google's, and only the live runtime shows it.

   WHAT THEY DO PROVE — the half that is ours to get wrong: the lock is taken
   BEFORE the read (a lock taken after the snapshot protects nothing), tryLock is
   used and never waitLock, writes are flushed before release, the lock is released
   on every path including the throwing one, and a refused lock does no partial
   work and says so.

   WHAT THE LOCK ITSELF DOES NOT PROTECT (a real, documented gap, not an oversight):
   sweep vs a human's Status edit. handleStatusEdit does not take this lock — it is
   Stage 3 — so a human promoting a lead to 'Client' mid-sweep can still be
   clobbered by a stale 'Cold' write. A lock only excludes writers that take it.
   ════════════════════════════════════════════════════════════ */

test('lock: taken before the read, flushed before release, released last', () => {
  const events = [];
  const probe = load(new FakeSpreadsheet({}), true);
  const leads = recordingSheet('Leads', leadsGrid(probe.sandbox), events);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true, { events });

  sandbox.moveColdLeads();
  const trace = events.slice();

  assert.equal(trace[0], 'tryLock(30000)', 'the lock is taken first, with a bounded timeout');

  const read = trace.indexOf('read');
  const firstWrite = trace.indexOf('write');
  const lastWrite = trace.lastIndexOf('write');
  const flush = trace.indexOf('flush');
  const release = trace.indexOf('releaseLock');

  assert.ok(read > 0 && read < firstWrite, 'the READ must be inside the lock, before any write');
  assert.equal(trace.filter((e) => e === 'write').length, 2, 'one Status write per swept lead');
  assert.ok(lastWrite < flush, 'writes land before the flush');
  assert.ok(flush < release, 'the flush happens before the lock is released');

  // The slow side effects (Contacts, email) are deliberately OUTSIDE the lock, so
  // release must not be the last thing that ever happens — but it must come after
  // every sheet write.
  assert.ok(release > lastWrite);
});

test('lock: refused → nothing swept, no email, no Contacts call, and a clear log', () => {
  const events = [];
  const probe = load(new FakeSpreadsheet({}), true);
  const leads = recordingSheet('Leads', leadsGrid(probe.sandbox), events);
  const before = JSON.stringify(leads.getDataRange().getValues());
  const { sandbox, logs, sentEmails, contactMoves } =
    load(new FakeSpreadsheet({ Leads: leads }), true, { events, lockGranted: false });

  assert.doesNotThrow(() => sandbox.moveColdLeads());

  assert.equal(JSON.stringify(leads.getDataRange().getValues()), before,
    'a refused lock must leave every lead exactly as it was — no half-swept table');
  assert.ok(!events.includes('write'));
  assert.ok(!events.includes('releaseLock'), 'a lock never acquired must not be released');
  assert.equal(sentEmails.length, 0, 'and no summary email claiming leads went cold');
  assert.deepEqual(contactMoves, []);

  const log = logs.join('\n');
  assert.match(log, /could not acquire the script lock/i);
  assert.match(log, /next scheduled sweep/i, 'the log must say why skipping is safe');
});

test('lock: released even when the header is mangled and the sweep throws', () => {
  const events = [];
  const broken = MANGLED.filter((h) => norm(h) !== 'timestamp');
  const leads = recordingSheet('Leads', [broken, new Array(broken.length).fill('x')], events);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true, { events });

  sandbox.moveColdLeads();

  // A leaked lock would block every later sweep AND every referral credit (the
  // GAS script lock is process-wide) until the execution times out.
  assert.ok(events.includes('tryLock(30000)'));
  assert.ok(events.includes('releaseLock'), 'the lock must be released on the throwing path');
  assert.ok(!events.includes('write'));
});

/* ── The legacy branch: proof production is byte-for-byte unchanged ──
   Delete at cutover, with the legacy body. */

test('legacy branch (flag off): still appends to Cold, DELETES from Active, and syncs the category tab', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;
  const D = coldDays(probe.sandbox);

  // Rotate the 31-column legacy header so nothing sits at its COLS index either.
  const header = LEAD_HEADERS.slice(11).concat(LEAD_HEADERS.slice(0, 11));
  const at = (n) => header.indexOf(n);
  assert.notDeepEqual(header, LEAD_HEADERS);

  const mk = (vals) => {
    const r = new Array(header.length).fill('');
    Object.keys(vals).forEach((n) => { r[at(n)] = vals[n]; });
    return r;
  };
  const stale = mk({ 'Lead ID': 'AXP-2026-0001', Timestamp: daysAgo(D + 10), Status: 'New Lead',
                     Email: 'stale@x.com', 'First Name': 'Stale', 'Last Name': 'Lead',
                     Role: 'investor', Category: 'Investor' });
  const fresh = mk({ 'Lead ID': 'AXP-2026-0002', Timestamp: daysAgo(2), Status: 'New Lead',
                     Email: 'fresh@x.com', 'First Name': 'Fresh', 'Last Name': 'Lead',
                     Role: 'investor', Category: 'Investor' });

  const active = new FakeSheet('Active Leads', [header.slice(), stale, fresh]);
  const cold = new FakeSheet('Cold Leads', [header.slice()]);
  const investors = new FakeSheet('Investors', [header.slice(),
    mk({ Email: 'stale@x.com', Status: 'New Lead', Role: 'investor' })]);

  const { sandbox, sentEmails, contactMoves, events } = load(new FakeSpreadsheet({
    'Active Leads': active, 'Cold Leads': cold, Investors: investors,
  }), false);

  sandbox.moveColdLeads();

  // The legacy row-relocation behavior, intact: appended to Cold, deleted from Active.
  assert.equal(cold.getDataRange().getValues()[1][at('Email')], 'stale@x.com');
  assert.equal(cold.getDataRange().getValues()[1][at('Status')], 'Cold');
  assert.equal(active.deletedRows.length, 1, 'legacy still deletes the row from Active');
  assert.deepEqual(
    active.getDataRange().getValues().slice(1).map((r) => r[at('Email')]),
    ['fresh@x.com'],
  );
  // And the duplicate on the category tab is still kept in sync.
  assert.equal(investors.getDataRange().getValues()[1][at('Status')], 'Cold');

  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].body, /AXP-2026-0001/);
  assert.ok(!sentEmails[0].body.includes('AXP-2026-0002'));
  assert.deepEqual(contactMoves, ['stale@x.com']);

  // Legacy takes NO lock. Adding one to the legacy body would be a behavior change
  // to production, which this stage must not make.
  assert.deepEqual(events, [], 'the legacy path must not touch LockService or flush');
});
