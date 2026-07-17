'use strict';

/*
 * Tests the pure (GAS-runtime-independent) functions of Code.gs by vm-loading
 * the REAL file — never a reimplementation. Covers the 25 functions the
 * 2026-07-09 backend audit flagged as untested.
 *
 * CRITICAL FIXTURE RULE (the lesson from the 2026-07-08 header-corruption
 * incident): any fixture that stands in for a live Sheet header row is
 * deliberately DIFFERENT from LEAD_HEADERS — reordered, re-cased, whitespace-
 * mangled, or renamed. A fixture built from the same constant the code reads
 * would make positional/name-matching bugs invisible, which is exactly how the
 * earlier throwaway harness passed while a real bug shipped. Header fixtures
 * here are defined by hand and asserted to NOT equal LEAD_HEADERS.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCode } = require('./helpers/load-code.js');

const S = loadCode();
// These are pre-dispatcher tests that assert LEGACY behavior (e.g. buildLeadRow's
// 31-column positional row, submit_referral prose in Message). They predate the
// USE_UNIFIED_SCHEMA switch and used to rely on its module default being false. The
// cutover flip (2026-07-15) made false no longer the default, so pin the legacy
// branch explicitly, exactly as every newer test file does. Deleted/rewritten for the
// unified schema at Phase D, with the legacy bodies these exercise.
S.USE_UNIFIED_SCHEMA = false;

/* ── vm sanity guard ──────────────────────────────────────────────────────── */

test('vm sandbox exposes top-level declarations (no top-level const/let regression)', () => {
  // If someone adds a top-level `const`/`let` to Code.gs, it stops attaching to
  // the vm global and every test that reads it silently sees undefined. Assert a
  // representative spread of vars + functions is visible so that regression is
  // caught here, loudly, rather than as a confusing failure elsewhere.
  for (const name of ['LEAD_HEADERS', 'COLS', 'CONFIG', 'LEAD_TYPES', 'BOOKING_SLOTS']) {
    assert.ok(S[name] !== undefined, `expected ${name} to be visible from the sandbox`);
  }
  for (const fn of ['roleToCategory', 'findHeaderIndex', 'buildLeadRow', 'renderTemplate']) {
    assert.equal(typeof S[fn], 'function', `expected ${fn} to be a function`);
  }
});

/* ── normalizeHeaderName ──────────────────────────────────────────────────── */

test('normalizeHeaderName: case, whitespace runs, trim, zero-width', () => {
  assert.equal(S.normalizeHeaderName('Lead ID'), 'lead id');
  assert.equal(S.normalizeHeaderName('  LEAD ID '), 'lead id');
  assert.equal(S.normalizeHeaderName('Lead  ID'), 'lead id'); // doubled space collapses
  assert.equal(S.normalizeHeaderName('Lead\u00A0ID'), 'lead id'); // NBSP is in \s -> space
  assert.equal(S.normalizeHeaderName('Lead\uFEFFID'), 'lead id'); // BOM is in \s -> space
  assert.equal(S.normalizeHeaderName('Lead\u200BID'), 'leadid'); // ZWSP not in \s; deleted, halves join
  assert.equal(S.normalizeHeaderName(''), '');
  assert.equal(S.normalizeHeaderName(null), '');
  assert.equal(S.normalizeHeaderName(undefined), '');
});

test('normalizeHeaderName: distinct headers stay distinct', () => {
  assert.notEqual(S.normalizeHeaderName('Lead ID'), S.normalizeHeaderName('LeadID'));
  assert.notEqual(S.normalizeHeaderName('Lead ID'), S.normalizeHeaderName('Referred By Lead ID'));
});

/* ── findHeaderIndex ──────────────────────────────────────────────────────── */

test('findHeaderIndex: resilient match against a deliberately mangled header row', () => {
  // Fixture is intentionally NOT LEAD_HEADERS: reordered, re-cased, whitespaced.
  const mangled = ['e-mail?', 'lead  id', 'TIMESTAMP', 'Referred By Lead ID', 'cat'];
  assert.notDeepEqual(mangled, Array.from(S.LEAD_HEADERS));

  assert.equal(S.findHeaderIndex(mangled, 'Lead ID'), 1); // 'lead  id' matches
  assert.equal(S.findHeaderIndex(mangled, 'Timestamp'), 2); // case-insensitive
  assert.equal(S.findHeaderIndex(mangled, 'Referred By Lead ID'), 3); // not confused with Lead ID
  assert.equal(S.findHeaderIndex(mangled, 'Category'), -1); // 'cat' is not 'Category'
  assert.equal(S.findHeaderIndex(mangled, 'Email'), -1); // 'e-mail?' is not 'Email'
  assert.equal(S.findHeaderIndex([], 'Lead ID'), -1);
  assert.equal(S.findHeaderIndex(['x'], ''), -1);
});

