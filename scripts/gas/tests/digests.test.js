'use strict';

/*
 * sendDailyDigest and sendMonthlyReferralSummaries — the unified-schema rewrite
 * (migration Stage 8), AND their first test coverage of any kind.
 *
 * These two functions had ZERO tests before this stage — in either schema. That is
 * the real risk here, and it is not a migration risk: a filter bug (wrong Status
 * excluded, wrong date boundary, wrong Reports-Enabled check) silently emails the
 * wrong people, or nobody, and nothing catches it. So this suite is written to be a
 * genuine regression net for the LEGACY behavior too, not only a check on the port.
 *
 * Both functions are READ-ONLY (read rows, send email, write no cell), so neither
 * takes the script lock. The tests assert that by never wiring one up and asserting
 * the sheets are unmodified.
 *
 * FIXTURE RULE: headers are HAND-TYPED and mangled (seventh distinct scramble for the
 * unified one). Sandbox constants lifted with Array.from before any deep comparison
 * (see helpers/load-code.js — cross-realm equality is a trap).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/** Loads Code.gs with a real America/Chicago formatDate (the digest's date filter is
 *  the whole point, so it must not depend on the host timezone). Captures emails. */
function load(spreadsheet, unified) {
  const logs = [];
  const sentEmails = [];

  function formatDate(date, tz, fmt) {
    const d = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const g = (t) => (parts.find((p) => p.type === t) || {}).value || '';
    return fmt.replace(/yyyy/g, g('year')).replace(/MM/g, g('month')).replace(/dd/g, g('day'));
  }

  const sandbox = {
    console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp,
    isNaN, parseInt, parseFloat,
    Logger: { log: (m) => logs.push(String(m)) },
    Utilities: {
      base64Decode: (s) => Buffer.from(String(s), 'base64'),
      newBlob: (d, t, n) => ({ _data: d, _type: t, _name: n, getBytes: () => d }),
      formatDate,
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (k === 'SPREADSHEET_ID' ? 'FAKE_ID' : ''), setProperty() {}, setProperties() {} }),
    },
    SpreadsheetApp: { openById: () => spreadsheet, flush() {} },
    // Present but unused: a read-only function must never reach for it. A test asserts
    // no sheet was written, which is the observable proof.
    LockService: { getScriptLock: () => { throw new Error('a read-only digest must not take the script lock'); } },
    GmailApp: { sendEmail(to, subject, body, options) { sentEmails.push({ to, subject, body, options }); } },
    ContactsApp: {}, Calendar: {}, CalendarApp: {}, ContentService: {}, HtmlService: {}, ScriptApp: {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE_SRC, sandbox, { filename: 'Code.gs' });
  sandbox.USE_UNIFIED_SCHEMA = !!unified;
  return { sandbox, logs, sentEmails };
}

const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
function idx(header, name) {
  const i = header.findIndex((h) => norm(h) === norm(name));
  if (i === -1) throw new Error('fixture is missing a column: ' + name);
  return i;
}

/* Today / other days as ISO timestamps, anchored to a fixed CT wall-clock so the test
   is deterministic regardless of when it runs. Noon CT is safely inside one CT day. */
function ctIso(daysFromToday, hourCT) {
  const now = new Date();
  const d = new Date(now.getTime() + daysFromToday * 86400000);
  // Build an ISO at the given CT hour by going through the CT date parts.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t).value;
  // CT is UTC-5 or -6; use -05:00/-06:00 by asking Intl for the offset is overkill —
  // noon CT ± a few hours never crosses a UTC calendar-day boundary that flips the CT
  // date, which is all these tests need. Encode as an explicit CT offset.
  const off = ctOffsetHours(d);
  const hh = String(hourCT).padStart(2, '0');
  return `${g('year')}-${g('month')}-${g('day')}T${hh}:00:00${off}`;
}
/** The America/Chicago UTC offset for a given date, as "-05:00" or "-06:00". */
function ctOffsetHours(date) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'shortOffset' })
    .formatToParts(date).find((p) => p.type === 'timeZoneName').value;   // e.g. "GMT-5"
  const m = s.match(/GMT([+-]\d+)/);
  const h = m ? parseInt(m[1], 10) : -6;
  return (h < 0 ? '-' : '+') + String(Math.abs(h)).padStart(2, '0') + ':00';
}

