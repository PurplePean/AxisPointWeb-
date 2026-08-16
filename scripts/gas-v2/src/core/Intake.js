/**
 * Intake orchestration.
 *
 * ORDER MATTERS AND IS DELIBERATE. Store first, queue second, return third. The durable
 * record is the only artifact that cannot be reconstructed afterwards, so it is written
 * before anything that can fail slowly. Email, calendar, and contact synchronization are
 * all recoverable by hand; a dropped submission is not.
 *
 * EVERY accepted request writes an immutable Submission and a Delivery row. Then exactly
 * one business record:
 *
 *   service_inquiry   a Lead. No Contact: a website inquiry does not file a person.
 *   contact_exchange  a Contact. No Lead: a handshake is not a request with a clock.
 *
 * MATCHING RAISES A FLAG AND NOTHING ELSE. An exact email or full-phone match against an
 * existing Contact is recorded on the Submission and on the business record for a human to
 * act on. It never links, merges, overwrites, or updates an existing Contact.
 *
 * The whole thing runs under one lock, so two concurrent submissions cannot interleave
 * their reads and writes.
 */

/**
 * Processes a validated envelope. `envelope` has already passed parseEnvelope, so this
 * function never re-checks shapes; it makes decisions.
 */
function processSubmission(envelope, deps) {
  return deps.lock.withLock(function () {
    var now = deps.clock.now();

    // Replay protection, against the IMMUTABLE audit record. The submissionId is generated
    // by the browser once per completed form, so a retried request, a double-click, or a
    // flaky network returns the ORIGINAL result rather than creating a second Submission,
    // a second Lead, or a second Contact.
    var existing = deps.submissions.findBySubmissionId(envelope.submissionId);
    if (existing) {
      // A reused id carrying different data is not a retry. Returning "already stored"
      // would tell the sender their new data was accepted when it was discarded.
      if (existing.payloadFingerprint &&
          existing.payloadFingerprint !== submissionFingerprint(envelope)) {
        return { ok: false, code: 'SUBMISSION_ID_CONFLICT' };
      }

      // The Submission is written first, so its presence proves the request was accepted
      // but NOT that everything downstream of it landed. Repair before reporting success.
      reconcileSubmission(existing, envelope, deps, now);
      return replayResult(existing, deps);
    }

    var isInquiry = envelope.submissionKind === 'service_inquiry';
    var screening = screenSubmission(envelope);

    // Detection only. Nothing downstream of this reads it as an instruction to link.
    var possibleMatches = flagPossibleMatches(envelope, deps);

    var slaDueAt = isInquiry
      ? computeSlaDueAt(envelope.submissionKind, envelope.payload.pathway, now, deps.offsetResolver)
      : null;

    var ctx = {
      leadId: isInquiry ? deps.ids.newId() : '',
      contactId: isInquiry ? '' : deps.ids.newId(),
      receivedAt: now,
      slaDueAt: slaDueAt,
      screening: screening,
      possibleMatches: possibleMatches
    };

    // 1. The immutable audit record, first, so no business record can exist without one.
    deps.submissions.insertSubmission(buildSubmission(envelope, ctx));

    // 2. Exactly one business record.
    var lead = null;
    if (isInquiry) {
      lead = buildLead(envelope, ctx);
      deps.leads.insertLead(lead);
    } else {
      deps.contacts.insertContact(buildContact(envelope, ctx));
    }

    // 3. Mutable delivery state, kept out of the audit record so it can stay insert-only.
    deps.deliveries.insertDelivery(buildDelivery(envelope, ctx));

    enqueueSubmissionWork(envelope, deps, now);

    logAcceptance(envelope, ctx, screening, deps);

    return {
      ok: true,
      replay: false,
      submissionId: envelope.submissionId,
      leadId: ctx.leadId || null,
      contactId: ctx.contactId || null,
      slaDueAt: lead && lead.slaDueAt ? lead.slaDueAt : null,
      bookingEligible: lead ? lead.bookingEligible === true : false
    };
  });
}