/* ── parseBookingDateTime ─────────────────────────────────────────────────── */

test('parseBookingDateTime: parses / rejects', () => {
  const d = S.parseBookingDateTime('June 27, 2026', '1:00 PM');
  assert.ok(d instanceof Date && !isNaN(d));
  assert.equal(S.parseBookingDateTime('not a date', 'nonsense'), null);
});

/* ── computeSlotAvailability ──────────────────────────────────────────────── */

test('computeSlotAvailability: overlap marks slot busy, gaps stay free', () => {
  const slots = ['8:00 AM', '9:00 AM', '10:00 AM'];
  // Busy 8:45-9:15 CT overlaps the 9:00 slot only.
  const busy = [{ start: '2026-06-27T14:45:00Z', end: '2026-06-27T15:15:00Z' }]; // 9:45? tz-dependent
  // Build busy relative to the actual parsed slot instead, to stay tz-safe:
  const nineStart = S.parseBookingDateTime('June 27, 2026', '9:00 AM').getTime();
  const busy2 = [{ start: new Date(nineStart + 5 * 60000).toISOString(), end: new Date(nineStart + 20 * 60000).toISOString() }];
  const out = S.computeSlotAvailability('June 27, 2026', busy2, slots);
  assert.equal(out['8:00 AM'], true);
  assert.equal(out['9:00 AM'], false); // overlapped
  assert.equal(out['10:00 AM'], true);
  void busy;
});

test('computeSlotAvailability: no busy periods → all free; unparseable slot → free', () => {
  const out = S.computeSlotAvailability('June 27, 2026', [], ['8:00 AM', 'garbage']);
  assert.equal(out['8:00 AM'], true);
  assert.equal(out['garbage'], true); // unparseable label doesn't block
});

test('computeSlotAvailability: adjacent (touching, non-overlapping) busy leaves slot free', () => {
  const eight = S.parseBookingDateTime('June 27, 2026', '8:00 AM').getTime();
  // Busy period ends exactly at slot start → half-open, no overlap.
  const busy = [{ start: new Date(eight - 30 * 60000).toISOString(), end: new Date(eight).toISOString() }];
  const out = S.computeSlotAvailability('June 27, 2026', busy, ['8:00 AM']);
  assert.equal(out['8:00 AM'], true);
});

/* ── icsEscape / icsFold ──────────────────────────────────────────────────── */

test('icsEscape: escapes RFC5545 special chars', () => {
  assert.equal(S.icsEscape('a;b,c\\d'), 'a\\;b\\,c\\\\d');
  assert.equal(S.icsEscape('line1\nline2'), 'line1\\nline2');
  assert.equal(S.icsEscape('line1\r\nline2'), 'line1\\nline2');
  assert.equal(S.icsEscape(null), '');
});

test('icsFold: folds lines over 75 octets with leading space continuations', () => {
  const short = 'BEGIN:VEVENT';
  assert.equal(S.icsFold(short), short);
  const long = 'SUMMARY:' + 'x'.repeat(200);
  const folded = S.icsFold(long);
  assert.ok(folded.includes('\r\n '), 'expected CRLF + space continuation');
  // First physical line is exactly 75 chars.
  assert.equal(folded.split('\r\n')[0].length, 75);
});

/* ── humanList ────────────────────────────────────────────────────────────── */

test('humanList: prose joining', () => {
  assert.equal(S.humanList([]), '');
  assert.equal(S.humanList(['A']), 'A');
  assert.equal(S.humanList(['A', 'B']), 'A and B');
  assert.equal(S.humanList(['A', 'B', 'C']), 'A, B and C');
  assert.equal(S.humanList(['A', null, 'C']), 'A and C'); // falsy filtered
});

/* ── referralIntentClause ─────────────────────────────────────────────────── */

