'use strict';

/*
 * handleManualReferralLink — the unified-schema rewrite (migration Stage 5).
 *
 * A human types a referrer's email into the Referred By Email cell. We find that
 * referrer, back-fill the seven referral columns on the edited row, credit the
 * whole chain, log the relationship to the Referrals tab, and notify the referrer.
 *
 * THIS STAGE CLOSES THE HOLE STAGE 4 OPENED. Stage 4 migrated onSheetEdit but
 * REFUSED to call this handler, because it still scanned Lifetime Leads — which
 * does not exist under the unified schema — and its own missing-tab guard returned
 * SILENTLY. Wired up as-is, it would have accepted a human's edit and dropped it
 * with no error anywhere. So the headline test here is not "the refusal is gone",
 * it is "a Referred By Email edit now actually COMPLETES, end to end".
 *
 * FIXTURE RULE: hand-typed header, mangled a FIFTH distinct way.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/* The one process-wide script lock, as a real state machine. Also models what
   nextReferralSequence() does: waitLock() on the SAME lock. If any code path holds
   the lock across that call, waitLock throws here — which is precisely the
   reentrancy deadlock this stage's lock scoping exists to avoid. */
function makeScriptLock(events) {
  let held = false;
  return {
    tryLock(ms) {
      events.push('tryLock(' + ms + ')');
      if (held) { events.push('REFUSED'); return false; }
      held = true;
      events.push('ACQUIRED');
      return true;
    },
    waitLock(ms) {
      events.push('waitLock(' + ms + ')');
      if (held) {
        // A real GAS execution cannot wait on a lock it already holds.
        throw new Error('DEADLOCK: waitLock() called while this execution already holds the script lock');
      }
      held = true;
      return true;
    },
    releaseLock() { held = false; events.push('releaseLock'); },
    isHeld() { return held; },
  };
}

function load(spreadsheet, unified, opts) {
  opts = opts || {};
  const logs = [];
  const sentEmails = [];
  const events = opts.events || [];
  const lock = opts.lock || makeScriptLock(events);
  const props = { LAST_REFERRAL_ID: '7', SPREADSHEET_ID: 'FAKE_ID' };

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
        getProperty: (k) => props[k] || '',
        setProperty: (k, v) => { props[k] = v; },
        setProperties() {},
      }),
    },
    SpreadsheetApp: { openById: () => spreadsheet, flush: () => events.push('flush') },
    LockService: { getScriptLock: () => lock },
    GmailApp: { sendEmail(to, subject, body, options) { sentEmails.push({ to, subject, body, options }); } },
    ContactsApp: {
      getContactsByEmailAddress: () => [],
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
  return { sandbox, logs, sentEmails, events, lock };
}

function editEvent(sheet, row, col1Based, value) {
  return { range: { getSheet: () => sheet, getRow: () => row, getColumn: () => col1Based, getValue: () => value } };
}

/* ── Mangled unified header, scramble #5 ── */
const MANGLED = [
  'Source',
  'Match  Type',
  'Referral Chain',
  'Email',
  'Details',
  'Referred By Name',
  'LEAD ID',
  'Reports Enabled',
  'Category',
  'Referral Code',
  'Phone',
  'Total Downstream',
  'first  name',
  'Status',
  'Referred By Code',
  'Timestamp',
  'Company',
  'referred by lead id',
  'Chain Depth',
  'Last Name',
  'Heard About',
  'Direct Referrals',
  'Referred By Email',
  'Role',
  'Last Referral Date',
];

const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
function colOf(name) {
  const i = MANGLED.findIndex((h) => norm(h) === norm(name));
  if (i === -1) throw new Error('fixture is missing a column: ' + name);
  return i;
}
const col1 = (n) => colOf(n) + 1;
function mkLead(values) {
  const row = new Array(MANGLED.length).fill('');
  Object.keys(values).forEach((n) => { row[colOf(n)] = values[n]; });
  return row;
}
function cellOf(sheet, rowNum, name) {
  return sheet.getDataRange().getValues()[rowNum - 1][colOf(name)];
}

