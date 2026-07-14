'use strict';

/*
 * handleStatusEdit — the unified-schema rewrite (migration Stage 3).
 *
 * Legacy treats a status as a PLACE: 'Cold' means "copy this row to the Cold Leads
 * tab and delete it from Active", 'Client' means "copy it to Clients", 'Archive'
 * means "copy it to Archive and delete it". Unified treats a status as what it is —
 * a value in a cell that the HUMAN HAS ALREADY WRITTEN by the time the onEdit
 * trigger fires. The row moves nowhere. All that remains is the Contacts side
 * effect. With this stage, no unified path in the file deletes a lead row.
 *
 * THE CENTERPIECE of this file is the shared-lock section near the bottom. Stage 2
 * shipped a lock that only serialized sweep-vs-sweep, and flagged that a sweep
 * could still clobber a human's Status edit. Closing that needed TWO things, and
 * both are proven here:
 *
 *   1. handleStatusEdit and moveColdLeads must contend for the SAME lock — not
 *      each hold "a" lock. Proven by driving one WHILE the other holds it and
 *      asserting it is refused.
 *   2. The sweep must re-read each row's LIVE status immediately before stamping
 *      'Cold'. This is the part a lock CANNOT do: the human's write is performed
 *      by the Sheets UI, which takes no lock, so by the time handleStatusEdit runs
 *      the cell is already changed. Proven by mutating the cell between the sweep's
 *      snapshot and its write.
 *
 * FIXTURE RULE: hand-typed header, mangled differently again from both
 * referrer-stats.test.js and cold-sweep.test.js. Three fixtures, three scrambles.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/* A REAL, stateful, exclusive lock — not a stub that always says yes.
   getScriptLock() returns THE SAME object every call, exactly as Apps Script's
   process-wide script lock does. That singleton is what makes the contention tests
   below meaningful: if two functions took two different locks, tryLock would never
   be refused and those tests would fail. */
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
    releaseLock() { held = false; events.push('releaseLock'); },
    waitLock() { throw new Error('locked paths must use tryLock, never waitLock'); },
    isHeld() { return held; },
  };
}

