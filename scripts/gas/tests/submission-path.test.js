'use strict';

/*
 * The submission path — the unified-schema rewrite (migration Stage 7).
 *
 * findExistingLead / existingReferralCodes / matchReferrer / handleResubmission /
 * persistNewLead, and handleFormSubmission orchestrating them.
 *
 * THIS IS THE FIRST STAGE WHERE A COMPLETE REAL SUBMISSION EXISTS END TO END. Every
 * prior stage read or edited a Leads table that nothing ever wrote to. So the tests
 * here are not unit tests of five functions — they drive `handleFormSubmission` with
 * a real payload and assert on the row that actually lands, per lead type.
 *
 * WHY THESE FIVE COULD NOT BE SPLIT: findExistingLead (dedupe) and
 * existingReferralCodes (collision check) both scanned Lifetime Leads. Migrating
 * handleFormSubmission without them would have left both SILENTLY returning "no
 * match" — every resubmission becoming a duplicate lead, and referral codes no
 * longer collision-checked. Two silent data-corruption bugs. Tests below pin both.
 *
 * FIXTURE RULE: the Leads header is HAND-TYPED and mangled a SIXTH distinct way.
 * Sandbox constants are lifted with Array.from before any deep comparison (see
 * helpers/load-code.js — cross-realm deepEqual/notDeepEqual is a trap).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const CODE_PATH = path.join(__dirname, '..', 'Code.gs');
const CODE_SRC = fs.readFileSync(CODE_PATH, 'utf8');

/* The one process-wide script lock, as a real state machine. waitLock() THROWS when
   the lock is already held — modelling the reentrancy Apps Script does not promise,
   so a stage that widens a lock across nextLeadSequence() fails here rather than
   deadlocking in production. */
function makeScriptLock(events) {
  let held = false;
  return {
    tryLock(ms) {
      events.push('tryLock(' + ms + ')');
      if (held) { events.push('REFUSED'); return false; }
      held = true; events.push('ACQUIRED'); return true;
    },
    waitLock(ms) {
      events.push('waitLock(' + ms + ')');
      if (held) throw new Error('DEADLOCK: waitLock() while this execution already holds the script lock');
      held = true; return true;
    },
    releaseLock() { held = false; events.push('releaseLock'); },
    isHeld() { return held; },
  };
}

