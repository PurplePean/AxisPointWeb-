// AxisPoint Partners — Contact Form Backend
// Google Apps Script Web App
// Deploy as: Execute as "Me", Who has access: "Anyone"

var CONFIG = {
  SHEET_ID: 'REPLACE_WITH_GOOGLE_SHEET_ID',
  NOTIFY_EMAILS: ['zach@axispoint.llc', 'ethaniel@axispoint.llc'],
  FROM_NAME: 'AxisPoint Contact Form',
  SHEET_NAMES: {
    web: 'Web Submissions',
    qr: 'QR Submissions',
  },
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var source = payload.page === 'qr.axispoint.llc' ? 'qr' : 'web';

    logToSheet(payload, source);
    sendNotification(payload, source);

    return jsonResponse({ ok: true });
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

// Preflight — browsers send OPTIONS before cross-origin POST
function doGet(e) {
  return jsonResponse({ ok: true, service: 'AxisPoint Contact API' });
}

// ---------------------------------------------------------------------------
// Sheet logging
// ---------------------------------------------------------------------------

function logToSheet(payload, source) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheetName = CONFIG.SHEET_NAMES[source] || 'Submissions';
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  // Write header row if the sheet is brand new
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(getHeaderRow());
    sheet.getRange(1, 1, 1, getHeaderRow().length)
      .setFontWeight('bold')
      .setBackground('#38285D')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow(buildDataRow(payload));
}

function getHeaderRow() {
  return [
    'Timestamp',
    'Page',
    'Role',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Company',
    'Message',
    'Source',
    'Asset Classes',
    'Deal Sizes',
    'Markets',
    'Timeline',
    'Preferences',
    'Booking Date',
    'Booking Slot',
    'Meet Type',
    'Booking Phone',
    'Referred Name',
    'Referred Email',
    'Referred Phone',
    'Referred Notes',
    'Raw JSON',
  ];
}

function buildDataRow(p) {
  var person = p.person || {};
  var booking = p.booking || {};
  var qual = p.qualData || {};
  var referred = p.referred || {};

  return [
    p.timestamp || new Date().toISOString(),
    p.page || '',
    p.role || '',
    person.firstName || '',
    person.lastName || '',
    person.email || '',
    person.phone || '',
    person.company || '',
    p.message || '',
    p.source || '',
    arrJoin(qual.assetClasses),
    arrJoin(qual.dealSizes),
    arrJoin(qual.markets),
    qual.timeline || '',
    arrJoin(p.preferences),
    booking.date || '',
    booking.slot || '',
    booking.meetType || '',
    booking.phone || '',
    referred.name || '',
    referred.email || '',
    referred.phone || '',
    referred.notes || '',
    JSON.stringify(p),
  ];
}

// ---------------------------------------------------------------------------
// Email notification
// ---------------------------------------------------------------------------

function sendNotification(payload, source) {
  var person = payload.person || {};
  var booking = payload.booking || {};
  var qual = payload.qualData || {};

  var fullName = [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Unknown';
  var roleLabel = {
    investor: 'Investor',
    referral: 'Referral Partner',
    pro: 'CRE Professional',
    curious: 'Just Curious',
    refer: 'Referral (Someone Else)',
  }[payload.role] || payload.role;

  var subject = '[AxisPoint] New ' + roleLabel + ' inquiry — ' + fullName;

  var body = buildEmailBody(payload, source, fullName, roleLabel);

  CONFIG.NOTIFY_EMAILS.forEach(function (email) {
    GmailApp.sendEmail(email, subject, body, {
      name: CONFIG.FROM_NAME,
      htmlBody: body,
    });
  });
}

function buildEmailBody(p, source, fullName, roleLabel) {
  var person = p.person || {};
  var booking = p.booking || {};
  var qual = p.qualData || {};
  var referred = p.referred || {};

  var rows = [];

  rows.push(section('Contact'));
  rows.push(row('Name', fullName));
  rows.push(row('Email', person.email ? link('mailto:' + person.email, person.email) : '—'));
  rows.push(row('Phone', person.phone || '—'));
  rows.push(row('Company', person.company || '—'));

  rows.push(section('Inquiry'));
  rows.push(row('Role', roleLabel));
  rows.push(row('Source', p.source || '—'));
  if (p.message) rows.push(row('Message', nl2br(escHtml(p.message))));

  if (qual.assetClasses && qual.assetClasses.length) {
    rows.push(section('Qualifications'));
    rows.push(row('Asset classes', arrJoin(qual.assetClasses)));
    if (qual.dealSizes && qual.dealSizes.length) rows.push(row('Deal sizes', arrJoin(qual.dealSizes)));
    if (qual.markets && qual.markets.length) rows.push(row('Markets', arrJoin(qual.markets)));
    if (qual.timeline) rows.push(row('Timeline', qual.timeline));
  }

  if (p.preferences && p.preferences.length) {
    rows.push(section('Preferences'));
    rows.push(row('Selected', arrJoin(p.preferences)));
  }

  if (booking.date) {
    rows.push(section('Booking'));
    rows.push(row('Date', booking.date));
    rows.push(row('Time', booking.slot || '—'));
    rows.push(row('Meet via', booking.meetType === 'meet' ? 'Google Meet' : 'Phone call'));
    if (booking.phone) rows.push(row('Call-back number', booking.phone));
  }

  if (referred.name || referred.email) {
    rows.push(section('Referral Details'));
    rows.push(row('Referred person', referred.name || '—'));
    rows.push(row('Email', referred.email ? link('mailto:' + referred.email, referred.email) : '—'));
    rows.push(row('Phone', referred.phone || '—'));
    if (referred.notes) rows.push(row('Notes', nl2br(escHtml(referred.notes))));
  }

  rows.push(section('Meta'));
  rows.push(row('Page', p.page || source));
  rows.push(row('Submitted', p.timestamp || 'unknown'));

  return [
    '<div style="font-family:\'Figtree\',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1C1628">',
    '<div style="background:#38285D;padding:24px 32px;border-radius:8px 8px 0 0">',
    '<span style="color:#fff;font-size:18px;font-weight:600">AxisPoint Partners</span>',
    '<span style="color:#9490A8;font-size:13px;margin-left:12px">New inquiry</span>',
    '</div>',
    '<div style="background:#fff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #E8E4F0;border-top:none">',
    rows.join(''),
    '</div>',
    '</div>',
  ].join('');
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function section(label) {
  return '<h3 style="color:#38285D;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:24px 0 8px;border-bottom:1px solid #E8E4F0;padding-bottom:6px">'
    + escHtml(label) + '</h3>';
}

function row(label, value) {
  return '<div style="display:flex;gap:12px;margin:6px 0;font-size:14px">'
    + '<span style="color:#5A5270;min-width:140px;flex-shrink:0">' + escHtml(label) + '</span>'
    + '<span style="color:#1C1628">' + value + '</span>'
    + '</div>';
}

function link(href, text) {
  return '<a href="' + href + '" style="color:#24A5BC;text-decoration:none">' + escHtml(text) + '</a>';
}

function nl2br(s) {
  return s.replace(/\n/g, '<br>');
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function arrJoin(arr) {
  if (!arr || !arr.length) return '—';
  return arr.map(function (v) { return escHtml(String(v)); }).join(', ');
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
