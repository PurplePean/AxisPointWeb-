/**
 * Web app entry points and response shaping.
 *
 * TWO RULES GOVERN EVERY RESPONSE.
 *
 * 1. Always return JSON, always with HTTP 200. An uncaught exception in an Apps
 *    Script web app returns an HTML error page that a cross-origin fetch cannot even
 *    read, so the browser sees a network failure and the visitor sees nothing useful.
 *    Every failure is therefore caught and shaped into a JSON body carrying a stable
 *    code.
 *
 * 2. Nothing internal ever crosses the boundary. No stack trace, no Sheet id, no
 *    property name, no address, no row number. The client gets a code and, where it
 *    helps, the offending field path.
 *
 * ON ORIGIN CHECKING, STATED PLAINLY. An Apps Script web app does NOT expose request
 * headers to doPost, so the real Origin header cannot be read and cannot be enforced.
 * There is therefore no origin allowlist here, and there deliberately is no property
 * for one: a check applied to a value the client itself supplies would look like an
 * access control while providing none. The endpoint is anonymous by design and its
 * protections are validation, rate-limited side effects, and spam flagging.
 */

/*
 * Read through a function, not a top-level alias.
 *
 * Apps Script evaluates every pushed file's top-level statements in one shared scope,
 * in an order this repository does not control. A top-level `var X = SCHEMA_VERSION`
 * here throws if Tokens.js has not been evaluated yet, and it throws for EVERY
 * request and every trigger, which is a full outage. Function bodies run after all
 * files are loaded, so no cross-file value is read at load time anywhere in src.
 */
function responseSchemaVersion() {
  return SCHEMA_VERSION;
}

function jsonOutput(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function successBody(payload) {
  var body = { schemaVersion: responseSchemaVersion(), ok: true };
  Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
  return body;
}

function errorBody(code, field) {
  return {
    schemaVersion: responseSchemaVersion(),
    ok: false,
    error: { code: code, field: field || null }
  };
}

/**
 * Health check.
 *
 * Reports WHICH capabilities are configured, never the values that configure them. A
 * boolean tells an operator what they need to know; the calendar id tells an attacker
 * something they should not have.
 */
function doGet() {
  try {
    var config = readConfig(makePropertyReader());
    return jsonOutput(successBody({
      service: 'axispoint-intake',
      runMode: config.runMode,
      // Capability readiness AND promise keepability, reported separately. A deployment
      // can be able to send while the copy it would send is not yet true; see
      // configHealth in Config.js.
      health: configHealth(config)
    }));
  } catch (e) {
    return jsonOutput(errorBody('SERVICE_UNAVAILABLE'));
  }
}

function doPost(e) {
  var raw = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
  return jsonOutput(handlePost(raw, buildDepsSafely()));
}

/**
 * Wiring failure must not look like a malformed submission. It returns its own code so
 * an operator reads "this deployment is not configured", not "the browser sent junk".
 */
function buildDepsSafely() {
  try {
    return { ok: true, deps: buildProductionDeps() };
  } catch (e) {
    return { ok: false, code: 'SERVICE_NOT_CONFIGURED' };
  }
}

/**
 * The testable core of doPost. Takes the raw body and an already-built dependency
 * bundle, so the whole request path can be exercised under Node.
 */
function handlePost(rawBody, wiring) {
  if (!wiring || !wiring.ok) {
    return errorBody((wiring && wiring.code) || 'SERVICE_NOT_CONFIGURED');
  }
  var deps = wiring.deps;

  var parsed = parseEnvelope(rawBody);
  if (!parsed.ok) return errorBody(parsed.code, parsed.field);

  var envelope = parsed.value;

  try {
    if (envelope.submissionKind === 'booking_request') {
      var booking = executeBookingCommand(envelope, deps);
      // A refusal still returns its final status, so the client can say "that slot is
      // taken" rather than a generic failure. `confirmed` is reachable only from a
      // successful Calendar write; see Booking.js.
      if (!booking.ok) {
        var refused = errorBody(booking.code);
        refused.bookingStatus = booking.status;
        return refused;
      }
      return successBody({
        submissionKind: 'booking_request',
        bookingRequestId: envelope.bookingRequestId,
        bookingStatus: booking.status,
        replay: booking.replay === true
      });
    }

    if (!isConfigured(deps.config, 'intake')) {
      return errorBody('SERVICE_NOT_CONFIGURED');
    }

    var result = processSubmission(envelope, deps);

    // A reused submissionId carrying different data is refused rather than reported as a
    // replay, so the sender learns their new data was NOT stored.
    if (!result.ok) return errorBody(result.code);

    return successBody({
      submissionKind: envelope.submissionKind,
      submissionId: envelope.submissionId,
      leadId: result.leadId,
      contactId: result.contactId,
      slaDueAt: result.slaDueAt || null,
      replay: result.replay === true
    });
  } catch (err) {
    // The submission may or may not have been stored. Either way the visitor gets a
    // truthful failure rather than a success the record does not support.
    tryLog(deps, {
      level: 'error',
      event: 'submission_failed',
      submissionId: envelope.submissionId || '',
      detail: safeErrorCode(err)
    });
    return errorBody(err && err.message === 'LockUnavailable' ? 'BUSY_TRY_AGAIN' : 'INTERNAL_ERROR');
  }
}

/** Logging must never be the reason a request fails. */
function tryLog(deps, entry) {
  try {
    deps.log.append(entry);
  } catch (e) {
    /* deliberately swallowed */
  }
}

/**
 * Time-driven entry point for the work queue.
 *
 * The trigger that calls this is NOT created by this repository. Installing it is a
 * deliberate operation against a real Apps Script project, performed when the backend
 * is actually being brought up.
 */
function runWorkerTrigger() {
  var deps = buildProductionDeps();
  return runWorkerCycle(deps, defaultWorkHandlers());
}

/**
 * Callable handler for the daily internal QR Contact digest.
 *
 * Intended schedule: 8:00 AM America/Chicago. NO TRIGGER IS INSTALLED BY THIS
 * REPOSITORY. Scheduling it is a separate, deliberate operation performed against a real
 * Apps Script project, so this pass leaves it callable and unscheduled.
 */
function runDailyQrDigestTrigger() {
  return runDailyQrDigest(buildProductionDeps());
}

/**
 * Callable handler for operational-record retention.
 *
 * Business records are never selected. See Retention.js. Also unscheduled by design, and
 * worth running once with `{ dryRun: true }` against real data before it is scheduled.
 */
function runRetentionMaintenanceTrigger(options) {
  return runRetentionMaintenance(buildProductionDeps(), options || {});
}
