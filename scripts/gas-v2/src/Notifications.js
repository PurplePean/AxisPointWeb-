/**
 * Notification handlers.
 *
 * These are work-queue handlers, so they run on the trigger, never on the request path. A
 * visitor's confirmation screen does not wait on a mail quota.
 *
 * They key on the SUBMISSION, not the Lead, because a QR Contact Exchange produces no
 * Lead. Delivery status is written to the Delivery row, so the immutable audit record is
 * never touched after insert.
 */

var ACK_STATUS_FIELD = 'ackEmailStatus';
var NOTIFY_STATUS_FIELD = 'partnerNotifyStatus';

/* ── Website inquiry acknowledgement ──────────────────────────────────────── */

/**
 * Acknowledgement for a website service inquiry.
 *
 * A flagged submission is stored and reviewed but never auto-replied to. Auto-replying to
 * a forged address damages a mail domain's reputation for somebody else's abuse.
 */
function handleSendAcknowledgement(item, deps) {
  var submission = deps.submissions.findBySubmissionId(item.subjectId);
  if (!submission) return { ok: false, permanent: true, reason: 'submission_not_found' };

  if (submission.submissionKind !== 'service_inquiry') {
    return { ok: false, permanent: true, reason: 'wrong_handler_for_contact_exchange' };
  }

  var lead = submission.leadId ? deps.leads.findLeadById(submission.leadId) : null;
  if (!lead) return { ok: false, permanent: true, reason: 'lead_not_found' };

  if (!normalizeWhitespace(lead.email)) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'skipped');
    return { ok: true };
  }

  if (isFlagged(submission)) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'skipped');
    return { ok: true };
  }

  if (!isConfigured(deps.config, 'acknowledge')) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'not_configured');
    return { ok: false, permanent: true, reason: 'acknowledge_not_configured' };
  }

  /*
   * The locale this reply is actually written in.
   *
   * `resolveOutboundLocale` existed since Pass 9A but nothing called it, so a Spanish
   * preference was stored, shown to the partner, and then had no effect on what was sent.
   * It now selects the template set. Only launch-ready locales qualify, so an unlaunched
   * preference falls back to English honestly rather than being answered by an
   * untranslated template pretending to be Spanish.
   */
  var outbound = resolveOutboundLocale(
    { preferredFollowUpLocale: lead.preferredFollowUpLocale },
    deps.launchReadyLocales || ['en']
  );

  var rendered = deps.templates.renderAcknowledgement(
    lead, withOffsetResolver(deps.config, deps.offsetResolver), outbound.locale
  );
  if (!rendered || !rendered.ok) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'failed');
    return {
      ok: false,
      permanent: !!(rendered && rendered.permanent),
      reason: (rendered && rendered.reason) || 'render_failed'
    };
  }

  var sent = deps.mail.send({
    to: lead.email,
    replyTo: deps.config.replyTo,
    fromName: deps.config.fromName,
    subject: rendered.subject,
    htmlBody: rendered.htmlBody,
    textBody: rendered.textBody
  });

  if (!sent || !sent.ok) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'failed');
    return { ok: false, reason: (sent && sent.reason) || 'mail_send_failed' };
  }

  setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'sent');
  return { ok: true };
}

/* ── Internal website inquiry notification ────────────────────────────────── */

/**
 * Partner notification for a website inquiry.
 *
 * BOTH partners receive every new website inquiry, including a flagged one. A partner
 * deciding what is junk is fine; the system deciding it silently is not.
 */