/* A two-generation chain already exists: ORIGIN referred REFERRER.
   Row 4 is the lead a human is now hand-linking to REFERRER — which means ORIGIN
   must be credited a Total Downstream too, not just REFERRER. */
function worldSheet() {
  return new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead({ 'Lead ID': 'AXP-2026-0001', Email: 'origin@x.com', 'First Name': 'Olive',
             'Last Name': 'Origin', 'Referral Code': 'AXP-OOO111', 'Referral Chain': '',
             'Chain Depth': 0, 'Direct Referrals': 3, 'Total Downstream': 6, Status: 'Active' }),
    mkLead({ 'Lead ID': 'AXP-2026-0002', Email: 'referrer@x.com', 'First Name': 'Rita',
             'Last Name': 'Referrer', 'Referral Code': 'AXP-RRR222',
             'Referral Chain': 'AXP-2026-0001', 'Chain Depth': 1,
             'Direct Referrals': 1, 'Total Downstream': 1, Status: 'Active' }),
    mkLead({ 'Lead ID': 'AXP-2026-0003', Email: 'newlead@x.com', 'First Name': 'Nate',
             'Last Name': 'Newlead', 'Referral Code': 'AXP-NNN333',
             Status: 'New Lead', 'Direct Referrals': 0, 'Total Downstream': 0 }),
  ]);
}
const NEW_LEAD_ROW = 4;   // Nate's row, 1-based with the header

test('fixture header is genuinely drifted from the constants', () => {
  const { sandbox } = load(new FakeSpreadsheet({}), true);
  const { UNIFIED_LEAD_HEADERS, UCOLS } = sandbox;
  assert.equal(MANGLED.length, UNIFIED_LEAD_HEADERS.length);
  assert.notDeepEqual(MANGLED, Array.from(UNIFIED_LEAD_HEADERS));
  Object.keys(UCOLS).forEach((k) => {
    assert.notEqual(colOf(UNIFIED_LEAD_HEADERS[UCOLS[k]]), UCOLS[k],
      `"${UNIFIED_LEAD_HEADERS[UCOLS[k]]}" must not sit at its canonical index`);
  });
});

/* ════════════════════════════════════════════════════════════
   THE HEADLINE: a Referred By Email edit now COMPLETES, end to end.
   Not "the refusal is gone" — the whole thing actually happens, through the real
   onSheetEdit dispatcher, exactly as a human would trigger it.
   ════════════════════════════════════════════════════════════ */

test('END TO END: a Referred By Email edit links the referral — columns, stats, Referrals row, notification', () => {
  const leads = worldSheet();
  const referrals = new FakeSheet('Referrals', [[
    'Referral ID', 'Referrer Lead ID', 'Referrer Name', 'Referrer Email', 'Referrer Code',
    'Referred Lead ID', 'Referred Name', 'Referred Email',
    'Match Type', 'Chain Depth', 'Full Chain', 'Date', 'Status',
  ]]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);

  // The human types Rita's email into Nate's Referred By Email cell. The Sheets UI
  // has already written it; that write is what fires the trigger.
  leads.getRange(NEW_LEAD_ROW, col1('Referred By Email')).setValue('Referrer@X.com');
  sandbox.onSheetEdit(editEvent(leads, NEW_LEAD_ROW, col1('Referred By Email'), 'Referrer@X.com'));

  // 1. The seven referral columns are back-filled on Nate's row.
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referred By Lead ID'), 'AXP-2026-0002');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referred By Name'), 'Rita Referrer');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referred By Email'), 'referrer@x.com', 'lowercased');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referred By Code'), 'AXP-RRR222');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Match Type'), 'manual');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referral Chain'), 'AXP-2026-0001|AXP-2026-0002',
    'the chain is the referrer\'s own chain plus the referrer — ancestors only, never the new lead');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Chain Depth'), 2);

  // 2. Stats: Rita gets a direct referral; Olive, her ancestor, gets ONLY downstream.
  //    A hand-linked referral credits the full chain, exactly like an auto-matched one.
  assert.equal(cellOf(leads, 3, 'Direct Referrals'), 2, 'Rita 1 → 2');
  assert.equal(cellOf(leads, 3, 'Total Downstream'), 2, 'Rita 1 → 2');
  assert.equal(cellOf(leads, 2, 'Direct Referrals'), 3, 'Olive UNCHANGED — she did not refer Nate');
  assert.equal(cellOf(leads, 2, 'Total Downstream'), 7, 'Olive 6 → 7 — Nate is in her downstream');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Direct Referrals'), 0, 'Nate credits himself nothing');

  // 3. The Referrals tab row.
  assert.equal(referrals.getLastRow(), 2);
  const logged = referrals.getDataRange().getValues()[1];
  assert.equal(logged[1], 'AXP-2026-0002', 'referrer lead id');
  assert.equal(logged[5], 'AXP-2026-0003', 'referred lead id');
  assert.equal(logged[6], 'Nate Newlead');
  assert.equal(logged[7], 'newlead@x.com');
  assert.equal(logged[8], 'manual', 'match type');
  assert.equal(logged[10], 'AXP-2026-0001|AXP-2026-0002', 'full chain');
  assert.equal(logged[12], 'manual',
    'Status stays "manual" — routing this through logReferralEntry would have written "linked"');

  // 4. The referrer is notified.
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'referrer@x.com');
  assert.match(sentEmails[0].subject, /referred/i);

  // And no row was created or destroyed by any of it.
  assert.equal(leads.appended.length, 0);
  assert.equal(leads.deletedRows.length, 0);
});

