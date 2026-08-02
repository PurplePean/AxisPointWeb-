'use strict';

/*
 * In-memory fakes for every port.
 *
 * These are FAKES, not mocks: they implement real behaviour (a row store that
 * actually stores rows, a queue that actually queues) so a test can assert on
 * outcomes rather than on which methods were called. Asserting call order proves the
 * code called something; asserting stored state proves it did the right thing.
 *
 * Every fake records what it was asked to do, so a test can also prove a NEGATIVE:
 * that no email was sent, that nothing was written twice.
 */

/**
 * Deterministic ids. A test that depends on real randomness is a flaky test.
 *
 * They are still UUID-SHAPED, because leadId is a UUID on the wire and the booking
 * command validates it as one. A readable-but-invalid fake id would let a real
 * format regression pass unnoticed.
 */
function fakeIds(prefix = '0000') {
  let n = 0;
  return {
    issued: [],
    newId() {
      n += 1;
      const tail = String(n).padStart(12, '0');
      const id = `${prefix}0000-0000-4000-8000-${tail}`;
      this.issued.push(id);
      return id;
    },
  };
}

function fakeClock(startIso) {
  let current = new Date(startIso);
  return {
    now() {
      return new Date(current.getTime());
    },
    advanceMinutes(minutes) {
      current = new Date(current.getTime() + minutes * 60000);
    },
    set(iso) {
      current = new Date(iso);
    },
  };
}

/**
 * Lock fake. `contended: true` makes acquisition fail the way the real adapter does,
 * so the caller's behaviour under contention is testable.
 */
function fakeLock(options = {}) {
  return {
    calls: 0,
    contended: options.contended === true,
    withLock(fn) {
      this.calls += 1;
      if (this.contended) throw new Error('LockUnavailable');
      return fn();
    },
  };
}

/** A generic row store keyed by an id field. */
function makeStore(idField) {
  return {
    rows: [],
    insert(record) {
      this.rows.push({ ...record });
      return record[idField];
    },
    findBy(field, value) {
      return this.rows.find((r) => String(r[field]) === String(value)) || null;
    },
    patch(id, fields) {
      const row = this.findBy(idField, id);
      if (!row) return false;
      Object.assign(row, fields);
      return true;
    },
  };
}

function fakeLeadRepository() {
  const store = makeStore('leadId');
  return {
    store,
    inserted: [],
    patches: [],
    insertLead(lead) {
      this.inserted.push(lead.leadId);
      return store.insert(lead);
    },
    findLeadById(leadId) {
      const row = store.findBy('leadId', leadId);
      return row ? { ...row } : null;
    },
    findLeadBySubmissionId(submissionId) {
      const row = store.findBy('submissionId', submissionId);
      return row ? { ...row } : null;
    },
    updateLeadFields(leadId, patch) {
      this.patches.push({ leadId, patch });
      return store.patch(leadId, patch);
    },
  };
}

