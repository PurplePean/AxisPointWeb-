'use strict';

/*
 * Sheet-backed repositories.
 *
 * WHAT THESE TESTS ARE FOR. Somebody will drag a column in the live Sheet, and when
 * they do the correct outcome is that nothing breaks. A position-based adapter would
 * instead start writing phone numbers into the notes column, with no error anywhere
 * and no way to tell which rows are affected afterwards.
 *
 * FIXTURE RULE: the header rows below are HAND-TYPED and deliberately mangled away
 * from the constants under test, reordered, re-cased, and whitespace-padded. A fixture
 * generated from LEAD_HEADERS would prove only that the constant equals itself.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const { FakeSheet, FakeSpreadsheet } = require('./helpers/fake-sheets.js');

const ctx = load();

/** Deliberately out of order, re-cased, and padded. Also carries an unknown column. */
const MANGLED_LEAD_HEADERS = [
  'Email',
  ' leadId ',
  'partnerNotifyStatus',
  'FULLNAME',
  'submissionId',
  'Owner Notes',
  'contactId',
  'spamSuspected',
  'ackEmailStatus',
  'calendarStatus',
  'activeBookingRequestId',
  'leadStatus',
  'phone',
  'calendarEventId',
];

const MANGLED_CONTACT_HEADERS = [
  'company',
  'CONTACTID',
  ' email ',
  'fullName',
  'leadCount',
  'phone',
  'lastLeadId',
];

const WORK_TAB_HEADERS = [
  'state',
  'workId',
  'attempts',
  'kind',
  'nextAttemptAt',
  'leadId',
  'idempotencyKey',
  'payload',
  'lastError',
  'completedAt',
  'createdAt',
];

function buildBook() {
  return new FakeSpreadsheet({
    Leads: new FakeSheet('Leads', [MANGLED_LEAD_HEADERS.slice()]),
    Contacts: new FakeSheet('Contacts', [MANGLED_CONTACT_HEADERS.slice()]),
    Work: new FakeSheet('Work', [WORK_TAB_HEADERS.slice()]),
  });
}

/* ── Leads ────────────────────────────────────────────────────────────────── */

test('a lead lands in the columns its headers name, not in header order', () => {
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({
    leadId: 'L-1',
    contactId: 'C-1',
    email: 'dana@whitfieldholdings.test',
    fullName: 'Dana Whitfield',
    phone: '214-555-0117',
    submissionId: 'S-1',
    leadStatus: 'new',
  });

  const row = book.getSheetByName('Leads').grid[1];
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf('Email')], 'dana@whitfieldholdings.test');
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf(' leadId ')], 'L-1');
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf('FULLNAME')], 'Dana Whitfield');
});

test('a column the code does not know about is left alone', () => {
  // "Owner Notes" is a human's column. Writing over it would destroy their work.
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1', email: 'x@y.test' });

  const row = book.getSheetByName('Leads').grid[1];
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf('Owner Notes')], '');
});

test('a field with no column in the sheet is dropped rather than shifting the row', () => {
  // The mangled tab has no 'pathway' column. Appending it positionally would push
  // every following value one cell to the right.
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1', pathway: 'management_proposal', email: 'x@y.test' });

  const row = book.getSheetByName('Leads').grid[1];
  assert.equal(row.length, MANGLED_LEAD_HEADERS.length);
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf('Email')], 'x@y.test');
});

test('a lead round-trips by id', () => {
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1', email: 'x@y.test', leadStatus: 'new' });

  const found = leads.findLeadById('L-1');
  assert.equal(found.email, 'x@y.test');
  assert.equal(found.leadStatus, 'new');
});

test('a lead is findable by submissionId, which is what replay protection needs', () => {
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1', submissionId: 'S-9' });

  assert.equal(leads.findLeadBySubmissionId('S-9').leadId, 'L-1');
  assert.equal(leads.findLeadBySubmissionId('S-0'), null);
});

test('a patch writes only the named cells', () => {
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1', email: 'x@y.test', fullName: 'Dana', leadStatus: 'new' });
  leads.updateLeadFields('L-1', { ackEmailStatus: 'sent' });

  const row = book.getSheetByName('Leads').grid[1];
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf('ackEmailStatus')], 'sent');
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf('Email')], 'x@y.test');
  assert.equal(row[MANGLED_LEAD_HEADERS.indexOf('FULLNAME')], 'Dana');
});

test('patching a lead that is not there reports false instead of writing somewhere', () => {
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1' });

  assert.equal(leads.updateLeadFields('L-nope', { ackEmailStatus: 'sent' }), false);
  assert.equal(book.getSheetByName('Leads').grid.length, 2);
});