test('unified: an email belonging to no lead links nothing, and says so', () => {
  const leads = worldSheet();
  const { sandbox, logs, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.onSheetEdit(editEvent(leads, NEW_LEAD_ROW, col1('Referred By Email'), 'nobody@x.com'));

  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referred By Lead ID'), '', 'nothing back-filled');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Match Type'), '');
  assert.equal(cellOf(leads, 3, 'Direct Referrals'), 1, 'nobody credited');
  assert.equal(sentEmails.length, 0);
  // Legacy returned silently here. One table makes this a diagnosable state.
  assert.match(logs.join('\n'), /no lead in "Leads" has the email "nobody@x\.com"/);
});

test('unified: a referrer with no chain of their own still links (1-deep chain)', () => {
  const leads = worldSheet();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true);

  // Link Nate to Olive, the chain's origin — her Referral Chain is empty.
  sandbox.onSheetEdit(editEvent(leads, NEW_LEAD_ROW, col1('Referred By Email'), 'origin@x.com'));

  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referral Chain'), 'AXP-2026-0001');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Chain Depth'), 1);
  assert.equal(cellOf(leads, 2, 'Direct Referrals'), 4, 'Olive 3 → 4');
  assert.equal(cellOf(leads, 2, 'Total Downstream'), 7, 'Olive 6 → 7');
});

test('unified: a blank Referred By Email does nothing at all', () => {
  const leads = worldSheet();
  const { sandbox, logs, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.onSheetEdit(editEvent(leads, NEW_LEAD_ROW, col1('Referred By Email'), ''));

  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Match Type'), '');
  assert.equal(sentEmails.length, 0);
  assert.deepEqual(logs, []);
});

test('unified: a mangled header missing a referral column links nothing and releases the lock', () => {
  const broken = MANGLED.filter((h) => norm(h) !== 'referral chain');
  const mk = (v) => {
    const r = new Array(broken.length).fill('');
    Object.keys(v).forEach((n) => { r[broken.findIndex((h) => norm(h) === norm(n))] = v[n]; });
    return r;
  };
  const leads = new FakeSheet('Leads', [broken,
    mk({ 'Lead ID': 'AXP-1', Email: 'referrer@x.com' }),
    mk({ 'Lead ID': 'AXP-2', Email: 'newlead@x.com' })]);
  const events = [];
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true, { events });

  // resolveUnifiedCols throws. The handler does not swallow it — onSheetEdit's
  // try/catch is what logs it in production (asserted separately below). What
  // matters here: nothing is written into a guessed column, and the process-wide
  // lock does not leak.
  assert.throws(() => sandbox.handleManualReferralLink(leads, 3, [], 'referrer@x.com', null),
    /Referral Chain/);
  assert.equal(sentEmails.length, 0);
  assert.equal(events[events.length - 1], 'releaseLock', 'the lock is released on the throwing path');

  // And through the real dispatcher, the throw is caught and logged, not raised.
  const ctx2 = load(new FakeSpreadsheet({ Leads: leads }), true);
  assert.doesNotThrow(() => ctx2.sandbox.onSheetEdit(editEvent(leads, 3, 1, 'referrer@x.com')));
  assert.match(ctx2.logs.join('\n'), /onSheetEdit error/);
});

