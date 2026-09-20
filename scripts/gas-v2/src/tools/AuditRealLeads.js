/**
 * TEMPORARY AUDIT — Real (non-TEST) leads in the production Sheet.
 *
 * Run auditRealLeads() manually from the Apps Script editor. Results land in
 * View > Executions > the most recent run > Logs.
 *
 * DELETE THIS FILE once the audit is complete. It is a one-shot diagnostic,
 * not a supported operational function.
 */

function auditRealLeads() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('AXP_SHEET_ID');
  if (!sheetId) {
    Logger.log('ERROR: AXP_SHEET_ID not set in Script Properties — cannot open Sheet.');
    return;
  }

  var book = SpreadsheetApp.openById(sheetId);

  /* ── Leads tab ─────────────────────────────────────────────────────────── */

  var leadsSheet = book.getSheetByName(TAB_NAMES.LEADS);
  if (!leadsSheet) {
    Logger.log('ERROR: "Leads" tab not found in the Sheet.');
    return;
  }

  var leadsTable = readTable(leadsSheet, LEAD_HEADERS);
  var total = leadsTable.rows.length;

  var realLeads = leadsTable.rows.filter(function (row) {
    return String(row.fullName || '').slice(0, 4).toLowerCase() !== 'test';
  });

  Logger.log('=== REAL LEADS AUDIT ===');
  Logger.log('Total Leads rows: ' + total);
  Logger.log('Non-TEST leads:   ' + realLeads.length);

  var realSubmissionIds = {};
  var realLeadIds = {};

  if (realLeads.length === 0) {
    Logger.log('\nAll rows are TEST submissions — no real visitor data found.');
  } else {
    realLeads.forEach(function (lead, i) {
      Logger.log('\n--- Real Lead ' + (i + 1) + ' of ' + realLeads.length + ' ---');
      Logger.log('  leadId:             ' + lead.leadId);
      Logger.log('  sourceSubmissionId: ' + lead.sourceSubmissionId);
      Logger.log('  receivedAt:         ' + lead.receivedAt);
      Logger.log('  fullName:           ' + lead.fullName);
      Logger.log('  email:              ' + lead.email);
      Logger.log('  phone:              ' + lead.phone);
      Logger.log('  organization:       ' + lead.organization);
      Logger.log('  pathway:            ' + lead.pathway);
      Logger.log('  serviceScope:       ' + lead.serviceScope);
      Logger.log('  topic:              ' + lead.topic);
      Logger.log('  propertyType:       ' + lead.propertyType);
      Logger.log('  propertyScope:      ' + lead.propertyScope);
      Logger.log('  propertyLocation:   ' + lead.propertyLocation);
      Logger.log('  propertyScale:      ' + lead.propertyScale);
      Logger.log('  situationNotes:     ' + lead.situationNotes);
      Logger.log('  leadStatus:         ' + lead.leadStatus);
      Logger.log('  spamSuspected:      ' + lead.spamSuspected);
      if (lead.spamReason) {
        Logger.log('  spamReason:         ' + lead.spamReason);
      }
      Logger.log('  slaDueAt:           ' + lead.slaDueAt);
      Logger.log('  ownerPartner:       ' + lead.ownerPartner);

      if (lead.sourceSubmissionId) realSubmissionIds[String(lead.sourceSubmissionId)] = true;
      if (lead.leadId) realLeadIds[String(lead.leadId)] = true;
    });
  }

  /* ── Work tab ──────────────────────────────────────────────────────────── */

  var workSheet = book.getSheetByName(TAB_NAMES.WORK);
  if (!workSheet) {
    Logger.log('\nWork tab not found — skipping work queue check.');
    Logger.log('\n=== AUDIT COMPLETE ===');
    return;
  }

  var STORED_HEADERS = WORK_HEADERS.concat(['idempotencyKey', 'payload']);
  var workTable = readTable(workSheet, STORED_HEADERS);

  var pendingOrFailed = workTable.rows.filter(function (row) {
    return row.state === 'pending' || row.state === 'failed';
  });

  var tiedToReal = pendingOrFailed.filter(function (row) {
    var sid = String(row.subjectId || '');
    return realSubmissionIds[sid] || realLeadIds[sid];
  });

  Logger.log('\n=== WORK QUEUE (pending / failed) ===');
  Logger.log('All pending/failed items: ' + pendingOrFailed.length);
  Logger.log('Tied to real leads:       ' + tiedToReal.length);

  if (tiedToReal.length === 0) {
    if (pendingOrFailed.length > 0) {
      Logger.log('\n(All pending/failed work items are tied to TEST submissions.)');
      Logger.log('Listing them for completeness:');
      pendingOrFailed.forEach(function (item, i) {
        Logger.log('  [' + (i + 1) + '] workId=' + item.workId
          + '  kind=' + item.kind
          + '  state=' + item.state
          + '  subjectId=' + item.subjectId
          + '  attempts=' + item.attempts
          + '  lastError=' + (item.lastError || '(none)'));
      });
    } else {
      Logger.log('Work queue is clean — no pending or failed items.');
    }
  } else {
    tiedToReal.forEach(function (item, i) {
      Logger.log('\n--- Work Item ' + (i + 1) + ' of ' + tiedToReal.length + ' ---');
      Logger.log('  workId:        ' + item.workId);
      Logger.log('  kind:          ' + item.kind);
      Logger.log('  state:         ' + item.state);
      Logger.log('  subjectId:     ' + item.subjectId);
      Logger.log('  attempts:      ' + item.attempts);
      Logger.log('  nextAttemptAt: ' + item.nextAttemptAt);
      Logger.log('  lastError:     ' + (item.lastError || '(none)'));
      Logger.log('  completedAt:   ' + (item.completedAt || '(not complete)'));
    });
  }

  Logger.log('\n=== AUDIT COMPLETE ===');
}
