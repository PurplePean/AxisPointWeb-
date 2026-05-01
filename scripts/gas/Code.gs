/**
 * AxisPoint Partners — Google Apps Script Backend
 * ════════════════════════════════════════════════════════════════════════════
 *
 * DEPLOYMENT INSTRUCTIONS — follow in order
 * ──────────────────────────────────────────
 *
 * STEP 1 — Create the Google Sheet
 *   • Go to sheets.google.com and create a blank spreadsheet.
 *   • Name it "AxisPoint CRM".
 *   • Copy the Sheet ID from the URL bar:
 *       https://docs.google.com/spreadsheets/d/<<THIS_PART>>/edit
 *   • Paste it into CONFIG.SPREADSHEET_ID below.
 *
 * STEP 2 — Create the Apps Script project
 *   • Go to script.google.com → New project.
 *   • Name it "AxisPoint CRM Backend".
 *   • Delete any starter code, paste this entire file.
 *
 * STEP 3 — Set the project timezone
 *   • Project Settings (gear icon) → Time zone → America/Chicago.
 *   • This makes 6pm and 8am triggers fire at the right CT hour.
 *
 * STEP 4 — Create all sheet tabs
 *   • In the function dropdown select "setupSpreadsheet" → Run.
 *   • Grant all permissions when prompted.
 *   • This creates 10 tabs with colour-coded headers.
 *
 * STEP 5 — Deploy as a Web App
 *   • Deploy → New deployment → Type: Web App.
 *   • Execute as: Me.
 *   • Who has access: Anyone (anonymous — required for the contact form).
 *   • Click Deploy. Copy the /exec URL.
 *   • Paste it into CONFIG.SCRIPT_URL below.
 *   • Also set VITE_FORM_ENDPOINT in GitHub Secrets to this URL.
 *
 * STEP 6 — Create automated triggers
 *   • In the function dropdown select "setupTriggers" → Run.
 *   • This wires the 6pm daily digest, Monday 8am cold sweep,
 *     and the onEdit CRM sync trigger.
 *
 * REQUIRED GOOGLE PERMISSIONS
 *   • Google Sheets     — read / write the CRM spreadsheet
 *   • Gmail             — send email as you
 *   • Google Calendar   — create events on your default calendar
 *   • Google Contacts   — create contacts, manage contact groups
 *   • Script triggers   — create time-based and installable triggers
 *
 * ════════════════════════════════════════════════════════════════════════════
 */


/* ────────────────────────────────────────────────────────────
   CONFIG — fill in SPREADSHEET_ID and SCRIPT_URL before use
   ──────────────────────────────────────────────────────────── */

var CONFIG = {
  SPREADSHEET_ID: 'REPLACE_WITH_GOOGLE_SHEET_ID',
  SCRIPT_URL:     'REPLACE_WITH_WEB_APP_EXEC_URL',

  NOTIFY_EMAILS: ['zach@axispoint.llc', 'ethaniel@axispoint.llc'],
  FROM_EMAIL:    'zach@axispoint.llc',
  SENDER_NAME:   'AxisPoint Partners',

  TABS: {
    ACTIVE_LEADS:      'Active Leads',
    LIFETIME_LEADS:    'Lifetime Leads',
    COLD_LEADS:        'Cold Leads',
    INVESTORS:         'Investors',
    REFERRAL_PARTNERS: 'Referral Partners',
    RE_PROFESSIONALS:  'RE Professionals',
    CURIOUS:           'Curious',
    CLIENTS:           'Clients',
    SUBSCRIBERS:       'Subscribers',
    ARCHIVE:           'Archive',
  },

  CONTACT_GROUPS: {
    LEADS:             'AxisPoint Leads',
    INVESTORS:         'AxisPoint Investors',
    REFERRAL_PARTNERS: 'AxisPoint Referral Partners',
    RE_PROFESSIONALS:  'AxisPoint RE Professionals',
    CLIENTS:           'AxisPoint Clients',
    COLD:              'AxisPoint Cold',
  },

  // Leads older than this many days are moved to Cold Leads on Monday sweeps
  COLD_THRESHOLD_DAYS: 60,
};


/* ────────────────────────────────────────────────────────────
   COLUMN DEFINITIONS
   Shared by all tabs except Subscribers (0-based indexes)
   ──────────────────────────────────────────────────────────── */

var COLS = {
  TIMESTAMP:      0,
  FIRST_NAME:     1,
  LAST_NAME:      2,
  EMAIL:          3,
  PHONE:          4,
  COMPANY:        5,
  ROLE:           6,
  CATEGORY:       7,
  ASSET_CLASS:    8,
  MESSAGE:        9,
  PREFERENCES:   10,
  BOOKING_DATE:  11,
  BOOKING_TIME:  12,
  MEET_TYPE:     13,
  BOOKING_PHONE: 14,
  SOURCE:        15,
  STATUS:        16,
  DATE_SUBMITTED: 17,
};

