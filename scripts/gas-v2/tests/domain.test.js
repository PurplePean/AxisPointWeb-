'use strict';

/*
 * Lead and Contact construction.
 *
 * WHAT THESE TESTS ARE FOR. The Lead/Contact split is the whole reason for the
 * rebuild, so the assertions here are about the split holding: a request's fields
 * land on the Lead, a person's fields land on the Contact, and a second submission
 * from the same person never erases what the first one recorded.
 *
 * The other silent failure guarded here is inference. A pathway does not tell you
 * what somebody IS, so contactCategory must stay empty on a service inquiry rather
 * than being guessed. A guess written into a person's record reads later as a fact
 * they stated.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');

const ctx = load();

const RECEIVED = new Date('2026-08-03T14:00:00.000Z');

function parsed(envelope) {
  const result = ctx.parseEnvelope(JSON.stringify(envelope));
  assert.equal(result.ok, true, `fixture should be valid: ${result.code || ''}`);
  return result.value;
}

function leadCtx(overrides = {}) {
  return {
    leadId: 'lead-1',
    contactId: 'contact-1',
    receivedAt: RECEIVED,
    slaDueAt: new Date('2026-08-03T19:00:00.000Z'),
    screening: { spamSuspected: false, spamReason: '' },
    possibleMatches: [],
    ...overrides,
  };
}

/* ── Lead ─────────────────────────────────────────────────────────────────── */

test('a management proposal lead carries every block it was given', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), leadCtx());

  assert.equal(lead.pathway, 'management_proposal');
  assert.equal(lead.serviceScope, 'pm');
  assert.equal(lead.propertyType, 'multifamily');
  assert.equal(lead.propertyLocation, 'Dallas, TX');
  assert.equal(lead.situationTiming, 'within_30_days');
  assert.equal(lead.fullName, 'Dana Whitfield');
  assert.equal(lead.organization, 'Whitfield Holdings');
});

test('blocks that do not apply to a pathway are empty, never absent', () => {
  // An empty string keeps the column shape identical across pathways. A missing key
  // would write a ragged row that a later reader has to special-case.
  const lead = ctx.buildLead(parsed(fx.investorServices()), leadCtx());
  assert.equal(lead.propertyType, '');
  assert.equal(lead.situationCurrent, '');
  assert.equal(lead.serviceScope, '');
  assert.equal(lead.topic, 'actively_searching');
});

test('operational fields are set by the server at their initial values', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), leadCtx());
  assert.equal(lead.leadStatus, 'new');
  assert.equal(lead.qualificationOutcome, 'pending');
  assert.equal(lead.firstHumanContactAt, '');
  assert.equal(lead.ackEmailStatus, 'pending');
  assert.equal(lead.partnerNotifyStatus, 'pending');
  assert.equal(lead.calendarStatus, 'none');
  assert.equal(lead.activeBookingRequestId, '');
});

test('the SLA due time is stored as an ISO instant', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), leadCtx());
  assert.equal(lead.slaDueAt, '2026-08-03T19:00:00.000Z');
});

test('a submission with no commitment stores no due time', () => {
  const lead = ctx.buildLead(parsed(fx.contactExchange()), leadCtx({ slaDueAt: null }));
  assert.equal(lead.slaDueAt, '');
});

test('page locale and follow-up locale are stored as two separate columns', () => {
  const lead = ctx.buildLead(parsed(fx.investorServices()), leadCtx());
  assert.equal(lead.pageLocale, 'en');
  assert.equal(lead.preferredFollowUpLocale, 'es');
  assert.equal(lead.preferredFollowUpStated, true);
});

test('an unstated follow-up locale is inferred but flagged as inferred', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), leadCtx());
  assert.equal(lead.preferredFollowUpLocale, 'en');
  assert.equal(lead.preferredFollowUpStated, false);
});

test('a QR scan records which card was scanned', () => {
  const lead = ctx.buildLead(parsed(fx.contactExchange()), leadCtx());
  assert.equal(lead.sourceCategory, 'qr');
  assert.equal(lead.sourceDetail, 'zachary-russell');
  assert.equal(lead.scannedPartner, 'zachary_russell');
  assert.equal(lead.scannedSlugUnresolved, false);
});

test('an unknown card slug is recorded as unresolved rather than guessed', () => {
  const lead = ctx.buildLead(
    parsed(fx.contactExchange({ attribution: { sourceDetail: 'former-partner' } })),
    leadCtx(),
  );
  assert.equal(lead.scannedPartner, '');
  assert.equal(lead.scannedSlugUnresolved, true);
});

test('refToken is stored verbatim and nothing else changes because of it', () => {
  const withRef = ctx.buildLead(
    parsed(fx.managementProposal({ attribution: { refToken: 'PARTNER-77' } })),
    leadCtx(),
  );
  const without = ctx.buildLead(parsed(fx.managementProposal()), leadCtx());

  assert.equal(withRef.refToken, 'PARTNER-77');
  assert.equal(without.refToken, '');
  // Inert: no owner, no status, no routing field moves because a token was present.
  assert.equal(withRef.ownerPartner, without.ownerPartner);
  assert.equal(withRef.leadStatus, without.leadStatus);
});

