/**
 * Dependency wiring.
 *
 * One place assembles the real adapters. Anything that wants to run the backend in a
 * test builds the same shape from fakes, which is why the test suite exercises the
 * actual decision code rather than a parallel reimplementation of it.
 */

function buildProductionDeps() {
  var config = readConfig(makePropertyReader());
  var clock = makeClock();
  var ids = makeIdService();
  var book = makeSpreadsheet(config);

  var deps = {
    config: config,
    clock: clock,
    ids: ids,
    lock: makeLockService(),
    offsetResolver: makeOffsetResolver(BUSINESS_TIMEZONE),
    leads: makeLeadRepository(book),
    contacts: makeContactRepository(book),
    log: makeLogRepository(book, ids, clock),
    work: makeWorkRepository(book),
    mail: isConfigured(config, 'notify') || isConfigured(config, 'acknowledge')
      ? makeMailService(config)
      : notConfiguredMailService('mail_not_configured'),
    calendar: isConfigured(config, 'booking')
      ? makeCalendarService(config)
      : notConfiguredCalendarService('calendar_not_configured'),
    // The approved communications templates, implemented in Pass 9A.
    templates: realTemplates(),
    launchReadyLocales: LAUNCH_READY_LOCALES
  };

  return assertDeps(deps);
}