var LEAD_HEADERS = [
  'Timestamp', 'First Name', 'Last Name', 'Email', 'Phone',
  'Company', 'Role', 'Category', 'Asset Class', 'Message',
  'Preferences', 'Booking Date', 'Booking Time', 'Meet Type',
  'Booking Phone', 'Source', 'Status', 'Date Submitted',
];

// Subscribers tab uses its own column set
var SCOLS = {
  EMAIL:           0,
  FIRST_NAME:      1,
  DATE_SUBSCRIBED: 2,
  PREFERENCES:     3,
  ACTIVE:          4,
  LAST_EMAILED:    5,
};

var SUBSCRIBER_HEADERS = [
  'Email', 'First Name', 'Date Subscribed', 'Preferences', 'Active', 'Last Emailed',
];


/* ════════════════════════════════════════════════════════════
   ENTRY POINTS
   ════════════════════════════════════════════════════════════ */

/**
 * HTTP POST handler.
 * Routes to handleFormSubmission or handleSubscribe based on payload shape.
 *
 * Form submission payload:
 *   { role, qualData, person, preferences, booking, message, source, timestamp }
 *
 * Subscribe payload:
 *   { type:'subscribe', email, firstName, preferences }
 *   — OR any payload that has .email but no .role
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    if (payload.type === 'subscribe' || (!payload.role && payload.email)) {
      return handleSubscribe(payload);
    }

    return handleFormSubmission(payload);
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * HTTP GET handler.
 * Handles ?unsubscribe=[email] query param.
 * Returns a plain HTML confirmation page.
 */
function doGet(e) {
  try {
    var params = e.parameter || {};
    if (params.unsubscribe) {
      return handleUnsubscribe(params.unsubscribe);
    }
    return ContentService
      .createTextOutput('AxisPoint Partners API')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log('doGet error: ' + err);
    return htmlPage('<p>An error occurred.</p>');
  }
}


/* ════════════════════════════════════════════════════════════
   JOB 1 — FORM SUBMISSION HANDLER
   ════════════════════════════════════════════════════════════ */

