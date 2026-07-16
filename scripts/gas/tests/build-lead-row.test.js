'use strict';

/*
 * buildLeadRow — the unified-schema rewrite (migration Stage 6).
 *
 * This is where the migration's two DATA-FIDELITY FIXES actually ship. Until this
 * stage they were decisions in a document and existed nowhere in code:
 *
 *   §2a  All 13 qualData fields persist. Legacy writes exactly ONE (assetClasses →
 *        the Asset Class column) and silently discards the other twelve. The visitor
 *        answers the question, the browser sends the answer, the backend drops it.
 *   §2b  submit_referral's referred person becomes a structured Details.referred
 *        object instead of a prose paragraph prepended to the Message column.
 *
 * So the tests below are not "does it produce 25 cells". They are "does every field
 * a visitor actually filled in survive, on the right lead type, retrievable". Getting
 * the role mapping wrong here is wrong FOR REAL, going forward — an earlier draft of
 * the plan derived it from field names and got four of thirteen wrong.
 *
 * FIXTURE RULE, and it matters more here than anywhere else, because this stage IS
 * the schema: the expected column list below is HAND-TYPED from the plan's §1 table,
 * and every assertion reads the produced row through THAT list — never through
 * UNIFIED_LEAD_HEADERS or UCOLS. A test that indexes the row with the same constant
 * the code indexed it with proves only that the constant equals itself, and would
 * pass happily while every column was one cell to the left.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCode } = require('./helpers/load-code.js');

function unified() {
  const sandbox = loadCode();
  sandbox.USE_UNIFIED_SCHEMA = true;
  return sandbox;
}
function legacy() {
  const sandbox = loadCode();
  sandbox.USE_UNIFIED_SCHEMA = false;
  return sandbox;
}

/* The 25 columns, IN ORDER, hand-typed from UNIFIED_SCHEMA_MIGRATION_PLAN.md §1.
   Not imported, not derived. This list is the test's independent statement of what
   the schema is supposed to be. */
const EXPECTED_COLUMNS = [
  'Lead ID',
  'Timestamp',
  'Category',
  'Status',
  'Email',
  'First Name',
  'Last Name',
  'Referral Code',
  'Referred By Lead ID',
  'Referred By Name',
  'Referred By Email',
  'Referred By Code',
  'Match Type',
  'Referral Chain',
  'Chain Depth',
  'Direct Referrals',
  'Total Downstream',
  'Last Referral Date',
  'Phone',
  'Company',
  'Role',
  'Source',
  'Heard About',
  'Reports Enabled',
  'Details',
];

/** Reads a produced row by column NAME, through the hand-typed list above. */
function at(row, columnName) {
  const i = EXPECTED_COLUMNS.indexOf(columnName);
  if (i === -1) throw new Error('no such column in the expected schema: ' + columnName);
  return row[i];
}
/** The parsed Details blob of a produced row. */
function details(row) {
  const raw = at(row, 'Details');
  assert.equal(typeof raw, 'string', 'Details must be serialized, not a live object');
  return JSON.parse(raw);
}

const MATCH_NONE = { found: false, matchType: 'none' };

/** A referral match, hand-built — not taken from buildReferralMatch. */
const MATCH_CODE = {
  found: true,
  matchType: 'code',
  referrerLeadId: 'AXP-2026-0001',
  referrerName: 'Rita Referrer',
  referrerEmail: 'rita@x.com',
  referrerCode: 'AXP-RRR222',
  chain: 'AXP-2026-0000|AXP-2026-0001',
  depth: 2,
};

const BOOKING = { date: 'June 27, 2026', slot: '9:00 AM', meetType: 'meet', phone: '' };

function build(sandbox, payload, opts) {
  opts = opts || {};
  return sandbox.buildLeadRow(
    payload,
    opts.status || 'New Lead',
    opts.leadId || 'AXP-2026-0042',
    opts.referralCode || 'AXP-ZZZ999',
    opts.match || MATCH_NONE,
    opts.meetLink || '',
  );
}

/* ── Payloads, one per lead type, with EVERY qualData field filled ── */

const INVESTOR = {
  role: 'investor',
  person: { firstName: 'Ivy', lastName: 'Investor', email: 'ivy@x.com', phone: '555-0001', company: 'Ivy Capital' },
  message: 'Looking at multifamily in Texas.',
  qualData: { aum: '$10-50M', experience: '5-10 years', assetClasses: ['Multifamily', 'Industrial'], timeline: '3-6 months' },
  preferences: ['Market updates', 'Deal flow'],
  booking: BOOKING,
  heardAbout: 'LinkedIn',
  source: '',
  timestamp: '2026-07-14T12:00:00.000Z',
};