/**
 * Repairs a partially written request.
 *
 * WHY THIS EXISTS. Intake writes the immutable Submission first, on purpose: it is the
 * record that cannot be reconstructed. But that ordering means a failure anywhere after
 * it, an insert that threw, a lock lost mid-write, an Apps Script execution killed at its
 * time limit, leaves a Submission with no Lead, no Contact, no Delivery row, or no queued
 * work. Before this function existed, the retry saw the Submission, said "already stored",
 * and the request stayed permanently half-written: no acknowledgement, no digest entry,
 * nothing in the tab a partner reads.
 *
 * Every step is idempotent and each is checked independently, because the failure can
 * land at any one of the four boundaries.
 *
 * WHAT IT MUST NOT DO. It never rewrites the Submission, and it never links or merges a
 * Contact. A repaired Contact is rebuilt under the id the Submission already recorded,
 * which is the opposite of reusing somebody else's record.
 */
function reconcileSubmission(submission, envelope, deps, now) {
  var repaired = [];
  var isInquiry = submission.submissionKind === 'service_inquiry';
  var ctx = reconciliationContext(submission, deps);

  if (isInquiry) {
    if (!deps.leads.findBySourceSubmissionId(submission.submissionId)) {
      deps.leads.insertLead(buildLead(envelope, ctx));
      repaired.push('lead');
    }
  } else if (!deps.contacts.findBySourceSubmissionId(submission.submissionId)) {
    deps.contacts.insertContact(buildContact(envelope, ctx));
    repaired.push('contact');
  }

  if (!deps.deliveries.findBySubmissionId(submission.submissionId)) {
    deps.deliveries.insertDelivery(buildDelivery(envelope, ctx));
    repaired.push('delivery');
  }

  // Always re-run. `enqueue` is keyed on the work item's idempotency key, so an item that
  // already exists is a no-op and a missing one is restored. Counting the difference is
  // the only way to know whether anything was actually repaired.
  var before = countQueuedFor(envelope, deps);
  enqueueSubmissionWork(envelope, deps, now);
  if (countQueuedFor(envelope, deps) > before) repaired.push('work');

  if (repaired.length > 0) {
    tryLog(deps, {
      level: 'error',
      event: 'submission_reconciled',
      submissionId: submission.submissionId,
      leadId: submission.leadId || '',
      detail: 'repaired ' + repaired.join(',')
    });
  }
  return repaired;
}

/**
 * Rebuilds the context the original write used.
 *
 * Everything is recovered from the immutable Submission rather than recomputed, so a
 * repair reproduces the record that was accepted instead of a record that reflects today.
 * Re-running spam screening or identity matching here would produce different answers:
 * the Contacts tab has grown since, and the flags belong to the moment of submission.
 */
function reconciliationContext(submission, deps) {
  var receivedAt = parseIso(submission.receivedAt) || deps.clock.now();
  var isInquiry = submission.submissionKind === 'service_inquiry';

  return {
    leadId: submission.leadId || '',
    contactId: submission.contactId || '',
    receivedAt: receivedAt,
    slaDueAt: isInquiry
      ? computeSlaDueAt(submission.submissionKind, submission.pathway, receivedAt, deps.offsetResolver)
      : null,
    screening: {
      spamSuspected: submission.spamSuspected === true || submission.spamSuspected === 'TRUE',
      spamReason: submission.spamReason || ''
    },
    possibleMatches: parsePossibleMatches(submission.possibleMatches)
  };
}

/** How many work items currently exist for this submission, whatever their state. */
function countQueuedFor(envelope, deps) {
  var isExchange = envelope.submissionKind === 'contact_exchange';
  var keys = [
    (isExchange ? 'send_qr_acknowledgement' : 'send_acknowledgement') +
      ':' + envelope.submissionId + ':ack'
  ];
  if (!isExchange) keys.push('notify_partners:' + envelope.submissionId + ':notify');

  var found = 0;
  for (var i = 0; i < keys.length; i++) {
    if (deps.work.findByIdempotencyKey(keys[i])) found++;
  }
  return found;
}