test('referralIntentClause: known intents + default', () => {
  assert.match(S.referralIntentClause('I have a specific client in mind'), /client you have in mind/);
  assert.equal(S.referralIntentClause('something unmapped'), 'We look forward to connecting.');
  assert.equal(S.referralIntentClause(''), 'We look forward to connecting.');
});

/* ── leadSource ───────────────────────────────────────────────────────────── */

test('leadSource: qr normalizes, page is NOT a fallback, direct is blank', () => {
  assert.equal(S.leadSource({ source: 'qr' }), 'QR');
  assert.equal(S.leadSource({ source: 'QR' }), 'QR');
  assert.equal(S.leadSource({ source: '' }), '');
  assert.equal(S.leadSource({}), '');
  // The bug leadSource() exists to prevent: page must never become Source.
  assert.equal(S.leadSource({ page: 'axispoint.llc' }), '');
  // Any other explicit origin passes through verbatim.
  assert.equal(S.leadSource({ source: 'partner-portal' }), 'partner-portal');
});

/* ── leadHeardAbout ───────────────────────────────────────────────────────── */

test('leadHeardAbout: reads heardAbout only, trims, blank when absent', () => {
  assert.equal(S.leadHeardAbout({ heardAbout: '  LinkedIn ' }), 'LinkedIn');
  assert.equal(S.leadHeardAbout({}), '');
  assert.equal(S.leadHeardAbout({ source: 'qr' }), ''); // never reads source
});

/* ── leadTypeFor / roleToCategory / categoryTabForRole ────────────────────── */

test('leadTypeFor: known roles, unknown, prototype-key hardening', () => {
  assert.equal(S.leadTypeFor('investor').category, 'Investor');
  assert.equal(S.leadTypeFor('nope'), null);
  assert.equal(S.leadTypeFor(''), null);
  assert.equal(S.leadTypeFor(undefined), null);
  // POSTed role: "constructor" must not resolve to Object's constructor.
  assert.equal(S.leadTypeFor('constructor'), null);
  assert.equal(S.leadTypeFor('hasOwnProperty'), null);
});

test('roleToCategory: all five roles + unknown', () => {
  assert.equal(S.roleToCategory('investor'), 'Investor');
  assert.equal(S.roleToCategory('referral'), 'Referral Partner');
  assert.equal(S.roleToCategory('pro'), 'RE Professional');
  assert.equal(S.roleToCategory('existing_asset_owner'), 'Existing Asset Owner');
  assert.equal(S.roleToCategory('submit_referral'), 'Referral');
  assert.equal(S.roleToCategory('unknown'), '');
});

test('categoryTabForRole: tab or null (incl. deliberate submit_referral null)', () => {
  assert.equal(S.categoryTabForRole('investor'), 'Investors');
  assert.equal(S.categoryTabForRole('existing_asset_owner'), 'Existing Asset Owners');
  assert.equal(S.categoryTabForRole('submit_referral'), null); // by design, not omission
  assert.equal(S.categoryTabForRole('unknown'), null);
});

/* ── contactGroupForCategory ──────────────────────────────────────────────── */

test('contactGroupForCategory: registry categories + Client special case', () => {
  assert.equal(S.contactGroupForCategory('Investor'), 'AxisPoint Investors');
  assert.equal(S.contactGroupForCategory('Existing Asset Owner'), 'AxisPoint Existing Asset Owners');
  assert.equal(S.contactGroupForCategory('Client'), 'AxisPoint Clients'); // status-derived, explicit
  assert.equal(S.contactGroupForCategory('Referral'), null); // submit_referral has no group
  assert.equal(S.contactGroupForCategory('nonsense'), null);
});

/* ── leadTabConfigs ───────────────────────────────────────────────────────── */

test('leadTabConfigs: nine lead tabs, registry-ordered, submit_referral excluded', () => {
  // Array.from lifts the vm-realm array to the host realm so deepStrictEqual
  // compares contents, not cross-realm prototypes.
  const names = Array.from(S.leadTabConfigs().map((c) => c.name));
  assert.deepEqual(names, [
    'Active Leads',
    'Lifetime Leads',
    'Cold Leads',
    'Investors',
    'Referral Partners',
    'RE Professionals',
    'Existing Asset Owners',
    'Clients',
    'Archive',
  ]);
  // submit_referral (tab: null) must not appear.
  assert.ok(!names.includes('Referral'));
  // Every entry carries a color.
  S.leadTabConfigs().forEach((c) => assert.ok(c.color, `${c.name} missing color`));
});