/* ── Contact ──────────────────────────────────────────────────────────────── */

test('a contact exchange records the category the person actually chose', () => {
  const contact = ctx.buildContact(parsed(fx.contactExchange()), leadCtx());
  assert.equal(contact.contactCategory, 'broker_real_estate_advisor');
  assert.equal(contact.roleOrTitle, 'Principal');
  assert.equal(contact.company, 'Raman Brokers');
});

test('a service inquiry leaves contactCategory empty rather than inferring one', () => {
  const contact = ctx.buildContact(parsed(fx.managementProposal()), leadCtx());
  assert.equal(contact.contactCategory, '');
  // The organization still lands, because that one WAS stated.
  assert.equal(contact.company, 'Whitfield Holdings');
});

test('contact sync status truthfully reports that no sync exists yet', () => {
  const contact = ctx.buildContact(parsed(fx.contactExchange()), leadCtx());
  assert.equal(contact.contactSyncStatus, 'not_configured');
});

test('a new contact starts with one lead attributed to it', () => {
  const contact = ctx.buildContact(parsed(fx.managementProposal()), leadCtx());
  assert.equal(contact.leadCount, 1);
  assert.equal(contact.lastLeadId, 'lead-1');
  assert.equal(contact.createdAt, '2026-08-03T14:00:00.000Z');
});

/* ── Merge ────────────────────────────────────────────────────────────────── */

test('a blank incoming value never erases a stored one', () => {
  // Somebody filling in only a phone on their second submission must not lose the
  // email from their first.
  const existing = ctx.buildContact(parsed(fx.contactExchange()), leadCtx());
  const merged = ctx.mergeContact(
    existing,
    { fullName: 'Priya Raman', email: '', phone: '972-555-0143', company: '' },
    { leadId: 'lead-2', receivedAt: new Date('2026-09-01T14:00:00.000Z') },
  );

  assert.equal(merged.email, 'priya@ramanbrokers.test');
  assert.equal(merged.company, 'Raman Brokers');
});

test('a populated incoming value does replace a stored one', () => {
  const existing = ctx.buildContact(parsed(fx.contactExchange()), leadCtx());
  const merged = ctx.mergeContact(
    existing,
    { email: 'priya@newfirm.test', company: 'New Firm' },
    { leadId: 'lead-2', receivedAt: new Date('2026-09-01T14:00:00.000Z') },
  );

  assert.equal(merged.email, 'priya@newfirm.test');
  assert.equal(merged.company, 'New Firm');
});

test('merging counts the new lead and moves the pointer', () => {
  const existing = ctx.buildContact(parsed(fx.contactExchange()), leadCtx());
  const merged = ctx.mergeContact(existing, {}, {
    leadId: 'lead-2',
    receivedAt: new Date('2026-09-01T14:00:00.000Z'),
  });

  assert.equal(merged.leadCount, 2);
  assert.equal(merged.lastLeadId, 'lead-2');
  assert.equal(merged.lastLeadAt, '2026-09-01T14:00:00.000Z');
  assert.equal(merged.createdAt, '2026-08-03T14:00:00.000Z');
});

test('an inferred follow-up locale does not overwrite a stated one', () => {
  const existing = ctx.buildContact(parsed(fx.investorServices()), leadCtx());
  assert.equal(existing.preferredFollowUpLocale, 'es');

  const merged = ctx.mergeContact(
    existing,
    { preferredFollowUpLocale: 'en', preferredFollowUpStated: false },
    { leadId: 'lead-2', receivedAt: new Date('2026-09-01T14:00:00.000Z') },
  );
  assert.equal(merged.preferredFollowUpLocale, 'es');
});

test('merging does not mutate the record it was given', () => {
  const existing = ctx.buildContact(parsed(fx.contactExchange()), leadCtx());
  const before = JSON.stringify(existing);
  ctx.mergeContact(existing, { email: 'other@x.test' }, {
    leadId: 'lead-2',
    receivedAt: new Date('2026-09-01T14:00:00.000Z'),
  });
  assert.equal(JSON.stringify(existing), before);
});

/* ── Row projection ───────────────────────────────────────────────────────── */

test('every lead header has a value in the projected row', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), leadCtx());
  const row = ctx.toRow(ctx.LEAD_HEADERS, lead);
  assert.equal(row.length, ctx.LEAD_HEADERS.length);
  row.forEach((cell, i) => {
    assert.notEqual(cell, undefined, `header ${ctx.LEAD_HEADERS[i]} produced undefined`);
  });
});

test('booleans round-trip through the row projection', () => {
  const lead = ctx.buildLead(
    parsed(fx.contactExchange({ attribution: { sourceDetail: 'former-partner' } })),
    leadCtx(),
  );
  const row = ctx.toRow(ctx.LEAD_HEADERS, lead);
  const back = ctx.fromRow(ctx.LEAD_HEADERS, row);
  assert.equal(back.scannedSlugUnresolved, true);
  assert.equal(back.propertyScaleUnknown, false);
});

test('lead headers are unique', () => {
  const seen = new Set();
  Array.from(ctx.LEAD_HEADERS).forEach((h) => {
    assert.equal(seen.has(h), false, `duplicate header ${h}`);
    seen.add(h);
  });
});