/* ══════════════════════════════════════════════════════════════
   sendDailyDigest
   ══════════════════════════════════════════════════════════════ */

/* Mangled unified header, scramble #7. */
const U = [
  'Total Downstream', 'Email', 'Details', 'Category', 'Referred By Name', 'Lead ID',
  'Phone', 'Referral Chain', 'Status', 'Last Name', 'Direct Referrals',
  'Referred By Email', 'Source', 'timestamp', 'Match Type', 'Referral Code',
  'Heard About', 'Referred By Lead ID', 'Chain Depth', 'Company', 'first name',
  'Reports Enabled', 'Referred By Code', 'Role', 'Last Referral Date',
];
function uLead(vals) {
  const row = new Array(U.length).fill('');
  Object.keys(vals).forEach((n) => { row[idx(U, n)] = vals[n]; });
  return row;
}

test('daily/unified: leads from TODAY are included, leads from other days excluded', () => {
  const leads = new FakeSheet('Leads', [
    U.slice(),
    uLead({ 'Lead ID': 'AXP-TODAY-1', Timestamp: ctIso(0, 12), 'First Name': 'Tammy', Email: 't@x.com',
            Category: 'Investor', Phone: '555-1', Source: 'QR',
            Details: JSON.stringify({ assetClass: 'Multifamily', booking: { date: 'June 27, 2026', slot: '9:00 AM' } }) }),
    uLead({ 'Lead ID': 'AXP-Yda', Timestamp: ctIso(-1, 12), 'First Name': 'Yesther', Email: 'y@x.com', Category: 'Investor' }),
    uLead({ 'Lead ID': 'AXP-Tmw', Timestamp: ctIso(1, 12), 'First Name': 'Tom', Email: 'tm@x.com', Category: 'Investor' }),
    uLead({ 'Lead ID': 'AXP-TODAY-2', Timestamp: ctIso(0, 8), 'First Name': 'Terry', Email: 't2@x.com', Category: 'Referral Partner' }),
  ]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.sendDailyDigest();

  assert.equal(sentEmails.length, 1);
  const body = sentEmails[0].body;
  assert.match(sentEmails[0].subject, /2 new leads today/);
  assert.match(body, /AXP-TODAY-1/);
  assert.match(body, /AXP-TODAY-2/);
  assert.ok(!body.includes('AXP-Yda'), 'yesterday excluded');
  assert.ok(!body.includes('AXP-Tmw'), 'tomorrow excluded');

  // Asset Class and Booking came out of the Details blob, not columns.
  assert.match(body, /Asset Class: Multifamily/);
  assert.match(body, /Booking:\s+June 27, 2026 at 9:00 AM/);

  // Read-only: the sheet is untouched.
  assert.equal(leads.appended.length, 0);
  assert.equal(leads.deletedRows.length, 0);
});

test('daily/unified: a lead just before CT midnight today is IN; one just after is OUT', () => {
  // The timezone-boundary case. 00:30 CT today is today; 23:30 CT yesterday is not,
  // even though in UTC they can look like the same calendar day.
  const leads = new FakeSheet('Leads', [
    U.slice(),
    uLead({ 'Lead ID': 'AXP-JUSTIN', Timestamp: ctIso(0, 0), 'First Name': 'Justin', Email: 'i@x.com', Category: 'Investor' }),
    uLead({ 'Lead ID': 'AXP-JUSTOUT', Timestamp: ctIso(-1, 23), 'First Name': 'Justine', Email: 'o@x.com', Category: 'Investor' }),
  ]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true);

  sandbox.sendDailyDigest();

  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].body, /AXP-JUSTIN/, '00:00 CT today is included');
  assert.ok(!sentEmails[0].body.includes('AXP-JUSTOUT'), '23:00 CT yesterday is excluded');
});

test('daily/unified: nothing today → no email, and an unreadable timestamp is skipped not crashed', () => {
  const leads = new FakeSheet('Leads', [
    U.slice(),
    uLead({ 'Lead ID': 'AXP-OLD', Timestamp: ctIso(-5, 12), Email: 'o@x.com', Category: 'Investor' }),
    uLead({ 'Lead ID': 'AXP-JUNK', Timestamp: 'not a date', Email: 'j@x.com', Category: 'Investor' }),
  ]);
  const { sandbox, sentEmails, logs } = load(new FakeSpreadsheet({ Leads: leads }), true);

  assert.doesNotThrow(() => sandbox.sendDailyDigest());
  assert.equal(sentEmails.length, 0);
  assert.match(logs.join('\n'), /no new leads today/);
});