const REFERRAL_PARTNER = {
  role: 'referral',
  person: { firstName: 'Ray', lastName: 'Partner', email: 'ray@x.com', phone: '555-0002', company: 'Ray & Co' },
  message: 'Happy to send deals your way.',
  qualData: { profession: 'Attorney', clients: 'HNW individuals', referralIntent: 'Ongoing' },
  preferences: ['Newsletter'],
  booking: null,
  heardAbout: 'Referral',
  source: 'qr',
  timestamp: '2026-07-14T12:00:00.000Z',
};

const RE_PRO = {
  role: 'pro',
  person: { firstName: 'Pam', lastName: 'Pro', email: 'pam@x.com', phone: '555-0003', company: 'Pro Realty' },
  message: 'Broker in Dallas.',
  qualData: { proRole: 'Broker', markets: 'Dallas, Austin', proIntent: 'Co-broker deals' },
  preferences: [],
  booking: null,
  heardAbout: 'Google',
  source: '',
  timestamp: '2026-07-14T12:00:00.000Z',
};

const SUBMIT_REFERRAL = {
  role: 'submit_referral',
  person: { firstName: 'Sam', lastName: 'Submitter', email: 'sam@x.com', phone: '555-0004', company: '' },
  message: 'You should really talk to Jane.',
  qualData: { relationship: 'Former colleague', fit: 'Owns 200 units', awareness: 'Yes, I told her' },
  referred: {
    firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com',
    phone: '555-0100', notes: 'interested in multifamily',
  },
  preferences: ['Newsletter'],
  booking: null,
  heardAbout: 'Podcast',
  source: '',
  timestamp: '2026-07-14T12:00:00.000Z',
};

/** EAO arrives flat and is reshaped in place by normalizeEaoPayload, exactly as
 *  handleFormSubmission does before it calls buildLeadRow. */
function eaoPayload(sandbox) {
  const raw = {
    role: 'existing_asset_owner',
    name: 'Owen Owner',
    email: 'owen@x.com',
    phone: '555-0005',
    portfolio_type: 'Mixed',
    portfolio_composition: 'Multifamily + retail',
    property_type: 'Multifamily',
    units: 240,
    sqft: '180,000',
    asset_breakdown: '3 properties',
    current_situation: 'Considering a sale',
    pressing_issue: 'Debt maturing in 2027',
    booking: BOOKING,
    timestamp: '2026-07-14T12:00:00.000Z',
  };
  return sandbox.normalizeEaoPayload(raw);
}

/* ════════════════════════════════════════════════════════════
   The schema itself
   ════════════════════════════════════════════════════════════ */

test('the unified layout is exactly the plan\'s 25 columns, in the plan\'s order', () => {
  const sandbox = unified();
  // The hand-typed list vs the constant. A reordering, an insertion, or a rename
  // fails here — and this is the one place the two are allowed to meet.
  //
  // Array.from() is not cosmetic: Code.gs is evaluated in a vm context with its own
  // intrinsics, so its arrays carry a DIFFERENT Array.prototype and deepStrictEqual
  // fails on the realm rather than on the contents. Copying into a host array
  // compares what we actually mean to compare.
  assert.deepEqual(Array.from(sandbox.UNIFIED_LEAD_HEADERS), EXPECTED_COLUMNS);
  assert.equal(build(sandbox, INVESTOR).length, 25);
});

test('there is NO top-level Message column, and the submitter\'s text lives in Details.message', () => {
  const sandbox = unified();
  assert.ok(!EXPECTED_COLUMNS.includes('Message'), 'the schema has no Message column');
  assert.ok(!EXPECTED_COLUMNS.includes('Asset Class'), 'nor an Asset Class column');
  assert.ok(!EXPECTED_COLUMNS.includes('Preferences'), 'nor a Preferences column');

  const row = build(sandbox, INVESTOR);
  const msg = 'Looking at multifamily in Texas.';

  // The message must not appear in ANY of the 24 top-level cells.
  row.slice(0, 24).forEach((cell, i) => {
    assert.ok(String(cell) !== msg,
      `the message must not be a top-level column value (found at "${EXPECTED_COLUMNS[i]}")`);
  });
  assert.equal(details(row).message, msg);
});

/* ════════════════════════════════════════════════════════════
   §2a — all 13 qualData fields, per lead type, per the VERIFIED mapping.
   These twelve are DROPPED in production today. Each one is named explicitly so a
   regression names the field it lost.
   ════════════════════════════════════════════════════════════ */

