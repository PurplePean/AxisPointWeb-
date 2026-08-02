/**
 * SLA due-time arithmetic.
 *
 * The commitment is measured in BUSINESS hours, not elapsed hours. A Friday evening
 * inquiry with a four hour target is due Monday late morning, not Saturday at
 * midnight. A wall-clock deadline would mark almost every weekend lead breached
 * before anyone could have answered it, which makes the whole field worthless.
 *
 * This module is pure. It takes an explicit offset resolver so it never depends on
 * the Apps Script runtime's time zone, and so daylight saving is testable.
 */

/**
 * Minutes to add to UTC to get local business time. Supplied by the caller because
 * only the host runtime knows the real offset for a given instant. In Apps Script the
 * adapter passes a resolver backed by the runtime's own zone data; tests pass a fixed
 * one, so nothing here depends on the machine the tests run on.
 */
function makeFixedOffsetResolver(minutes) {
  return function () { return minutes; };
}

function toLocalParts(date, offsetResolver) {
  var offset = offsetResolver(date);
  var local = new Date(date.getTime() + offset * 60000);
  return {
    offset: offset,
    weekday: local.getUTCDay(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    dayStartUtc: new Date(Date.UTC(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()
    ).valueOf() - offset * 60000)
  };
}

function isBusinessDay(weekday) {
  return BUSINESS_DAYS.indexOf(weekday) !== -1;
}

/** Instant of `hour:00` local on the local day containing `date`. */
function localHourOnSameDay(date, hour, offsetResolver) {
  var parts = toLocalParts(date, offsetResolver);
  return new Date(parts.dayStartUtc.getTime() + hour * 60 * 60000);
}

/**
 * Moves an instant forward to the next moment inside business hours. An instant
 * already inside the window is returned unchanged.
 */
function advanceToBusinessHours(date, offsetResolver) {
  var cursor = new Date(date.getTime());
  for (var guard = 0; guard < 14; guard++) {
    var parts = toLocalParts(cursor, offsetResolver);
    if (!isBusinessDay(parts.weekday)) {
      cursor = new Date(localHourOnSameDay(cursor, BUSINESS_START_HOUR, offsetResolver).getTime() + 24 * 60 * 60000);
      continue;
    }
    if (parts.hour < BUSINESS_START_HOUR) {
      return localHourOnSameDay(cursor, BUSINESS_START_HOUR, offsetResolver);
    }
    if (parts.hour >= BUSINESS_END_HOUR) {
      cursor = new Date(localHourOnSameDay(cursor, BUSINESS_START_HOUR, offsetResolver).getTime() + 24 * 60 * 60000);
      continue;
    }
    return cursor;
  }
  return cursor;
}

/**
 * Adds business hours to an instant, walking one business day at a time.
 *
 * The loop is bounded. An unbounded walk would hang the whole request if the business
 * calendar were ever misconfigured to have no open days.
 */
function addBusinessHours(start, hours, offsetResolver) {
  var cursor = advanceToBusinessHours(start, offsetResolver);
  var remainingMs = hours * 60 * 60000;

  for (var guard = 0; guard < 400 && remainingMs > 0; guard++) {
    var endOfDay = localHourOnSameDay(cursor, BUSINESS_END_HOUR, offsetResolver);
    var availableMs = endOfDay.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      return new Date(cursor.getTime() + remainingMs);
    }
    remainingMs -= availableMs;
    cursor = advanceToBusinessHours(new Date(endOfDay.getTime() + 60000), offsetResolver);
  }
  return cursor;
}

/**
 * Due instant for a submission, or null when the submission carries no response
 * commitment. Contact Exchange is a record of a handshake, not a request for a reply,
 * so it deliberately has no due time rather than a fake distant one.
 */
function computeSlaDueAt(submissionKind, pathway, receivedAt, offsetResolver) {
  if (submissionKind !== 'service_inquiry') return null;
  var hours = SLA_BUSINESS_HOURS[pathway];
  if (typeof hours !== 'number') return null;
  return addBusinessHours(new Date(receivedAt), hours, offsetResolver);
}

/**
 * SLA is satisfied by the first human contact, not by an automated acknowledgement.
 * An auto-reply proves the machine worked; it proves nothing about the response the
 * commitment is actually about.
 */
function slaState(slaDueAt, firstHumanContactAt, now) {
  if (!slaDueAt) return 'not_applicable';
  var due = slaDueAt instanceof Date ? slaDueAt : parseIso(slaDueAt);
  if (!due) return 'not_applicable';

  var contacted = firstHumanContactAt instanceof Date ? firstHumanContactAt : parseIso(firstHumanContactAt);
  if (contacted) return contacted.getTime() <= due.getTime() ? 'met' : 'missed';
  return new Date(now).getTime() > due.getTime() ? 'breached' : 'pending';
}