/* ════════════════════════════════════════════════════════════
   THE LOCK. Two things to prove, and the second one is the subtle one.
   ════════════════════════════════════════════════════════════ */

test('SAME LOCK: a manual link arriving mid-sweep is refused, and writes nothing partial', () => {
  // Driven from INSIDE moveColdLeads' critical section — the same contention proof
  // as Stage 3. This is what shows the two functions share ONE lock rather than
  // each holding their own (two locks would never refuse).
  const events = [];
  const lock = makeScriptLock(events);

  const leads = worldSheet();
  // Make Nate stale so the sweep actually has work to do and holds the lock.
  leads.getRange(NEW_LEAD_ROW, col1('Timestamp'))
    .setValue(new Date(Date.now() - 200 * 86400000).toISOString());

  const ctx = load(new FakeSpreadsheet({ Leads: leads }), true, { events, lock });

  let reentered = false;
  const realGetRange = leads.getRange.bind(leads);
  leads.getRange = (...args) => {
    const range = realGetRange(...args);
    const realSetValue = range.setValue.bind(range);
    range.setValue = (v) => {
      const out = realSetValue(v);
      if (!reentered) {
        reentered = true;
        assert.ok(lock.isHeld(), 'precondition: the sweep holds the lock');
        events.push('-- manual link arrives --');
        ctx.sandbox.handleManualReferralLink(leads, NEW_LEAD_ROW, [], 'referrer@x.com', null);
      }
      return out;
    };
    return range;
  };

  ctx.sandbox.moveColdLeads();

  assert.ok(reentered, 'the test must actually have re-entered mid-sweep');
  const arrival = events.indexOf('-- manual link arrives --');
  assert.ok(events.indexOf('REFUSED') > arrival, 'the manual link must be refused while the sweep holds the lock');

  // Refused means NOTHING partial: no referral columns, no stats, no notification.
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Referred By Lead ID'), '');
  assert.equal(cellOf(leads, NEW_LEAD_ROW, 'Match Type'), '');
  assert.equal(cellOf(leads, 3, 'Direct Referrals'), 1, 'Rita must not have been credited');
  // The sweep sends its own summary email to NOTIFY_EMAILS; what must NOT exist is
  // a referrer notification, which would mean the refused link half-ran.
  assert.ok(!ctx.sentEmails.some((e) => e.to === 'referrer@x.com'),
    'the refused link must not have notified the referrer');

  const log = ctx.logs.join('\n');
  assert.match(log, /could not acquire the script lock/i);
  assert.match(log, /Nothing partial was written/i);
  assert.match(log, /Re-type the email/i, 'the human must be told how to retry');
});

