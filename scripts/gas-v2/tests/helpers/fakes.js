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

/**
 * The immutable audit store.
 *
 * It exposes no update method, exactly like the real adapter, so a test that tries to
 * mutate a Submission fails the same way production would.
 */
function fakeSubmissionRepository(seed = []) {
  const store = makeStore('submissionId');
  seed.forEach((s) => store.insert(s));
  return {
    store,
    inserted: [],
    insertSubmission(submission) {
      this.inserted.push(submission.submissionId);
      return store.insert(submission);
    },
    findBySubmissionId(submissionId) {
      const row = store.findBy('submissionId', submissionId);
      return row ? { ...row } : null;
    },
  };
}

function fakeDeliveryRepository(seed = []) {
  const store = makeStore('submissionId');
  seed.forEach((d) => store.insert(d));
  return {
    store,
    patches: [],
    insertDelivery(delivery) {
      return store.insert(delivery);
    },
    findBySubmissionId(submissionId) {
      const row = store.findBy('submissionId', submissionId);
      return row ? { ...row } : null;
    },
    listPendingDigest() {
      return store.rows
        .filter((r) => String(r.digestStatus) === 'pending_digest')
        .map((r) => ({ ...r }));
    },
    updateDelivery(submissionId, patch) {
      this.patches.push({ submissionId, patch });
      return store.patch(submissionId, patch);
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
    findBySourceSubmissionId(submissionId) {
      const row = store.rows.find((r) => String(r.sourceSubmissionId) === String(submissionId));
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
    findBySourceSubmissionId(submissionId) {
      const row = store.rows.find((r) => String(r.sourceSubmissionId) === String(submissionId));
      return row ? { ...row } : null;
    },
    /** Same filter as the real adapter: exact email OR exact full phone digits. */
    listContactCandidates(keys) {
      return store.rows.filter((row) => {
        const email = String(row.email || '').trim().toLowerCase();
        const phone = String(row.phone || '').replace(/\D+/g, '');
        if (keys.emailKey && email === keys.emailKey) return true;
        if (keys.phoneKey && phone === keys.phoneKey) return true;
        return false;
      });
    },
    updateContact(contact) {
      this.updated.push(contact.contactId);
      return store.patch(contact.contactId, contact);
    },
  };
}

function fakeLogRepository(seed = []) {
  return {
    entries: seed.map((e) => ({ ...e })),
    removed: [],
    append(entry) {
      this.entries.push({ ...entry });
      return true;
    },
    listAll() {
      return this.entries.map((e) => ({ ...e }));
    },
    removeByIds(ids) {
      const wanted = new Set(ids.map(String));
      const before = this.entries.length;
      this.entries = this.entries.filter((e) => !wanted.has(String(e.logId)));
      this.removed.push(...ids);
      return before - this.entries.length;
    },
    events() {
      return this.entries.map((e) => e.event);
    },
  };
}

function fakeWorkRepository(seed = []) {
  return {
    items: seed.map((i) => ({ ...i })),
    removed: [],
    listAll() {
      return this.items.map((i) => ({ ...i }));
    },
    removeByIds(ids) {
      const wanted = new Set(ids.map(String));
      const before = this.items.length;
      this.items = this.items.filter((i) => !wanted.has(String(i.workId)));
      this.removed.push(...ids);
      return before - this.items.length;
    },
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
      const meetLink = spec.mode === 'video_meeting' ? 'https://meet.google.com/fake-abc-def' : null;
      return { ok: true, eventId: `evt-${this.created.length}`, meetLink };
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
    qrAcknowledgements: [],
    notifications: [],
    digests: [],
    bookings: [],
    renderAcknowledgement(lead) {
      this.acknowledgements.push({ leadId: lead.leadId });
      return { ok: true, subject: 'ack', htmlBody: '<p>ack</p>', textBody: 'ack' };
    },
    renderPartnerNotification(lead) {
      this.notifications.push({ leadId: lead.leadId });
      return { ok: true, subject: 'notify', htmlBody: '<p>notify</p>', textBody: 'notify' };
    },
    renderQrAcknowledgement(lead) {
      this.qrAcknowledgements.push({ leadId: lead.leadId, to: lead.email });
      return { ok: true, subject: 'qr ack', htmlBody: '<p>qr</p>', textBody: 'qr' };
    },
    /**
     * Records what the digest was asked to render, so tests assert on the model.
     *
     * Arrays are copied with Array.from because the source runs in a VM realm and its
     * arrays never compare reference-equal to a Node literal.
     */
    renderQrDigest(model) {
      const groups = Array.from(model.groups);
      const records = groups.flatMap((g) => Array.from(g.records));
      this.digests.push({
        total: model.totalCount,
        partIndex: model.partIndex,
        partCount: model.partCount,
        groups: groups.map((g) => g.key),
        records: records.map((r) => r.submissionId),
        owners: records.map((r) => r.currentOwner),
      });
      return { ok: true, subject: 'digest', htmlBody: '<p>digest</p>', textBody: 'digest' };
    },
    renderBookingConfirmation(lead, booking) {
      this.bookings.push({ leadId: lead.leadId, status: booking.status, meetLink: booking.meetLink || null });
      return {
        ok: true,
        subject: 'booked',
        htmlBody: '<p>b</p>',
        textBody: 'b',
        icsContent: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
        icsFilename: 'booking.ics',
      };
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

    partnerDirectEmail: {
      zachary_russell: 'zr.direct@example.test',
      ethaniel_vu: 'ev.direct@example.test',
    },
    partnerDirectPhone: {
      zachary_russell: '(555) 010-0001',
      ethaniel_vu: '(555) 010-0002',
    },
    firmEmail: 'firm@example.test',
    // Deliberately empty: the approved rule omits the firm phone row until verified.
    firmPhone: '',
    websiteUrl: 'example.test',
    // Deliberately empty: both emails must be complete with no logo asset.
    logoUrl: '',

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
    submissions: overrides.submissions || fakeSubmissionRepository(),
    deliveries: overrides.deliveries || fakeDeliveryRepository(),
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
  fakeSubmissionRepository,
  fakeDeliveryRepository,
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
