'use strict';

/*
 * The record builders.
 *
 * WHAT THESE TESTS ARE FOR. The Lead/Contact split is the reason for the rebuild, and
 * Pass 9B narrowed it further: a builder now refuses the wrong submission kind outright
 * instead of producing a half-empty row. The first group asserts that refusal, because a
 * silent empty row is exactly how the defect would come back.
 *
 * The rest guard inference. A pathway does not tell you what somebody IS, so a category
 * must stay empty rather than being guessed; a guess written into a person's record reads
 * later as a fact they stated.
 *
 * The immutable Submission and the Delivery row are covered by storage-model.test.js.
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

function buildCtx(overrides = {}) {
  return {
    leadId: 'lead-1',
    contactId: 'contact-1',
    receivedAt: RECEIVED,
    slaDueAt: new Date('2026-08-04T22:00:00.000Z'),
    screening: { spamSuspected: false, spamReason: '' },
    possibleMatches: [],
    ...overrides,
  };
}

/* ── A builder refuses the wrong kind ─────────────────────────────────────── */

test('buildLead refuses a contact exchange rather than making an empty-pathway Lead', () => {
  assert.throws(
    () => ctx.buildLead(parsed(fx.contactExchange()), buildCtx()),
    /LeadFromNonInquiry/,
  );
});

test('buildContact refuses a service inquiry rather than filing a person', () => {
  assert.throws(
    () => ctx.buildContact(parsed(fx.managementProposal()), buildCtx()),
    /ContactFromNonExchange/,
  );
});

/* ── Lead ─────────────────────────────────────────────────────────────────── */

test('a management proposal Lead carries every block it was given', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());

  assert.equal(lead.pathway, 'management_proposal');
  assert.equal(lead.serviceScope, 'pm');
  assert.equal(lead.propertyType, 'multifamily');
  assert.equal(lead.propertyLocation, 'Dallas, TX');
  assert.equal(lead.situationTiming, 'within_30_days');
  assert.equal(lead.fullName, 'Dana Whitfield');
  assert.equal(lead.organization, 'Whitfield Holdings');
});

test('blocks that do not apply to a pathway are empty, never absent', () => {
  // An empty string keeps the column shape identical across pathways. A missing key would
  // write a ragged row that a later reader has to special-case.
  const lead = ctx.buildLead(parsed(fx.investorServices()), buildCtx());
  assert.equal(lead.propertyType, '');
  assert.equal(lead.situationCurrent, '');
  assert.equal(lead.serviceScope, '');
  assert.equal(lead.topic, 'actively_searching');
});

test('the Lead points back at its Submission and carries no contactId', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  assert.equal(lead.sourceSubmissionId, fx.VALID_UUID);
  assert.equal(lead.contactId, undefined, 'a website inquiry files no person');
});

test('operational fields are set by the server at their initial values', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  assert.equal(lead.leadStatus, 'new');
  assert.equal(lead.qualificationOutcome, 'pending');
  assert.equal(lead.firstHumanContactAt, '');
  assert.equal(lead.ownerPartner, '');
  assert.equal(lead.calendarStatus, 'none');
  assert.equal(lead.activeBookingRequestId, '');
});

test('delivery status does not live on the Lead any more', () => {
  // It moved to the Delivery row, because a QR exchange has delivery state and no Lead.
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  assert.equal(lead.ackEmailStatus, undefined);
  assert.equal(lead.partnerNotifyStatus, undefined);
  assert.equal(lead.digestStatus, undefined);
});

test('the SLA due time is stored as an ISO instant', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  assert.equal(lead.slaDueAt, '2026-08-04T22:00:00.000Z');
});

test('page locale and follow-up locale are stored as two separate columns', () => {
  const lead = ctx.buildLead(parsed(fx.investorServices()), buildCtx());
  assert.equal(lead.pageLocale, 'en');
  assert.equal(lead.preferredFollowUpLocale, 'es');
  assert.equal(lead.preferredFollowUpStated, true);
});

test('an unstated follow-up locale is inferred but flagged as inferred', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  assert.equal(lead.preferredFollowUpLocale, 'en');
  assert.equal(lead.preferredFollowUpStated, false);
});

test('refToken is stored verbatim and nothing else changes because of it', () => {
  const withRef = ctx.buildLead(
    parsed(fx.managementProposal({ attribution: { refToken: 'PARTNER-77' } })),
    buildCtx(),
  );
  const without = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());

  assert.equal(withRef.refToken, 'PARTNER-77');
  assert.equal(without.refToken, '');
  // Inert: no owner, no status, no routing field moves because a token was present.
  assert.equal(withRef.ownerPartner, without.ownerPartner);
  assert.equal(withRef.leadStatus, without.leadStatus);
});

/* ── Booking eligibility ──────────────────────────────────────────────────── */

test('Property Management and PM plus AM are bookable', () => {
  assert.equal(ctx.isBookablePathway('management_proposal', 'pm'), true);
  assert.equal(ctx.isBookablePathway('management_proposal', 'pm_plus_am'), true);
});

test('an undecided scope is still bookable, because that is the conversation', () => {
  assert.equal(ctx.isBookablePathway('management_proposal', 'undecided'), true);
});

test('investor services and general inquiry are not bookable', () => {
  assert.equal(ctx.isBookablePathway('investor_services', ''), false);
  assert.equal(ctx.isBookablePathway('general_inquiry', ''), false);
});