function load(spreadsheet, unified, opts) {
  opts = opts || {};
  const logs = [];
  const sentEmails = [];
  const contactsCreated = [];
  const events = opts.events || [];
  const lock = opts.lock || makeScriptLock(events);
  const props = { SPREADSHEET_ID: 'FAKE_ID', LAST_LEAD_ID: '40', LAST_REFERRAL_ID: '0' };

  const sandbox = {
    console, JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp,
    isNaN, parseInt, parseFloat,
    Logger: { log: (m) => logs.push(String(m)) },
    Utilities: {
      base64Decode: (s) => Buffer.from(String(s), 'base64'),
      newBlob: (d, t, n) => ({ _data: d, _type: t, _name: n, getBytes: () => d }),
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
      createContact: (f, l, e) => { contactsCreated.push(e); return { addToGroup() {}, setCompany() {}, addPhone() {} }; },
      getContactGroup: (n) => ({ _name: n }),
      createContactGroup: (n) => ({ _name: n }),
      Field: { WORK_PHONE: 'WORK_PHONE' },
    },
    Calendar: {}, CalendarApp: {},
    ContentService: {
      createTextOutput: (t) => ({ _text: t, setMimeType() { return this; } }),
      MimeType: { JSON: 'JSON' },
    },
    HtmlService: {}, ScriptApp: {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE_SRC, sandbox, { filename: 'Code.gs' });
  sandbox.USE_UNIFIED_SCHEMA = !!unified;
  return { sandbox, logs, sentEmails, contactsCreated, events, lock, props };
}

/** handleFormSubmission returns a ContentService text output; read the JSON back. */
function jsonOf(result) {
  return JSON.parse(result._text);
}

/* ── The header, HAND-TYPED ──
 *
 * HISTORY WORTH KEEPING, because this comment used to say the opposite: when this
 * suite was written, the append was POSITIONAL. buildLeadRow constructed the
 * canonical layout and persistNewLead appended that array straight down, assuming the
 * live header still matched. So an append-target sheet HAD to carry the canonical
 * header, and this fixture was canonical for that reason.
 *
 * That asymmetry — every reader name-resolving and tolerating drift, the one writer
 * assuming position — was the bug. It is now closed: persistNewLeadUnified projects
 * the row onto the sheet's REAL columns by name (projectLeadRowByName). The append
 * survives a reordered header exactly as every reader always has, and refuses (throws
 * headerLookupError) on a header that is genuinely broken rather than guessing.
 *
 * This fixture stays canonical because that is the ordinary case worth testing here —
 * and because it must be proven that the fix changed NOTHING for it. The reordered
 * and widened cases have their own tests below.
 *
 * The list is HAND-TYPED, not imported from UNIFIED_LEAD_HEADERS — a fixture built
 * from the constant under test proves only that the constant equals itself.
 */
const HEADER = [
  'Lead ID', 'Timestamp', 'Category', 'Status', 'Email', 'First Name', 'Last Name',
  'Referral Code', 'Referred By Lead ID', 'Referred By Name', 'Referred By Email',
  'Referred By Code', 'Match Type', 'Referral Chain', 'Chain Depth',
  'Direct Referrals', 'Total Downstream', 'Last Referral Date', 'Phone', 'Company',
  'Role', 'Source', 'Heard About', 'Reports Enabled', 'Details',
];

/* And a deliberately MANGLED variant of the same 25 columns — reordered, re-cased,
   whitespace-padded — used to prove the READ paths (dedupe, collision set, referrer
   match, resubmission) resolve by name and not by position. */
const MANGLED = [
  'Chain Depth', 'Email', 'Details', 'Source', 'Referred By Code', 'Lead ID',
  'Company', 'Referral Chain', 'STATUS', 'Last Name', 'Direct Referrals',
  'Referred By Email', 'Category', 'timestamp', 'Match Type', 'Referral Code',
  'Heard  About', 'Referred By Lead ID', 'Total Downstream', 'phone', 'first name',
  'Reports Enabled', 'Referred By Name', 'Role', 'Last Referral Date',
];

const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
/** Column index by name, against whichever header a given sheet was built with. */
function idx(header, name) {
  const i = header.findIndex((h) => norm(h) === norm(name));
  if (i === -1) throw new Error('fixture is missing a column: ' + name);
  return i;
}
function colOf(name) { return idx(HEADER, name); }
function emptyLeads() { return new FakeSheet('Leads', [HEADER.slice()]); }
function referralsSheet() {
  return new FakeSheet('Referrals', [[
    'Referral ID', 'Referrer Lead ID', 'Referrer Name', 'Referrer Email', 'Referrer Code',
    'Referred Lead ID', 'Referred Name', 'Referred Email',
    'Match Type', 'Chain Depth', 'Full Chain', 'Date', 'Status',
  ]]);
}
/** The row a lead landed on, read by column NAME through the hand-typed fixture. */
function leadRow(sheet, n) {
  const rows = sheet.getDataRange().getValues();
  const row = rows[n];
  assert.ok(row, 'no lead row at index ' + n);
  return {
    get: (name) => row[colOf(name)],
    details: () => JSON.parse(row[colOf('Details')] || '{}'),
    raw: row,
  };
}

/* ── Payloads ── */
const BOOKING = { date: 'June 27, 2026', slot: '9:00 AM', meetType: 'meet', phone: '' };

const INVESTOR = () => ({
  role: 'investor',
  person: { firstName: 'Ivy', lastName: 'Investor', email: 'ivy@x.com', phone: '555-0001', company: 'Ivy Capital' },
  message: 'Looking at multifamily.',
  qualData: { aum: '$10-50M', experience: '5-10 years', assetClasses: ['Multifamily'], timeline: '3-6 months' },
  preferences: ['Deal flow'],
  booking: null, heardAbout: 'LinkedIn', source: '',
});
const REFERRAL_PARTNER = () => ({
  role: 'referral',
  person: { firstName: 'Ray', lastName: 'Partner', email: 'ray@x.com', phone: '555-0002', company: 'Ray & Co' },
  message: 'Happy to refer.',
  qualData: { profession: 'Attorney', clients: 'HNW individuals', referralIntent: 'Ongoing' },
  preferences: [], booking: null, heardAbout: 'Referral', source: 'qr',
});
const RE_PRO = () => ({
  role: 'pro',
  person: { firstName: 'Pam', lastName: 'Pro', email: 'pam@x.com', phone: '555-0003', company: 'Pro Realty' },
  message: 'Broker in Dallas.',
  qualData: { proRole: 'Broker', markets: 'Dallas, Austin', proIntent: 'Co-broker deals' },
  preferences: [], booking: null, heardAbout: 'Google', source: '',
});
const SUBMIT_REFERRAL = () => ({
  role: 'submit_referral',
  person: { firstName: 'Sam', lastName: 'Submitter', email: 'sam@x.com', phone: '555-0004', company: '' },
  message: 'You should talk to Jane.',
  qualData: { relationship: 'Former colleague', fit: 'Owns 200 units', awareness: 'Yes, I told her' },
  referred: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-0100', notes: 'multifamily' },
  preferences: [], booking: null, heardAbout: 'Podcast', source: '',
});
const EAO = () => ({
  role: 'existing_asset_owner',
  name: 'Owen Owner', email: 'owen@x.com', phone: '555-0005',
  portfolio_type: 'Mixed', property_type: 'Multifamily', units: 240, sqft: '180,000',
  current_situation: 'Considering a sale', pressing_issue: 'Debt maturing in 2027',
  booking: null,
});

test('the hand-typed append header matches the schema, and the mangled one genuinely differs', () => {
  const { sandbox } = load(new FakeSpreadsheet({}), true);
  const { UNIFIED_LEAD_HEADERS, UCOLS } = sandbox;

  // The append target must be the canonical layout — that is what setupSpreadsheet
  // creates and what the positional row builder writes into. Hand-typed vs constant.
  assert.deepEqual(HEADER, Array.from(UNIFIED_LEAD_HEADERS));

  // The read-path fixture must be genuinely drifted: same columns, none in place.
  assert.equal(MANGLED.length, UNIFIED_LEAD_HEADERS.length);
  assert.notDeepEqual(MANGLED, Array.from(UNIFIED_LEAD_HEADERS));
  Object.keys(UCOLS).forEach((k) => {
    assert.notEqual(idx(MANGLED, UNIFIED_LEAD_HEADERS[UCOLS[k]]), UCOLS[k],
      `"${UNIFIED_LEAD_HEADERS[UCOLS[k]]}" must not sit at its canonical index`);
  });
});

test('the READ paths resolve by NAME: dedupe, collision set, referrer match and resubmission all work on a drifted header', () => {
  // Every reader in the submission path must survive a hand-mangled live header.
  // (The writer is positional by design — see the note on HEADER above — so this
  // fixture is seeded directly rather than through handleFormSubmission.)
  const m = (vals) => {
    const row = new Array(MANGLED.length).fill('');
    Object.keys(vals).forEach((n) => { row[idx(MANGLED, n)] = vals[n]; });
    return row;
  };
  const leads = new FakeSheet('Leads', [
    MANGLED.slice(),
    m({ 'Lead ID': 'AXP-2026-0001', Email: 'ivy@x.com', 'First Name': 'Ivy', 'Last Name': 'Investor',
        'Referral Code': 'AXP-IVY111', 'Referral Chain': '', 'Direct Referrals': 0,
        'Total Downstream': 0, Status: 'Active',
        Details: JSON.stringify({ message: 'Original.', preferences: [], booking: null }) }),
  ]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  // findExistingLead
  const hit = sandbox.findExistingLead('ivy@x.com');
  assert.ok(hit, 'dedupe found the lead on a drifted header');
  assert.equal(hit.rowIndex, 2);

  // existingReferralCodes
  assert.ok(sandbox.existingReferralCodes()['AXP-IVY111']);

  // matchReferrer, all three paths
  assert.equal(sandbox.matchReferrer({ referralCode: 'AXP-IVY111' }).referrerLeadId, 'AXP-2026-0001');
  assert.equal(sandbox.matchReferrer({ referredByEmail: 'IVY@X.COM' }).matchType, 'email');
  assert.equal(sandbox.matchReferrer({ referredByName: 'Ivy Investor' }).matchType, 'name');
  assert.equal(sandbox.matchReferrer({ referredByEmail: 'no@x.com' }).matchType, 'none');

  // handleResubmission: the Details read-modify-write, on a drifted header.
  const again = INVESTOR();
  again.message = 'Back again.';
  const res = jsonOf(sandbox.handleFormSubmission(again));
  assert.equal(res.resubmission, true);
  assert.equal(res.leadId, 'AXP-2026-0001');
  assert.equal(leads.getLastRow(), 2, 'no duplicate row');

  const d = JSON.parse(leads.getDataRange().getValues()[1][idx(MANGLED, 'Details')]);
  assert.match(d.message, /^Original\./, 'the existing blob was preserved');
  assert.match(d.message, /New message: Back again\./);
});

/* ════════════════════════════════════════════════════════════
   END TO END — one complete submission per lead type. The first time this has
   been possible: nothing wrote to the Leads table before this stage.
   ════════════════════════════════════════════════════════════ */

test('E2E investor: one submission → ONE row, correct columns, full Details', () => {
  const leads = emptyLeads();
  const { sandbox, sentEmails, contactsCreated } =
    load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  const res = jsonOf(sandbox.handleFormSubmission(INVESTOR()));

  assert.equal(res.success, true);
  assert.match(res.leadId, /^AXP-\d{4}-\d{4}$/);
  assert.match(res.referralCode, /^AXP-[A-Z2-9]{6}$/);

  // ONE row. Not three (Lifetime + Active + category tab).
  assert.equal(leads.getLastRow(), 2, 'exactly one lead row, on one table');
  const r = leadRow(leads, 1);

  assert.equal(r.get('Lead ID'), res.leadId);
  assert.equal(r.get('Email'), 'ivy@x.com');
  assert.equal(r.get('First Name'), 'Ivy');
  assert.equal(r.get('Category'), 'Investor');
  assert.equal(r.get('Status'), 'New Lead');
  assert.equal(r.get('Role'), 'investor');
  assert.equal(r.get('Referral Code'), res.referralCode);
  assert.equal(r.get('Match Type'), 'none');
  assert.equal(r.get('Direct Referrals'), 0);
  assert.equal(r.get('Heard About'), 'LinkedIn');
  assert.equal(r.get('Reports Enabled'), '', 'not a referral partner');

  const d = r.details();
  assert.equal(d.aum, '$10-50M');
  assert.equal(d.experience, '5-10 years');
  assert.equal(d.timeline, '3-6 months');
  assert.deepEqual(d.assetClasses, ['Multifamily']);
  assert.equal(d.message, 'Looking at multifamily.');

  // The side effects still fire.
  assert.deepEqual(contactsCreated, ['ivy@x.com']);
  assert.ok(sentEmails.length >= 2, 'visitor confirmation + partner notification');
});

test('E2E referral partner: Reports Enabled is seeded TRUE on the one table', () => {
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  sandbox.handleFormSubmission(REFERRAL_PARTNER());
  const r = leadRow(leads, 1);

  assert.equal(r.get('Category'), 'Referral Partner');
  // The per-tab extra column is gone: it is an ordinary column now, seeded by the
  // row builder. The whole REPORTS_ENABLED_COL bug class dies with it.
  assert.equal(r.get('Reports Enabled'), true);
  assert.equal(r.get('Source'), 'QR');
  const d = r.details();
  assert.equal(d.profession, 'Attorney');
  assert.equal(d.clients, 'HNW individuals');
  assert.equal(d.referralIntent, 'Ongoing');
});

test('E2E RE professional', () => {
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);
  sandbox.handleFormSubmission(RE_PRO());
  const r = leadRow(leads, 1);
  assert.equal(r.get('Category'), 'RE Professional');
  const d = r.details();
  assert.equal(d.proRole, 'Broker');
  assert.equal(d.markets, 'Dallas, Austin');
  assert.equal(d.proIntent, 'Co-broker deals');
});

test('E2E submit_referral: Stage 6\'s structured Details.referred survives the FULL path', () => {
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  sandbox.handleFormSubmission(SUBMIT_REFERRAL());
  const r = leadRow(leads, 1);
  const d = r.details();

  // Structured, retrievable as discrete values — not prose, all the way through.
  assert.equal(d.referred.firstName, 'Jane');
  assert.equal(d.referred.email, 'jane@example.com');
  assert.equal(d.referred.phone, '555-0100');
  assert.equal(d.referred.notes, 'multifamily');

  // The three fields that are discarded entirely in production.
  assert.equal(d.relationship, 'Former colleague');
  assert.equal(d.fit, 'Owns 200 units');
  assert.equal(d.awareness, 'Yes, I told her');

  // And the prose block appears NOWHERE on the row.
  assert.equal(d.message, 'You should talk to Jane.');
  r.raw.forEach((cell) => {
    assert.ok(!String(cell).includes('Referred person:'), 'the legacy prose must not survive');
  });
  assert.equal(r.get('Category'), 'Referral');
});

test('E2E existing asset owner: the normalizer runs, and its 8 fields land in Details', () => {
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  sandbox.handleFormSubmission(EAO());
  const r = leadRow(leads, 1);

  assert.equal(r.get('Category'), 'Existing Asset Owner');
  assert.equal(r.get('First Name'), 'Owen', 'the normalizer split the flat name');
  assert.equal(r.get('Email'), 'owen@x.com');

  const d = r.details();
  assert.equal(d.portfolio_type, 'Mixed');
  assert.equal(d.units, 240);
  assert.equal(d.current_situation, 'Considering a sale');
  assert.equal(d.pressing_issue, 'Debt maturing in 2027');
  // The normalizer's JSON-into-Preferences hack must not leak through.
  assert.deepEqual(d.preferences, []);
  // Details.message must NOT duplicate pressing_issue. The normalizer no longer
  // copies pressing_issue onto message; the free text lives once, in pressing_issue,
  // and reaches the internal email/note via leadMessageText — not by being stored twice.
  assert.equal(d.message, '', 'message is blank, not a copy of pressing_issue');
  assert.notEqual(d.message, d.pressing_issue, 'message and pressing_issue no longer carry identical text');
});

/* ════════════════════════════════════════════════════════════
   DEDUPE — the silent-duplicate bug this stage exists to prevent
   ════════════════════════════════════════════════════════════ */

test('DEDUPE: a second identical submission creates NO second row, and routes to the resubmission path', () => {
  const leads = emptyLeads();
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  const first = jsonOf(sandbox.handleFormSubmission(INVESTOR()));
  assert.equal(leads.getLastRow(), 2);

  const second = INVESTOR();
  second.message = 'Following up — still interested.';
  const res = jsonOf(sandbox.handleFormSubmission(second));

  // THE assertion. If findExistingLeadUnified silently returned null (the failure
  // mode of migrating handleFormSubmission alone), this would be 3.
  assert.equal(leads.getLastRow(), 2, 'a resubmission must NOT create a duplicate lead row');
  assert.equal(res.resubmission, true);
  assert.equal(res.leadId, first.leadId, 'the ORIGINAL lead id is returned');
  assert.equal(res.referralCode, first.referralCode);

  // The note was appended to Details.message — a read-modify-write of the blob.
  const d = leadRow(leads, 1).details();
  assert.match(d.message, /^Looking at multifamily\./, 'the original message is preserved');
  assert.match(d.message, /Resubmission on 07\/14\/2026 \(AXP-/);
  assert.match(d.message, /New message: Following up — still interested\./);

  assert.ok(sentEmails.some((e) => /Resubmission/i.test(e.subject)), 'partners are notified');
});

test('DEDUPE is case-insensitive, and a resubmission fills in ONLY previously-blank fields', () => {
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  const first = INVESTOR();
  first.person.company = '';          // left blank the first time
  sandbox.handleFormSubmission(first);

  const second = INVESTOR();
  second.person.email = 'IVY@X.COM';  // same person, different casing
  second.person.company = 'Ivy Capital';
  second.person.firstName = 'Ivalene'; // a DIFFERENT first name — must not overwrite
  jsonOf(sandbox.handleFormSubmission(second));

  assert.equal(leads.getLastRow(), 2, 'case must not defeat the dedupe');
  const r = leadRow(leads, 1);
  assert.equal(r.get('Company'), 'Ivy Capital', 'a blank field IS filled in');
  assert.equal(r.get('First Name'), 'Ivy', 'a known field is NEVER overwritten');
});

test('resubmission survives a Details blob that is not valid JSON', () => {
  const leads = emptyLeads();
  const { sandbox, logs } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  sandbox.handleFormSubmission(INVESTOR());
  // Somebody hand-edits the cell into garbage.
  leads.getRange(2, colOf('Details') + 1).setValue('{not json');

  const again = INVESTOR();
  again.message = 'Second try.';
  const res = jsonOf(sandbox.handleFormSubmission(again));

  assert.equal(res.resubmission, true);
  const d = leadRow(leads, 1).details();
  assert.match(d.message, /New message: Second try\./, 'the new message still lands');
  assert.equal(d._unparsed, '{not json', 'the corrupt blob is preserved, not silently destroyed');
  assert.match(logs.join('\n'), /not valid JSON/);
});

/* ════════════════════════════════════════════════════════════
   REFERRAL CODE COLLISION — the other silent bug
   ════════════════════════════════════════════════════════════ */

test('COLLISION: generateReferralCode regenerates rather than reusing a code already on the table', () => {
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  // Seed a lead, then force the generator to produce that exact code on its first
  // attempt. The collision set (existingReferralCodes) must push it to try again.
  const first = jsonOf(sandbox.handleFormSubmission(INVESTOR()));
  const taken = first.referralCode;

  const codes = sandbox.existingReferralCodes();
  assert.ok(codes[taken.toUpperCase()], 'the issued code is in the collision set — the set is being read');

  // Drive the collision deterministically: hand the generator a rigged Math.random
  // that returns the taken code once, then something else.
  let call = 0;
  const realRandom = sandbox.Math.random;
  sandbox.Math.random = () => { call++; return realRandom(); };

  const second = RE_PRO();
  const res = jsonOf(sandbox.handleFormSubmission(second));
  sandbox.Math.random = realRandom;

  assert.notEqual(res.referralCode, taken, 'a second lead never receives a code already in use');
  assert.equal(leads.getLastRow(), 3);
  // Both codes are distinct and present.
  const all = sandbox.existingReferralCodes();
  assert.ok(all[taken.toUpperCase()] && all[res.referralCode.toUpperCase()]);
});

test('COLLISION: existingReferralCodesUnified reads the Leads table, not an empty map', () => {
  // The silent-failure shape: if this returned {} because it scanned a tab that no
  // longer exists, collisions would stop being detected entirely.
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);
  // Object.keys, not deepEqual: existingReferralCodes builds its map inside the vm
  // realm, and deepEqual would compare prototypes rather than contents.
  assert.equal(Object.keys(sandbox.existingReferralCodes()).length, 0, 'empty table → empty set');

  sandbox.handleFormSubmission(INVESTOR());
  const after = sandbox.existingReferralCodes();
  assert.equal(Object.keys(after).length, 1, 'the issued code is now in the set');
});

/* ════════════════════════════════════════════════════════════
   REFERRAL MATCHING — chain attaches, stats fire, Referrals row logged
   ════════════════════════════════════════════════════════════ */

test('REFERRAL: a code match attaches the chain and credits the referrer (and every ancestor)', () => {
  const leads = emptyLeads();
  const referrals = referralsSheet();
  const { sandbox, sentEmails } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referrals }), true);

  // Build a real two-generation chain through the real path: Ivy, then Ray referred
  // by Ivy's code, then Pam referred by Ray's code.
  const ivy = jsonOf(sandbox.handleFormSubmission(INVESTOR()));

  const ray = REFERRAL_PARTNER();
  ray.referralCode = ivy.referralCode;              // "who referred you" — Ivy's code
  const rayRes = jsonOf(sandbox.handleFormSubmission(ray));

  const pam = RE_PRO();
  pam.referralCode = rayRes.referralCode;           // referred by Ray
  const pamRes = jsonOf(sandbox.handleFormSubmission(pam));

  const rowOf = (id) => {
    const rows = leads.getDataRange().getValues();
    const i = rows.findIndex((r) => r[colOf('Lead ID')] === id);
    return leadRow(leads, i);
  };

  // Pam's row carries the full ancestor chain: Ivy then Ray.
  const p = rowOf(pamRes.leadId);
  assert.equal(p.get('Match Type'), 'code');
  assert.equal(p.get('Referred By Lead ID'), rayRes.leadId);
  assert.equal(p.get('Referral Chain'), ivy.leadId + '|' + rayRes.leadId);
  assert.equal(p.get('Chain Depth'), 2);

  // Stats: Ray is the immediate referrer of Pam; Ivy is only an ancestor.
  const r = rowOf(rayRes.leadId);
  assert.equal(r.get('Direct Referrals'), 1, 'Ray referred Pam');
  assert.equal(r.get('Total Downstream'), 1);
  const i = rowOf(ivy.leadId);
  assert.equal(i.get('Direct Referrals'), 1, 'Ivy referred Ray — and ONLY Ray');
  assert.equal(i.get('Total Downstream'), 2, 'Ray AND Pam are in Ivy\'s downstream');

  // Both referrals were logged, and both referrers notified.
  assert.equal(referrals.getLastRow(), 3, 'header + two referral rows');
  assert.ok(sentEmails.some((e) => e.to === 'ivy@x.com'));
  assert.ok(sentEmails.some((e) => e.to === 'ray@x.com'));
});

