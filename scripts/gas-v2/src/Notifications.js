/**
 * Notification handlers.
 *
 * These are work-queue handlers, so they run on the trigger, never on the request
 * path. A visitor's confirmation screen does not wait on a mail quota.
 *
 * Message CONTENT is not built here. Rendering goes through the template port, which
 * has no production implementation yet: the approved email design is separate work,
 * and interim wording would put unapproved copy in front of real people. The delivery
 * machinery around it is complete, so when the templates land nothing else changes.
 */

var ACK_STATUS_FIELD = 'ackEmailStatus';
var NOTIFY_STATUS_FIELD = 'partnerNotifyStatus';

/**
 * Visitor acknowledgement.
 *
 * A Contact Exchange never gets one. It is a handshake record, not a request, and an
 * unsolicited automated email to someone who just swapped a card is the wrong move.
 */
function handleSendAcknowledgement(item, deps) {
  var lead = deps.leads.findLeadById(item.leadId);
  if (!lead) return { ok: false, permanent: true, reason: 'lead_not_found' };

  if (lead.submissionKind === 'contact_exchange') {
    deps.leads.updateLeadFields(lead.leadId, setField(ACK_STATUS_FIELD, 'skipped'));
    return { ok: true };
  }

  if (!lead.email) {
    deps.leads.updateLeadFields(lead.leadId, setField(ACK_STATUS_FIELD, 'skipped'));
    return { ok: true };
  }

  if (!isConfigured(deps.config, 'acknowledge')) {
    deps.leads.updateLeadFields(lead.leadId, setField(ACK_STATUS_FIELD, 'not_configured'));
    return { ok: false, permanent: true, reason: 'acknowledge_not_configured' };
  }

  // A suspected-spam submission is stored and reviewed, but it does not get an
  // automated reply. Auto-replying to a forged address is how a mail domain gets
  // reputation damage for someone else's abuse.
  if (lead.spamSuspected === true || lead.spamSuspected === 'TRUE') {
    deps.leads.updateLeadFields(lead.leadId, setField(ACK_STATUS_FIELD, 'skipped'));
    return { ok: true };
  }

  var outbound = resolveOutboundLocale({
    preferredFollowUpLocale: lead.preferredFollowUpLocale,
    pageLocale: lead.pageLocale
  }, deps.launchReadyLocales || ['en']);

  var rendered = deps.templates.renderAcknowledgement(lead, outbound.locale);
  if (!rendered || !rendered.ok) {
    deps.leads.updateLeadFields(lead.leadId, setField(ACK_STATUS_FIELD, 'failed'));
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
    deps.leads.updateLeadFields(lead.leadId, setField(ACK_STATUS_FIELD, 'failed'));
    return { ok: false, reason: (sent && sent.reason) || 'mail_send_failed' };
  }

  deps.leads.updateLeadFields(lead.leadId, setField(ACK_STATUS_FIELD, 'sent'));
  return { ok: true };
}

/**
 * Partner notification.
 *
 * Every submission produces one, including a flagged one. A partner deciding what is
 * junk is fine; the system deciding it silently is not.
 */
function handleNotifyPartners(item, deps) {
  var lead = deps.leads.findLeadById(item.leadId);
  if (!lead) return { ok: false, permanent: true, reason: 'lead_not_found' };

  if (!isConfigured(deps.config, 'notify')) {
    deps.leads.updateLeadFields(lead.leadId, setField(NOTIFY_STATUS_FIELD, 'not_configured'));
    return { ok: false, permanent: true, reason: 'notify_not_configured' };
  }

  var decision = routeNotification(lead, { spamSuspected: lead.spamSuspected === true || lead.spamSuspected === 'TRUE' });
  var recipients = resolveRecipients(decision, deps.config);

  if (recipients.length === 0) {
    deps.leads.updateLeadFields(lead.leadId, setField(NOTIFY_STATUS_FIELD, 'not_configured'));
    return { ok: false, permanent: true, reason: 'no_recipients_configured' };
  }

  var rendered = deps.templates.renderPartnerNotification(lead, decision);
  if (!rendered || !rendered.ok) {
    deps.leads.updateLeadFields(lead.leadId, setField(NOTIFY_STATUS_FIELD, 'failed'));
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
    deps.leads.updateLeadFields(lead.leadId, setField(NOTIFY_STATUS_FIELD, 'failed'));
    return { ok: false, reason: (sent && sent.reason) || 'mail_send_failed' };
  }

  deps.leads.updateLeadFields(lead.leadId, setField(NOTIFY_STATUS_FIELD, 'sent'));
  return { ok: true };
}

function setField(name, value) {
  var patch = {};
  patch[name] = value;
  return patch;
}

/** The kind-to-handler table the worker cycle runs against. */
function defaultWorkHandlers() {
  return {
    send_acknowledgement: handleSendAcknowledgement,
    notify_partners: handleNotifyPartners,
    create_booking_event: handleCreateBookingEvent
  };
}
