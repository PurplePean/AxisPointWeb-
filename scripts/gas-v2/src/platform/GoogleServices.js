/**
 * Google service adapters.
 *
 * This is the ONLY file that names SpreadsheetApp, MailApp, CalendarApp,
 * LockService, PropertiesService, or Utilities. Everything above it is plain
 * JavaScript, which is what lets the test suite run the real logic under Node.
 *
 * Google People synchronization is deliberately absent. Contact sync is scoped to a
 * later pass, and `contactSyncStatus` records `not_configured` rather than a status
 * that implies a sync nobody wrote.
 */

function makePropertyReader() {
  var props = PropertiesService.getScriptProperties();
  return {
    get: function (key) {
      var v = props.getProperty(key);
      return v === null || v === undefined ? '' : String(v);
    }
  };
}

/**
 * Property writer adapter for provisionProperties / setProperties.
 *
 * Returns an object with setProperty(key, value) backed by the real Script
 * Properties store. Pass this to setProperties() to write provisioning values.
 * Tests inject a fake writer instead of calling this.
 */
function makePropertyWriter() {
  var props = PropertiesService.getScriptProperties();
  return {
    setProperty: function (key, value) {
      props.setProperty(key, String(value));
    }
  };
}

function makeClock() {
  return { now: function () { return new Date(); } };
}

function makeIdService() {
  return { newId: function () { return uuidV4(); } };
}

/**
 * Lock adapter.
 *
 * A failure to acquire is NOT swallowed. Running the body unlocked because the lock
 * was busy is precisely the concurrency the lock exists to prevent, and the resulting
 * duplicate rows look like a data problem rather than a locking one.
 */
function makeLockService(timeoutMs) {
  var wait = timeoutMs || 20000;
  return {
    withLock: function (fn) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(wait)) {
        throw new Error('LockUnavailable');
      }
      try {
        return fn();
      } finally {
        SpreadsheetApp.flush();
        lock.releaseLock();
      }
    }
  };
}

/**
 * Real UTC offset for an instant, in minutes, for the business time zone. Derived
 * from the runtime rather than hard-coded, so daylight saving is handled by Google's
 * own zone data instead of by an assumption that breaks twice a year.
 */
function makeOffsetResolver(timeZone) {
  var tz = timeZone || BUSINESS_TIMEZONE;
  return function (date) {
    var offsetText = Utilities.formatDate(date instanceof Date ? date : new Date(date), tz, 'Z');
    var sign = offsetText.charAt(0) === '-' ? -1 : 1;
    var hours = parseInt(offsetText.substr(1, 2), 10);
    var minutes = parseInt(offsetText.substr(3, 2), 10);
    return sign * (hours * 60 + minutes);
  };
}

function makeSpreadsheet(config) {
  if (!config.sheetId) throw new Error('SheetNotConfigured');
  return SpreadsheetApp.openById(config.sheetId);
}

/**
 * Mail adapter.
 *
 * Returns a result object instead of throwing, because the caller is a work-queue
 * handler whose retry policy needs to distinguish a transient quota failure from a
 * permanent one. A thrown exception collapses that distinction.
 */
function makeMailService(config) {
  return {
    send: function (message) {
      if (config.runMode !== RUN_MODE_LIVE) {
        // Dry run stops at the boundary. Nothing leaves the project.
        return { ok: true, status: 'dry_run' };
      }
      try {
        MailApp.sendEmail({
          to: message.to,
          replyTo: message.replyTo || undefined,
          name: message.fromName || undefined,
          subject: message.subject,
          htmlBody: message.htmlBody,
          body: message.textBody || ''
        });
        return { ok: true, status: 'sent' };
      } catch (e) {
        var name = e && e.name ? String(e.name) : 'Error';
        // A quota refusal is transient and worth retrying; a malformed address is not.
        var permanent = /Invalid email|no recipient/i.test(String(e && e.message));
        return { ok: false, permanent: permanent, reason: 'mail_error:' + name };
      }
    }
  };
}

/**
 * Calendar adapter.
 *
 * Availability is read from the real calendar rather than from a stored slot list,
 * so a meeting booked directly in the calendar still blocks the slot.
 */
function makeCalendarService(config) {
  return {
    listBusy: function (startIso, endIso) {
      if (!config.calendarId) {
        return { ok: false, status: 'not_configured', reason: 'calendar_not_configured', busy: [] };
      }
      try {
        var cal = CalendarApp.getCalendarById(config.calendarId);
        if (!cal) return { ok: false, reason: 'calendar_not_found', busy: [] };
        var events = cal.getEvents(new Date(startIso), new Date(endIso));
        return {
          ok: true,
          busy: events.map(function (ev) {
            return { startIso: toIso(ev.getStartTime()), endIso: toIso(ev.getEndTime()) };
          })
        };
      } catch (e) {
        return { ok: false, reason: 'calendar_error:' + safeErrorCode(e), busy: [] };
      }
    },

    createEvent: function (spec) {
      if (!config.calendarId) {
        return { ok: false, permanent: true, reason: 'calendar_not_configured' };
      }
      if (config.runMode !== RUN_MODE_LIVE) {
        return { ok: true, status: 'dry_run', eventId: '' };
      }
      try {
        var cal = CalendarApp.getCalendarById(config.calendarId);
        if (!cal) return { ok: false, permanent: true, reason: 'calendar_not_found' };

        var title = spec.mode === 'video_meeting' ? 'AxisPoint video meeting' : 'AxisPoint call';
        var event = cal.createEvent(
          title + ' with ' + (spec.attendeeName || 'inquiry'),
          new Date(spec.startIso),
          new Date(spec.endIso),
          { description: 'leadId: ' + spec.leadId }
        );
        return { ok: true, eventId: event.getId() };
      } catch (e) {
        return { ok: false, reason: 'calendar_error:' + safeErrorCode(e) };
      }
    },

    deleteEvent: function (eventId) {
      if (!config.calendarId || !eventId) {
        return { ok: false, permanent: true, reason: 'calendar_not_configured' };
      }
      if (config.runMode !== RUN_MODE_LIVE) return { ok: true, status: 'dry_run' };
      try {
        var cal = CalendarApp.getCalendarById(config.calendarId);
        if (!cal) return { ok: false, permanent: true, reason: 'calendar_not_found' };
        var event = cal.getEventById(eventId);
        if (!event) return { ok: true, status: 'already_absent' };
        event.deleteEvent();
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: 'calendar_error:' + safeErrorCode(e) };
      }
    }
  };
}