function handleFormSubmission(payload) {
  try {
    var row = buildLeadRow(payload, 'New Lead');

    // 1. Log to Lifetime Leads (permanent record, never deleted)
    appendRow(CONFIG.TABS.LIFETIME_LEADS, row);

    // 2. Log to Active Leads (working queue)
    appendRow(CONFIG.TABS.ACTIVE_LEADS, row);

    // 3. Log to category tab
    var categoryTab = categoryTabForRole(payload.role);
    if (categoryTab) {
      appendRow(categoryTab, row);
    }

    // 4. Create Google Contact
    try {
      createContact(payload);
    } catch (err) {
      Logger.log('createContact failed: ' + err);
    }

    // 5. Create Google Calendar event if booking was included
    if (payload.booking && payload.booking.date) {
      try {
        createBookingEvent(payload);
      } catch (err) {
        Logger.log('createBookingEvent failed: ' + err);
      }
    }

    // 6. Send confirmation email to visitor
    try {
      sendVisitorConfirmation(payload);
    } catch (err) {
      Logger.log('sendVisitorConfirmation failed: ' + err);
    }

    // 7. Send immediate notification to both partners
    try {
      sendPartnerNotification(payload);
    } catch (err) {
      Logger.log('sendPartnerNotification failed: ' + err);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    Logger.log('handleFormSubmission error: ' + err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/* ── Row builder ── */
function buildLeadRow(payload, status) {
  var p   = payload.person   || {};
  var b   = payload.booking  || null;
  var q   = payload.qualData || {};
  var now = new Date();

  // Include referred person details in Message when role is "refer"
  var message = payload.message || '';
  if (payload.role === 'refer' && payload.referred) {
    var ref = payload.referred;
    var refNote = [
      'Referred person:',
      ref.name  ? '  Name: '  + ref.name  : '',
      ref.email ? '  Email: ' + ref.email : '',
      ref.phone ? '  Phone: ' + ref.phone : '',
      ref.notes ? '  Notes: ' + ref.notes : '',
    ].filter(Boolean).join('\n');
    message = refNote + (message ? '\n\n' + message : '');
  }

  return [
    payload.timestamp || now.toISOString(),                           // Timestamp
    p.firstName || '',                                                 // First Name
    p.lastName  || '',                                                 // Last Name
    p.email     || '',                                                 // Email
    p.phone     || '',                                                 // Phone
    p.company   || '',                                                 // Company
    payload.role || '',                                                // Role
    roleToCategory(payload.role),                                      // Category
    assetClassFromQualData(q),                                         // Asset Class
    message,                                                           // Message
    (payload.preferences || []).join(', '),                           // Preferences
    b ? (b.date || '') : '',                                          // Booking Date
    b ? (b.slot || b.time || '') : '',                                // Booking Time
    b ? (b.meetType || '') : '',                                      // Meet Type
    b ? (b.phone || '') : '',                                         // Booking Phone
    payload.source || payload.page || '',                             // Source
    status,                                                            // Status
    Utilities.formatDate(now, 'America/Chicago', 'MM/dd/yyyy'),       // Date Submitted
  ];
}

/* ── Helpers ── */
function roleToCategory(role) {
  return { investor: 'Investor', referral: 'Referral Partner',
           pro: 'RE Professional', curious: 'Curious', refer: 'Referral' }[role] || '';
}

function assetClassFromQualData(q) {
  var a = q && q.assetClasses;
  return Array.isArray(a) && a.length ? a.join(', ') : '';
}

function categoryTabForRole(role) {
  return { investor: CONFIG.TABS.INVESTORS,
           referral: CONFIG.TABS.REFERRAL_PARTNERS,
           pro:      CONFIG.TABS.RE_PROFESSIONALS,
           curious:  CONFIG.TABS.CURIOUS }[role] || null;
}

/* ── Visitor confirmation email ── */
function sendVisitorConfirmation(payload) {
  var p  = payload.person || {};
  if (!p.email) return;

  var name        = p.firstName || 'there';
  var hasBooking  = payload.booking && payload.booking.date;
  var bookingLine = hasBooking
    ? 'We received your booking request for ' + payload.booking.date +
      ' at ' + (payload.booking.slot || payload.booking.time) +
      '. We will confirm your spot within one business day.'
    : 'We will follow up personally — usually within one business day.';

  GmailApp.sendEmail(
    p.email,
    'We received your message — AxisPoint Partners',
    [
      'Hi ' + name + ',',
      '',
      'Thank you for reaching out to AxisPoint Partners.',
      '',
      bookingLine,
      '',
      'In the meantime, feel free to explore our work at axispoint.llc.',
      '',
      'Best,',
      'Zachary Russell and Ethaniel Vu',
      'AxisPoint Partners',
      'axispoint.llc',
    ].join('\n'),
    { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL }
  );
}

/* ── Immediate partner notification (fires on every submission) ── */
function sendPartnerNotification(payload) {
  var p = payload.person || {};
  var b = payload.booking || null;
  var q = payload.qualData || {};

  var name     = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
  var category = roleToCategory(payload.role);
  var subject  = 'New lead: ' + name + ' (' + category + ')';

  var lines = [
    'Name:         ' + name,
    'Role:         ' + category,
    'Email:        ' + (p.email   || '—'),
    'Phone:        ' + (p.phone   || '—'),
    'Company:      ' + (p.company || '—'),
    'Asset Class:  ' + assetClassFromQualData(q),
    'Source:       ' + (payload.source || payload.page || '—'),
    b && b.date
      ? 'Booking:      ' + b.date + ' at ' + (b.slot || b.time) + ' (' + (b.meetType || '') + ')'
      : 'Booking:      None',
    (payload.preferences || []).length
      ? 'Preferences:  ' + payload.preferences.join(', ')
      : '',
    payload.message
      ? '\nMessage:\n' + payload.message
      : '',
  ].filter(function(l) { return l !== ''; });

  var body = [
    'A new lead just came in through ' + (payload.page || 'the contact form') + '.',
    '',
    lines.join('\n'),
    '',
    'View Active Leads: https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID,
  ].join('\n');

  GmailApp.sendEmail(
    CONFIG.NOTIFY_EMAILS.join(','),
    subject, body,
    { name: CONFIG.SENDER_NAME }
  );
}


/* ════════════════════════════════════════════════════════════
   JOB 2 — DAILY DIGEST  (6 pm CT, time-based trigger)
   Only fires an email if leads came in today.
   ════════════════════════════════════════════════════════════ */

function sendDailyDigest() {
  try {
    var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
    if (!sheet) return;

    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    var rows  = sheet.getDataRange().getValues().slice(1).filter(function(r) {
      return String(r[COLS.DATE_SUBMITTED]) === today;
    });

    if (rows.length === 0) {
      Logger.log('sendDailyDigest: no new leads today.');
      return;
    }

    var n = rows.length;
    var blocks = rows.map(function(r) {
      var name = [r[COLS.FIRST_NAME], r[COLS.LAST_NAME]].filter(Boolean).join(' ') || 'Unknown';
      return [
        'Name:        ' + name,
        'Role:        ' + r[COLS.CATEGORY],
        'Email:       ' + r[COLS.EMAIL],
        'Phone:       ' + r[COLS.PHONE],
        'Asset Class: ' + r[COLS.ASSET_CLASS],
        r[COLS.BOOKING_DATE]
          ? 'Booking:     ' + r[COLS.BOOKING_DATE] + ' at ' + r[COLS.BOOKING_TIME]
          : '',
        'Source:      ' + r[COLS.SOURCE],
      ].filter(function(l) { return l.slice(-1) !== ':'; }).join('\n');
    });

    GmailApp.sendEmail(
      CONFIG.NOTIFY_EMAILS.join(','),
      'AxisPoint — ' + n + ' new lead' + (n > 1 ? 's' : '') + ' today (' + today + ')',
      [
        n + ' new lead' + (n > 1 ? 's' : '') + ' submitted on ' + today + '.',
        '',
        blocks.join('\n\n───────────────────────────\n\n'),
        '',
        'Sheet: https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID,
      ].join('\n'),
      { name: CONFIG.SENDER_NAME }
    );

    Logger.log('sendDailyDigest: emailed digest for ' + n + ' lead(s).');
  } catch (err) {
    Logger.log('sendDailyDigest error: ' + err);
  }
}


/* ════════════════════════════════════════════════════════════
   JOB 3 — COLD LEAD MIGRATION  (Monday 8 am CT)
   Scans Active Leads for rows older than COLD_THRESHOLD_DAYS.
   Moves them to Cold Leads, updates category tab and Contacts.
   Only sends an email if at least one lead was moved.
   ════════════════════════════════════════════════════════════ */

function moveColdLeads() {
  try {
    var activeSheet = tab(CONFIG.TABS.ACTIVE_LEADS);
    if (!activeSheet) return;

    var data    = activeSheet.getDataRange().getValues();
    var now     = new Date();
    var active  = ['New Lead', 'Contacted', 'Active'];
    var moved   = [];

    // Iterate bottom-up so row deletion doesn't shift indices
    for (var i = data.length - 1; i >= 1; i--) {
      var row    = data[i];
      var status = String(row[COLS.STATUS] || '');
      if (active.indexOf(status) === -1) continue;

      var submitted = new Date(row[COLS.DATE_SUBMITTED]);
      if (isNaN(submitted)) continue;

      var age = (now - submitted) / 86400000; // ms → days
      if (age <= CONFIG.COLD_THRESHOLD_DAYS) continue;

      row[COLS.STATUS] = 'Cold';
      appendRow(CONFIG.TABS.COLD_LEADS, row);
      activeSheet.deleteRow(i + 1);

      // Mirror status change in category tab
      setCategoryTabStatus(row, 'Cold');

      // Move Google Contact from Leads → Cold group
      try { moveContactToCold(row[COLS.EMAIL]); } catch (e) {
        Logger.log('moveContactToCold failed for ' + row[COLS.EMAIL] + ': ' + e);
      }

      moved.push(row);
    }

    if (moved.length === 0) {
      Logger.log('moveColdLeads: nothing to move.');
      return;
    }

    var blocks = moved.map(function(r) {
      return [
        'Name:           ' + [r[COLS.FIRST_NAME], r[COLS.LAST_NAME]].filter(Boolean).join(' '),
        'Role:           ' + r[COLS.CATEGORY],
        'Email:          ' + r[COLS.EMAIL],
        'Date Submitted: ' + r[COLS.DATE_SUBMITTED],
      ].join('\n');
    });

    GmailApp.sendEmail(
      CONFIG.NOTIFY_EMAILS.join(','),
      'AxisPoint — Leads moved to cold this week',
      [
        moved.length + ' lead' + (moved.length > 1 ? 's were' : ' was') + ' moved to Cold.',
        '',
        blocks.join('\n\n───────────────────────────\n\n'),
        '',
        'Update their status in the Sheet to move them back to Active at any time.',
        '',
        'Sheet: https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID,
      ].join('\n'),
      { name: CONFIG.SENDER_NAME }
    );

    Logger.log('moveColdLeads: moved ' + moved.length + ' lead(s).');
  } catch (err) {
    Logger.log('moveColdLeads error: ' + err);
  }
}

function setCategoryTabStatus(row, newStatus) {
  var tabName = categoryTabForRole(row[COLS.ROLE]);
  if (!tabName) return;
  var sheet = tab(tabName);
  if (!sheet) return;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][COLS.EMAIL] === row[COLS.EMAIL]) {
      sheet.getRange(i + 1, COLS.STATUS + 1).setValue(newStatus);
      break;
    }
  }
}

function moveContactToCold(email) {
  if (!email) return;
  var contacts = ContactsApp.getContactsByEmailAddress(email);
  if (!contacts || !contacts.length) return;
  var contact = contacts[0];
  var leadsGroup = ContactsApp.getContactGroup(CONFIG.CONTACT_GROUPS.LEADS);
  if (leadsGroup) {
    try { contact.removeFromGroup(leadsGroup); } catch (e) {}
  }
  contact.addToGroup(ensureContactGroup(CONFIG.CONTACT_GROUPS.COLD));
}


/* ════════════════════════════════════════════════════════════
   JOB 4 — SHEET EDIT SYNC  (installable onEdit trigger)
   Watches the Status and Category columns.
   Moves rows between tabs and updates Google Contact groups.
   ════════════════════════════════════════════════════════════ */

function onSheetEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet     = e.range.getSheet();
    var sheetName = sheet.getName();
    var col       = e.range.getColumn();  // 1-indexed
    var row       = e.range.getRow();
    if (row <= 1) return;

    var statusCol   = COLS.STATUS   + 1;  // convert to 1-indexed
    var categoryCol = COLS.CATEGORY + 1;
    if (col !== statusCol && col !== categoryCol) return;

    var newValue = String(e.range.getValue());
    var rowData  = sheet.getRange(row, 1, 1, LEAD_HEADERS.length).getValues()[0];

    if (col === statusCol)   { handleStatusEdit(sheetName, row, rowData, newValue); }
    else                     { handleCategoryEdit(rowData, newValue); }
  } catch (err) {
    Logger.log('onSheetEdit error: ' + err);
  }
}