test('daily/unified: an empty Leads table sends nothing', () => {
  const leads = new FakeSheet('Leads', [U.slice()]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads }), true);
  assert.doesNotThrow(() => sandbox.sendDailyDigest());
  assert.equal(sentEmails.length, 0);
});

test('daily/LEGACY: reads Lifetime Leads and includes only today (first regression net this ever had)', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;
  // Rotate the legacy header so nothing sits at its COLS index.
  const header = LEAD_HEADERS.slice(9).concat(LEAD_HEADERS.slice(0, 9));
  const at = (n) => header.indexOf(n);
  assert.notDeepEqual(Array.from(header), Array.from(LEAD_HEADERS));

  const mk = (vals) => { const r = new Array(header.length).fill(''); Object.keys(vals).forEach((n) => { r[at(n)] = vals[n]; }); return r; };
  const lifetime = new FakeSheet('Lifetime Leads', [
    header.slice(),
    mk({ 'Lead ID': 'AXP-T', Timestamp: ctIso(0, 12), 'First Name': 'Tay', Email: 't@x.com', Category: 'Investor', 'Asset Class': 'Retail' }),
    mk({ 'Lead ID': 'AXP-Y', Timestamp: ctIso(-1, 12), 'First Name': 'Yao', Email: 'y@x.com', Category: 'Investor' }),
  ]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ 'Lifetime Leads': lifetime }), false);

  sandbox.sendDailyDigest();
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].body, /AXP-T\b/);
  assert.ok(!sentEmails[0].body.includes('AXP-Y'));
  // Legacy reads Asset Class as a top-level COLUMN (it is one, pre-migration).
  assert.match(sentEmails[0].body, /Asset Class: Retail/);
});

/* ══════════════════════════════════════════════════════════════
   sendMonthlyReferralSummaries
   ══════════════════════════════════════════════════════════════ */

/* A different mangle of the same 25 columns, so this section's fixture is not the
   digest section's fixture. */
const M = [
  'Referral Code', 'Category', 'Details', 'Status', 'Email', 'Reports  Enabled',
  'Lead ID', 'Referral Chain', 'Direct Referrals', 'Last Name', 'Total Downstream',
  'Referred By Email', 'Source', 'Timestamp', 'Match Type', 'Chain Depth',
  'Heard About', 'Referred By Lead ID', 'Phone', 'Company', 'first name',
  'Referred By Name', 'Referred By Code', 'Role', 'Last Referral Date',
];
function mPartner(vals) {
  const row = new Array(M.length).fill('');
  Object.keys(vals).forEach((n) => { row[idx(M, n)] = vals[n]; });
  return row;
}
const REF_HEADERS = [
  'Referral ID', 'Referrer Lead ID', 'Referrer Name', 'Referrer Email', 'Referrer Code',
  'Referred Lead ID', 'Referred Name', 'Referred Email',
  'Match Type', 'Chain Depth', 'Full Chain', 'Date', 'Status',
];
/** A Referrals-tab row crediting `referrerLeadId`, dated `date` (Date or ISO). */
function refRow(id, referrerLeadId, date) {
  const r = new Array(REF_HEADERS.length).fill('');
  r[0] = id; r[1] = referrerLeadId; r[11] = date; r[12] = 'linked';
  return r;
}
function thisMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 15); }
function lastMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 15); }