/* ── expectedHeadersFor ───────────────────────────────────────────────────── */

test('expectedHeadersFor: Referral Partners gets +Reports Enabled, no duplicate Heard About', () => {
  const plain = S.expectedHeadersFor('Investors');
  assert.equal(plain.length, 31);
  assert.equal(plain[30], 'Heard About');

  const rp = S.expectedHeadersFor('Referral Partners');
  assert.equal(rp.length, 32);
  assert.equal(rp[31], 'Reports Enabled');
  // Regression: exactly one 'Heard About', never two.
  assert.equal(rp.filter((h) => h === 'Heard About').length, 1);

  // Returns a copy, not the shared LEAD_HEADERS reference.
  plain.push('MUTATED');
  assert.equal(S.LEAD_HEADERS.length, 31, 'expectedHeadersFor must not alias LEAD_HEADERS');
});

/* ── buildLeadRow ─────────────────────────────────────────────────────────── */

test('buildLeadRow: positional row matches COLS, heardAbout lands in 31 not Source', () => {
  const payload = {
    timestamp: '2026-06-27T12:00:00.000Z',
    role: 'investor',
    source: 'qr',
    heardAbout: 'LinkedIn',
    person: { firstName: 'Ada', lastName: 'Lovelace', email: 'ADA@Example.com', phone: '555', company: 'Analytical' },
    qualData: { assetClasses: ['Multifamily', 'Industrial'] },
    preferences: ['a', 'b'],
    booking: { date: 'June 27, 2026', slot: '1:00 PM', meetType: 'meet', phone: '' },
    message: 'hello',
  };
  const row = S.buildLeadRow(payload, 'New Lead', 'AXP-2026-0001', 'AXP-ABC123', { found: false, matchType: 'none' }, 'https://meet');

  assert.equal(row.length, 31);
  assert.equal(row[S.COLS.TIMESTAMP], '2026-06-27T12:00:00.000Z');
  assert.equal(row[S.COLS.LEAD_ID], 'AXP-2026-0001');
  assert.equal(row[S.COLS.ROLE], 'investor');
  assert.equal(row[S.COLS.CATEGORY], 'Investor');
  assert.equal(row[S.COLS.ASSET_CLASS], 'Multifamily, Industrial');
  assert.equal(row[S.COLS.SOURCE], 'QR'); // origin only
  assert.equal(row[S.COLS.HEARD_ABOUT], 'LinkedIn'); // separate column
  assert.notEqual(row[S.COLS.SOURCE], 'LinkedIn'); // never conflated
  assert.equal(row[S.COLS.STATUS], 'New Lead');
  assert.equal(row[S.COLS.MEET_LINK], 'https://meet');
  assert.equal(row[S.COLS.MATCH_TYPE], 'none');
});

test('buildLeadRow: submit_referral appends referred-person block to Message', () => {
  const payload = {
    role: 'submit_referral',
    person: { firstName: 'R', lastName: 'P', email: 'r@x.com' },
    referred: { firstName: 'New', lastName: 'Person', email: 'new@x.com', phone: '999', notes: 'warm intro' },
    message: 'original note',
  };
  const row = S.buildLeadRow(payload, 'New Lead', 'AXP-2026-0002', 'AXP-XYZ', { found: false, matchType: 'none' }, '');
  const msg = row[S.COLS.MESSAGE];
  assert.match(msg, /Referred person:/);
  assert.match(msg, /New Person/);
  assert.match(msg, /new@x.com/);
  assert.match(msg, /original note/);
});

/* ── normalizeEaoPayload / eao helpers ────────────────────────────────────── */