function handleStatusEdit(sheetName, rowNum, rowData, newStatus) {
  var email = rowData[COLS.EMAIL];

  switch (newStatus) {

    case 'Cold':
      // Move from Active Leads → Cold Leads
      if (sheetName === CONFIG.TABS.ACTIVE_LEADS) {
        rowData[COLS.STATUS] = 'Cold';
        appendRow(CONFIG.TABS.COLD_LEADS, rowData);
        tab(CONFIG.TABS.ACTIVE_LEADS).deleteRow(rowNum);
        try { moveContactToCold(email); } catch (e) {}
      }
      break;

    case 'Client':
      // Add copy to Clients tab and update contact label
      appendRow(CONFIG.TABS.CLIENTS, rowData);
      try {
        var contacts = ContactsApp.getContactsByEmailAddress(email);
        if (contacts && contacts.length) {
          contacts[0].addToGroup(ensureContactGroup(CONFIG.CONTACT_GROUPS.CLIENTS));
        }
      } catch (e) { Logger.log('Client contact label error: ' + e); }
      break;

    case 'Archive':
      // Move from Active Leads → Archive
      if (sheetName === CONFIG.TABS.ACTIVE_LEADS) {
        appendRow(CONFIG.TABS.ARCHIVE, rowData);
        tab(CONFIG.TABS.ACTIVE_LEADS).deleteRow(rowNum);
      }
      break;

    case 'New Lead':
    case 'Active':
    case 'Contacted':
      // Reactivate a cold lead — move from Cold → Active Leads
      if (sheetName === CONFIG.TABS.COLD_LEADS) {
        rowData[COLS.STATUS] = newStatus;
        appendRow(CONFIG.TABS.ACTIVE_LEADS, rowData);
        tab(CONFIG.TABS.COLD_LEADS).deleteRow(rowNum);
      }
      break;
  }
}