test('§2a Investor: aum, experience, assetClasses, timeline ALL persist', () => {
  const row = build(unified(), INVESTOR);
  const d = details(row);

  assert.equal(d.aum, '$10-50M');                       // dropped today (email-only)
  assert.equal(d.experience, '5-10 years');             // dropped today (email-only)
  assert.deepEqual(d.assetClasses, ['Multifamily', 'Industrial']);   // the only one legacy kept
  assert.equal(d.timeline, '3-6 months');               // dropped today (read by NOTHING)

  // Fields belonging to other roles must NOT appear on this row.
  ['profession', 'clients', 'referralIntent', 'proRole', 'markets', 'proIntent',
   'relationship', 'fit', 'awareness'].forEach((k) => {
    assert.ok(!(k in d), `"${k}" is not an investor field and must be absent`);
  });

  // Top-level columns.
  assert.equal(at(row, 'Category'), 'Investor');
  assert.equal(at(row, 'Role'), 'investor');
  assert.equal(at(row, 'Email'), 'ivy@x.com');
  assert.equal(at(row, 'Reports Enabled'), '', 'only referral partners are seeded');
});

test('§2a Referral Partner: profession, clients, referralIntent ALL persist', () => {
  const row = build(unified(), REFERRAL_PARTNER);
  const d = details(row);

  assert.equal(d.profession, 'Attorney');           // dropped today (email-only)
  assert.equal(d.clients, 'HNW individuals');       // dropped today (read by NOTHING)
  assert.equal(d.referralIntent, 'Ongoing');        // dropped today (email-only)

  // `profession` belongs to the REFERRAL partner, not the RE pro. The plan's earlier
  // draft got this exact assignment wrong by guessing from the name.
  assert.ok(!('proRole' in d) && !('markets' in d), 'RE-pro fields must not appear here');

  assert.equal(at(row, 'Category'), 'Referral Partner');
  assert.equal(at(row, 'Reports Enabled'), true, 'referral partners ARE seeded enabled');
  assert.equal(at(row, 'Source'), 'QR', 'arrival channel, normalized');
  assert.equal(at(row, 'Heard About'), 'Referral', 'the visitor\'s own answer — a different question');
});

test('§2a RE Professional: proRole, markets, proIntent ALL persist', () => {
  const row = build(unified(), RE_PRO);
  const d = details(row);

  assert.equal(d.proRole, 'Broker');                // dropped today (email-only)
  assert.equal(d.markets, 'Dallas, Austin');        // dropped today (email-only)
  assert.equal(d.proIntent, 'Co-broker deals');     // dropped today (read by NOTHING)

  assert.ok(!('profession' in d), '"profession" belongs to the referral partner, not the RE pro');
  assert.equal(at(row, 'Category'), 'RE Professional');
});

test('§2a submit_referral: relationship, fit, awareness ALL persist — 100% of its qualData is discarded today', () => {
  const row = build(unified(), SUBMIT_REFERRAL);
  const d = details(row);

  // Every one of these three is read by NOTHING in production. This lead type is the
  // biggest single beneficiary of the fix.
  assert.equal(d.relationship, 'Former colleague');
  assert.equal(d.fit, 'Owns 200 units');
  assert.equal(d.awareness, 'Yes, I told her');

  // `awareness` and `fit` are submit_referral's, NOT the investor's — the other two
  // assignments the plan's earlier draft got wrong.
  const investorDetails = details(build(unified(), INVESTOR));
  assert.ok(!('awareness' in investorDetails) && !('fit' in investorDetails));

  assert.equal(at(row, 'Category'), 'Referral');
});

test('§2a: the blank-field contract — asked-but-blank is PRESENT as \'\'; never-asked is ABSENT', () => {
  const sandbox = unified();
  const partial = JSON.parse(JSON.stringify(INVESTOR));
  partial.qualData = { aum: '$10-50M', experience: '', assetClasses: [], timeline: '' };

  const d = details(build(sandbox, partial));

  // Asked, left blank → the key EXISTS, holding '' (or [] for a list). That is what
  // distinguishes "we asked and they didn't answer" from "we never asked".
  assert.ok('experience' in d, 'a blank answer must still round-trip as a key');
  assert.equal(d.experience, '');
  assert.ok('timeline' in d);
  assert.equal(d.timeline, '');
  assert.deepEqual(d.assetClasses, [], 'an empty list round-trips as []');

  // Never asked of an investor → absent entirely.
  assert.ok(!('proIntent' in d));

  // And with no assetClasses there is no derived label at all.
  assert.ok(!('assetClass' in d), 'the derived label is written only when non-empty');
});

/* ════════════════════════════════════════════════════════════
   §2b — the referred person is structured JSON, not prose
   ════════════════════════════════════════════════════════════ */