test('REFERRAL: email and name match paths, and a miss reads "none"', () => {
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);
  const ivy = jsonOf(sandbox.handleFormSubmission(INVESTOR()));

  const byEmail = REFERRAL_PARTNER();
  byEmail.referredByEmail = 'IVY@X.COM';
  const e = jsonOf(sandbox.handleFormSubmission(byEmail));

  const byName = RE_PRO();
  byName.referredByName = 'Ivy Investor';
  const n = jsonOf(sandbox.handleFormSubmission(byName));

  const miss = SUBMIT_REFERRAL();
  miss.referredByEmail = 'nobody@x.com';
  const m = jsonOf(sandbox.handleFormSubmission(miss));

  const find = (id) => {
    const rows = leads.getDataRange().getValues();
    return leadRow(leads, rows.findIndex((r) => r[colOf('Lead ID')] === id));
  };
  assert.equal(find(e.leadId).get('Match Type'), 'email');
  assert.equal(find(e.leadId).get('Referred By Lead ID'), ivy.leadId);
  assert.equal(find(n.leadId).get('Match Type'), 'name');
  assert.equal(find(m.leadId).get('Match Type'), 'none');
  assert.equal(find(m.leadId).get('Referral Chain'), '');
});

/* ════════════════════════════════════════════════════════════
   THE LOCK on handleResubmission — same rigor as Stage 5
   ════════════════════════════════════════════════════════════ */