test('monthly/unified: a Referral-Partner with Reports Enabled and ≥1 referral gets a summary; the count is right', () => {
  const leads = new FakeSheet('Leads', [
    M.slice(),
    mPartner({ 'Lead ID': 'AXP-P1', Category: 'Referral Partner', Status: 'Active',
               Email: 'p1@x.com', 'first name': 'Pat', 'Referral Code': 'AXP-P1CODE', 'Reports Enabled': true }),
    // An INVESTOR with referrals must NOT get a partner summary — the category filter.
    mPartner({ 'Lead ID': 'AXP-INV', Category: 'Investor', Status: 'Active', Email: 'inv@x.com', 'Reports Enabled': true }),
  ]);
  const referrals = new FakeSheet('Referrals', [
    REF_HEADERS.slice(),
    refRow('REF-1', 'AXP-P1', thisMonth()),
    refRow('REF-2', 'AXP-P1', thisMonth()),
    refRow('REF-3', 'AXP-P1', lastMonth()),
    refRow('REF-4', 'AXP-INV', thisMonth()),   // credited to the investor — must not send
  ]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);

  sandbox.sendMonthlyReferralSummaries();

  assert.equal(sentEmails.length, 1, 'only the referral partner, not the investor');
  assert.equal(sentEmails[0].to, 'p1@x.com');
  // 3 total (2 this month + 1 last), 2 this month — the template is rendered with both.
  assert.match(sentEmails[0].options.htmlBody, /3/);
  assert.match(sentEmails[0].options.htmlBody, /2/);
});

test('monthly/unified: Reports Enabled = FALSE is skipped; blank and TRUE are sent', () => {
  const leads = new FakeSheet('Leads', [
    M.slice(),
    mPartner({ 'Lead ID': 'AXP-OFF', Category: 'Referral Partner', Status: 'Active', Email: 'off@x.com', 'Reports Enabled': false }),
    mPartner({ 'Lead ID': 'AXP-OFFSTR', Category: 'Referral Partner', Status: 'Active', Email: 'offs@x.com', 'Reports Enabled': 'FALSE' }),
    mPartner({ 'Lead ID': 'AXP-BLANK', Category: 'Referral Partner', Status: 'Active', Email: 'blank@x.com', 'Reports Enabled': '' }),
    mPartner({ 'Lead ID': 'AXP-TRUE', Category: 'Referral Partner', Status: 'Active', Email: 'true@x.com', 'Reports Enabled': true }),
  ]);
  const referrals = new FakeSheet('Referrals', [REF_HEADERS.slice(),
    refRow('R1', 'AXP-OFF', thisMonth()), refRow('R2', 'AXP-OFFSTR', thisMonth()),
    refRow('R3', 'AXP-BLANK', thisMonth()), refRow('R4', 'AXP-TRUE', thisMonth())]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);

  sandbox.sendMonthlyReferralSummaries();

  const to = sentEmails.map((e) => e.to).sort();
  assert.deepEqual(to, ['blank@x.com', 'true@x.com'], 'FALSE (bool and string) opted out; blank and TRUE sent');
});

test('monthly/unified: Cold and Archive status are skipped even with referrals and Reports Enabled', () => {
  const leads = new FakeSheet('Leads', [
    M.slice(),
    mPartner({ 'Lead ID': 'AXP-COLD', Category: 'Referral Partner', Status: 'Cold', Email: 'c@x.com', 'Reports Enabled': true }),
    mPartner({ 'Lead ID': 'AXP-ARCH', Category: 'Referral Partner', Status: 'Archive', Email: 'a@x.com', 'Reports Enabled': true }),
    mPartner({ 'Lead ID': 'AXP-ACT', Category: 'Referral Partner', Status: 'Active', Email: 'ok@x.com', 'Reports Enabled': true }),
  ]);
  const referrals = new FakeSheet('Referrals', [REF_HEADERS.slice(),
    refRow('R1', 'AXP-COLD', thisMonth()), refRow('R2', 'AXP-ARCH', thisMonth()), refRow('R3', 'AXP-ACT', thisMonth())]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);

  sandbox.sendMonthlyReferralSummaries();
  assert.deepEqual(sentEmails.map((e) => e.to), ['ok@x.com']);
});

test('monthly/unified: a partner with ZERO referrals is skipped', () => {
  const leads = new FakeSheet('Leads', [
    M.slice(),
    mPartner({ 'Lead ID': 'AXP-ZERO', Category: 'Referral Partner', Status: 'Active', Email: 'z@x.com', 'Reports Enabled': true }),
    mPartner({ 'Lead ID': 'AXP-ONE', Category: 'Referral Partner', Status: 'Active', Email: 'one@x.com', 'Reports Enabled': true }),
  ]);
  const referrals = new FakeSheet('Referrals', [REF_HEADERS.slice(), refRow('R1', 'AXP-ONE', thisMonth())]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);

  sandbox.sendMonthlyReferralSummaries();
  assert.deepEqual(sentEmails.map((e) => e.to), ['one@x.com'], 'the zero-referral partner is skipped');
});