test('§2b submit_referral: Details.referred is a real object, read back as DISCRETE values', () => {
  const row = build(unified(), SUBMIT_REFERRAL);
  const d = details(row);

  // Retrievable as fields — not a paragraph that happens to contain them.
  assert.equal(typeof d.referred, 'object');
  assert.equal(d.referred.firstName, 'Jane');
  assert.equal(d.referred.lastName, 'Doe');
  assert.equal(d.referred.email, 'jane@example.com');
  assert.equal(d.referred.phone, '555-0100');
  assert.equal(d.referred.notes, 'interested in multifamily');
});

test('§2b: the prose block is GONE — asserted as a negative, so a double-write is caught', () => {
  const row = build(unified(), SUBMIT_REFERRAL);
  const d = details(row);

  // The submitter's message holds ONLY what the submitter typed.
  assert.equal(d.message, 'You should really talk to Jane.');

  // The legacy prose must not survive anywhere: not in the message, not in any cell.
  assert.ok(!d.message.includes('Referred person:'), 'the prose block must not be prepended');
  assert.ok(!d.message.includes('jane@example.com'), 'the referred email must not be glued into prose');
  row.forEach((cell, i) => {
    if (EXPECTED_COLUMNS[i] === 'Details') return;
    assert.ok(!String(cell).includes('Referred person:'),
      'the prose block must not appear in any top-level column either');
  });
});

test('§2b: a partially-filled referred person still round-trips, with blanks as \'\'', () => {
  const sandbox = unified();
  const partial = JSON.parse(JSON.stringify(SUBMIT_REFERRAL));
  partial.referred = { firstName: 'Jane', email: 'jane@example.com' };   // no last name/phone/notes

  const d = details(build(sandbox, partial));
  assert.deepEqual(d.referred, {
    firstName: 'Jane', lastName: '', email: 'jane@example.com', phone: '', notes: '',
  }, 'every key present, so a partial referral is still machine-readable');
});

/* ════════════════════════════════════════════════════════════
   EAO — the type whose informal JSON-blob pattern this generalizes
   ════════════════════════════════════════════════════════════ */

test('EAO: all eight detail fields land as real Details keys, read off the payload top level', () => {
  const sandbox = unified();
  const row = build(sandbox, eaoPayload(sandbox));
  const d = details(row);

  assert.equal(d.portfolio_type, 'Mixed');
  assert.equal(d.portfolio_composition, 'Multifamily + retail');
  assert.equal(d.property_type, 'Multifamily');
  assert.equal(d.units, 240, 'a number stays a number');
  assert.equal(d.sqft, '180,000');
  assert.equal(d.asset_breakdown, '3 properties');
  assert.equal(d.current_situation, 'Considering a sale');
  assert.equal(d.pressing_issue, 'Debt maturing in 2027');

  assert.equal(at(row, 'Category'), 'Existing Asset Owner');
  assert.equal(at(row, 'First Name'), 'Owen', 'the normalizer split the name');
  assert.equal(at(row, 'Last Name'), 'Owner');
  assert.equal(at(row, 'Heard About'), '', 'the EAO flow never asks the question');
});

test('EAO: no JSON blob lands in Details.preferences', () => {
  const sandbox = unified();
  const row = build(sandbox, eaoPayload(sandbox));
  const d = details(row);

  // normalizeEaoPayload used to set payload.preferences = [eaoDetailsSummary(payload)]
  // — a JSON STRING — because the legacy schema gave EAO nowhere else to put its
  // fields. That hack is gone: EAO's fields have real Details keys now, so the
  // normalizer creates no synthetic entry and preferences is simply empty.
  assert.deepEqual(d.preferences, [], 'no synthetic entry is created');
  d.preferences.forEach((p) => {
    assert.ok(!String(p).startsWith('{'), 'no preference may be a JSON blob');
  });

  // And the data itself is not lost — it is in the real keys, unencoded.
  assert.equal(d.portfolio_type, 'Mixed');
});

test('EAO: a real preference the flow might someday collect flows straight into Details', () => {
  const sandbox = unified();
  const p = eaoPayload(sandbox);
  p.preferences = ['Market updates'];   // as if the EAO flow started collecting them

  const d = details(build(sandbox, p));
  // With the synthetic-entry filter removed, an opt-in flows straight through —
  // there is no longer anything for it to survive.
  assert.deepEqual(d.preferences, ['Market updates']);
});

/* ════════════════════════════════════════════════════════════
   Shared fields, and the referral block
   ════════════════════════════════════════════════════════════ */