function handleCategoryEdit(rowData, newCategory) {
  var email = rowData[COLS.EMAIL];
  try {
    var contacts = ContactsApp.getContactsByEmailAddress(email);
    if (!contacts || !contacts.length) return;
    var contact = contacts[0];

    // Remove from all category groups before re-assigning
    var categoryGroups = [
      CONFIG.CONTACT_GROUPS.INVESTORS,
      CONFIG.CONTACT_GROUPS.REFERRAL_PARTNERS,
      CONFIG.CONTACT_GROUPS.RE_PROFESSIONALS,
      CONFIG.CONTACT_GROUPS.CLIENTS,
    ];
    categoryGroups.forEach(function(gName) {
      try {
        var g = ContactsApp.getContactGroup(gName);
        if (g) contact.removeFromGroup(g);
      } catch (e) {}
    });

    // Add to the new category group
    var newGroup = contactGroupForCategory(newCategory);
    if (newGroup) contact.addToGroup(ensureContactGroup(newGroup));
  } catch (err) {
    Logger.log('handleCategoryEdit error: ' + err);
  }
}

function contactGroupForCategory(category) {
  return {
    'Investor':         CONFIG.CONTACT_GROUPS.INVESTORS,
    'Referral Partner': CONFIG.CONTACT_GROUPS.REFERRAL_PARTNERS,
    'RE Professional':  CONFIG.CONTACT_GROUPS.RE_PROFESSIONALS,
    'Client':           CONFIG.CONTACT_GROUPS.CLIENTS,
  }[category] || null;
}