function load(spreadsheet, unified, opts) {
  opts = opts || {};
  const logs = [];
  const sentEmails = [];
  const contactCalls = [];
  const groupAdds = [];
  const events = opts.events || [];
  const lock = opts.lock || makeScriptLock(events);

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
    SpreadsheetApp: { openById: () => spreadsheet, flush: () => { events.push('flush'); } },
    LockService: { getScriptLock: () => lock },   // the SAME lock, every call
    GmailApp: { sendEmail(to, subject, body) { sentEmails.push({ to, subject, body }); } },
    ContactsApp: {
      getContactsByEmailAddress(email) {
        contactCalls.push(email);
        return [{
          addToGroup: (g) => groupAdds.push({ email, group: g && g._name }),
          removeFromGroup() {},
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
  return { sandbox, logs, sentEmails, contactCalls, groupAdds, events, lock };
}

/* ── Mangled unified header, scramble #3 ── */
const MANGLED = [
  'Referral Code',
  'Phone',
  'STATUS',
  'Referred By Name',
  'Details',
  'Category',
  'Chain Depth',
  'first name',
  'Total Downstream',
  'Timestamp',
  'Referred By Lead ID',
  'Company',
  'Last  Name',
  ' email ',
  'Referral Chain',
  'Match Type',
  'Direct Referrals',
  'Heard About',
  'Lead ID',
  'Referred By Code',
  'Source',
  'Reports Enabled',
  'Last Referral Date',
  'referred by email',
  'Role',
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
function statusAt(sheet, rowNum) {
  return sheet.getDataRange().getValues()[rowNum - 1][colOf('Status')];
}

/** One lead on row 2, whose Status the human has already set to `status` (the
 *  Sheets UI wrote it; that is what fired the trigger). */
function leadsWith(status, extra) {
  return new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead(Object.assign({
      'Lead ID': 'AXP-2026-0001', Email: 'lead@x.com', 'First Name': 'Edited',
      'Last Name': 'Lead', Status: status, Category: 'Investor', Role: 'investor',
      Timestamp: daysAgo(5),
    }, extra || {})),
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

/* ── The unified branch: a status edit is just a status edit ── */

test('unified: Status→Cold moves the CONTACT, and moves no row — nothing appended, nothing deleted', () => {
  const leads = leadsWith('Cold');
  const { sandbox, contactCalls } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.handleStatusEdit('Leads', 2, [], 'Cold', null);

  assert.equal(leads.appended.length, 0, 'no row may be appended anywhere');
  assert.equal(leads.deletedRows.length, 0, 'and the row-deletion path is GONE');
  assert.equal(leads.getLastRow(), 2, 'the lead is still there');
  assert.equal(statusAt(leads, 2), 'Cold', 'the human already wrote this; we must not undo it');
  assert.deepEqual(contactCalls, ['lead@x.com'], 'the Contacts move still runs');
});

test('unified: Status→Client labels the contact and appends to no Clients tab', () => {
  const leads = leadsWith('Client');
  const { sandbox, groupAdds } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.handleStatusEdit('Leads', 2, [], 'Client', null);

  assert.equal(leads.appended.length, 0);
  assert.equal(leads.deletedRows.length, 0);
  assert.equal(statusAt(leads, 2), 'Client');
  assert.deepEqual(groupAdds, [{ email: 'lead@x.com', group: 'AxisPoint Clients' }]);
});

test('unified: Archive and the restore statuses move nothing and touch no contact', () => {
  ['Archive', 'New Lead', 'Active', 'Contacted'].forEach((status) => {
    const leads = leadsWith(status);
    const { sandbox, contactCalls, groupAdds } = load(new FakeSpreadsheet({ Leads: leads }), true);

    sandbox.handleStatusEdit('Leads', 2, [], status, null);

    // Legacy's entire job for these four was the row move. The row no longer
    // moves, so there is nothing left to do — and that silence is deliberate.
    assert.equal(leads.appended.length, 0, status + ': nothing appended');
    assert.equal(leads.deletedRows.length, 0, status + ': nothing deleted');
    assert.equal(statusAt(leads, 2), status);
    assert.deepEqual(contactCalls, [], status + ': no Contacts call');
    assert.deepEqual(groupAdds, [], status + ': no group change');
  });
});

test('unified: the side effect follows the LIVE cell, not the stale edit event', () => {
  // The event says 'Client', but by the time we hold the lock the cell reads
  // 'Cold' — a sweep got there first. Acting on the event would label them a
  // Client in Google Contacts while the Sheet says Cold: two systems disagreeing,
  // silently, forever.
  const leads = leadsWith('Cold');
  const { sandbox, logs, contactCalls, groupAdds } =
    load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.handleStatusEdit('Leads', 2, [], 'Client', null);

  assert.deepEqual(contactCalls, ['lead@x.com'], 'acted on the LIVE Cold, not the event Client');
  // It ran the COLD path (which labels them AxisPoint Cold), and specifically did
  // NOT run the Client path the stale event asked for.
  assert.deepEqual(groupAdds.map((g) => g.group), ['AxisPoint Cold']);
  assert.ok(!groupAdds.some((g) => g.group === 'AxisPoint Clients'),
    'must NOT have labeled them a Client on the strength of a stale event');
  assert.equal(statusAt(leads, 2), 'Cold', 'and must NOT auto-restore the cell');

  const log = logs.join('\n');
  assert.match(log, /CONFLICT on row 2/);
  assert.match(log, /NOT being auto-restored/,
    'the refusal to auto-restore must be stated, not silent');
});

test('unified: a mangled header missing Status does nothing and releases the lock', () => {
  const broken = MANGLED.filter((h) => norm(h) !== 'status');
  const leads = new FakeSheet('Leads', [broken, new Array(broken.length).fill('x')]);
  const events = [];
  const { sandbox, contactCalls } = load(new FakeSpreadsheet({ Leads: leads }), true, { events });

  // resolveUnifiedCols throws; onSheetEdit's try/catch is what swallows it in
  // production. What matters here is that no side effect ran on a guessed column
  // and the process-wide lock did not leak.
  assert.throws(() => sandbox.handleStatusEdit('Leads', 2, [], 'Cold', null), /Status/);
  assert.deepEqual(contactCalls, []);
  assert.equal(events[events.length - 1], 'releaseLock', 'the lock must be released on the throwing path');
});

test('unified: a refused lock skips only the Contacts update, and says the Sheet is still correct', () => {
  const leads = leadsWith('Cold');
  const events = [];
  const lock = makeScriptLock(events);
  lock.tryLock = () => { events.push('tryLock'); return false; };   // permanently contended

  const { sandbox, logs, contactCalls } =
    load(new FakeSpreadsheet({ Leads: leads }), true, { events, lock });

  assert.doesNotThrow(() => sandbox.handleStatusEdit('Leads', 2, [], 'Cold', null));

  assert.deepEqual(contactCalls, [], 'no side effect on a refused lock');
  assert.equal(statusAt(leads, 2), 'Cold', 'and the human\'s edit is untouched — the UI already saved it');
  const log = logs.join('\n');
  assert.match(log, /could not acquire the script lock/i);
  assert.match(log, /Status edit itself IS saved/i, 'must not imply the edit was lost');
});

/* ════════════════════════════════════════════════════════════
   THE CENTERPIECE: the sweep and the status edit now contend for the SAME lock.

   Stage 2's lock serialized sweep-vs-sweep only. The gap it flagged was
   sweep-vs-human-edit. Closing it took two independent mechanisms, and BOTH are
   asserted below, because either one alone leaves a real hole:

     A. THE SHARED LOCK. Both functions must take the same process-wide lock, so
        their critical sections cannot interleave. It is not enough that each has
        "a" lock — two separate locks would serialize nothing. The tests drive one
        function from INSIDE the other's critical section and assert refusal.

     B. THE SWEEP'S PRE-WRITE RE-READ. The lock CANNOT protect the human's edit,
        because the Sheets UI performs that write and takes no lock; by the time
        handleStatusEdit fires, the cell is already changed. Only the sweep
        re-checking the live cell immediately before stamping can prevent the
        clobber.

   HONEST LIMITS, same as Stages 1 and 2: none of this proves Apps Script's
   LockService actually delivers mutual exclusion. There is no concurrency in a
   Node harness; the lock here is a faithful but stubbed state machine. What IS
   proven is what is ours to get wrong: that both functions reach for the same lock
   object, that a held lock refuses the other one, that neither leaks it, and that
   the sweep re-verifies before it writes. Real mutual exclusion is Google's
   guarantee, observable only in the live runtime.
   ════════════════════════════════════════════════════════════ */

test('SAME LOCK: a status edit arriving mid-sweep is refused, because the sweep holds the one lock', () => {
  const events = [];
  const lock = makeScriptLock(events);

  const leads = new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead({ 'Lead ID': 'AXP-2026-0001', Email: 'stale@x.com', Status: 'New Lead',
             Timestamp: daysAgo(90), Category: 'Investor', Role: 'investor' }),
  ]);

  const ctx = load(new FakeSpreadsheet({ Leads: leads }), true, { events, lock });

  // Fire an onEdit-style status edit from INSIDE the sweep's critical section:
  // the sweep is mid-write and still holds the lock.
  let reentered = false;
  const realGetRange = leads.getRange.bind(leads);
  leads.getRange = (...args) => {
    const range = realGetRange(...args);
    const realSetValue = range.setValue.bind(range);
    range.setValue = (v) => {
      const out = realSetValue(v);
      if (!reentered) {
        reentered = true;
        assert.ok(lock.isHeld(), 'precondition: the sweep must be holding the lock right now');
        events.push('-- status edit arrives --');
        ctx.sandbox.handleStatusEdit('Leads', 2, [], 'Client', null);
      }
      return out;
    };
    return range;
  };

  ctx.sandbox.moveColdLeads();

  assert.ok(reentered, 'the test must actually have re-entered mid-sweep');

  // THE ASSERTION. The status edit asked for the lock and was REFUSED — proof the
  // two functions contend for one lock. With two independent locks it would have
  // sailed straight through.
  const arrival = events.indexOf('-- status edit arrives --');
  const refusedAfter = events.indexOf('REFUSED');
  assert.ok(refusedAfter > arrival, 'the status edit must be refused while the sweep holds the lock');

  // The refused edit was a promotion to 'Client'. Had it run, the contact would
  // carry the Clients label. The only Contacts work that happened is the SWEEP's
  // own Cold labeling, which runs after it releases the lock.
  assert.ok(!ctx.groupAdds.some((g) => g.group === 'AxisPoint Clients'),
    'the refused status edit must have run no Contacts side effect');
  assert.deepEqual(ctx.groupAdds.map((g) => g.group), ['AxisPoint Cold'],
    'only the sweep\'s own Cold labeling should have happened');

  // The sweep still completed and released cleanly.
  assert.equal(statusAt(leads, 2), 'Cold');
  assert.ok(!lock.isHeld(), 'the sweep must have released the lock');
  assert.match(ctx.logs.join('\n'), /could not acquire the script lock/i);
});

test('SAME LOCK: a sweep arriving mid-status-edit is refused, and sweeps nothing', () => {
  const events = [];
  const lock = makeScriptLock(events);

  const leads = new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead({ 'Lead ID': 'AXP-2026-0001', Email: 'lead@x.com', Status: 'Client',
             Timestamp: daysAgo(400), Category: 'Investor', Role: 'investor' }),
  ]);

  const ctx = load(new FakeSpreadsheet({ Leads: leads }), true, { events, lock });

  // Fire the sweep from inside handleStatusEdit's critical section (it holds the
  // lock while it reads the live row).
  let reentered = false;
  const realGetRange = leads.getRange.bind(leads);
  leads.getRange = (...args) => {
    const range = realGetRange(...args);
    const realGetValues = range.getValues.bind(range);
    range.getValues = () => {
      const v = realGetValues();
      if (!reentered && lock.isHeld()) {
        reentered = true;
        events.push('-- sweep arrives --');
        ctx.sandbox.moveColdLeads();
      }
      return v;
    };
    return range;
  };

  ctx.sandbox.handleStatusEdit('Leads', 2, [], 'Client', null);

  assert.ok(reentered, 'the test must actually have re-entered mid-edit');
  const arrival = events.indexOf('-- sweep arrives --');
  assert.ok(events.indexOf('REFUSED') > arrival, 'the sweep must be refused while the edit holds the lock');

  // A 400-day-old lead that the sweep would happily have touched had it not been
  // refused — and it is a Client, so it must never be swept anyway.
  assert.equal(statusAt(leads, 2), 'Client');
  assert.equal(leads.deletedRows.length, 0);
  assert.ok(!lock.isHeld(), 'the edit must have released the lock');
});

test('SAME LOCK: it is one lock object, and it is released — not leaked — between callers', () => {
  const events = [];
  const lock = makeScriptLock(events);
  const leads = leadsWith('Cold');
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads }), true, { events, lock });

  // Every locked path reaches for the same object, exactly as GAS's process-wide
  // script lock behaves. If any of them ever built its own lock, these would differ.
  assert.equal(sandbox.LockService.getScriptLock(), sandbox.LockService.getScriptLock());

  sandbox.handleStatusEdit('Leads', 2, [], 'Cold', null);
  assert.ok(!lock.isHeld(), 'released after the status edit');

  sandbox.moveColdLeads();
  assert.ok(!lock.isHeld(), 'released after the sweep');

  sandbox.updateReferrerStats('AXP-2026-0001', 'AXP-2026-0001');
  assert.ok(!lock.isHeld(), 'released after the referral credit — all three share one lock');

  // Never refused when run sequentially: a leak would show up as a refusal here.
  assert.ok(!events.includes('REFUSED'), 'sequential calls must never contend');
});