test('LOCK: the resubmission holds the lock across the Details read-modify-write, and releases it', () => {
  const leads = emptyLeads();
  const events = [];
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true, { events });

  sandbox.handleFormSubmission(INVESTOR());
  events.length = 0;                                  // ignore the first submission

  const again = INVESTOR();
  again.message = 'Second.';
  sandbox.handleFormSubmission(again);

  const acquired = events.indexOf('ACQUIRED');
  const flush = events.indexOf('flush');
  const release = events.indexOf('releaseLock');
  assert.ok(acquired > -1, 'the resubmission took the lock');
  assert.ok(flush > acquired && flush < release, 'the blob write is flushed before the lock is released');
  assert.equal(events[release], 'releaseLock');
  assert.ok(!events.includes('REFUSED'));
});

test('LOCK (SAME LOCK): a resubmission arriving mid-sweep is refused — nothing partial, lead still returned', () => {
  const leads = emptyLeads();
  const events = [];
  const lock = makeScriptLock(events);
  const ctx = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true, { events, lock });

  const first = jsonOf(ctx.sandbox.handleFormSubmission(INVESTOR()));
  // Age the lead so the sweep has work to do, and hold the lock inside the sweep.
  leads.getRange(2, colOf('Timestamp') + 1)
    .setValue(new Date(Date.now() - 200 * 86400000).toISOString());

  let res = null;
  const realGetRange = leads.getRange.bind(leads);
  leads.getRange = (...args) => {
    const range = realGetRange(...args);
    const realSetValue = range.setValue.bind(range);
    range.setValue = (v) => {
      const out = realSetValue(v);
      if (!res) {
        assert.ok(lock.isHeld(), 'precondition: the sweep holds the lock');
        const again = INVESTOR();
        again.message = 'Arrived mid-sweep.';
        res = jsonOf(ctx.sandbox.handleFormSubmission(again));   // must be refused
      }
      return out;
    };
    return range;
  };

  ctx.sandbox.moveColdLeads();

  assert.ok(res, 'the resubmission ran');
  assert.ok(events.includes('REFUSED'), 'it contended for the SAME lock the sweep holds');

  // Refused ≠ broken: the visitor still gets their real lead ID back...
  assert.equal(res.success, true);
  assert.equal(res.resubmission, true);
  assert.equal(res.leadId, first.leadId);
  // ...and NOTHING partial was written: the new message did not land.
  const d = leadRow(leads, 1).details();
  assert.ok(!d.message.includes('Arrived mid-sweep.'), 'no partial blob write');
  assert.match(ctx.logs.join('\n'), /MANUAL REPAIR NEEDED/);
  assert.match(ctx.logs.join('\n'), /Arrived mid-sweep\./, 'the dropped message is logged for repair');

  // And still exactly one lead row: a refused resubmission must never fall through
  // to the new-row path.
  assert.equal(leads.getLastRow(), 2);
});