/* ════════════════════════════════════════════════════════════
   JOB 5 — SUBSCRIBE HANDLER
   POST { type:'subscribe', email, firstName, preferences }
   ════════════════════════════════════════════════════════════ */

function handleSubscribe(payload) {
  try {
    var email       = String(payload.email || '').toLowerCase().trim();
    var firstName   = String(payload.firstName || '').trim();
    var preferences = payload.preferences || [];

    if (!email) return jsonResponse({ success: false, error: 'Email is required.' });

    var sheet = tab(CONFIG.TABS.SUBSCRIBERS);
    if (!sheet) return jsonResponse({ success: false, error: 'Subscribers tab not found.' });

    // Duplicate check
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][SCOLS.EMAIL] || '').toLowerCase().trim() === email) {
        return jsonResponse({ success: true, alreadySubscribed: true });
      }
    }

    // New subscriber
    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    sheet.appendRow([email, firstName, today, preferences.join(', '), true, '']);

    // Welcome email
    try { sendWelcomeEmail(email, firstName, preferences); }
    catch (e) { Logger.log('Welcome email failed: ' + e); }

    return jsonResponse({ success: true, alreadySubscribed: false });
  } catch (err) {
    Logger.log('handleSubscribe error: ' + err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function sendWelcomeEmail(email, firstName, preferences) {
  var name    = firstName || 'there';
  var prefStr = preferences.length
    ? 'You signed up to receive:\n' + preferences.map(function(p) { return '  • ' + p; }).join('\n')
    : 'You are now subscribed to updates from AxisPoint Partners.';

  GmailApp.sendEmail(
    email,
    'You are on the list — AxisPoint Partners',
    [
      'Hi ' + name + ',',
      '',
      'You are on the list.',
      '',
      prefStr,
      '',
      'We only send what we said we would.',
      'You can unsubscribe at any time by replying "unsubscribe" to any email.',
      '',
      'Best,',
      'Zachary and Ethaniel',
      'AxisPoint Partners',
      'axispoint.llc',
    ].join('\n'),
    { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL }
  );
}


/* ════════════════════════════════════════════════════════════
   JOB 6 — PUBLISH NOTIFICATION
   Called manually from the custom Sheets menu.
   Emails every active subscriber with article details.
   ════════════════════════════════════════════════════════════ */

function notifySubscribers(title, excerpt, url) {
  var sheet = tab(CONFIG.TABS.SUBSCRIBERS);
  if (!sheet) throw new Error('Subscribers tab not found.');

  var rows  = sheet.getDataRange().getValues();
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
  var sent  = 0;

  for (var i = 1; i < rows.length; i++) {
    var active = rows[i][SCOLS.ACTIVE];
    if (!active || String(active).toLowerCase() === 'false') continue;

    var email     = String(rows[i][SCOLS.EMAIL] || '').trim();
    var firstName = String(rows[i][SCOLS.FIRST_NAME] || '').trim();
    if (!email) continue;

    var unsubUrl = CONFIG.SCRIPT_URL + '?unsubscribe=' + encodeURIComponent(email);

    try {
      GmailApp.sendEmail(
        email,
        'New from AxisPoint — ' + title,
        [
          firstName ? 'Hi ' + firstName + ',' : 'Hi,',
          '',
          title,
          '',
          excerpt || '',
          '',
          'Read it here: ' + url,
          '',
          '— Zachary and Ethaniel',
          'AxisPoint Partners',
          'axispoint.llc',
          '',
          '─────────────────────────────────────────',
          'You are receiving this because you subscribed to AxisPoint updates.',
          'Unsubscribe: ' + unsubUrl,
        ].join('\n'),
        { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL }
      );
      sheet.getRange(i + 1, SCOLS.LAST_EMAILED + 1).setValue(today);
      sent++;
    } catch (emailErr) {
      Logger.log('notifySubscribers: failed for ' + email + ': ' + emailErr);
    }
  }

  Logger.log('notifySubscribers: sent to ' + sent + ' subscriber(s).');
  return sent;
}


/* ════════════════════════════════════════════════════════════
   JOB 7 — UNSUBSCRIBE HANDLER  (doGet ?unsubscribe=email)
   ════════════════════════════════════════════════════════════ */

function handleUnsubscribe(rawEmail) {
  try {
    var email  = decodeURIComponent(rawEmail).toLowerCase().trim();
    var sheet  = tab(CONFIG.TABS.SUBSCRIBERS);
    var found  = false;

    if (sheet) {
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][SCOLS.EMAIL] || '').toLowerCase().trim() === email) {
          sheet.getRange(i + 1, SCOLS.ACTIVE + 1).setValue(false);
          found = true;
          try {
            GmailApp.sendEmail(
              email,
              'You have been unsubscribed — AxisPoint Partners',
              [
                'Hi,',
                '',
                'You have been successfully unsubscribed from AxisPoint Partners updates.',
                '',
                'You will not receive any further emails from us.',
                '',
                'To resubscribe at any time, visit axispoint.llc/learn.',
                '',
                'Best,',
                'Zachary and Ethaniel',
                'AxisPoint Partners',
              ].join('\n'),
              { name: CONFIG.SENDER_NAME }
            );
          } catch (e) {}
          break;
        }
      }
    }

    var msg = found
      ? 'You have been unsubscribed. You will no longer receive emails from AxisPoint Partners.'
      : 'That email address was not found in our subscriber list.';

    return htmlPage(
      '<h2>AxisPoint Partners</h2>' +
      '<p>' + msg + '</p>' +
      '<p><a href="https://axispoint.llc">Return to axispoint.llc</a></p>'
    );
  } catch (err) {
    Logger.log('handleUnsubscribe error: ' + err);
    return htmlPage('<p>An error occurred. Reply to any email to unsubscribe manually.</p>');
  }
}


