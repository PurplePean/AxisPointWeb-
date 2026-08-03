/**
 * The booking command.
 *
 * TRUTHFULNESS IS THE WHOLE POINT OF THIS FILE. Pass 8 queued the calendar write and
 * returned `pending` while the visitor's screen said their call was booked. That is a
 * message headed "you are on the calendar" sent before the calendar agreed, and the
 * failure mode is somebody sitting by a phone at 10:30 for a meeting that does not
 * exist. So the Calendar port is now called SYNCHRONOUSLY inside the command, and the
 * command returns a final result:
 *
 *   confirmed       the Calendar service created the event and returned its id
 *   unavailable     the slot is taken, or outside the rules
 *   rejected        the request itself is not allowed (wrong pathway, already booked)
 *   failed          the Calendar service was reachable and did not succeed
 *   not_configured  there is no calendar to book against
 *
 * `confirmed` is reachable from exactly one place: a successful `createEvent`.
 *
 * Booking is still a SEPARATE COMMAND ISSUED AFTER a submission, never a block inside
 * one. The Lead must already exist. A calendar failure never deletes or changes the
 * stored Lead, because an inquiry that was safely recorded stays recorded whatever the
 * calendar does.
 */

var BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  UNAVAILABLE: 'unavailable',
  REJECTED: 'rejected',
  FAILED: 'failed',
  NOT_CONFIGURED: 'not_configured'
};

/** A slot must start at least this far ahead. Nobody can honour a booking made now. */
var BOOKING_MIN_LEAD_MINUTES = 60;
/** And no further out than this, so the calendar cannot be filled a year ahead. */
var BOOKING_MAX_AHEAD_DAYS = 60;

/**
 * Booking is offered on the Management Proposal pathway only.
 *
 * The other two pathways are questions, not engagements. Offering a calendar slot for a
 * press enquiry would put a partner in a meeting the visitor never intended to request.
 */
var BOOKABLE_PATHWAYS = ['management_proposal'];

/**
 * Executes a validated booking request.
 *
 * Returns { ok, status, code? }. `ok` is true only for `confirmed`; every other status
 * is a truthful refusal the client can render as one.
 */
function executeBookingCommand(request, deps) {
  var now = deps.clock.now();
  var lead = deps.leads.findLeadById(request.leadId);

  if (!lead) {
    return { ok: false, status: BOOKING_STATUS.REJECTED, code: 'LEAD_NOT_FOUND' };
  }

  if (BOOKABLE_PATHWAYS.indexOf(String(lead.pathway)) === -1) {
    return { ok: false, status: BOOKING_STATUS.REJECTED, code: 'PATHWAY_NOT_BOOKABLE' };
  }

  // Idempotent replay. A retried request with the same id is the SAME booking, so it
  // reports the outcome already recorded rather than creating a second calendar hold.
  if (lead.activeBookingRequestId === request.bookingRequestId) {
    return {
      ok: lead.calendarStatus === 'booked',
      status: lead.calendarStatus === 'booked' ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.FAILED,
      replay: true
    };
  }

  // One active booking at a time. A previously failed attempt does not lock the lead
  // out of ever booking again.
  if (lead.activeBookingRequestId && lead.calendarStatus === 'booked') {
    return { ok: false, status: BOOKING_STATUS.REJECTED, code: 'BOOKING_ALREADY_ACTIVE' };
  }

  var slotCheck = validateSlotWindow(request, now, deps.offsetResolver);
  if (!slotCheck.ok) {
    return { ok: false, status: BOOKING_STATUS.UNAVAILABLE, code: slotCheck.code };
  }

  if (!isConfigured(deps.config, 'booking')) {
    // The visitor asked for a specific time. Recording the request so a partner can
    // confirm by hand beats losing the intent, but the result is NOT confirmed and the
    // client must not render it as one.
    deps.leads.updateLeadFields(lead.leadId, {
      activeBookingRequestId: request.bookingRequestId,
      calendarStatus: 'not_configured'
    });
    return { ok: false, status: BOOKING_STATUS.NOT_CONFIGURED, code: 'CALENDAR_NOT_CONFIGURED' };
  }

  var slotEnd = isoSlotEnd(request);
  var busy = deps.calendar.listBusy(request.slotStart, slotEnd);

  // An unreadable calendar is NOT an available calendar. Treating a failed availability
  // read as "nothing is booked" is how a partner ends up double-booked.
  if (!busy || !busy.ok) {
    return { ok: false, status: BOOKING_STATUS.FAILED, code: 'AVAILABILITY_UNAVAILABLE' };
  }
  if (Array.isArray(busy.busy) && busy.busy.length > 0) {
    return { ok: false, status: BOOKING_STATUS.UNAVAILABLE, code: 'SLOT_UNAVAILABLE' };
  }

  var created = deps.calendar.createEvent({
    startIso: request.slotStart,
    endIso: slotEnd,
    mode: request.mode,
    leadId: lead.leadId,
    attendeeEmail: lead.email,
    attendeeName: lead.fullName
  });

  if (!created || !created.ok || !created.eventId) {
    // The Lead is untouched apart from recording that the attempt failed. Nothing is
    // deleted and nothing is rolled back.
    deps.leads.updateLeadFields(lead.leadId, {
      activeBookingRequestId: request.bookingRequestId,
      calendarStatus: 'failed'
    });
    tryLog(deps, {
      level: 'error',
      event: 'booking_failed',
      leadId: lead.leadId,
      detail: (created && created.reason) || 'calendar_create_failed'
    });
    return { ok: false, status: BOOKING_STATUS.FAILED, code: 'CALENDAR_CREATE_FAILED' };
  }

  deps.leads.updateLeadFields(lead.leadId, {
    activeBookingRequestId: request.bookingRequestId,
    calendarStatus: 'booked',
    calendarEventId: created.eventId
  });

  // The confirmation email is queued, not sent inline: the booking is already true, and
  // making the visitor's response wait on a mail quota adds nothing.
  deps.work.enqueue(buildWorkItem('send_booking_confirmation', lead.leadId, {
    bookingRequestId: request.bookingRequestId,
    slotStart: request.slotStart,
    durationMinutes: request.durationMinutes,
    mode: request.mode
  }, {
    workId: deps.ids.newId(),
    now: now,
    discriminator: request.bookingRequestId
  }));

  tryLog(deps, {
    level: 'info',
    event: 'booking_confirmed',
    leadId: lead.leadId,
    detail: request.mode + ' @ ' + request.slotStart
  });

  return { ok: true, status: BOOKING_STATUS.CONFIRMED, eventId: created.eventId };
}