test('LOCK SCOPE: the downstream calls run OUTSIDE the lock — no reentrant deadlock', () => {
  /* THE SUBTLE ONE. updateReferrerStats takes the script lock itself (Stage 1), and
     nextReferralSequence calls waitLock() on the SAME lock. Apps Script does not
     document the script lock as reentrant, so holding it across either call is a
     deadlock — one that would only ever appear in production.

     The lock stub models this honestly: waitLock() THROWS if the lock is already
     held. So if a future refactor "tidies up" by widening the lock to wrap the whole
     function, this test fails with a DEADLOCK error rather than shipping. */
  const events = [];
  const leads = worldSheet();
  const referrals = new FakeSheet('Referrals', [['Referral ID', 'Referrer Lead ID', 'Referrer Name',
    'Referrer Email', 'Referrer Code', 'Referred Lead ID', 'Referred Name', 'Referred Email',
    'Match Type', 'Chain Depth', 'Full Chain', 'Date', 'Status']]);
  const { sandbox, lock } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true, { events });

  assert.doesNotThrow(
    () => sandbox.onSheetEdit(editEvent(leads, NEW_LEAD_ROW, col1('Referred By Email'), 'referrer@x.com')),
    'a reentrant lock acquisition would surface here as a DEADLOCK',
  );

  // The row write took the lock and RELEASED it before the downstream work began.
  const firstRelease = events.indexOf('releaseLock');
  const waitLock = events.findIndex((e) => e.startsWith('waitLock'));
  assert.ok(firstRelease > -1, 'the critical section released the lock');
  assert.ok(waitLock > firstRelease,
    'nextReferralSequence\'s waitLock must happen AFTER the critical section released');

  // updateReferrerStats re-acquired the lock on its own afterwards — which is only
  // possible because we were not still holding it.
  const acquisitions = events.filter((e) => e === 'ACQUIRED').length;
  assert.ok(acquisitions >= 2, 'the row write and the stats update each took the lock separately');
  assert.ok(!lock.isHeld(), 'and everything released it');
  assert.ok(!events.includes('REFUSED'), 'a single execution must never contend with itself');
});

/* ── The legacy branch: byte-for-byte production behavior ── */

test('legacy branch (flag off): still scans Lifetime Leads and writes the same row', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;

  const header = LEAD_HEADERS.slice(9).concat(LEAD_HEADERS.slice(0, 9));
  const at = (n) => header.indexOf(n);
  assert.notDeepEqual(Array.from(header), Array.from(LEAD_HEADERS));
  const mk = (v) => {
    const r = new Array(header.length).fill('');
    Object.keys(v).forEach((n) => { r[at(n)] = v[n]; });
    return r;
  };

  const lifetime = new FakeSheet('Lifetime Leads', [header.slice(),
    mk({ 'Lead ID': 'AXP-L-1', Email: 'referrer@x.com', 'First Name': 'Rita', 'Last Name': 'Referrer',
         'Referral Code': 'AXP-RRR222', 'Referral Chain': '', 'Direct Referrals': 1 }),
    mk({ 'Lead ID': 'AXP-L-2', Email: 'newlead@x.com', 'First Name': 'Nate', 'Last Name': 'Newlead' })]);
  const active = new FakeSheet('Active Leads', [header.slice(),
    mk({ 'Lead ID': 'AXP-L-2', Email: 'newlead@x.com', 'First Name': 'Nate', 'Last Name': 'Newlead' })]);
  const referrals = new FakeSheet('Referrals', [['Referral ID', 'Referrer Lead ID', 'Referrer Name',
    'Referrer Email', 'Referrer Code', 'Referred Lead ID', 'Referred Name', 'Referred Email',
    'Match Type', 'Chain Depth', 'Full Chain', 'Date', 'Status']]);

  const ss = new FakeSpreadsheet({ 'Lifetime Leads': lifetime, 'Active Leads': active, Referrals: referrals });
  const { sandbox, sentEmails } = load(ss, false);

  // Dispatched exactly as onSheetEditLegacy does: the edited sheet + its resolved cols.
  sandbox.handleManualReferralLink(active, 2, active.getDataRange().getValues()[1],
    'referrer@x.com', sandbox.resolveCols(active));

  const row = active.getDataRange().getValues()[1];
  assert.equal(row[at('Referred By Lead ID')], 'AXP-L-1');
  assert.equal(row[at('Referred By Name')], 'Rita Referrer');
  assert.equal(row[at('Match Type')], 'manual');
  assert.equal(row[at('Referral Chain')], 'AXP-L-1');
  assert.equal(row[at('Chain Depth')], 1);

  // Legacy credits the referrer on every lead tab it appears on (the duplication
  // this migration deletes). Here: Lifetime Leads.
  assert.equal(lifetime.getDataRange().getValues()[1][at('Direct Referrals')], 2);

  assert.equal(referrals.getLastRow(), 2);
  assert.equal(referrals.getDataRange().getValues()[1][12], 'manual', 'Status column');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'referrer@x.com');
});