test('THE CLOBBER GUARD: the sweep re-reads the live Status and will not stamp over a human edit', () => {
  // The case no lock can fix: the human's write is done by the Sheets UI, which
  // takes no lock, and it lands AFTER the sweep has read its snapshot.
  const events = [];
  const leads = new FakeSheet('Leads', [
    MANGLED.slice(),
    mkLead({ 'Lead ID': 'AXP-2026-0001', Email: 'promoted@x.com', Status: 'New Lead',
             Timestamp: daysAgo(90), Category: 'Investor', Role: 'investor' }),
    mkLead({ 'Lead ID': 'AXP-2026-0002', Email: 'stale@x.com', Status: 'New Lead',
             Timestamp: daysAgo(90), Category: 'Investor', Role: 'investor' }),
  ]);

  // Simulate the human promoting lead 1 to 'Client' in the window between the
  // sweep's snapshot read and its write — the exact race Stage 2 flagged.
  const realGetDataRange = leads.getDataRange.bind(leads);
  leads.getDataRange = () => {
    const range = realGetDataRange();
    const realGetValues = range.getValues.bind(range);
    range.getValues = () => {
      const snapshot = realGetValues();          // sweep sees 'New Lead' + 90 days old
      leads.getRange(2, colOf('Status') + 1).setValue('Client');   // ...then the human types
      return snapshot;                            // the sweep is now holding a STALE view
    };
    return range;
  };

  const { sandbox, logs } = load(new FakeSpreadsheet({ Leads: leads }), true, { events });

  sandbox.moveColdLeads();

  // Without the pre-write re-read, the sweep's stale decision would silently
  // overwrite this human's promotion with 'Cold'.
  assert.equal(statusAt(leads, 2), 'Client', 'the human edit must survive the sweep');
  assert.match(logs.join('\n'), /changed to "Client" after this sweep read the table/);

  // And the genuinely-stale lead beside it is still swept — the guard must not
  // turn into "never sweep anything".
  assert.equal(statusAt(leads, 3), 'Cold');
});