test('the referral-identity columns are populated from the match, and the chain is intact', () => {
  const row = build(unified(), INVESTOR, { match: MATCH_CODE });

  assert.equal(at(row, 'Referred By Lead ID'), 'AXP-2026-0001');
  assert.equal(at(row, 'Referred By Name'), 'Rita Referrer');
  assert.equal(at(row, 'Referred By Email'), 'rita@x.com');
  assert.equal(at(row, 'Referred By Code'), 'AXP-RRR222');
  assert.equal(at(row, 'Match Type'), 'code');
  assert.equal(at(row, 'Referral Chain'), 'AXP-2026-0000|AXP-2026-0001');
  assert.equal(at(row, 'Chain Depth'), 2);

  // A new lead has referred nobody yet.
  assert.equal(at(row, 'Direct Referrals'), 0);
  assert.equal(at(row, 'Total Downstream'), 0);
  assert.equal(at(row, 'Last Referral Date'), '');
});

test('an unreferred lead carries no referral identity, and Match Type reads "none"', () => {
  const row = build(unified(), RE_PRO);
  ['Referred By Lead ID', 'Referred By Name', 'Referred By Email', 'Referred By Code',
   'Referral Chain'].forEach((c) => assert.equal(at(row, c), ''));
  assert.equal(at(row, 'Match Type'), 'none');
  assert.equal(at(row, 'Chain Depth'), 0);
});

test('booking (and the Meet link) live in Details.booking — there are no booking columns', () => {
  const row = build(unified(), INVESTOR, { meetLink: 'https://meet.google.com/abc-defg-hij' });
  const d = details(row);

  assert.deepEqual(d.booking, {
    date: 'June 27, 2026', slot: '9:00 AM', meetType: 'meet', phone: '',
    meetLink: 'https://meet.google.com/abc-defg-hij',
  });
  ['Booking Date', 'Booking Time', 'Meet Type', 'Booking Phone', 'Meet Link']
    .forEach((c) => assert.ok(!EXPECTED_COLUMNS.includes(c), c + ' must not be a column'));

  // No booking at all → null, not a half-empty object.
  assert.equal(details(build(unified(), RE_PRO)).booking, null);
});

/* ════════════════════════════════════════════════════════════
   The legacy branch: byte-for-byte production, defects included
   ════════════════════════════════════════════════════════════ */

test('legacy branch (flag off): still 31 columns, still drops 12 of 13 qualData fields', () => {
  const sandbox = legacy();
  const row = sandbox.buildLeadRow(INVESTOR, 'New Lead', 'AXP-2026-0042', 'AXP-ZZZ999', MATCH_NONE, '');

  assert.equal(row.length, 31, 'the legacy 31-column layout is unchanged');

  // The whole row, as one string. The twelve dropped fields must appear NOWHERE —
  // that is the bug, and preserving it is the point: this is what production does,
  // and a migration stage must not quietly change live behavior.
  const flat = row.map(String).join(' ');
  ['$10-50M', '5-10 years', '3-6 months'].forEach((v) => {
    assert.ok(!flat.includes(v), `legacy must still drop "${v}"`);
  });
  // The one field it does keep: assetClasses → the Asset Class column (index 10).
  assert.equal(row[10], 'Multifamily, Industrial');
});

test('legacy branch (flag off): submit_referral is still prose prepended to Message', () => {
  const sandbox = legacy();
  const row = sandbox.buildLeadRow(SUBMIT_REFERRAL, 'New Lead', 'AXP-1', 'AXP-Z', MATCH_NONE, '');

  const message = row[11];   // legacy COLS.MESSAGE
  assert.match(message, /^Referred person:/, 'the prose block is still prepended');
  assert.match(message, /Name: Jane Doe/);
  assert.match(message, /Email: jane@example\.com/);
  assert.match(message, /You should really talk to Jane\./, 'and the submitter\'s own text follows');

  // And the qualData is still discarded entirely.
  const flat = row.map(String).join(' ');
  ['Former colleague', 'Owns 200 units', 'Yes, I told her'].forEach((v) => {
    assert.ok(!flat.includes(v), `legacy still discards "${v}"`);
  });
});

test('the two branches genuinely differ — the dispatcher is not returning the same row twice', () => {
  const u = Array.from(build(unified(), SUBMIT_REFERRAL));
  const l = Array.from(build(legacy(), SUBMIT_REFERRAL));
  assert.equal(u.length, 25);
  assert.equal(l.length, 31);
  assert.notDeepEqual(u, l);
  // The unified row carries a parseable blob; the legacy row carries prose.
  assert.ok(JSON.parse(u[24]).referred.email === 'jane@example.com');
  assert.match(String(l[11]), /Referred person:/);
});