/* ════════════════════════════════════════════════════════════
   GOOGLE CONTACTS
   ════════════════════════════════════════════════════════════ */

function createContact(payload) {
  var p = payload.person || {};
  var q = payload.qualData || {};
  var b = payload.booking || null;

  var contact = ContactsApp.createContact(
    p.firstName || '',
    p.lastName  || '',
    p.email     || ''
  );

  if (p.phone)   contact.addPhone(ContactsApp.Field.WORK_PHONE, p.phone);
  if (p.company) contact.addOrganization(ContactsApp.Field.WORK, p.company, '', '', '', true);

  contact.setNotes([
    'Source:      ' + (payload.source || payload.page || ''),
    'Role:        ' + (payload.role || ''),
    'Category:    ' + roleToCategory(payload.role),
    'Asset Class: ' + assetClassFromQualData(q),
    'Preferences: ' + (payload.preferences || []).join(', '),
    b && b.date
      ? 'Booking:     ' + b.date + ' at ' + (b.slot || b.time || '') +
        (b.meetType ? ' (' + b.meetType + ')' : '')
      : null,
    'Submitted:   ' + (payload.timestamp || new Date().toISOString()),
  ].filter(Boolean).join('\n'));

  // All new form submissions → AxisPoint Leads
  contact.addToGroup(ensureContactGroup(CONFIG.CONTACT_GROUPS.LEADS));

  // Category-specific group
  var catGroupName = contactGroupForCategory(roleToCategory(payload.role));
  if (catGroupName) {
    contact.addToGroup(ensureContactGroup(catGroupName));
  }
}

function ensureContactGroup(name) {
  var group = ContactsApp.getContactGroup(name);
  return group || ContactsApp.createContactGroup(name);
}


/* ════════════════════════════════════════════════════════════
   GOOGLE CALENDAR
   ════════════════════════════════════════════════════════════ */

function createBookingEvent(payload) {
  var p = payload.person   || {};
  var b = payload.booking;
  var q = payload.qualData || {};

  var start = parseBookingDateTime(b.date, b.slot || b.time || '');
  if (!start) {
    Logger.log('createBookingEvent: unable to parse "' + b.date + ' ' + (b.slot || b.time) + '"');
    return;
  }
  var end = new Date(start.getTime() + 30 * 60 * 1000);

  var title = 'Intro Call — ' + [p.firstName, p.lastName].filter(Boolean).join(' ');

  var desc = [
    'Role:        ' + roleToCategory(payload.role),
    'Asset Class: ' + assetClassFromQualData(q),
    'Email:       ' + (p.email || ''),
    'Phone:       ' + (p.phone || ''),
    b.meetType === 'phone' && b.phone ? 'Call them at: ' + b.phone : '',
    payload.message ? '\nMessage:\n' + payload.message : '',
    'Source:      ' + (payload.source || payload.page || ''),
  ].filter(Boolean).join('\n');

  CalendarApp.getDefaultCalendar().createEvent(title, start, end, {
    description: desc,
    guests:      CONFIG.NOTIFY_EMAILS.join(','),
    sendInvites: true,
  });
}

function parseBookingDateTime(dateStr, timeStr) {
  try {
    var d = new Date(dateStr + ' ' + timeStr);
    return isNaN(d) ? null : d;
  } catch (e) {
    return null;
  }
}