/* ── The legacy branch: byte-for-byte production behavior, all four paths ── */

test('legacy branch (flag off): every status still relocates the row exactly as production does', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;

  // Rotate the legacy 31-column header so nothing sits at its COLS index.
  const header = LEAD_HEADERS.slice(17).concat(LEAD_HEADERS.slice(0, 17));
  const at = (n) => header.indexOf(n);
  assert.notDeepEqual(header, LEAD_HEADERS);

  const mk = (vals) => {
    const r = new Array(header.length).fill('');
    Object.keys(vals).forEach((n) => { r[at(n)] = vals[n]; });
    return r;
  };
  const rowFor = (status) => mk({ 'Lead ID': 'AXP-2026-0001', Email: 'legacy@x.com',
                                  Status: status, Role: 'investor', Category: 'Investor' });

  const build = () => {
    const active = new FakeSheet('Active Leads', [header.slice(), rowFor('New Lead')]);
    const cold = new FakeSheet('Cold Leads', [header.slice(), rowFor('Cold')]);
    const clients = new FakeSheet('Clients', [header.slice()]);
    const archive = new FakeSheet('Archive', [header.slice()]);
    return { active, cold, clients, archive,
             ss: new FakeSpreadsheet({ 'Active Leads': active, 'Cold Leads': cold,
                                       Clients: clients, Archive: archive }) };
  };

  // Cold: appended to Cold Leads, DELETED from Active.
  let f = build();
  let events = [];
  let ctx = load(f.ss, false, { events });
  // onSheetEdit passes the cols it RESOLVED off the edited tab, not the compile-time
  // COLS — so the test must too, or it is testing a caller that does not exist.
  ctx.sandbox.handleStatusEdit('Active Leads', 2, rowFor('Cold'), 'Cold', ctx.sandbox.resolveCols(f.active));
  assert.equal(f.cold.appended.length, 1, 'Cold: appended to Cold Leads');
  assert.deepEqual(f.active.deletedRows, [2], 'Cold: deleted from Active');
  assert.deepEqual(ctx.contactCalls, ['legacy@x.com']);

  // Client: appended to Clients, NOT deleted from Active (legacy quirk, preserved).
  f = build(); ctx = load(f.ss, false, { events: [] });
  ctx.sandbox.handleStatusEdit('Active Leads', 2, rowFor('Client'), 'Client', ctx.sandbox.resolveCols(f.active));
  assert.equal(f.clients.appended.length, 1, 'Client: appended to Clients');
  assert.deepEqual(f.active.deletedRows, [], 'Client: legacy does NOT delete from Active');
  assert.deepEqual(ctx.groupAdds, [{ email: 'legacy@x.com', group: 'AxisPoint Clients' }]);

  // Archive: appended to Archive, DELETED from Active.
  f = build(); ctx = load(f.ss, false, { events: [] });
  ctx.sandbox.handleStatusEdit('Active Leads', 2, rowFor('Archive'), 'Archive', ctx.sandbox.resolveCols(f.active));
  assert.equal(f.archive.appended.length, 1, 'Archive: appended to Archive');
  assert.deepEqual(f.active.deletedRows, [2], 'Archive: deleted from Active');

  // Restore from Cold: appended back to Active, DELETED from Cold Leads.
  f = build(); ctx = load(f.ss, false, { events: [] });
  ctx.sandbox.handleStatusEdit('Cold Leads', 2, rowFor('Active'), 'Active', ctx.sandbox.resolveCols(f.cold));
  assert.equal(f.active.appended.length, 1, 'restore: appended back to Active');
  assert.deepEqual(f.cold.deletedRows, [2], 'restore: deleted from Cold Leads');

  // And legacy takes NO lock. Adding one would be a change to live production,
  // which this stage must not make.
  assert.deepEqual(events.filter((e) => /Lock|flush/i.test(e)), [],
    'the legacy path must not touch LockService or flush');
});