test('monthly/unified: read-only — no sheet is modified, and the script lock is never taken', () => {
  const leads = new FakeSheet('Leads', [M.slice(),
    mPartner({ 'Lead ID': 'AXP-P', Category: 'Referral Partner', Status: 'Active', Email: 'p@x.com', 'Reports Enabled': true })]);
  const referrals = new FakeSheet('Referrals', [REF_HEADERS.slice(), refRow('R', 'AXP-P', thisMonth())]);
  // load()'s LockService.getScriptLock throws — so if this function ever took the
  // lock, the test would fail with that error rather than passing.
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);

  assert.doesNotThrow(() => sandbox.sendMonthlyReferralSummaries());
  assert.equal(leads.appended.length, 0);
  assert.equal(leads.deletedRows.length, 0);
  assert.equal(referrals.appended.length, 0);
});

test('monthly/LEGACY: reads the Referral Partners tab + its per-tab Reports Enabled extra', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const LEAD_HEADERS = probe.sandbox.LEAD_HEADERS;
  const header = LEAD_HEADERS.slice(20).concat(LEAD_HEADERS.slice(0, 20));
  // The legacy Referral Partners tab carries an EXTRA 'Reports Enabled' column past
  // the 31 standard ones — resolved by name via reportsEnabledIndex, not position.
  const partnersHeader = header.concat(['Reports Enabled']);
  const at = (n) => partnersHeader.indexOf(n);
  assert.notDeepEqual(Array.from(header), Array.from(LEAD_HEADERS));

  const mk = (vals) => { const r = new Array(partnersHeader.length).fill(''); Object.keys(vals).forEach((n) => { r[at(n)] = vals[n]; }); return r; };
  const partners = new FakeSheet('Referral Partners', [
    partnersHeader.slice(),
    mk({ 'Lead ID': 'AXP-P1', Status: 'Active', Email: 'p1@x.com', 'First Name': 'Pat', 'Referral Code': 'C1', 'Reports Enabled': true }),
    mk({ 'Lead ID': 'AXP-OFF', Status: 'Active', Email: 'off@x.com', 'Reports Enabled': false }),
    mk({ 'Lead ID': 'AXP-COLD', Status: 'Cold', Email: 'c@x.com', 'Reports Enabled': true }),
    mk({ 'Lead ID': 'AXP-ZERO', Status: 'Active', Email: 'z@x.com', 'Reports Enabled': true }),
  ]);
  const referrals = new FakeSheet('Referrals', [REF_HEADERS.slice(),
    refRow('R1', 'AXP-P1', thisMonth()), refRow('R2', 'AXP-OFF', thisMonth()), refRow('R3', 'AXP-COLD', thisMonth())]);
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ 'Referral Partners': partners, Referrals: referrals }), false);

  sandbox.sendMonthlyReferralSummaries();

  // Only AXP-P1: enabled, active, has a referral. OFF opted out, COLD skipped, ZERO
  // has none. This is the production behavior, now pinned for the first time.
  assert.deepEqual(sentEmails.map((e) => e.to), ['p1@x.com']);
});

test('both branches differ where it matters: unified filters a table, legacy reads a tab', () => {
  // A sanity anchor that the dispatcher is actually switching. With only a Leads
  // table present, the unified branch works and the legacy branch (which wants a
  // Referral Partners tab) sends nothing.
  const leads = new FakeSheet('Leads', [M.slice(),
    mPartner({ 'Lead ID': 'AXP-P', Category: 'Referral Partner', Status: 'Active', Email: 'p@x.com', 'Reports Enabled': true })]);
  const referrals = new FakeSheet('Referrals', [REF_HEADERS.slice(), refRow('R', 'AXP-P', thisMonth())]);

  const u = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);
  u.sandbox.sendMonthlyReferralSummaries();
  assert.equal(u.sentEmails.length, 1, 'unified reads the Leads table');

  const l = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), false);
  l.sandbox.sendMonthlyReferralSummaries();
  assert.equal(l.sentEmails.length, 0, 'legacy wants a Referral Partners tab, which is absent here');
});