/* ════════════════════════════════════════════════════════════
   CUSTOM SHEETS MENU  (runs automatically when Sheet opens)
   ════════════════════════════════════════════════════════════ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AxisPoint')
    .addItem('📣  Send publish notification',  'openPublishDialog')
    .addSeparator()
    .addItem('❄️  Run cold lead check now',    'moveColdLeads')
    .addItem('📬  Send daily digest now',       'sendDailyDigest')
    .addToUi();
}

function openPublishDialog() {
  var ui = SpreadsheetApp.getUi();

  var r1 = ui.prompt('Publish (1/3)', 'Article title:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var title = r1.getResponseText().trim();
  if (!title) { ui.alert('Title is required.'); return; }

  var r2 = ui.prompt('Publish (2/3)', 'Excerpt (1–2 sentences shown in the email):', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var excerpt = r2.getResponseText().trim();

  var r3 = ui.prompt('Publish (3/3)', 'Full article URL:', ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;
  var url = r3.getResponseText().trim();
  if (!url) { ui.alert('URL is required.'); return; }

  try {
    var count = notifySubscribers(title, excerpt, url);
    ui.alert('Sent to ' + count + ' subscriber(s).');
  } catch (err) {
    ui.alert('Error: ' + err.toString());
  }
}


/* ════════════════════════════════════════════════════════════
   SETUP — run once after pasting this file
   ════════════════════════════════════════════════════════════ */

/**
 * Creates all 10 tabs with correct headers and colour-coded header rows.
 * Safe to re-run — only adds a tab / header row if missing.
 */
function setupSpreadsheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // Tabs that share the standard lead column set
  var leadTabs = [
    { name: CONFIG.TABS.ACTIVE_LEADS,      color: '#24A5BC' },
    { name: CONFIG.TABS.LIFETIME_LEADS,    color: '#38285D' },
    { name: CONFIG.TABS.COLD_LEADS,        color: '#5A5270' },
    { name: CONFIG.TABS.INVESTORS,         color: '#24A5BC' },
    { name: CONFIG.TABS.REFERRAL_PARTNERS, color: '#38285D' },
    { name: CONFIG.TABS.RE_PROFESSIONALS,  color: '#9F328C' },
    { name: CONFIG.TABS.CURIOUS,           color: '#5A5270' },
    { name: CONFIG.TABS.CLIENTS,           color: '#1A8799' },
    { name: CONFIG.TABS.ARCHIVE,           color: '#9490A8' },
  ];

  leadTabs.forEach(function(cfg) {
    var sheet = ss.getSheetByName(cfg.name) || ss.insertSheet(cfg.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(LEAD_HEADERS);
      sheet.getRange(1, 1, 1, LEAD_HEADERS.length)
        .setFontWeight('bold')
        .setBackground(cfg.color)
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });

  // Subscribers tab (different column set)
  var subSheet = ss.getSheetByName(CONFIG.TABS.SUBSCRIBERS) || ss.insertSheet(CONFIG.TABS.SUBSCRIBERS);
  if (subSheet.getLastRow() === 0) {
    subSheet.appendRow(SUBSCRIBER_HEADERS);
    subSheet.getRange(1, 1, 1, SUBSCRIBER_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#9F328C')
      .setFontColor('#FFFFFF');
    subSheet.setFrozenRows(1);
  }

  Logger.log('setupSpreadsheet: all 10 tabs ready.');
}

/**
 * Creates all automated triggers.
 * Deletes existing project triggers first to prevent duplicates.
 * Run once after deploying the web app.
 */
function setupTriggers() {
  // Clear existing to prevent duplicates on re-run
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // Daily digest — 6 pm CT  (project timezone must be America/Chicago)
  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();

  // Cold lead sweep — every Monday at 8 am CT
  ScriptApp.newTrigger('moveColdLeads')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  // Installable onEdit trigger for Status/Category sync
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID))
    .onEdit()
    .create();

  Logger.log('setupTriggers: daily digest, Monday cold sweep, and onEdit trigger created.');
}


/* ════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ════════════════════════════════════════════════════════════ */

function tab(name) {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
}

function appendRow(tabName, row) {
  var sheet = tab(tabName);
  if (!sheet) { Logger.log('appendRow: tab not found — ' + tabName); return; }
  sheet.appendRow(row);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlPage(bodyHtml) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>AxisPoint Partners</title>' +
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'max-width:500px;margin:80px auto;padding:0 24px;color:#1C1628;line-height:1.65}' +
    'h2{margin-bottom:6px}a{color:#24A5BC;text-decoration:none}' +
    'a:hover{text-decoration:underline}</style></head>' +
    '<body>' + bodyHtml + '</body></html>'
  );
}