function fakeContactRepository(seed = []) {
  const store = makeStore('contactId');
  seed.forEach((c) => store.insert(c));
  return {
    store,
    inserted: [],
    updated: [],
    insertContact(contact) {
      this.inserted.push(contact.contactId);
      return store.insert(contact);
    },
    findContactById(contactId) {
      const row = store.findBy('contactId', contactId);
      return row ? { ...row } : null;
    },
    /** Same generous filter as the real adapter: email OR phone OR name. */
    listContactCandidates(keys) {
      return store.rows.filter((row) => {
        const email = String(row.email || '').trim().toLowerCase();
        const phone = String(row.phone || '').replace(/\D+/g, '').slice(-10);
        const name = String(row.fullName || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (keys.emailKey && email === keys.emailKey) return true;
        if (keys.phoneKey && phone === keys.phoneKey) return true;
        if (keys.nameKey && name === keys.nameKey) return true;
        return false;
      });
    },
    updateContact(contact) {
      this.updated.push(contact.contactId);
      return store.patch(contact.contactId, contact);
    },
  };
}

function fakeLogRepository() {
  return {
    entries: [],
    append(entry) {
      this.entries.push({ ...entry });
      return true;
    },
    events() {
      return this.entries.map((e) => e.event);
    },
  };
}

function fakeWorkRepository() {
  return {
    items: [],
    enqueue(item) {
      const existing = this.items.find((i) => i.idempotencyKey === item.idempotencyKey);
      if (existing) return existing.workId;
      this.items.push({ ...item, payload: { ...(item.payload || {}) } });
      return item.workId;
    },
    findByIdempotencyKey(key) {
      return this.items.find((i) => i.idempotencyKey === key) || null;
    },
    claimDue(nowIso, limit) {
      return this.items
        .filter((i) => i.state === 'pending' && (!i.nextAttemptAt || i.nextAttemptAt <= nowIso))
        .slice(0, limit)
        .map((i) => ({ ...i }));
    },
    markSucceeded(workId, next) {
      return this.applyState(workId, next);
    },
    markFailed(workId, next) {
      return this.applyState(workId, next);
    },
    markAbandoned(workId, next) {
      return this.applyState(workId, next);
    },
    applyState(workId, next) {
      const item = this.items.find((i) => i.workId === workId);
      if (!item) return false;
      Object.assign(item, next);
      return true;
    },
    kinds() {
      return this.items.map((i) => i.kind);
    },
  };
}

/**
 * Mail fake. `failTimes` makes the first N sends fail transiently, which is how the
 * retry policy gets tested without waiting for a real quota error.
 */
function fakeMailService(options = {}) {
  return {
    sent: [],
    attempts: 0,
    failTimes: options.failTimes || 0,
    permanentFailure: options.permanentFailure === true,
    send(message) {
      this.attempts += 1;
      if (this.permanentFailure) {
        return { ok: false, permanent: true, reason: 'invalid_recipient' };
      }
      if (this.attempts <= this.failTimes) {
        return { ok: false, reason: 'transient_quota' };
      }
      this.sent.push({ ...message });
      return { ok: true, status: 'sent' };
    },
  };
}

function fakeCalendarService(options = {}) {
  return {
    busy: options.busy || [],
    created: [],
    deleted: [],
    createFails: options.createFails === true,
    listBusy(startIso, endIso) {
      const overlapping = this.busy.filter((b) => b.startIso < endIso && b.endIso > startIso);
      return { ok: true, busy: overlapping };
    },
    createEvent(spec) {
      if (this.createFails) return { ok: false, reason: 'calendar_error:Test' };
      this.created.push({ ...spec });
      return { ok: true, eventId: `evt-${this.created.length}` };
    },
    deleteEvent(eventId) {
      this.deleted.push(eventId);
      return { ok: true };
    },
  };
}

/** Template fake standing in for the design pass that has not happened yet. */
function fakeTemplates() {
  return {
    acknowledgements: [],
    notifications: [],
    renderAcknowledgement(lead, locale) {
      this.acknowledgements.push({ leadId: lead.leadId, locale });
      return { ok: true, subject: 'ack', htmlBody: '<p>ack</p>', textBody: 'ack' };
    },
    renderPartnerNotification(lead, decision) {
      this.notifications.push({ leadId: lead.leadId, reason: decision.reason });
      return { ok: true, subject: 'notify', htmlBody: '<p>notify</p>', textBody: 'notify' };
    },
  };
}

/** Fully configured environment. Individual tests blank fields to test degradation. */
function fakeConfig(overrides = {}) {
  return {
    sheetId: 'sheet-fake',
    calendarId: 'calendar-fake',
    partnerNotifyTo: ['firm@example.test'],
    partnerEmailMap: {
      zachary_russell: 'zr@example.test',
      ethaniel_vu: 'ev@example.test',
    },
    replyTo: 'reply@example.test',
    fromName: 'AxisPoint',
    runMode: 'live',
    ...overrides,
  };
}

/** Fixed -05:00. Business-hour tests that need a DST change set their own resolver. */
function fixedOffsetResolver(minutes = -300) {
  return () => minutes;
}

function buildDeps(overrides = {}) {
  return {
    config: fakeConfig(overrides.config),
    clock: overrides.clock || fakeClock('2026-08-03T14:00:00.000Z'),
    ids: overrides.ids || fakeIds(),
    lock: overrides.lock || fakeLock(),
    offsetResolver: overrides.offsetResolver || fixedOffsetResolver(),
    leads: overrides.leads || fakeLeadRepository(),
    contacts: overrides.contacts || fakeContactRepository(overrides.seedContacts),
    log: overrides.log || fakeLogRepository(),
    work: overrides.work || fakeWorkRepository(),
    mail: overrides.mail || fakeMailService(),
    calendar: overrides.calendar || fakeCalendarService(),
    templates: overrides.templates || fakeTemplates(),
    launchReadyLocales: overrides.launchReadyLocales || ['en'],
  };
}

module.exports = {
  fakeIds,
  fakeClock,
  fakeLock,
  fakeLeadRepository,
  fakeContactRepository,
  fakeLogRepository,
  fakeWorkRepository,
  fakeMailService,
  fakeCalendarService,
  fakeTemplates,
  fakeConfig,
  fixedOffsetResolver,
  buildDeps,
};