test('the right row is patched when several leads exist', () => {
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1', email: 'a@x.test' });
  leads.insertLead({ leadId: 'L-2', email: 'b@x.test' });
  leads.insertLead({ leadId: 'L-3', email: 'c@x.test' });
  leads.updateLeadFields('L-2', { leadStatus: 'working' });

  const grid = book.getSheetByName('Leads').grid;
  const statusCol = MANGLED_LEAD_HEADERS.indexOf('leadStatus');
  assert.equal(grid[1][statusCol], '');
  assert.equal(grid[2][statusCol], 'working');
  assert.equal(grid[3][statusCol], '');
});

test('booleans survive the round trip', () => {
  const book = buildBook();
  const leads = ctx.makeLeadRepository(book);
  leads.insertLead({ leadId: 'L-1', spamSuspected: true });
  assert.equal(leads.findLeadById('L-1').spamSuspected, true);

  leads.insertLead({ leadId: 'L-2', spamSuspected: false });
  assert.equal(leads.findLeadById('L-2').spamSuspected, false);
});

test('a missing tab is named plainly and does not leak the spreadsheet id', () => {
  const leads = ctx.makeLeadRepository(new FakeSpreadsheet({}));
  assert.throws(() => leads.findLeadById('L-1'), /missing tab: Leads/);
});

/* ── Contacts ─────────────────────────────────────────────────────────────── */

test('candidate lookup matches on exact email or exact full phone digits', () => {
  const book = buildBook();
  const contacts = ctx.makeContactRepository(book);
  contacts.insertContact({ contactId: 'C-1', email: 'Dana@Whitfield.test', phone: '', fullName: 'Dana Whitfield' });
  contacts.insertContact({ contactId: 'C-2', email: '', phone: '(214) 555-0117', fullName: 'Someone Else' });
  contacts.insertContact({ contactId: 'C-3', email: 'other@x.test', phone: '', fullName: 'Third Person' });

  const byEmail = contacts.listContactCandidates({ emailKey: 'dana@whitfield.test', phoneKey: '' });
  assert.equal(byEmail.length, 1);
  assert.equal(byEmail[0].contactId, 'C-1');

  const byPhone = contacts.listContactCandidates({ emailKey: '', phoneKey: '2145550117' });
  assert.equal(byPhone[0].contactId, 'C-2');
});

test('a shared name is not a candidate, because it can never become a match', () => {
  // Filtering on name would read rows that matching is guaranteed to discard.
  const book = buildBook();
  const contacts = ctx.makeContactRepository(book);
  contacts.insertContact({ contactId: 'C-1', email: 'a@x.test', phone: '', fullName: 'Dana Whitfield' });

  const found = contacts.listContactCandidates({ emailKey: 'b@x.test', phoneKey: '' });
  assert.equal(found.length, 0);
});

test('empty lookup keys match nothing rather than everything', () => {
  const book = buildBook();
  const contacts = ctx.makeContactRepository(book);
  contacts.insertContact({ contactId: 'C-1', email: '', phone: '', fullName: '' });

  const found = contacts.listContactCandidates({ emailKey: '', phoneKey: '' });
  assert.equal(found.length, 0);
});

test('updating a contact rewrites its row in place', () => {
  const book = buildBook();
  const contacts = ctx.makeContactRepository(book);
  contacts.insertContact({ contactId: 'C-1', email: 'a@x.test', fullName: 'A', leadCount: 1 });
  contacts.updateContact({ contactId: 'C-1', email: 'a@x.test', fullName: 'A', leadCount: 2, company: 'Acme' });

  assert.equal(book.getSheetByName('Contacts').grid.length, 2);
  const stored = contacts.findContactById('C-1');
  assert.equal(stored.leadCount, 2);
  assert.equal(stored.company, 'Acme');
});

/* ── Work queue ───────────────────────────────────────────────────────────── */

test('enqueueing the same idempotency key twice stores one row', () => {
  const book = buildBook();
  const work = ctx.makeWorkRepository(book);
  const item = {
    workId: 'W-1',
    createdAt: '2026-08-03T14:00:00.000Z',
    kind: 'send_acknowledgement',
    leadId: 'L-1',
    state: 'pending',
    attempts: 0,
    nextAttemptAt: '2026-08-03T14:00:00.000Z',
    lastError: '',
    completedAt: '',
    idempotencyKey: 'send_acknowledgement:L-1:ack',
    payload: {},
  };

  work.enqueue(item);
  work.enqueue({ ...item, workId: 'W-2' });
  assert.equal(book.getSheetByName('Work').grid.length, 2);
});

