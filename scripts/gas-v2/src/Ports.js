/**
 * Ports.
 *
 * Everything that touches the outside world goes through one of these interfaces.
 * Nothing in the domain, contract, routing, SLA, spam, matching, or worker layers
 * references SpreadsheetApp, MailApp, or Calendar directly. That is what makes the
 * whole backend testable under plain Node with no Apps Script runtime, and it is why
 * the test suite can prove behaviour instead of asserting that constants equal
 * themselves.
 *
 * A port is a plain object with the named methods. There is no class hierarchy and no
 * framework. `assertPort` exists so a wiring mistake fails at startup with a clear
 * message instead of at 2am inside a trigger.
 */

var LEAD_REPOSITORY_PORT = [
  'insertLead',
  'findLeadById',
  'findLeadBySubmissionId',
  'listPendingDigestSubmissions',
  'updateLeadFields'
];

var CONTACT_REPOSITORY_PORT = [
  'insertContact',
  'findContactById',
  'listContactCandidates',
  'updateContact'
];

var LOG_REPOSITORY_PORT = [
  'append',
  'listAll',
  'removeByIds'
];

var WORK_REPOSITORY_PORT = [
  'listAll',
  'removeByIds',
  'enqueue',
  'claimDue',
  'markSucceeded',
  'markFailed',
  'markAbandoned',
  'findByIdempotencyKey'
];

var MAIL_SERVICE_PORT = [
  'send'
];

var CALENDAR_SERVICE_PORT = [
  'listBusy',
  'createEvent',
  'deleteEvent'
];

/**
 * Message rendering.
 *
 * IMPLEMENTED as of Pass 9A, from the approved communications design. `realTemplates()`
 * in Templates.js is the production implementation; the port stays because it is what
 * lets every handler be tested against a fake renderer without asserting on markup.
 *
 * `notImplementedTemplates()` is retained for the tests that prove a permanent render
 * failure is abandoned rather than retried forever.
 */
var TEMPLATE_PORT = [
  'renderAcknowledgement',
  'renderPartnerNotification',
  'renderQrAcknowledgement',
  'renderQrDigest',
  'renderBookingConfirmation'
];

var CLOCK_PORT = [
  'now'
];

var LOCK_PORT = [
  'withLock'
];

var ID_PORT = [
  'newId'
];

function assertPort(name, port, methods) {
  if (!port || typeof port !== 'object') {
    throw new Error('port ' + name + ' is missing');
  }
  var missing = methods.filter(function (m) { return typeof port[m] !== 'function'; });
  if (missing.length > 0) {
    throw new Error('port ' + name + ' is missing methods: ' + missing.join(', '));
  }
  return port;
}

/**
 * Validates a fully assembled dependency bundle.
 *
 * Called once at the entry point. Wiring is checked in one place so that a half-wired
 * deployment cannot accept a submission, write half of it, and then fail on the part
 * nobody tested.
 */
function assertDeps(deps) {
  assertPort('leads', deps.leads, LEAD_REPOSITORY_PORT);
  assertPort('contacts', deps.contacts, CONTACT_REPOSITORY_PORT);
  assertPort('log', deps.log, LOG_REPOSITORY_PORT);
  assertPort('work', deps.work, WORK_REPOSITORY_PORT);
  assertPort('mail', deps.mail, MAIL_SERVICE_PORT);
  assertPort('templates', deps.templates, TEMPLATE_PORT);
  assertPort('calendar', deps.calendar, CALENDAR_SERVICE_PORT);
  assertPort('clock', deps.clock, CLOCK_PORT);
  assertPort('lock', deps.lock, LOCK_PORT);
  assertPort('ids', deps.ids, ID_PORT);
  if (typeof deps.offsetResolver !== 'function') {
    throw new Error('deps.offsetResolver must be a function');
  }
  if (!deps.config || typeof deps.config !== 'object') {
    throw new Error('deps.config is missing');
  }
  return deps;
}

/**
 * A service port that is not configured for this environment.
 *
 * It reports `not_configured` rather than throwing or pretending to succeed, so a
 * deployment without mail configured still accepts and stores submissions. Storage is
 * the part that cannot be redone later; notification can be caught up by hand.
 */
function notConfiguredMailService(reason) {
  return {
    send: function () {
      return { ok: false, status: 'not_configured', reason: reason || 'mail_not_configured' };
    }
  };
}

/**
 * The template port before the email design pass lands.
 *
 * It fails PERMANENTLY, not transiently: retrying an unwritten template three more
 * times changes nothing. The lead is already stored, the failure is visible in
 * `ackEmailStatus`, and a partner can respond by hand in the meantime.
 */
function notImplementedTemplates() {
  var fail = function (reason) {
    return function () { return { ok: false, permanent: true, reason: reason }; };
  };
  return {
    renderAcknowledgement: fail('acknowledgement_template_not_implemented'),
    renderPartnerNotification: fail('partner_template_not_implemented'),
    renderQrAcknowledgement: fail('qr_acknowledgement_template_not_implemented'),
    renderQrDigest: fail('qr_digest_template_not_implemented'),
    renderBookingConfirmation: fail('booking_template_not_implemented')
  };
}

function notConfiguredCalendarService(reason) {
  return {
    listBusy: function () {
      return { ok: false, status: 'not_configured', reason: reason || 'calendar_not_configured', busy: [] };
    },
    createEvent: function () {
      return { ok: false, status: 'not_configured', reason: reason || 'calendar_not_configured' };
    },
    deleteEvent: function () {
      return { ok: false, status: 'not_configured', reason: reason || 'calendar_not_configured' };
    }
  };
}
