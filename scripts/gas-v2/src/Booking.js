/**
 * The booking command.
 *
 * Booking is a SEPARATE COMMAND ISSUED AFTER a submission, never a block inside one.
 * That is the corrected contract, and it exists because the two operations have
 * genuinely different failure modes: an inquiry must be stored even if the calendar
 * is down, and a calendar conflict must not be able to reject an inquiry. The
 * contract layer enforces the separation by rejecting `payload.booking` outright.
 *
 * The command therefore always references an existing leadId. Everything here is a
 * pure decision plus repository calls; the actual calendar write is queued work, so a
 * calendar outage delays a meeting rather than losing one.
 */

/** Slot must start at least this far ahead. Nobody can honour a booking made now. */
var BOOKING_MIN_LEAD_MINUTES = 60;
/** And no further out than this, so the calendar cannot be filled a year ahead. */
var BOOKING_MAX_AHEAD_DAYS = 60;

/**
 * Executes a validated booking request.
 *
 * Returns { ok, status, code? }. `status` is what the client shows; `code` is the
 * stable reason when something was refused.
 */
function executeBookingCommand(request, deps) {
  var now = deps.clock.now();
  var lead = deps.leads.findLeadById(request.leadId);

  if (!lead) {
    return { ok: false, code: 'LEAD_NOT_FOUND' };
  }

  // Idempotent replay. A retried request with the same id is the SAME booking, so it
  // reports the existing outcome rather than creating a second calendar hold.
  if (lead.activeBookingRequestId === request.bookingRequestId) {
    return { ok: true, status: lead.calendarStatus || 'pending', replay: true };
  }

  if (lead.activeBookingRequestId && lead.calendarStatus !== 'failed') {
    return { ok: false, code: 'BOOKING_ALREADY_ACTIVE' };
  }

  var slotCheck = validateSlotWindow(request, now, deps.offsetResolver);
  if (!slotCheck.ok) return slotCheck;

  if (!isConfigured(deps.config, 'booking')) {
    // The request is real and the visitor asked for a time. Recording it and letting a
    // partner confirm by hand beats telling them booking is unavailable.
    deps.leads.updateLeadFields(lead.leadId, {
      activeBookingRequestId: request.bookingRequestId,
      calendarStatus: 'not_configured'
    });
    return { ok: true, status: 'not_configured' };
  }

  var busy = deps.calendar.listBusy(request.slotStart, isoSlotEnd(request));
  if (busy && busy.ok && Array.isArray(busy.busy) && busy.busy.length > 0) {
    return { ok: false, code: 'SLOT_UNAVAILABLE' };
  }

  deps.leads.updateLeadFields(lead.leadId, {
    activeBookingRequestId: request.bookingRequestId,
    calendarStatus: 'pending'
  });

  deps.work.enqueue(buildWorkItem('create_booking_event', lead.leadId, {
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
    event: 'booking_requested',
    leadId: lead.leadId,
    detail: request.mode + ' @ ' + request.slotStart
  });

  return { ok: true, status: 'pending' };
}

function isoSlotEnd(request) {
  return toIso(addMinutes(parseIso(request.slotStart), request.durationMinutes));
}

/**
 * Slot sanity. Rejected reasons are specific so the client can say something useful
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
 * Handler for the queued calendar write.
 *
 * On success the lead records the event id, which is what makes a later cancellation
 * or reschedule possible at all.
 */
function handleCreateBookingEvent(item, deps) {
  if (!isConfigured(deps.config, 'booking')) {
    deps.leads.updateLeadFields(item.leadId, { calendarStatus: 'not_configured' });
    return { ok: false, permanent: true, reason: 'calendar_not_configured' };
  }

  var lead = deps.leads.findLeadById(item.leadId);
  if (!lead) return { ok: false, permanent: true, reason: 'lead_not_found' };

  // The request was superseded while it sat in the queue. Creating the stale event
  // would put a meeting on the calendar nobody asked for any more.
  if (lead.activeBookingRequestId !== item.payload.bookingRequestId) {
    return { ok: false, permanent: true, reason: 'booking_superseded' };
  }

  var result = deps.calendar.createEvent({
    startIso: item.payload.slotStart,
    endIso: toIso(addMinutes(parseIso(item.payload.slotStart), item.payload.durationMinutes)),
    mode: item.payload.mode,
    leadId: lead.leadId,
    attendeeEmail: lead.email,
    attendeeName: lead.fullName
  });

  if (!result || !result.ok) {
    deps.leads.updateLeadFields(item.leadId, { calendarStatus: 'failed' });
    return { ok: false, reason: (result && result.reason) || 'calendar_create_failed' };
  }

  deps.leads.updateLeadFields(item.leadId, {
    calendarStatus: 'booked',
    calendarEventId: result.eventId || ''
  });
  return { ok: true };
}
