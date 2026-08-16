/**
 * SLA due-time arithmetic.
 *
 * ONE POLICY, ONE NUMBER: every website service inquiry is due at 5:00 PM local time on
 * the NEXT BUSINESS DAY. Monday through Friday. Holidays are ignored at launch, and
 * that is a stated simplification rather than an oversight: a holiday calendar nobody
 * maintains produces wrong deadlines silently, which is worse than a deadline everyone
 * knows ignores holidays.
 *
 * This replaces the pathway-specific 4 / 8 / 24 business-hour policy from Pass 8. Three
 * different clocks running against three pathways meant nobody could answer "when is
 * this due" without first checking which pathway it was, so in practice nobody checked
 * at all. One deadline that everyone can state from memory is a deadline that gets met.
 *
 * The module is pure. It takes an explicit offset resolver, so it never depends on the
 * runtime's time zone and daylight saving is testable.
 */

/**
 * Minutes to add to UTC to get local business time. Supplied by the caller because only
 * the host runtime knows the real offset for a given instant. In Apps Script the
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
 * The next business day strictly after the local day containing `date`.
 *
 * "Next" is deliberately strict even for a submission that arrives at 9:01 AM Monday:
 * the commitment is a full working day, not the remainder of today. The loop is bounded
 * so a misconfigured business calendar with no open days cannot hang a request.
 */
function nextBusinessDayStart(date, offsetResolver) {
  var cursor = new Date(localHourOnSameDay(date, 0, offsetResolver).getTime() + 24 * 60 * 60000);

  for (var guard = 0; guard < 10; guard++) {
    var parts = toLocalParts(cursor, offsetResolver);
    if (isBusinessDay(parts.weekday)) return cursor;
    cursor = new Date(localHourOnSameDay(cursor, 0, offsetResolver).getTime() + 24 * 60 * 60000);
  }
  return cursor;
}

/**
 * Due instant for a submission, or null when the submission carries no response
 * commitment.
 *
 * A Contact Exchange is a record of a handshake, not a request for a reply, so it
 * deliberately has no due time rather than a fake distant one that would put it in the
 * same overdue reports as a real inquiry.
 */
function computeSlaDueAt(submissionKind, pathway, receivedAt, offsetResolver) {
  if (submissionKind !== 'service_inquiry') return null;
  var day = nextBusinessDayStart(new Date(receivedAt), offsetResolver);
  return localHourOnSameDay(day, SLA_DUE_HOUR, offsetResolver);
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