test('normalizeEaoPayload: reshapes in place, preserves role-specific fields', () => {
  const payload = {
    role: 'existing_asset_owner',
    name: 'Grace Hopper',
    email: 'grace@navy.mil',
    phone: '555',
    pressing_issue: 'Vacancy climbing',
    current_situation: 'Two office towers underperforming',
    portfolio_type: 'portfolio',
    property_type: 'Office',
  };
  const out = S.normalizeEaoPayload(payload);
  assert.equal(out, payload); // mutated in place, same ref
  assert.equal(payload.person.firstName, 'Grace');
  assert.equal(payload.person.lastName, 'Hopper');
  assert.equal(payload.person.email, 'grace@navy.mil');
  assert.ok(Array.isArray(payload.qualData.assetClasses));
  // It no longer copies pressing_issue onto message (that made Details.message
  // duplicate Details.pressing_issue), nor stuffs a synthetic JSON blob into
  // preferences (EAO's fields have real Details keys now). pressing_issue itself
  // is untouched on the payload, and reaches the internal email via leadMessageText.
  assert.ok(!payload.message, 'message is NOT populated from pressing_issue any more');
  assert.ok(!payload.preferences, 'preferences is NOT synthesized from eaoDetailsSummary any more');
  assert.equal(payload.pressing_issue, 'Vacancy climbing', 'the real field is left intact');
  // Role-specific fields must survive normalization (bookingEventInternalDescription reads them).
  assert.equal(payload.role, 'existing_asset_owner');
  assert.equal(payload.current_situation, 'Two office towers underperforming');
});

test('leadMessageText: EAO falls back to pressing_issue; every other role uses message', () => {
  // EAO has no dedicated message field, so its free text is pressing_issue.
  assert.equal(S.leadMessageText({ role: 'existing_asset_owner', pressing_issue: 'Debt maturing' }), 'Debt maturing');
  assert.equal(S.leadMessageText({ role: 'existing_asset_owner' }), '');
  // Non-EAO roles are unchanged: message verbatim, pressing_issue never consulted.
  assert.equal(S.leadMessageText({ role: 'investor', message: 'Hi there' }), 'Hi there');
  assert.equal(S.leadMessageText({ role: 'investor' }), '');
  // An explicit message always wins, even for EAO.
  assert.equal(S.leadMessageText({ role: 'existing_asset_owner', message: 'typed', pressing_issue: 'x' }), 'typed');
});

test('eaoAssetClassLabel: mixed portfolio, portfolio, single', () => {
  assert.match(
    S.eaoAssetClassLabel({ asset_breakdown: [{ property_type: ['Office', 'Retail'] }, { property_type: 'Industrial' }] }),
    /^Mixed portfolio: Office\/Retail, Industrial$/
  );
  assert.equal(S.eaoAssetClassLabel({ portfolio_type: 'portfolio', property_type: 'Multifamily' }), 'Portfolio: Multifamily');
  assert.equal(S.eaoAssetClassLabel({ property_type: 'Office' }), 'Single: Office');
  assert.equal(S.eaoAssetClassLabel({}), '');
});

test('eaoDetailsSummary: JSON captures provided EAO fields only', () => {
  const json = S.eaoDetailsSummary({ portfolio_type: 'single', property_type: 'Office', units: 0, pressing_issue: 'x' });
  const parsed = JSON.parse(json);
  assert.equal(parsed.portfolio_type, 'single');
  assert.equal(parsed.property_type, 'Office');
  assert.equal(parsed.units, 0); // units != null → included even when 0
  assert.equal(parsed.pressing_issue, 'x');
  assert.ok(!('sqft' in parsed)); // absent field omitted
});

/* ── renderTemplate ───────────────────────────────────────────────────────── */

test('renderTemplate: fills placeholders, strips unfilled, leaves literal text', () => {
  assert.equal(S.renderTemplate('Hi {{name}}!', { name: 'Ada' }), 'Hi Ada!');
  assert.equal(S.renderTemplate('a{{missing}}b', {}), 'ab'); // unfilled → ''
  assert.equal(S.renderTemplate('{{n}} + {{n}}', { n: 2 }), '2 + 2'); // repeated
  assert.equal(S.renderTemplate('no placeholders', {}), 'no placeholders');
  assert.equal(S.renderTemplate('{{a}}', { a: null }), ''); // null → ''
});

/* ── buildVisitorPersonalNote ─────────────────────────────────────────────── */

test('buildVisitorPersonalNote: per-role content + escaping + unknown role empty', () => {
  const inv = S.buildVisitorPersonalNote({ role: 'investor', qualData: { aum: '$1M-$5M', experience: ['Owned CRE directly'] } });
  assert.match(inv, /Your investor profile/);
  assert.match(inv, /\$1M-\$5M/);

  const pro = S.buildVisitorPersonalNote({ role: 'pro', qualData: { proRole: 'Broker', markets: ['Austin', 'Dallas'] } });
  assert.match(pro, /Broker/);
  assert.match(pro, /Austin and Dallas/);

  const sr = S.buildVisitorPersonalNote({ role: 'submit_referral', referred: { firstName: 'Jo', lastName: 'Blow' } });
  assert.match(sr, /Jo Blow/);

  assert.equal(S.buildVisitorPersonalNote({ role: 'mystery' }), ''); // unknown → ''
});