/**
 * The result a replayed submission returns.
 *
 * Read back from the stored records rather than recomputed, so a retry can never tell the
 * visitor something different from what the first attempt told them.
 */
function replayResult(submission, deps) {
  var lead = submission.leadId ? deps.leads.findLeadById(submission.leadId) : null;
  return {
    ok: true,
    replay: true,
    submissionId: submission.submissionId,
    leadId: submission.leadId || null,
    contactId: submission.contactId || null,
    slaDueAt: lead && lead.slaDueAt ? lead.slaDueAt : null,
    bookingEligible: !!lead && (lead.bookingEligible === true || lead.bookingEligible === 'TRUE')
  };
}

/**
 * Looks for existing Contacts that share an exact normalized email or an exact normalized
 * full phone digit string.
 *
 * PURE DETECTION. It reads the Contacts tab and returns suggestions. It writes nothing,
 * and no caller may treat its output as permission to reuse a contactId. Both submission
 * kinds run it, because a partner opening a website inquiry benefits from knowing this
 * person is already in the Contacts tab just as much as the other way round.
 */
function flagPossibleMatches(envelope, deps) {
  var isExchange = envelope.submissionKind === 'contact_exchange';
  var p = envelope.payload;
  var source = isExchange ? p : (p.contact || {});

  var incoming = { email: source.email || '', phone: source.phone || '' };

  var candidates = deps.contacts.listContactCandidates({
    emailKey: emailKey(incoming.email),
    phoneKey: phoneKey(incoming.phone)
  });

  return findPossibleMatches(incoming, candidates || []);
}

/**
 * Queues the side effects.
 *
 * A website service inquiry queues an acknowledgement AND an immediate internal
 * notification to both partners. It is a request with a clock running on it.
 *
 * A QR Contact Exchange queues an acknowledgement and NO immediate notification. It goes
 * into the 8:00 AM digest instead: a scanned card is an acquisition record, not a request,
 * and one email per scan is unreadable after a conference.
 *
 * Work is keyed on the SUBMISSION id, because a contact exchange has no lead. It is
 * enqueued even when the relevant service is not configured: the handler then records
 * `not_configured`, which is a visible, auditable state, where skipping the enqueue would
 * leave `pending` forever and read as a stuck queue instead of a missing setting.
 */
function enqueueSubmissionWork(envelope, deps, now) {
  var isExchange = envelope.submissionKind === 'contact_exchange';

  deps.work.enqueue(buildWorkItem(
    isExchange ? 'send_qr_acknowledgement' : 'send_acknowledgement',
    envelope.submissionId, {}, { workId: deps.ids.newId(), now: now, discriminator: 'ack' }
  ));

  if (!isExchange) {
    deps.work.enqueue(buildWorkItem('notify_partners', envelope.submissionId, {}, {
      workId: deps.ids.newId(),
      now: now,
      discriminator: 'notify'
    }));
  }
}

/** Redacted. A log line is read casually and copied around; personal data stays out. */
function logAcceptance(envelope, ctx, screening, deps) {
  var isInquiry = envelope.submissionKind === 'service_inquiry';
  var attribution = buildAttributionRecord(envelope.attribution);

  tryLog(deps, {
    level: 'info',
    event: 'submission_accepted',
    submissionId: envelope.submissionId,
    leadId: ctx.leadId,
    detail: [
      envelope.submissionKind,
      isInquiry ? envelope.payload.pathway : attribution.acquisitionSource,
      attribution.sourceCategory,
      redactEmail(isInquiry ? envelope.payload.contact.email : envelope.payload.email),
      screening.spamSuspected ? 'flagged:' + screening.spamReason : 'clean',
      ctx.possibleMatches.length > 0 ? 'possible_match_flagged' : 'no_match'
    ].join(' ')
  });
}