test('LOCK: no reentrancy — nextLeadSequence\'s waitLock never runs inside a held lock', () => {
  // A submission calls nextLeadSequence (waitLock) and updateReferrerStats (tryLock).
  // If any of them were nested inside another lock, the stub throws DEADLOCK.
  const leads = emptyLeads();
  const events = [];
  const { sandbox, lock } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true, { events });

  const ivy = jsonOf(sandbox.handleFormSubmission(INVESTOR()));
  const ray = REFERRAL_PARTNER();
  ray.referralCode = ivy.referralCode;

  assert.doesNotThrow(() => sandbox.handleFormSubmission(ray),
    'a referred submission must not nest lock acquisitions');
  assert.ok(!lock.isHeld(), 'every lock taken was released');
  assert.ok(!events.includes('REFUSED'), 'a single execution must never contend with itself');
});

/* ════════════════════════════════════════════════════════════
   Failure modes
   ════════════════════════════════════════════════════════════ */

test('a missing Leads table fails LOUDLY — it does not accept a submission and drop it', () => {
  const { sandbox } = load(new FakeSpreadsheet({ Referrals: referralsSheet() }), true);
  const res = jsonOf(sandbox.handleFormSubmission(INVESTOR()));

  // With one table there is no second copy to fall back on, so a missing table must
  // never look like a success. This is the opposite of the EAO category-tab bug.
  assert.equal(res.success, false);
  assert.match(res.error, /does not exist/);
  assert.match(res.error, /setupSpreadsheet/);
});