/* The EAO "What you told us" callout was REMOVED by request (2026-07-16). This
   test is the removal's guard: it pins that the note is EMPTY for EAO — not that
   some other label renders — so a future edit cannot quietly reintroduce the echo.
   The strongest assertion here is the last one: the visitor's own free text must
   not appear in the confirmation at all. */
test('buildVisitorPersonalNote: EAO renders NO note, and never echoes pressing_issue', () => {
  const eao = S.buildVisitorPersonalNote({
    role: 'existing_asset_owner',
    pressing_issue: 'Tenant <churn> & risk',
    current_situation: 'Two vacant floors',
  });
  assert.equal(eao, '');

  // Belt and braces: neither free-text field leaks through any other branch.
  assert.doesNotMatch(eao, /What you told us/);
  assert.doesNotMatch(eao, /Tenant/);
  assert.doesNotMatch(eao, /vacant/);

  // Even with nothing to echo, EAO stays empty rather than falling into a default.
  assert.equal(S.buildVisitorPersonalNote({ role: 'existing_asset_owner' }), '');
});

/* The removal must be an EMAIL-DISPLAY change only. pressing_issue is EAO's only
   free text, and it still has to reach storage and the internal surfaces — this is
   what makes "removed the echo" different from "dropped the field". */
test('buildVisitorPersonalNote: removing the EAO note did NOT drop pressing_issue anywhere else', () => {
  const payload = { role: 'existing_asset_owner', pressing_issue: 'Roof needs replacing', person: {} };

  // Still persisted to the Details blob.
  const details = S.buildLeadDetails(payload, '');
  assert.equal(details.pressing_issue, 'Roof needs replacing');

  // Still the internal display text (partner notification, booking dump, resubmissions).
  assert.equal(S.leadMessageText(payload), 'Roof needs replacing');
});

/* ── booking event content helpers (client vs internal split) ─────────────── */

test('bookingEventTitle: client-facing, no category label', () => {
  assert.equal(S.bookingEventTitle({ person: { firstName: 'Ada', lastName: 'Lovelace' } }), 'AxisPoint Partners intro call with Ada Lovelace');
  assert.equal(S.bookingEventTitle({ person: {} }), 'AxisPoint Partners intro call');
  // Never leaks a category/role.
  assert.ok(!/Investor|Category/.test(S.bookingEventTitle({ person: { firstName: 'A' }, role: 'investor' })));
});

test('bookingEventClientDescription: warm, NO CRM internals, meet vs phone', () => {
  const meet = S.bookingEventClientDescription({ booking: { meetType: 'meet' }, person: { firstName: 'A' } });
  assert.match(meet, /Google Meet/);
  const phone = S.bookingEventClientDescription({ booking: { meetType: 'phone', phone: '555-1234' }, person: {} });
  assert.match(phone, /555-1234/);
  // Privacy: must never contain CRM internals.
  const both = meet + phone;
  assert.ok(!/Lead ID|AXP-|Asset class|Source:/.test(both), 'client description leaked a CRM field');
});

test('bookingEventInternalDescription: full dump incl leadId, reads EAO fields post-normalize', () => {
  const payload = {
    role: 'existing_asset_owner',
    person: { firstName: 'Grace', lastName: 'Hopper', email: 'g@x.com', phone: '555' },
    booking: { meetType: 'phone', phone: '555-9' },
    qualData: { assetClasses: ['Office'] },
    current_situation: 'Underperforming towers',
    // EAO carries no `message`; its free text is pressing_issue, and the dump reads
    // it via leadMessageText() under the "Message / pressing issue" heading.
    pressing_issue: 'Vacancy climbing',
    source: 'qr',
  };
  const out = S.bookingEventInternalDescription(payload, 'AXP-2026-0007');
  assert.match(out, /AXP-2026-0007/);
  assert.match(out, /g@x.com/);
  assert.match(out, /Asset class: Office/);
  assert.match(out, /Current situation: Underperforming towers/); // role-specific field readable
  assert.match(out, /Source: QR/);
  assert.match(out, /Message \/ pressing issue:/);
  assert.match(out, /Vacancy climbing/); // pressing_issue surfaces even with no message field
});
