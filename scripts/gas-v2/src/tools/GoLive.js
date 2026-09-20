/**
 * TEMPORARY GO-LIVE TOOLS. DELETE THIS FILE after the go-live sequence is complete.
 *
 * Two functions:
 *
 *   setRunModeLive()  — sets AXP_RUN_MODE to "live". Run this once, deliberately.
 *   readRunMode()     — reads AXP_RUN_MODE back directly and logs the real current value.
 *                       Run this immediately after setRunModeLive() to confirm the flip.
 *
 * WHAT "live" MEANS. The backend's run mode gates every outbound side effect. In dry_run,
 * submissions are stored to the Sheet and emails/calendar events are simulated but never
 * sent or created. In live, real emails are sent to real addresses and real calendar events
 * are created on the production calendar. There is no undo for a sent email or a created
 * calendar event. Run setRunModeLive() only when the triggers are installed and the E2E
 * verification is complete.
 *
 * WHY A FUNCTION INSTEAD OF HAND-EDITING IN THE PROPERTIES UI. Properties Service stores
 * values with trailing and leading whitespace intact. A value typed or pasted by hand can
 * carry a space that looks identical and passes a string equality check against the wrong
 * side. Writing it through code is exact.
 */

function setRunModeLive() {
  PropertiesService.getScriptProperties().setProperty('AXP_RUN_MODE', 'live');
  Logger.log('AXP_RUN_MODE written.');
  Logger.log('Call readRunMode() to confirm the stored value before proceeding.');
}

function readRunMode() {
  var value = PropertiesService.getScriptProperties().getProperty('AXP_RUN_MODE');
  Logger.log('AXP_RUN_MODE = ' + JSON.stringify(value));
  Logger.log(value === 'live'
    ? 'CONFIRMED LIVE — real emails and calendar events will fire.'
    : 'NOT live — current value is ' + JSON.stringify(value));
}