/* ════════════════════════════════════════════════════════════
   THE APPEND IS NAME-PROJECTED — the reader/writer asymmetry, closed.

   Until this fix, persistNewLead appended the canonical array positionally. Every
   READER in the file resolves by name and shrugs off a reordered header; the one
   WRITER assumed the header had not moved. So a human reordering the live Leads
   header would have kept every read working while silently writing Email into
   Category and the Details blob into Phone on every subsequent lead — and the
   readers' own tolerance is what would have hidden it. Nothing would have complained.
   ════════════════════════════════════════════════════════════ */

test('APPEND BY NAME: a REORDERED live header still receives every value under its own column', () => {
  // The header a human has rearranged. Same 25 columns, none where the code expects
  // it. Under the old positional append, every assertion below lands in the wrong
  // cell — this test is the proof the old behavior was wrong.
  const leads = new FakeSheet('Leads', [MANGLED.slice()]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  const res = jsonOf(sandbox.handleFormSubmission(INVESTOR()));
  assert.equal(res.success, true);
  assert.equal(leads.getLastRow(), 2);

  // Read the appended row back through the MANGLED header, by name.
  const row = leads.getDataRange().getValues()[1];
  const get = (name) => row[idx(MANGLED, name)];

  assert.equal(get('Lead ID'), res.leadId);
  assert.equal(get('Email'), 'ivy@x.com');
  assert.equal(get('First Name'), 'Ivy');
  assert.equal(get('Last Name'), 'Investor');
  assert.equal(get('Category'), 'Investor');
  assert.equal(get('Status'), 'New Lead');
  assert.equal(get('Role'), 'investor');
  assert.equal(get('Phone'), '555-0001');
  assert.equal(get('Company'), 'Ivy Capital');
  assert.equal(get('Referral Code'), res.referralCode);
  assert.equal(get('Heard About'), 'LinkedIn');
  assert.equal(get('Match Type'), 'none');
  assert.equal(get('Direct Referrals'), 0);
  assert.equal(get('Total Downstream'), 0);
  assert.equal(get('Reports Enabled'), '');

  // The blob landed in Details — not in Phone, which is where a positional append
  // would have put it under this header.
  const d = JSON.parse(get('Details'));
  assert.equal(d.aum, '$10-50M');
  assert.equal(d.message, 'Looking at multifamily.');
  assert.ok(!String(get('Phone')).startsWith('{'), 'the Details blob must not land in Phone');
});

test('APPEND BY NAME: the whole submission path still works on a reordered header — dedupe, referral, stats', () => {
  // Not just one row: the readers and the writer must agree on the same drifted sheet.
  const leads = new FakeSheet('Leads', [MANGLED.slice()]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  const ivy = jsonOf(sandbox.handleFormSubmission(INVESTOR()));
  const ray = REFERRAL_PARTNER();
  ray.referralCode = ivy.referralCode;
  const rayRes = jsonOf(sandbox.handleFormSubmission(ray));

  // Dedupe still finds the lead the writer just appended.
  const dup = INVESTOR();
  dup.message = 'Again.';
  const dupRes = jsonOf(sandbox.handleFormSubmission(dup));
  assert.equal(dupRes.resubmission, true);
  assert.equal(dupRes.leadId, ivy.leadId);
  assert.equal(leads.getLastRow(), 3, 'two leads, no duplicate');

  const rowOf = (id) => {
    const rows = leads.getDataRange().getValues();
    const r = rows.find((x) => x[idx(MANGLED, 'Lead ID')] === id);
    assert.ok(r, 'no row for ' + id);
    return (n) => r[idx(MANGLED, n)];
  };

  // The referral matched, the chain attached, the stats were credited — all through
  // a header where nothing sits where the code would have assumed.
  assert.equal(rowOf(rayRes.leadId)('Match Type'), 'code');
  assert.equal(rowOf(rayRes.leadId)('Referred By Lead ID'), ivy.leadId);
  assert.equal(rowOf(rayRes.leadId)('Referral Chain'), ivy.leadId);
  assert.equal(rowOf(ivy.leadId)('Direct Referrals'), 1);
  assert.equal(rowOf(ivy.leadId)('Total Downstream'), 1);

  // And the resubmission's blob RMW found the right cell too.
  assert.match(JSON.parse(rowOf(ivy.leadId)('Details')).message, /New message: Again\./);
});

test('APPEND BY NAME: this is a SAFETY fix, not a behavior change — a canonical header is byte-for-byte identical', () => {
  // The common case must be untouched. The appended row on a canonical header must
  // equal exactly what buildLeadRowUnified produced, cell for cell.
  const leads = emptyLeads();
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  const payload = INVESTOR();
  const res = jsonOf(sandbox.handleFormSubmission(payload));

  const appended = Array.from(leads.getDataRange().getValues()[1]);
  assert.equal(appended.length, 25, 'no padding, no widening');

  // Rebuild the same row directly and compare. (Timestamp is generated per call, so
  // pin it from the appended row; everything else must match exactly.)
  const expected = Array.from(sandbox.buildLeadRow(
    payload, 'New Lead', res.leadId, res.referralCode,
    { found: false, matchType: 'none' }, '',
  ));
  expected[colOf('Timestamp')] = appended[colOf('Timestamp')];

  assert.deepEqual(appended, expected,
    'on a canonical header the projection must be an exact no-op');
});

test('APPEND BY NAME: a human\'s EXTRA column is preserved as a blank, not clipped', () => {
  const wide = HEADER.concat(['Internal Notes']);   // somebody added a column
  const leads = new FakeSheet('Leads', [wide]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  sandbox.handleFormSubmission(INVESTOR());
  const row = leads.getDataRange().getValues()[1];

  assert.equal(row.length, 26, 'the row spans the sheet\'s real width');
  assert.equal(row[idx(wide, 'Email')], 'ivy@x.com');
  assert.equal(row[idx(wide, 'Internal Notes')], '', 'the unknown column is left blank, not overwritten');
});

test('APPEND BY NAME: a header MISSING a required column REFUSES the write — it never guesses', () => {
  const broken = HEADER.filter((h) => h !== 'Details');
  const leads = new FakeSheet('Leads', [broken]);
  const { sandbox } = load(new FakeSpreadsheet({ Leads: leads, Referrals: referralsSheet() }), true);

  const res = jsonOf(sandbox.handleFormSubmission(INVESTOR()));

  // Loud, not silent: resolveUnifiedCols throws headerLookupError, handleFormSubmission
  // catches it and reports failure. Refusing to run on a broken tab is the intended
  // outcome — the same contract every reader already has.
  assert.equal(res.success, false);
  assert.match(res.error, /Details/);
  assert.equal(leads.getLastRow(), 1, 'nothing may be appended to a header we cannot trust');
});

/* ════════════════════════════════════════════════════════════
   LEGACY — byte-for-byte production behavior, all five functions
   ════════════════════════════════════════════════════════════ */

test('legacy branch (flag off): one submission still writes THREE rows across three tabs', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  // Canonical, for the same reason the unified HEADER is (see its note): legacy's
  // buildLeadRow is positional too, and appendRow writes it into whatever header the
  // tab has. An append target with a scrambled header is not a sheet that can exist.
  const header = Array.from(probe.sandbox.LEAD_HEADERS);
  const at = (n) => header.indexOf(n);

  const lifetime = new FakeSheet('Lifetime Leads', [header.slice()]);
  const active = new FakeSheet('Active Leads', [header.slice()]);
  const partners = new FakeSheet('Referral Partners', [header.concat(['Reports Enabled'])]);
  const ss = new FakeSpreadsheet({
    'Lifetime Leads': lifetime, 'Active Leads': active,
    'Referral Partners': partners, Referrals: referralsSheet(),
  });
  const { sandbox } = load(ss, false);

  const res = jsonOf(sandbox.handleFormSubmission(REFERRAL_PARTNER()));
  assert.equal(res.success, true);

  // The triplication this migration deletes, still intact under the flag.
  assert.equal(lifetime.getLastRow(), 2, 'Lifetime Leads');
  assert.equal(active.getLastRow(), 2, 'Active Leads');
  assert.equal(partners.getLastRow(), 2, 'the category tab');
  assert.equal(lifetime.getDataRange().getValues()[1][at('Email')], 'ray@x.com');

  // 31 columns, and the per-tab Reports Enabled extra seeded TRUE by position 32.
  assert.equal(lifetime.getDataRange().getValues()[1].length, 31);
  assert.equal(partners.getDataRange().getValues()[1][31], true);
});

test('legacy branch (flag off): dedupe still scans Lifetime Leads and appends prose to the Message column', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const header = Array.from(probe.sandbox.LEAD_HEADERS);   // canonical append target
  const at = (n) => header.indexOf(n);

  const lifetime = new FakeSheet('Lifetime Leads', [header.slice()]);
  const active = new FakeSheet('Active Leads', [header.slice()]);
  const investors = new FakeSheet('Investors', [header.slice()]);
  const ss = new FakeSpreadsheet({
    'Lifetime Leads': lifetime, 'Active Leads': active, Investors: investors, Referrals: referralsSheet(),
  });
  const { sandbox } = load(ss, false);

  const first = jsonOf(sandbox.handleFormSubmission(INVESTOR()));
  const again = INVESTOR();
  again.message = 'Following up.';
  const res = jsonOf(sandbox.handleFormSubmission(again));

  assert.equal(res.resubmission, true);
  assert.equal(res.leadId, first.leadId);
  assert.equal(lifetime.getLastRow(), 2, 'no duplicate row under legacy either');

  // Legacy writes the note into the Message COLUMN — the column the unified schema
  // does not have. This is what must NOT change while the flag is off.
  const msg = lifetime.getDataRange().getValues()[1][at('Message')];
  assert.match(msg, /^Looking at multifamily\./);
  assert.match(msg, /Resubmission on 07\/14\/2026/);
  assert.match(msg, /New message: Following up\./);
});

test('legacy branch (flag off): submit_referral still gets prose prepended, and drops its qualData', () => {
  const probe = load(new FakeSpreadsheet({}), false);
  const header = Array.from(probe.sandbox.LEAD_HEADERS);   // canonical append target
  const at = (n) => header.indexOf(n);

  const lifetime = new FakeSheet('Lifetime Leads', [header.slice()]);
  const active = new FakeSheet('Active Leads', [header.slice()]);
  const ss = new FakeSpreadsheet({
    'Lifetime Leads': lifetime, 'Active Leads': active, Referrals: referralsSheet(),
  });
  const { sandbox } = load(ss, false);

  sandbox.handleFormSubmission(SUBMIT_REFERRAL());
  const row = lifetime.getDataRange().getValues()[1];

  assert.match(String(row[at('Message')]), /^Referred person:/, 'prose, still');
  assert.match(String(row[at('Message')]), /Email: jane@example\.com/);
  const flat = row.map(String).join(' ');
  assert.ok(!flat.includes('Former colleague'), 'legacy still discards submit_referral qualData');
});