function isoSlotEnd(request) {
  return toIso(addMinutes(parseIso(request.slotStart), request.durationMinutes));
}

/**
 * Slot sanity. Refusal reasons are specific so the client can say something useful
 * instead of a generic failure.
 */
function validateSlotWindow(request, now, offsetResolver) {
  var start = parseIso(request.slotStart);
  if (!start) return { ok: false, code: 'INVALID_TIMESTAMP' };

  var minStart = addMinutes(now, BOOKING_MIN_LEAD_MINUTES);
  if (start.getTime() < minStart.getTime()) return { ok: false, code: 'SLOT_TOO_SOON' };

  var maxStart = addMinutes(now, BOOKING_MAX_AHEAD_DAYS * 24 * 60);
  if (start.getTime() > maxStart.getTime()) return { ok: false, code: 'SLOT_TOO_FAR_AHEAD' };

  if (!isWithinBusinessHours(start, request.durationMinutes, offsetResolver)) {
    return { ok: false, code: 'SLOT_OUTSIDE_BUSINESS_HOURS' };
  }

  return { ok: true };
}

/** Both ends of the meeting must fall inside one business day. */
function isWithinBusinessHours(start, durationMinutes, offsetResolver) {
  var end = addMinutes(start, durationMinutes);
  var s = toLocalParts(start, offsetResolver);
  var e = toLocalParts(end, offsetResolver);

  if (!isBusinessDay(s.weekday)) return false;
  if (s.dayStartUtc.getTime() !== e.dayStartUtc.getTime()) return false;

  var startMinutes = s.hour * 60 + s.minute;
  var endMinutes = e.hour * 60 + e.minute;
  return startMinutes >= BUSINESS_START_HOUR * 60 && endMinutes <= BUSINESS_END_HOUR * 60;
}

/**
 * Queued handler for the confirmation email.
 *
 * It re-reads the Lead and refuses to send unless the calendar state still says booked,
 * so a booking cancelled between confirmation and delivery does not produce a
 * confirmation for a meeting that no longer exists.
 */
function handleSendBookingConfirmation(item, deps) {
  var lead = deps.leads.findLeadById(item.leadId);
  if (!lead) return { ok: false, permanent: true, reason: 'lead_not_found' };

  if (lead.calendarStatus !== 'booked' ||
      lead.activeBookingRequestId !== item.payload.bookingRequestId) {
    return { ok: false, permanent: true, reason: 'booking_no_longer_confirmed' };
  }

  if (!isConfigured(deps.config, 'acknowledge')) {
    return { ok: false, permanent: true, reason: 'acknowledge_not_configured' };
  }

  var rendered = deps.templates.renderBookingConfirmation(lead, {
    status: 'confirmed',
    slotStart: item.payload.slotStart,
    durationMinutes: item.payload.durationMinutes,
    mode: item.payload.mode
  }, withOffsetResolver(deps.config, deps.offsetResolver));

  if (!rendered || !rendered.ok) {
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

  if (!sent || !sent.ok) return { ok: false, reason: (sent && sent.reason) || 'mail_send_failed' };
  return { ok: true };
}