test('only due pending items are claimed', () => {
  const book = buildBook();
  const work = ctx.makeWorkRepository(book);
  const base = {
    createdAt: '2026-08-03T14:00:00.000Z',
    kind: 'notify_partners',
    leadId: 'L-1',
    attempts: 0,
    lastError: '',
    completedAt: '',
    payload: {},
  };

  work.enqueue({ ...base, workId: 'W-1', state: 'pending', nextAttemptAt: '2026-08-03T13:00:00.000Z', idempotencyKey: 'k1' });
  work.enqueue({ ...base, workId: 'W-2', state: 'pending', nextAttemptAt: '2026-08-03T18:00:00.000Z', idempotencyKey: 'k2' });
  work.enqueue({ ...base, workId: 'W-3', state: 'succeeded', nextAttemptAt: '', idempotencyKey: 'k3' });

  const due = work.claimDue('2026-08-03T14:00:00.000Z', 10);
  assert.equal(due.length, 1);
  assert.equal(due[0].workId, 'W-1');
});

test('a payload survives serialization', () => {
  const book = buildBook();
  const work = ctx.makeWorkRepository(book);
  work.enqueue({
    workId: 'W-1',
    createdAt: '2026-08-03T14:00:00.000Z',
    kind: 'create_booking_event',
    leadId: 'L-1',
    state: 'pending',
    attempts: 0,
    nextAttemptAt: '2026-08-03T14:00:00.000Z',
    lastError: '',
    completedAt: '',
    idempotencyKey: 'k1',
    payload: { slotStart: '2026-08-04T15:00:00.000Z', durationMinutes: 30, mode: 'phone_call' },
  });

  const claimed = work.claimDue('2026-08-03T14:00:00.000Z', 10);
  assert.equal(claimed[0].payload.durationMinutes, 30);
  assert.equal(claimed[0].payload.mode, 'phone_call');
});

test('a corrupted payload cell degrades to an empty payload instead of throwing', () => {
  // One unreadable cell must not stop the entire queue from draining.
  const book = buildBook();
  const sheet = book.getSheetByName('Work');
  const row = new Array(WORK_TAB_HEADERS.length).fill('');
  row[WORK_TAB_HEADERS.indexOf('workId')] = 'W-1';
  row[WORK_TAB_HEADERS.indexOf('state')] = 'pending';
  row[WORK_TAB_HEADERS.indexOf('kind')] = 'notify_partners';
  row[WORK_TAB_HEADERS.indexOf('payload')] = '{broken';
  sheet.grid.push(row);

  const work = ctx.makeWorkRepository(book);
  const claimed = work.claimDue('2026-08-03T14:00:00.000Z', 10);
  assert.deepEqual(Object.keys(claimed[0].payload), []);
});

test('state transitions write back to the right row', () => {
  const book = buildBook();
  const work = ctx.makeWorkRepository(book);
  const base = {
    createdAt: '2026-08-03T14:00:00.000Z',
    kind: 'notify_partners',
    leadId: 'L-1',
    state: 'pending',
    attempts: 0,
    nextAttemptAt: '2026-08-03T13:00:00.000Z',
    lastError: '',
    completedAt: '',
    payload: {},
  };
  work.enqueue({ ...base, workId: 'W-1', idempotencyKey: 'k1' });
  work.enqueue({ ...base, workId: 'W-2', idempotencyKey: 'k2' });

  work.markSucceeded('W-2', {
    state: 'succeeded',
    attempts: 1,
    nextAttemptAt: '',
    lastError: '',
    completedAt: '2026-08-03T14:05:00.000Z',
  });

  const stateCol = WORK_TAB_HEADERS.indexOf('state');
  assert.equal(book.getSheetByName('Work').grid[1][stateCol], 'pending');
  assert.equal(book.getSheetByName('Work').grid[2][stateCol], 'succeeded');
});

/* ── Log degradation ──────────────────────────────────────────────────────── */

test('a missing Log tab does not fail the write path', () => {
  // The log is a convenience. Losing it must not cost a submission.
  const book = buildBook();
  const log = ctx.makeLogRepository(
    book,
    { newId: () => 'LOG-1' },
    { now: () => new Date('2026-08-03T14:00:00.000Z') },
  );
  assert.equal(log.append({ level: 'info', event: 'x' }), false);
});

/* ── Declared layout ──────────────────────────────────────────────────────── */

test('the declared layout names every tab the adapters actually open', () => {
  const declared = ctx.expectedTabLayout().map((t) => t.name);
  assert.deepEqual(Array.from(declared).sort(), ['Contacts', 'Leads', 'Log', 'Work']);
});

test('the declared work layout includes the two columns the queue serializes', () => {
  const work = ctx.expectedTabLayout().find((t) => t.name === 'Work');
  assert.ok(Array.from(work.headers).indexOf('idempotencyKey') !== -1);
  assert.ok(Array.from(work.headers).indexOf('payload') !== -1);
});