function handleNotifyPartners(item, deps) {
  var submission = deps.submissions.findBySubmissionId(item.subjectId);
  if (!submission) return { ok: false, permanent: true, reason: 'submission_not_found' };

  if (submission.submissionKind !== 'service_inquiry') {
    // A QR Contact Exchange is never notified immediately. Reaching here means the wrong
    // work kind was queued.
    return { ok: false, permanent: true, reason: 'qr_contacts_are_digested_not_notified' };
  }

  var lead = submission.leadId ? deps.leads.findLeadById(submission.leadId) : null;
  if (!lead) return { ok: false, permanent: true, reason: 'lead_not_found' };

  if (!isConfigured(deps.config, 'notify')) {
    setDelivery(deps, submission.submissionId, NOTIFY_STATUS_FIELD, 'not_configured');
    return { ok: false, permanent: true, reason: 'notify_not_configured' };
  }

  var decision = routeNotification(lead, { spamSuspected: isFlagged(submission) });
  var recipients = resolveRecipients(decision, deps.config);

  if (recipients.length === 0) {
    setDelivery(deps, submission.submissionId, NOTIFY_STATUS_FIELD, 'not_configured');
    return { ok: false, permanent: true, reason: 'no_recipients_configured' };
  }

  var rendered = deps.templates.renderPartnerNotification(
    lead, withOffsetResolver(deps.config, deps.offsetResolver)
  );
  if (!rendered || !rendered.ok) {
    setDelivery(deps, submission.submissionId, NOTIFY_STATUS_FIELD, 'failed');
    return {
      ok: false,
      permanent: !!(rendered && rendered.permanent),
      reason: (rendered && rendered.reason) || 'render_failed'
    };
  }

  var sent = deps.mail.send({
    to: recipients.join(','),
    replyTo: lead.email || deps.config.replyTo,
    fromName: deps.config.fromName,
    subject: rendered.subject,
    htmlBody: rendered.htmlBody,
    textBody: rendered.textBody
  });

  if (!sent || !sent.ok) {
    setDelivery(deps, submission.submissionId, NOTIFY_STATUS_FIELD, 'failed');
    return { ok: false, reason: (sent && sent.reason) || 'mail_send_failed' };
  }

  setDelivery(deps, submission.submissionId, NOTIFY_STATUS_FIELD, 'sent');
  return { ok: true };
}

/* ── QR Contact acknowledgement ───────────────────────────────────────────── */

/**
 * Acknowledgement for a Contact Exchange.
 *
 * Driven by the immutable Submission, which carries the submitted display name and the
 * acquisition attribution. It reads no Lead, because there is none.
 *
 * Three refusals, each for its own reason:
 *   - no email address: the Contact is fully valid and appears in the digest; there is
 *     simply nowhere to write, and no SMS is designed. Status is `skipped`, not failed.
 *   - suspected spam: stored, but never acknowledged, so the form cannot be used to mail a
 *     third party from an address the submitter does not own.
 *   - not configured: recorded as such, and the record is untouched.
 *
 * A failed acknowledgement NEVER removes or rolls back the stored Contact. It was safely
 * stored before this handler ever ran.
 */
function handleSendQrAcknowledgement(item, deps) {
  var submission = deps.submissions.findBySubmissionId(item.subjectId);
  if (!submission) return { ok: false, permanent: true, reason: 'submission_not_found' };

  if (submission.submissionKind !== 'contact_exchange') {
    return { ok: false, permanent: true, reason: 'wrong_handler_for_service_inquiry' };
  }

  if (isFlagged(submission)) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'skipped');
    return { ok: true };
  }

  if (!normalizeWhitespace(submission.email)) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'skipped');
    return { ok: true };
  }

  if (!isConfigured(deps.config, 'qr_acknowledge')) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'not_configured');
    return { ok: false, permanent: true, reason: 'qr_acknowledge_not_configured' };
  }

  // The stored Submission carries the preference; there is no `contact` in this scope.
  var qrOutbound = resolveOutboundLocale(
    { preferredFollowUpLocale: submission.preferredFollowUpLocale },
    deps.launchReadyLocales || ['en']
  );

  var rendered = deps.templates.renderQrAcknowledgement(
    submission, withOffsetResolver(deps.config, deps.offsetResolver), qrOutbound.locale
  );
  if (!rendered || !rendered.ok) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'failed');
    return {
      ok: false,
      permanent: !!(rendered && rendered.permanent),
      reason: (rendered && rendered.reason) || 'render_failed'
    };
  }

  var sent = deps.mail.send({
    to: submission.email,
    replyTo: deps.config.replyTo,
    fromName: deps.config.fromName,
    subject: rendered.subject,
    htmlBody: rendered.htmlBody,
    textBody: rendered.textBody
  });

  if (!sent || !sent.ok) {
    setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'failed');
    return { ok: false, reason: (sent && sent.reason) || 'mail_send_failed' };
  }

  setDelivery(deps, submission.submissionId, ACK_STATUS_FIELD, 'sent');
  return { ok: true };
}

/* ── Shared ───────────────────────────────────────────────────────────────── */

function isFlagged(record) {
  return record.spamSuspected === true || record.spamSuspected === 'TRUE';
}

function setDelivery(deps, submissionId, field, value) {
  var patch = {};
  patch[field] = value;
  return deps.deliveries.updateDelivery(submissionId, patch);
}

/** The kind-to-handler table the worker cycle runs against. */
function defaultWorkHandlers() {
  return {
    send_acknowledgement: handleSendAcknowledgement,
    send_qr_acknowledgement: handleSendQrAcknowledgement,
    notify_partners: handleNotifyPartners,
    send_booking_confirmation: handleSendBookingConfirmation
  };
}