test('eligibility is stored on the Lead so the frontend cannot disagree with it', () => {
  const bookable = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  const notBookable = ctx.buildLead(parsed(fx.investorServices()), buildCtx());

  assert.equal(bookable.bookingEligible, true);
  assert.equal(notBookable.bookingEligible, false);
});

/* ── Contact ──────────────────────────────────────────────────────────────── */

test('a contact exchange records the category the person actually chose', () => {
  const contact = ctx.buildContact(parsed(fx.contactExchange()), buildCtx());
  assert.equal(contact.contactCategory, 'broker_real_estate_advisor');
  assert.equal(contact.roleOrTitle, 'Principal');
  assert.equal(contact.company, 'Raman Brokers');
});

test('the Contact stores the phone as typed and the normalized digits alongside', () => {
  const contact = ctx.buildContact(
    parsed(fx.contactExchange({ payload: { phone: '+44 (0)20 7946-0958' } })),
    buildCtx(),
  );
  assert.equal(contact.phone, '+44 (0)20 7946-0958');
  assert.equal(contact.normalizedPhone, '4402079460958');
});

test('the Contact points back at its Submission', () => {
  const contact = ctx.buildContact(parsed(fx.contactExchange()), buildCtx());
  assert.equal(contact.sourceSubmissionId, '99998888-7777-4666-8555-444433332222');
});

test('attribution is recorded and ownership is left unassigned', () => {
  const contact = ctx.buildContact(parsed(fx.contactExchange()), buildCtx());
  assert.equal(contact.acquisitionSource, 'zachary_russell');
  assert.equal(contact.scannedPartner, 'zachary_russell');
  assert.equal(contact.ownerPartner, '');
  assert.equal(contact.followUpState, 'not_contacted');
});

test('an unknown card slug is recorded as unresolved rather than guessed', () => {
  const contact = ctx.buildContact(
    parsed(fx.contactExchange({ attribution: { sourceDetail: 'former-partner' } })),
    buildCtx(),
  );
  assert.equal(contact.acquisitionSource, 'unknown');
  assert.equal(contact.scannedPartner, '');
});

test('the firm card is recorded as firm and never as a partner', () => {
  const contact = ctx.buildContact(
    parsed(fx.contactExchange({ attribution: { sourceDetail: 'axispoint-partners' } })),
    buildCtx(),
  );
  assert.equal(contact.acquisitionSource, 'firm');
  assert.equal(contact.scannedPartner, '', 'firm must not occupy a partner field');
});

test('a new Contact counts one submission and links to no Lead', () => {
  const contact = ctx.buildContact(parsed(fx.contactExchange()), buildCtx());
  assert.equal(contact.submissionCount, 1);
  assert.equal(contact.lastSubmissionId, '99998888-7777-4666-8555-444433332222');
  assert.equal(contact.linkedLeadIds, '', 'linking is a human decision');
  assert.equal(contact.createdAt, '2026-08-03T14:00:00.000Z');
});

test('Google Contacts readiness is present, empty, and not configured', () => {
  const contact = ctx.buildContact(parsed(fx.contactExchange()), buildCtx());
  assert.equal(contact.contactSyncStatus, 'not_configured');
  assert.equal(contact.externalContactResourceName, '');
  assert.equal(contact.externalContactEtag, '');
  assert.equal(contact.externalContactSyncedAt, '');
});

test('there is no merge helper to call', () => {
  // It folded a new submission into an existing Contact, which is what the approved rule
  // forbids. Dead code here would be an invitation to call it again.
  assert.equal(typeof ctx.mergeContact, 'undefined');
});

/* ── Row projection ───────────────────────────────────────────────────────── */

test('every lead header has a value in the projected row', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  const row = ctx.toRow(ctx.LEAD_HEADERS, lead);
  assert.equal(row.length, ctx.LEAD_HEADERS.length);
  row.forEach((cell, i) => {
    assert.notEqual(cell, undefined, `header ${ctx.LEAD_HEADERS[i]} produced undefined`);
  });
});

test('every submission header has a value in the projected row', () => {
  const submission = ctx.buildSubmission(parsed(fx.contactExchange()), buildCtx());
  const row = ctx.toRow(ctx.SUBMISSION_HEADERS, submission);
  assert.equal(row.length, ctx.SUBMISSION_HEADERS.length);
  row.forEach((cell, i) => {
    assert.notEqual(cell, undefined, `header ${ctx.SUBMISSION_HEADERS[i]} produced undefined`);
  });
});

test('booleans round-trip through the row projection', () => {
  const lead = ctx.buildLead(parsed(fx.managementProposal()), buildCtx());
  const back = ctx.fromRow(ctx.LEAD_HEADERS, ctx.toRow(ctx.LEAD_HEADERS, lead));
  assert.equal(back.bookingEligible, true);
  assert.equal(back.propertyScaleUnknown, false);
});

test('lead, contact, submission, and delivery headers are each unique', () => {
  [
    ['LEAD_HEADERS', ctx.LEAD_HEADERS],
    ['CONTACT_HEADERS', ctx.CONTACT_HEADERS],
    ['SUBMISSION_HEADERS', ctx.SUBMISSION_HEADERS],
    ['DELIVERY_HEADERS', ctx.DELIVERY_HEADERS],
  ].forEach(([name, headers]) => {
    const seen = new Set();
    Array.from(headers).forEach((h) => {
      assert.equal(seen.has(h), false, `duplicate header ${h} in ${name}`);
      seen.add(h);
    });
  });
});
