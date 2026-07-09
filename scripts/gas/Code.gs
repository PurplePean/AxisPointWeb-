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
 *   • You will store it via setProperties() in STEP 4 (not in this file).
 *
 * STEP 2 — Create the Apps Script project
 *   • Go to script.google.com → New project.
 *   • Name it "AxisPoint CRM Backend".
 *   • Delete any starter code, paste this entire file.
 *
 * STEP 3 — Set the project timezone
 *   • Project Settings (gear icon) → Time zone → America/Chicago.
 *
 * STEP 4 — Set Script Properties
 *   • Select setProperties() and click Run once.
 *   • This stores credentials that persist across all future deployments.
 *     Never needs to be run again unless credentials change.
 *
 * STEP 5 — Create all sheet tabs
 *   • In the function dropdown select "setupSpreadsheet" → Run.
 *   • Grant all permissions when prompted.
 *
 * STEP 6 — Deploy as a Web App
 *   • Deploy → New deployment → Type: Web App.
 *   • Execute as: Me.
 *   • Who has access: Anyone (anonymous — required for the contact form).
 *   • Click Deploy. Copy the /exec URL.
 *   • Store it as SCRIPT_URL via setProperties() (update the value if it changed).
 *   • Also set VITE_FORM_ENDPOINT in GitHub Secrets to this URL.
 *
 * STEP 7 — Create automated triggers
 *   • In the function dropdown select "setupTriggers" → Run.
 *
 * REQUIRED GOOGLE PERMISSIONS
 *   • Google Sheets     — read / write the CRM spreadsheet
 *   • Gmail             — send email as you
 *   • Google Calendar   — create events on your default calendar
 *   • Google Contacts   — create contacts, manage contact groups
 *   • Script triggers   — create time-based and installable triggers
 *   • Script Properties — persist lead ID sequence across executions
 *
 * ════════════════════════════════════════════════════════════════════════════
 */


/* ────────────────────────────────────────────────────────────
   CONFIG
   ──────────────────────────────────────────────────────────── */

/**
 * Reads a value from Apps Script Script Properties.
 * SPREADSHEET_ID and SCRIPT_URL live here (set once via setProperties())
 * so they are never hardcoded in this file and survive every redeploy.
 */
function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

var CONFIG = {
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
    ASSET_OWNER:       'Existing Asset Owners',
    CLIENTS:           'Clients',
    SUBSCRIBERS:       'Subscribers',
    ARCHIVE:           'Archive',
    REFERRALS:         'Referrals',
  },

  CONTACT_GROUPS: {
    LEADS:             'AxisPoint Leads',
    INVESTORS:         'AxisPoint Investors',
    REFERRAL_PARTNERS: 'AxisPoint Referral Partners',
    RE_PROFESSIONALS:  'AxisPoint RE Professionals',
    CLIENTS:           'AxisPoint Clients',
    COLD:              'AxisPoint Cold',
  },

  // Days a lead can sit Active before moveColdLeads() sweeps it to Cold.
  // Centralized here so a future dashboard control can adjust it in one place.
  COLD_LEAD_DAYS: 60,

  // Calendar ID of the dedicated shared "AxisPoint Bookings" calendar that ALL
  // booking events (Google Meet and phone) are written to — never the deploying
  // account's personal default calendar. The actual ID lives in Script Properties
  // (set once via setProperties(), the same survives-redeploys pattern as
  // SPREADSHEET_ID / SCRIPT_URL) and is read here so it is never hardcoded in a
  // function body. createBookingEvent() and the availability endpoint both
  // reference this one value, so bookings and free/busy checks can never diverge.
  get BOOKING_CALENDAR_ID() { return getProp('BOOKING_CALENDAR_ID'); },
};

// Fixed intro-call time slots offered on the booking calendar (all Central Time).
// MUST stay in sync with SLOTS in packages/brand/src/components/form/utils.ts —
// the frontend renders these labels and the availability endpoint keys its
// free/busy response by them. Editing one copy without the other silently breaks
// the availability cross-reference.
var BOOKING_SLOTS = [
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
];


/* ────────────────────────────────────────────────────────────
   EMAIL LOGO  (CID inline image)
   Embedded as base64 so the AxisPoint mark renders in every email
   client with no external hotlink. Referenced in templates as
   <img src="cid:logo"> and passed via the inlineImages option.
   ──────────────────────────────────────────────────────────── */
var LOGO_BASE64 = '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';
var LOGO_BLOB = Utilities.newBlob(Utilities.base64Decode(LOGO_BASE64), 'image/png', 'logo.png');


/* ════════════════════════════════════════════════════════════
   EMAIL TEMPLATES
   HTML mirrors scripts/gas/emails/*.html. Apps Script cannot read
   local files, so each template is embedded here as a const string.
   Dynamic values use {{placeholder}} syntax, filled by renderTemplate().
   ════════════════════════════════════════════════════════════ */

var TEMPLATE_VISITOR_PHONE = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><meta charset="utf-8"></head>',
  '<body style="margin:0;padding:0;background:#F7F5FB;font-family:Arial,Helvetica,sans-serif;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr><td align="center" style="padding:32px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;">',
  '',
  '<!-- HEADER -->',
  '<tr><td style="background:#F7F5FB;padding:18px 28px;border-bottom:1px solid #E8E4F0;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td>',
  '<img src="cid:logo" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
  '</td>',
  '<td align="right"><div style="width:2px;height:32px;background:linear-gradient(to bottom,#24A5BC,#9F328C);border-radius:2px;display:inline-block;"></div></td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- BODY -->',
  '<tr><td style="padding:28px 28px 24px;">',
  '',
  '<p style="font-size:15px;color:#1C1628;margin:0 0 6px;">Hi {{firstName}},</p>',
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">Thanks for reaching out. Your call is set. We will review your details ahead of time and come ready to talk specifics about your situation.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
  '',
  '{{personalNote}}',
  '',
  '<!-- BOOKING BLOCK -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;margin:0 0 20px;">',
  '<tr><td colspan="2" style="background:#38285D;padding:8px 14px;">',
  '<span style="font-size:10px;font-weight:500;color:#C9C4D6;letter-spacing:0.1em;text-transform:uppercase;">Scheduled call</span>',
  '</td></tr>',
  '<tr>',
  '<td width="100" style="background:#F7F5FB;padding:14px 18px;text-align:center;border-right:1px solid #E8E4F0;vertical-align:middle;">',
  '<p style="font-size:10px;font-weight:500;color:#9490A8;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 3px;">{{bookingMonth}}</p>',
  '<p style="font-size:30px;font-weight:500;color:#38285D;line-height:1;margin:0 0 3px;">{{bookingDay}}</p>',
  '<p style="font-size:10px;color:#9490A8;margin:0;">{{bookingDayOfWeek}}</p>',
  '</td>',
  '<td style="padding:14px 18px;vertical-align:middle;">',
  '<p style="font-size:17px;font-weight:500;color:#1C1628;margin:0 0 3px;white-space:nowrap;">{{bookingTime}} CT</p>',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 10px;white-space:nowrap;">30 minutes &nbsp;·&nbsp; Phone call</p>',
  '<span style="display:inline-block;background:#E8F7FA;border:1px solid #B8E6EF;border-radius:5px;padding:4px 10px;font-size:11px;color:#1A8799;font-weight:500;">We will call you at {{bookingPhone}}</span>',
  '</td>',
  '</tr>',
  '</table>',
  '',
  '<!-- REFERRAL BLOCK -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border-left:3px solid #24A5BC;border-radius:0 6px 6px 0;margin:0 0 22px;">',
  '<tr><td style="padding:12px 16px;">',
  '<p style="font-size:11px;color:#5A5270;margin:0 0 6px;">Know someone who should talk to us?</p>',
  '<p style="font-size:15px;font-weight:500;color:#1C1628;margin:0 0 3px;letter-spacing:0.03em;">{{referralCode}}</p>',
  '<p style="font-size:11px;color:#5A5270;margin:0;">Share this link and we will make sure you get credit: <a href="{{referralLink}}" style="color:#24A5BC;">{{referralLink}}</a></p>',
  '</td></tr>',
  '</table>',
  '',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 2px;">Best,</p>',
  '<p style="font-size:13px;color:#1C1628;font-weight:500;margin:0;">Zachary Russell and Ethaniel Vu</p>',
  '<p style="font-size:12px;color:#9490A8;margin:0 0 2px;">AxisPoint Partners &nbsp;·&nbsp; axispoint.llc</p>',
  '<p style="font-size:11px;color:#9490A8;font-style:italic;margin:0;">Commercial real estate, done right.</p>',
  '',
  '</td></tr>',
  '',
  '<!-- FOOTER -->',
  '<tr><td style="padding:0 28px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8E4F0;">',
  '<tr><td style="padding-top:12px;">',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; This email was sent because you submitted a contact form at axispoint.llc.</p>',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- COLOR BAR -->',
  '<tr><td>',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td width="33%" height="4" style="background:#24A5BC;font-size:0;">&nbsp;</td>',
  '<td width="33%" height="4" style="background:#9F328C;font-size:0;">&nbsp;</td>',
  '<td width="34%" height="4" style="background:#38285D;font-size:0;">&nbsp;</td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body>',
  '</html>'
].join('\n');

var TEMPLATE_VISITOR_MEET = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><meta charset="utf-8"></head>',
  '<body style="margin:0;padding:0;background:#F7F5FB;font-family:Arial,Helvetica,sans-serif;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr><td align="center" style="padding:32px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;">',
  '',
  '<!-- HEADER -->',
  '<tr><td style="background:#F7F5FB;padding:18px 28px;border-bottom:1px solid #E8E4F0;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td>',
  '<img src="cid:logo" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
  '</td>',
  '<td align="right"><div style="width:2px;height:32px;background:linear-gradient(to bottom,#24A5BC,#9F328C);border-radius:2px;display:inline-block;"></div></td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- BODY -->',
  '<tr><td style="padding:28px 28px 24px;">',
  '',
  '<p style="font-size:15px;color:#1C1628;margin:0 0 6px;">Hi {{firstName}},</p>',
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">Thanks for reaching out. Your call is set. We will review your details ahead of time and come ready to talk specifics about your situation.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
  '',
  '{{personalNote}}',
  '',
  '<!-- BOOKING BLOCK -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;margin:0 0 20px;">',
  '<tr><td colspan="2" style="background:#38285D;padding:8px 14px;">',
  '<span style="font-size:10px;font-weight:500;color:#C9C4D6;letter-spacing:0.1em;text-transform:uppercase;">Scheduled call</span>',
  '</td></tr>',
  '<tr>',
  '<td width="100" style="background:#F7F5FB;padding:14px 18px;text-align:center;border-right:1px solid #E8E4F0;vertical-align:middle;">',
  '<p style="font-size:10px;font-weight:500;color:#9490A8;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 3px;">{{bookingMonth}}</p>',
  '<p style="font-size:30px;font-weight:500;color:#38285D;line-height:1;margin:0 0 3px;">{{bookingDay}}</p>',
  '<p style="font-size:10px;color:#9490A8;margin:0;">{{bookingDayOfWeek}}</p>',
  '</td>',
  '<td style="padding:14px 18px;vertical-align:middle;">',
  '<p style="font-size:17px;font-weight:500;color:#1C1628;margin:0 0 3px;white-space:nowrap;">{{bookingTime}} CT</p>',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 10px;white-space:nowrap;">30 minutes &nbsp;·&nbsp; Google Meet</p>',
  '<a href="{{meetLink}}" style="display:inline-block;background:#E8F7FA;border:1px solid #B8E6EF;border-radius:5px;padding:4px 10px;font-size:11px;color:#1A8799;font-weight:500;text-decoration:none;">Join Google Meet &nbsp;→</a>',
  '</td>',
  '</tr>',
  '</table>',
  '',
  '<!-- REFERRAL BLOCK -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border-left:3px solid #24A5BC;border-radius:0 6px 6px 0;margin:0 0 22px;">',
  '<tr><td style="padding:12px 16px;">',
  '<p style="font-size:11px;color:#5A5270;margin:0 0 6px;">Know someone who should talk to us?</p>',
  '<p style="font-size:15px;font-weight:500;color:#1C1628;margin:0 0 3px;letter-spacing:0.03em;">{{referralCode}}</p>',
  '<p style="font-size:11px;color:#5A5270;margin:0;">Share this link and we will make sure you get credit: <a href="{{referralLink}}" style="color:#24A5BC;">{{referralLink}}</a></p>',
  '</td></tr>',
  '</table>',
  '',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 2px;">Best,</p>',
  '<p style="font-size:13px;color:#1C1628;font-weight:500;margin:0;">Zachary Russell and Ethaniel Vu</p>',
  '<p style="font-size:12px;color:#9490A8;margin:0 0 2px;">AxisPoint Partners &nbsp;·&nbsp; axispoint.llc</p>',
  '<p style="font-size:11px;color:#9490A8;font-style:italic;margin:0;">Commercial real estate, done right.</p>',
  '',
  '</td></tr>',
  '',
  '<!-- FOOTER -->',
  '<tr><td style="padding:0 28px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8E4F0;">',
  '<tr><td style="padding-top:12px;">',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; This email was sent because you submitted a contact form at axispoint.llc.</p>',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- COLOR BAR -->',
  '<tr><td>',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td width="33%" height="4" style="background:#24A5BC;font-size:0;">&nbsp;</td>',
  '<td width="33%" height="4" style="background:#9F328C;font-size:0;">&nbsp;</td>',
  '<td width="34%" height="4" style="background:#38285D;font-size:0;">&nbsp;</td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body>',
  '</html>'
].join('\n');

var TEMPLATE_VISITOR_NO_BOOKING = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><meta charset="utf-8"></head>',
  '<body style="margin:0;padding:0;background:#F7F5FB;font-family:Arial,Helvetica,sans-serif;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr><td align="center" style="padding:32px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;">',
  '',
  '<!-- HEADER -->',
  '<tr><td style="background:#F7F5FB;padding:18px 28px;border-bottom:1px solid #E8E4F0;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td>',
  '<img src="cid:logo" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
  '</td>',
  '<td align="right"><div style="width:2px;height:32px;background:linear-gradient(to bottom,#24A5BC,#9F328C);border-radius:2px;display:inline-block;"></div></td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- BODY -->',
  '<tr><td style="padding:28px 28px 24px;">',
  '',
  '<p style="font-size:15px;color:#1C1628;margin:0 0 6px;">Hi {{firstName}},</p>',
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">Thanks for reaching out. We are reviewing your details now, and one of us will follow up personally within one business day.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
  '',
  '{{personalNote}}',
  '',
  '<!-- BOOKING PROMPT CARD -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;margin:0 0 22px;">',
  '<tr><td style="padding:20px 22px;text-align:center;">',
  '<div style="width:42px;height:42px;border-radius:8px;background:#E8F7FA;display:inline-block;text-align:center;line-height:42px;font-size:20px;margin:0 0 10px;">📅</div>',
  '<p style="font-size:15px;font-weight:500;color:#1C1628;margin:0 0 3px;">Want to schedule a call?</p>',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 14px;">30 minutes. No obligation.</p>',
  '<a href="https://axispoint.llc/contact" style="display:inline-block;background:#24A5BC;color:#ffffff;text-decoration:none;font-size:13px;font-weight:500;padding:10px 22px;border-radius:7px;">Book a call &nbsp;→</a>',
  '</td></tr>',
  '</table>',
  '',
  '<!-- REFERRAL BLOCK -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border-left:3px solid #24A5BC;border-radius:0 6px 6px 0;margin:0 0 22px;">',
  '<tr><td style="padding:12px 16px;">',
  '<p style="font-size:11px;color:#5A5270;margin:0 0 6px;">Know someone who should talk to us?</p>',
  '<p style="font-size:15px;font-weight:500;color:#1C1628;margin:0 0 3px;letter-spacing:0.03em;">{{referralCode}}</p>',
  '<p style="font-size:11px;color:#5A5270;margin:0;">Share this link and we will make sure you get credit: <a href="{{referralLink}}" style="color:#24A5BC;">{{referralLink}}</a></p>',
  '</td></tr>',
  '</table>',
  '',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 2px;">Best,</p>',
  '<p style="font-size:13px;color:#1C1628;font-weight:500;margin:0;">Zachary Russell and Ethaniel Vu</p>',
  '<p style="font-size:12px;color:#9490A8;margin:0 0 2px;">AxisPoint Partners &nbsp;·&nbsp; axispoint.llc</p>',
  '<p style="font-size:11px;color:#9490A8;font-style:italic;margin:0;">Commercial real estate, done right.</p>',
  '',
  '</td></tr>',
  '',
  '<!-- FOOTER -->',
  '<tr><td style="padding:0 28px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8E4F0;">',
  '<tr><td style="padding-top:12px;">',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; This email was sent because you submitted a contact form at axispoint.llc.</p>',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- COLOR BAR -->',
  '<tr><td>',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td width="33%" height="4" style="background:#24A5BC;font-size:0;">&nbsp;</td>',
  '<td width="33%" height="4" style="background:#9F328C;font-size:0;">&nbsp;</td>',
  '<td width="34%" height="4" style="background:#38285D;font-size:0;">&nbsp;</td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body>',
  '</html>'
].join('\n');

var TEMPLATE_REFERRER_NOTIFICATION = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><meta charset="utf-8"></head>',
  '<body style="margin:0;padding:0;background:#F7F5FB;font-family:Arial,Helvetica,sans-serif;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr><td align="center" style="padding:32px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;">',
  '',
  '<!-- HEADER -->',
  '<tr><td style="background:#F7F5FB;padding:18px 28px;border-bottom:1px solid #E8E4F0;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td>',
  '<img src="cid:logo" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
  '</td>',
  '<td align="right"><div style="width:2px;height:32px;background:linear-gradient(to bottom,#24A5BC,#9F328C);border-radius:2px;display:inline-block;"></div></td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- BODY -->',
  '<tr><td style="padding:28px 28px 24px;">',
  '',
  '<p style="font-size:15px;color:#1C1628;margin:0 0 6px;">Hi {{firstName}},</p>',
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">Someone you referred just reached out to us. We will take it from here.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
  '',
  '<!-- REFERRAL RECEIVED CARD -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;margin:0 0 22px;">',
  '<tr><td style="padding:22px;text-align:center;">',
  '<div style="width:48px;height:48px;border-radius:8px;background:#24A5BC;display:inline-block;text-align:center;line-height:48px;font-size:24px;color:#ffffff;margin:0 0 12px;">✓</div>',
  '<p style="font-size:16px;font-weight:500;color:#1C1628;margin:0 0 4px;">Referral received</p>',
  '<p style="font-size:12px;color:#5A5270;line-height:1.6;margin:0;">Thank you for the introduction. We handle it from here.</p>',
  '</td></tr>',
  '</table>',
  '',
  '<!-- REFERRAL LINK BLOCK -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;margin:0 0 22px;">',
  '<tr><td style="background:#38285D;padding:10px 16px;">',
  '<span style="font-size:11px;font-weight:500;color:#ffffff;letter-spacing:0.06em;text-transform:uppercase;">Your referral link</span>',
  '</td></tr>',
  '<tr><td style="padding:16px;">',
  '<p style="font-size:12px;color:#5A5270;line-height:1.6;margin:0 0 12px;">Keep sharing this link. Every time someone uses it we will let you know.</p>',
  '<p style="font-size:13px;color:#24A5BC;word-break:break-all;margin:0 0 16px;"><a href="{{referralLink}}" style="color:#24A5BC;text-decoration:none;">{{referralLink}}</a></p>',
  '<a href="{{sharePageUrl}}" style="display:block;background:#24A5BC;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 0;border-radius:7px;text-align:center;">Share your referral link &nbsp;↑</a>',
  '<p style="font-size:11px;color:#9490A8;text-align:center;margin:8px 0 0;">Opens your phone\'s share sheet</p>',
  '</td></tr>',
  '</table>',
  '',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 2px;">Best,</p>',
  '<p style="font-size:13px;color:#1C1628;font-weight:500;margin:0;">Zachary Russell and Ethaniel Vu</p>',
  '<p style="font-size:12px;color:#9490A8;margin:0 0 2px;">AxisPoint Partners &nbsp;·&nbsp; axispoint.llc</p>',
  '<p style="font-size:11px;color:#9490A8;font-style:italic;margin:0;">Commercial real estate, done right.</p>',
  '',
  '</td></tr>',
  '',
  '<!-- FOOTER -->',
  '<tr><td style="padding:0 28px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8E4F0;">',
  '<tr><td style="padding-top:12px;">',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; You are receiving this because someone used your referral link.</p>',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- COLOR BAR -->',
  '<tr><td>',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td width="33%" height="4" style="background:#24A5BC;font-size:0;">&nbsp;</td>',
  '<td width="33%" height="4" style="background:#9F328C;font-size:0;">&nbsp;</td>',
  '<td width="34%" height="4" style="background:#38285D;font-size:0;">&nbsp;</td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body>',
  '</html>'
].join('\n');

var TEMPLATE_REFERRER_MONTHLY = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><meta charset="utf-8"></head>',
  '<body style="margin:0;padding:0;background:#F7F5FB;font-family:Arial,Helvetica,sans-serif;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr><td align="center" style="padding:32px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;">',
  '',
  '<!-- HEADER -->',
  '<tr><td style="background:#F7F5FB;padding:18px 28px;border-bottom:1px solid #E8E4F0;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td>',
  '<img src="cid:logo" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
  '</td>',
  '<td align="right"><div style="width:2px;height:32px;background:linear-gradient(to bottom,#24A5BC,#9F328C);border-radius:2px;display:inline-block;"></div></td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- BODY -->',
  '<tr><td style="padding:28px 28px 24px;">',
  '',
  '<p style="font-size:15px;color:#1C1628;margin:0 0 6px;">Hi {{firstName}},</p>',
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">Here is a quick look at your referral activity with AxisPoint.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
  '',
  '<!-- STAT CARDS -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">',
  '<tr>',
  '<td width="50%" style="padding-right:6px;vertical-align:top;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#38285D;border-radius:8px;">',
  '<tr><td style="padding:20px 18px;text-align:center;">',
  '<p style="font-size:34px;font-weight:500;color:#ffffff;line-height:1;margin:0 0 6px;">{{totalReferrals}}</p>',
  '<p style="font-size:11px;color:#C9C4D6;letter-spacing:0.05em;text-transform:uppercase;margin:0;">Total referrals</p>',
  '</td></tr>',
  '</table>',
  '</td>',
  '<td width="50%" style="padding-left:6px;vertical-align:top;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#24A5BC;border-radius:8px;">',
  '<tr><td style="padding:20px 18px;text-align:center;">',
  '<p style="font-size:34px;font-weight:500;color:#ffffff;line-height:1;margin:0 0 6px;">{{monthReferrals}}</p>',
  '<p style="font-size:11px;color:#D4EEF3;letter-spacing:0.05em;text-transform:uppercase;margin:0;">This month</p>',
  '</td></tr>',
  '</table>',
  '</td>',
  '</tr>',
  '</table>',
  '',
  '<!-- REFERRAL LINK BLOCK -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;margin:0 0 22px;">',
  '<tr><td style="background:#38285D;padding:10px 16px;">',
  '<span style="font-size:11px;font-weight:500;color:#ffffff;letter-spacing:0.06em;text-transform:uppercase;">Your referral link</span>',
  '</td></tr>',
  '<tr><td style="padding:16px;">',
  '<p style="font-size:12px;color:#5A5270;line-height:1.6;margin:0 0 12px;">Keep sharing this link. Every time someone uses it we will let you know.</p>',
  '<p style="font-size:13px;color:#24A5BC;word-break:break-all;margin:0 0 16px;"><a href="{{referralLink}}" style="color:#24A5BC;text-decoration:none;">{{referralLink}}</a></p>',
  '<a href="{{sharePageUrl}}" style="display:block;background:#24A5BC;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 0;border-radius:7px;text-align:center;">Share your referral link &nbsp;↑</a>',
  '<p style="font-size:11px;color:#9490A8;text-align:center;margin:8px 0 0;">Opens your phone\'s share sheet</p>',
  '</td></tr>',
  '</table>',
  '',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 2px;">Best,</p>',
  '<p style="font-size:13px;color:#1C1628;font-weight:500;margin:0;">Zachary Russell and Ethaniel Vu</p>',
  '<p style="font-size:12px;color:#9490A8;margin:0 0 2px;">AxisPoint Partners &nbsp;·&nbsp; axispoint.llc</p>',
  '<p style="font-size:11px;color:#9490A8;font-style:italic;margin:0;">Commercial real estate, done right.</p>',
  '',
  '</td></tr>',
  '',
  '<!-- FOOTER -->',
  '<tr><td style="padding:0 28px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8E4F0;">',
  '<tr><td style="padding-top:12px;">',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; You are receiving this because you have referred people to AxisPoint Partners.</p>',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- COLOR BAR -->',
  '<tr><td>',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td width="33%" height="4" style="background:#24A5BC;font-size:0;">&nbsp;</td>',
  '<td width="33%" height="4" style="background:#9F328C;font-size:0;">&nbsp;</td>',
  '<td width="34%" height="4" style="background:#38285D;font-size:0;">&nbsp;</td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body>',
  '</html>'
].join('\n');

var TEMPLATE_PARTNER_NOTIFICATION = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><meta charset="utf-8"></head>',
  '<body style="margin:0;padding:0;background:#F7F5FB;font-family:Arial,Helvetica,sans-serif;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr><td align="center" style="padding:32px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;">',
  '',
  '<!-- HEADER -->',
  '<tr><td style="background:#F7F5FB;padding:18px 28px;border-bottom:1px solid #E8E4F0;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td>',
  '<img src="cid:logo" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
  '</td>',
  '<td align="right"><span style="display:inline-block;background:#24A5BC;color:#ffffff;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:5px 12px;border-radius:8px;">New Lead</span></td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- BODY -->',
  '<tr><td style="padding:28px 28px 24px;">',
  '',
  '<!-- LEAD IDENTITY -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">',
  '<tr>',
  '<td width="52" style="vertical-align:middle;">',
  '<div style="width:44px;height:44px;border-radius:8px;background:#38285D;color:#ffffff;text-align:center;line-height:44px;font-size:16px;font-weight:500;">{{initials}}</div>',
  '</td>',
  '<td style="padding-left:14px;vertical-align:middle;">',
  '<p style="font-size:17px;font-weight:500;color:#1C1628;margin:0 0 2px;">{{fullName}}</p>',
  '<p style="font-size:12px;color:#5A5270;margin:0;">{{role}} &nbsp;·&nbsp; via {{source}}</p>',
  '</td>',
  '</tr>',
  '</table>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 18px;"></div>',
  '',
  '<!-- DETAIL TABLE -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">',
  '<tr>',
  '<td width="120" style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Lead ID</td>',
  '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">{{leadId}}</td>',
  '</tr>',
  '<tr>',
  '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Email</td>',
  '<td style="padding:6px 0;font-size:13px;vertical-align:top;"><a href="mailto:{{email}}" style="color:#24A5BC;text-decoration:none;">{{email}}</a></td>',
  '</tr>',
  '<tr>',
  '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Phone</td>',
  '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">{{phone}}</td>',
  '</tr>',
  '<tr>',
  '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Company</td>',
  '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">{{company}}</td>',
  '</tr>',
  '<tr>',
  '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Asset class</td>',
  '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">{{assetClass}}</td>',
  '</tr>',
  '{{capitalRangeRow}}',
  '<tr>',
  '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Source</td>',
  '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">{{source}}</td>',
  '</tr>',
  '{{heardAboutRow}}',
  '{{referredByRow}}',
  '</table>',
  '',
  '{{messageBlock}}',
  '',
  '{{bookingBlock}}',
  '',
  '<a href="{{crmUrl}}" style="display:block;background:#38285D;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 0;border-radius:7px;text-align:center;margin:4px 0 0;">View in AxisPoint CRM &nbsp;→</a>',
  '',
  '</td></tr>',
  '',
  '<!-- FOOTER -->',
  '<tr><td style="padding:0 28px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8E4F0;">',
  '<tr><td style="padding-top:12px;">',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; Internal notification, do not forward.</p>',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- COLOR BAR -->',
  '<tr><td>',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td width="33%" height="4" style="background:#24A5BC;font-size:0;">&nbsp;</td>',
  '<td width="33%" height="4" style="background:#9F328C;font-size:0;">&nbsp;</td>',
  '<td width="34%" height="4" style="background:#38285D;font-size:0;">&nbsp;</td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body>',
  '</html>'
].join('\n');

var TEMPLATE_WELCOME_SUBSCRIBER = [
  '<!DOCTYPE html>',
  '<html>',
  '<head><meta charset="utf-8"></head>',
  '<body style="margin:0;padding:0;background:#F7F5FB;font-family:Arial,Helvetica,sans-serif;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr><td align="center" style="padding:32px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;">',
  '',
  '<!-- HEADER -->',
  '<tr><td style="background:#F7F5FB;padding:18px 28px;border-bottom:1px solid #E8E4F0;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td>',
  '<img src="cid:logo" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
  '</td>',
  '<td align="right"><div style="width:2px;height:32px;background:linear-gradient(to bottom,#24A5BC,#9F328C);border-radius:2px;display:inline-block;"></div></td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- BODY -->',
  '<tr><td style="padding:28px 28px 24px;">',
  '',
  '<p style="font-size:15px;color:#1C1628;margin:0 0 6px;">Hi {{firstName}},</p>',
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">You are on the list. Here is what you signed up for.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
  '',
  '<!-- PREFERENCE LIST -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">',
  '{{preferenceList}}',
  '</table>',
  '',
  '<!-- NOTE BOX -->',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border:1px solid #E8E4F0;border-radius:8px;margin:0 0 22px;">',
  '<tr><td style="padding:14px 16px;">',
  '<p style="font-size:12px;color:#5A5270;line-height:1.6;margin:0;">We only send what we said we would. No noise, no spam. You can unsubscribe at any time by replying to any email.</p>',
  '</td></tr>',
  '</table>',
  '',
  '<a href="https://axispoint.llc/learn" style="display:block;background:#24A5BC;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 0;border-radius:7px;text-align:center;margin:0 0 22px;">Explore our articles &nbsp;→</a>',
  '',
  '<p style="font-size:12px;color:#5A5270;margin:0 0 2px;">Best,</p>',
  '<p style="font-size:13px;color:#1C1628;font-weight:500;margin:0;">Zachary Russell and Ethaniel Vu</p>',
  '<p style="font-size:12px;color:#9490A8;margin:0 0 2px;">AxisPoint Partners &nbsp;·&nbsp; axispoint.llc</p>',
  '<p style="font-size:11px;color:#9490A8;font-style:italic;margin:0;">Commercial real estate, done right.</p>',
  '',
  '</td></tr>',
  '',
  '<!-- FOOTER -->',
  '<tr><td style="padding:0 28px 16px;">',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E8E4F0;">',
  '<tr><td style="padding-top:12px;">',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; You are receiving this because you subscribed at axispoint.llc/learn.<br><a href="{{unsubscribeUrl}}" style="color:#9490A8;text-decoration:underline;">Unsubscribe</a></p>',
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:6px 0 0;text-align:center;">9999 Bellaire Blvd, Ste 999 &nbsp;·&nbsp; Houston, TX 77036</p>',
  '</td></tr>',
  '</table>',
  '</td></tr>',
  '',
  '<!-- COLOR BAR -->',
  '<tr><td>',
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">',
  '<tr>',
  '<td width="33%" height="4" style="background:#24A5BC;font-size:0;">&nbsp;</td>',
  '<td width="33%" height="4" style="background:#9F328C;font-size:0;">&nbsp;</td>',
  '<td width="34%" height="4" style="background:#38285D;font-size:0;">&nbsp;</td>',
  '</tr>',
  '</table>',
  '</td></tr>',
  '',
  '</table>',
  '</td></tr>',
  '</table>',
  '</body>',
  '</html>'
].join('\n');

/**
 * Minimal template engine. Replaces every {{key}} with vars[key].
 * Unfilled placeholders are stripped to '' so partial var sets render clean.
 */
function renderTemplate(template, vars) {
  return String(template).replace(/\{\{(\w+)\}\}/g, function(_, key) {
    var v = vars[key];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

/**
 * Resolves a template name to its embedded const string.
 */
function templateByName(name) {
  return {
    'visitor-phone':         TEMPLATE_VISITOR_PHONE,
    'visitor-meet':          TEMPLATE_VISITOR_MEET,
    'visitor-no-booking':    TEMPLATE_VISITOR_NO_BOOKING,
    'referrer-notification': TEMPLATE_REFERRER_NOTIFICATION,
    'referrer-monthly':      TEMPLATE_REFERRER_MONTHLY,
    'partner-notification':  TEMPLATE_PARTNER_NOTIFICATION,
    'welcome-subscriber':    TEMPLATE_WELCOME_SUBSCRIBER,
  }[name] || '';
}


/* ────────────────────────────────────────────────────────────
   COLUMN DEFINITIONS  (0-based indexes)
   Shared by all lead tabs.
   ──────────────────────────────────────────────────────────── */

var COLS = {
  TIMESTAMP:          0,
  LEAD_ID:            1,
  REFERRAL_CODE:      2,   // person's own shareable code
  FIRST_NAME:         3,
  LAST_NAME:          4,
  EMAIL:              5,
  PHONE:              6,
  COMPANY:            7,
  ROLE:               8,
  CATEGORY:           9,
  ASSET_CLASS:        10,
  MESSAGE:            11,
  PREFERENCES:        12,
  BOOKING_DATE:       13,
  BOOKING_TIME:       14,
  MEET_TYPE:          15,
  BOOKING_PHONE:      16,
  SOURCE:             17,
  STATUS:             18,
  REF_BY_LEAD_ID:     19,
  REF_BY_NAME:        20,
  REF_BY_EMAIL:       21,
  REF_BY_CODE:        22,
  MATCH_TYPE:         23,
  REFERRAL_CHAIN:     24,
  CHAIN_DEPTH:        25,
  DIRECT_REFERRALS:   26,
  TOTAL_DOWNSTREAM:   27,
  LAST_REFERRAL_DATE: 28,
  MEET_LINK:          29,   // Google Meet URL when meetType === 'meet'
  HEARD_ABOUT:        30,   // visitor's own "How did you hear about us?" answer
};

var LEAD_HEADERS = [
  'Timestamp', 'Lead ID', 'Referral Code',
  'First Name', 'Last Name', 'Email', 'Phone',
  'Company', 'Role', 'Category', 'Asset Class', 'Message',
  'Preferences', 'Booking Date', 'Booking Time', 'Meet Type',
  'Booking Phone', 'Source', 'Status',
  'Referred By Lead ID', 'Referred By Name', 'Referred By Email', 'Referred By Code',
  'Match Type', 'Referral Chain', 'Chain Depth',
  'Direct Referrals', 'Total Downstream', 'Last Referral Date', 'Meet Link',
  'Heard About',
];

// The Referral Partners tab carries one extra column beyond LEAD_HEADERS:
// a per-partner toggle for the monthly referral-summary email. 0-based index
// (= first column past the shared lead layout). Blank/TRUE = enabled; only an
// explicit FALSE opts a partner out. Groundwork for a future dashboard control.
var REPORTS_ENABLED_COL = LEAD_HEADERS.length;

// Referrals tab columns
var REFERRAL_HEADERS = [
  'Referral ID', 'Referrer Lead ID', 'Referrer Name', 'Referrer Email', 'Referrer Code',
  'Referred Lead ID', 'Referred Name', 'Referred Email',
  'Match Type', 'Chain Depth', 'Full Chain', 'Date', 'Status',
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
   LEAD ID / REFERRAL CODE GENERATION
   ════════════════════════════════════════════════════════════ */

/**
 * Returns the next sequential number and persists it.
 * Thread-safe via LockService.
 */
function nextLeadSequence() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var last  = parseInt(props.getProperty('LAST_LEAD_ID') || '0', 10);
    var next  = last + 1;
    props.setProperty('LAST_LEAD_ID', String(next));
    return next;
  } finally {
    lock.releaseLock();
  }
}

function buildLeadId(seq) {
  var year   = new Date().getFullYear();
  var padded = String(seq).padStart(4, '0');
  return 'AXP-' + year + '-' + padded;
}

/**
 * Generates a hash-based referral code: AXP-XXXXXX
 * 6 random uppercase alphanumeric chars, ambiguous chars (0,O,1,I) removed.
 * Seeded from leadId + timestamp + Math.random(); collision-checked against
 * the Lifetime Leads sheet, regenerating until unique.
 */
function generateReferralCode(leadId) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no 0, O, 1, I

  function makeCode() {
    var seed = String(leadId || '') + ':' + Date.now() + ':' + Math.random();
    var out  = '';
    for (var i = 0; i < 6; i++) {
      // Mix the seed with the position and a fresh random draw each char.
      var n = Math.floor((Math.random() * 1e9 + seed.charCodeAt(i % seed.length) + i)) % chars.length;
      out += chars.charAt(n);
    }
    return 'AXP-' + out;
  }

  var existing = existingReferralCodes();
  var code;
  var attempts = 0;
  do {
    code = makeCode();
    attempts++;
  } while (existing[code] && attempts < 50);

  return code;
}

/**
 * Returns a lookup map of all referral codes currently in the Lifetime Leads
 * sheet so generateReferralCode can detect collisions.
 */
function existingReferralCodes() {
  var map   = {};
  var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!sheet) return map;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var c = String(data[i][COLS.REFERRAL_CODE] || '').toUpperCase();
    if (c) map[c] = true;
  }
  return map;
}

/**
 * Returns the next Referral tab entry ID.
 */
function nextReferralSequence() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var last  = parseInt(props.getProperty('LAST_REFERRAL_ID') || '0', 10);
    var next  = last + 1;
    props.setProperty('LAST_REFERRAL_ID', String(next));
    return next;
  } finally {
    lock.releaseLock();
  }
}

function buildReferralTabId(seq) {
  var year   = new Date().getFullYear();
  var padded = String(seq).padStart(4, '0');
  return 'REF-' + year + '-' + padded;
}


/* ════════════════════════════════════════════════════════════
   ENTRY POINTS
   ════════════════════════════════════════════════════════════ */

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

function doGet(e) {
  try {
    var params = e.parameter || {};
    if (params.unsubscribe) {
      return handleUnsubscribe(params.unsubscribe);
    }
    if (params.action === 'availability' && params.date) {
      return handleAvailability(params.date);
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
    // Existing Asset Owner submissions arrive with a flat contact/property shape.
    // Normalize them into the generic lead payload (person / message / qualData /
    // preferences) so every downstream step below runs through the same code path
    // as Investor / RE Professional / Referral — no per-role branching required.
    if (payload.role === 'existing_asset_owner') normalizeEaoPayload(payload);

    var email = ((payload.person || {}).email || '').toLowerCase().trim();

    // ── Dedupe check ──
    if (email) {
      var existing = findExistingLead(email);
      if (existing) {
        return handleResubmission(existing, payload);
      }
    }

    // ── New submission ──
    var seq          = nextLeadSequence();
    var leadId       = buildLeadId(seq);
    var referralCode = generateReferralCode(leadId);

    // Match referrer (code > email > name priority)
    var referralMatch = matchReferrer(payload);

    // Create the booking event first so we can capture the Google Meet link
    // and store it on the lead row / include it in confirmation emails.
    var meetLink = '';
    var calendarLink = '';
    var bookingRequested = !!(payload.booking && payload.booking.date);
    // Carries the full outcome of the booking insert into the partner email, so
    // both a hard failure (no event) and a degraded success (event created, but
    // no calendar link / Meet conference captured) announce themselves.
    var calendarStatus = { requested: bookingRequested, created: false, degraded: false, error: '' };
    if (bookingRequested) {
      try {
        var bookingResult = createBookingEvent(payload, leadId) || {};
        meetLink                 = bookingResult.meetLink || '';
        calendarLink             = bookingResult.calendarLink || '';
        calendarStatus.created   = !!bookingResult.created;
        calendarStatus.degraded  = !!bookingResult.degraded;
        calendarStatus.error     = bookingResult.error || '';
      }
      catch (err) {
        calendarStatus.error = String(err);
        Logger.log('createBookingEvent failed: ' + err);
      }
    }

    var row = buildLeadRow(payload, 'New Lead', leadId, referralCode, referralMatch, meetLink);

    appendRow(CONFIG.TABS.LIFETIME_LEADS, row);
    appendRow(CONFIG.TABS.ACTIVE_LEADS,   row);

    var categoryTab = categoryTabForRole(payload.role);
    if (categoryTab) {
      appendRow(categoryTab, row);
      // New referral partners default to "Reports Enabled = TRUE" so they receive
      // the monthly referral summary until explicitly opted out in the sheet.
      if (categoryTab === CONFIG.TABS.REFERRAL_PARTNERS) {
        var partnerSheet = tab(categoryTab);
        if (partnerSheet) {
          partnerSheet.getRange(partnerSheet.getLastRow(), REPORTS_ENABLED_COL + 1).setValue(true);
        }
      }
    }

    // Update referrer stats if matched
    if (referralMatch.found) {
      updateReferrerStats(referralMatch.referrerLeadId);
      logReferralEntry(referralMatch, leadId, payload, row);
      sendReferrerNotification(referralMatch.referrerEmail, referralMatch.referrerFirstName, referralMatch.referrerCode);
    }

    try { createContact(payload); }
    catch (err) { Logger.log('createContact failed: ' + err); }

    try { sendVisitorConfirmation(payload, referralCode, meetLink, leadId); }
    catch (err) { Logger.log('sendVisitorConfirmation failed: ' + err); }

    try { sendPartnerNotification(payload, leadId, referralCode, referralMatch, meetLink, calendarLink, calendarStatus); }
    catch (err) { Logger.log('sendPartnerNotification failed: ' + err); }

    return jsonResponse({ success: true, leadId: leadId, referralCode: referralCode });
  } catch (err) {
    Logger.log('handleFormSubmission error: ' + err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/* ── Dedupe handler ── */
function handleResubmission(existing, payload) {
  var sheet    = tab(CONFIG.TABS.LIFETIME_LEADS);
  var rowIndex = existing.rowIndex;  // 1-based sheet row
  var rowData  = existing.rowData;
  var existingLeadId       = rowData[COLS.LEAD_ID];
  var existingReferralCode = rowData[COLS.REFERRAL_CODE];
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
  var p = payload.person || {};

  // Update any previously-empty fields with new info
  var updates = {};
  if (!rowData[COLS.FIRST_NAME]   && p.firstName)   updates[COLS.FIRST_NAME]   = p.firstName;
  if (!rowData[COLS.LAST_NAME]    && p.lastName)     updates[COLS.LAST_NAME]    = p.lastName;
  if (!rowData[COLS.PHONE]        && p.phone)        updates[COLS.PHONE]        = p.phone;
  if (!rowData[COLS.COMPANY]      && p.company)      updates[COLS.COMPANY]      = p.company;
  if (!rowData[COLS.BOOKING_DATE] && payload.booking && payload.booking.date) {
    updates[COLS.BOOKING_DATE] = payload.booking.date;
    updates[COLS.BOOKING_TIME] = payload.booking.slot || payload.booking.time || '';
    updates[COLS.MEET_TYPE]    = payload.booking.meetType || '';
    updates[COLS.BOOKING_PHONE]= payload.booking.phone   || '';
  }

  for (var col in updates) {
    sheet.getRange(rowIndex, parseInt(col, 10) + 1).setValue(updates[col]);
  }

  // Append resubmission note to message column
  var existingMsg   = rowData[COLS.MESSAGE] || '';
  var resubNote     = 'Resubmission on ' + today + ' (' + existingLeadId + ')';
  if (payload.message) resubNote += '\n\nNew message: ' + payload.message;
  var newMsg = existingMsg ? existingMsg + '\n\n' + resubNote : resubNote;
  sheet.getRange(rowIndex, COLS.MESSAGE + 1).setValue(newMsg);

  // Notify partners of resubmission
  try { sendResubmissionNotification(payload, existingLeadId, existingReferralCode); }
  catch (err) { Logger.log('sendResubmissionNotification failed: ' + err); }

  return jsonResponse({
    success: true,
    leadId: existingLeadId,
    referralCode: existingReferralCode,
    resubmission: true,
  });
}

function findExistingLead(email) {
  if (!email) return null;
  var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][COLS.EMAIL] || '').toLowerCase().trim();
    if (rowEmail === email) {
      return { rowIndex: i + 1, rowData: data[i] };
    }
  }
  return null;
}

/* ── Referral matching ── */
function matchReferrer(payload) {
  var code  = (payload.referralCode    || '').trim();
  var email = (payload.referredByEmail || '').toLowerCase().trim();
  var name  = (payload.referredByName  || '').trim();

  if (!code && !email && !name) {
    return { found: false, matchType: 'none' };
  }

  var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!sheet) return { found: false, matchType: 'none' };
  var data = sheet.getDataRange().getValues();

  // Priority 1: code match
  if (code) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COLS.REFERRAL_CODE] || '').toUpperCase() === code.toUpperCase()) {
        return buildReferralMatch(data[i], 'code');
      }
    }
  }

  // Priority 2: email match
  if (email) {
    for (var j = 1; j < data.length; j++) {
      var rowEmail = String(data[j][COLS.EMAIL] || '').toLowerCase().trim();
      if (rowEmail === email) {
        return buildReferralMatch(data[j], 'email');
      }
    }
  }

  // Priority 3: name match (flag for review)
  if (name) {
    var nameLower = name.toLowerCase();
    for (var k = 1; k < data.length; k++) {
      var full = (String(data[k][COLS.FIRST_NAME] || '') + ' ' + String(data[k][COLS.LAST_NAME] || '')).toLowerCase().trim();
      if (full && full === nameLower) {
        return buildReferralMatch(data[k], 'name');
      }
    }
  }

  return { found: false, matchType: 'none' };
}

function buildReferralMatch(referrerRow, matchType) {
  var referrerChain = String(referrerRow[COLS.REFERRAL_CHAIN] || '').trim();
  var referrerLeadId = String(referrerRow[COLS.LEAD_ID] || '');
  var chain = referrerChain
    ? referrerChain + '|' + referrerLeadId
    : referrerLeadId;
  var depth = chain ? chain.split('|').length : 1;

  return {
    found:             true,
    matchType:         matchType,
    referrerLeadId:    referrerLeadId,
    referrerName:      [referrerRow[COLS.FIRST_NAME], referrerRow[COLS.LAST_NAME]].filter(Boolean).join(' '),
    referrerFirstName: String(referrerRow[COLS.FIRST_NAME] || ''),
    referrerEmail:     String(referrerRow[COLS.EMAIL] || ''),
    referrerCode:      String(referrerRow[COLS.REFERRAL_CODE] || ''),
    chain:             chain,
    depth:             depth,
  };
}

function updateReferrerStats(referrerLeadId) {
  if (!referrerLeadId) return;
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
  var tabsToCheck = [
    CONFIG.TABS.LIFETIME_LEADS, CONFIG.TABS.ACTIVE_LEADS,
    CONFIG.TABS.REFERRAL_PARTNERS, CONFIG.TABS.INVESTORS,
    CONFIG.TABS.RE_PROFESSIONALS, CONFIG.TABS.ASSET_OWNER, CONFIG.TABS.COLD_LEADS,
  ];
  tabsToCheck.forEach(function(tabName) {
    var sheet = tab(tabName);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][COLS.LEAD_ID] || '') === referrerLeadId) {
        var current = parseInt(data[i][COLS.DIRECT_REFERRALS] || '0', 10);
        sheet.getRange(i + 1, COLS.DIRECT_REFERRALS + 1).setValue(current + 1);
        sheet.getRange(i + 1, COLS.LAST_REFERRAL_DATE + 1).setValue(today);
        break;
      }
    }
  });
}

function logReferralEntry(referralMatch, referredLeadId, payload, referredRow) {
  var refSheet = tab(CONFIG.TABS.REFERRALS);
  if (!refSheet) return;
  var seq   = nextReferralSequence();
  var refId = buildReferralTabId(seq);
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
  var p     = payload.person || {};
  var referredName = [p.firstName, p.lastName].filter(Boolean).join(' ');
  var status = referralMatch.matchType === 'name' ? 'pending' : 'linked';

  refSheet.appendRow([
    refId,
    referralMatch.referrerLeadId,
    referralMatch.referrerName,
    referralMatch.referrerEmail,
    referralMatch.referrerCode,
    referredLeadId,
    referredName,
    p.email || '',
    referralMatch.matchType,
    referralMatch.depth,
    referralMatch.chain,
    today,
    status,
  ]);
}

function sendReferrerNotification(referrerEmail, referrerFirstName, referrerCode) {
  if (!referrerEmail) return;
  var name = referrerFirstName || 'there';

  var html = renderTemplate(TEMPLATE_REFERRER_NOTIFICATION, {
    firstName:    name,
    referralLink: referralLinkFor(referrerCode),
    sharePageUrl: sharePageUrlFor(referrerCode),
  });

  GmailApp.sendEmail(
    referrerEmail,
    'Someone you referred just connected with AxisPoint',
    'Someone you referred just reached out to us.',
    { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL, htmlBody: html, inlineImages: { logo: LOGO_BLOB } }
  );
}

function sendResubmissionNotification(payload, existingLeadId, existingReferralCode) {
  var p        = payload.person || {};
  var name     = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
  var category = roleToCategory(payload.role);
  var today    = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');

  GmailApp.sendEmail(
    CONFIG.NOTIFY_EMAILS.join(','),
    'Resubmission: ' + name + ' (' + existingLeadId + ')',
    [
      name + ' submitted the contact form again on ' + today + '.',
      '',
      'Lead ID:       ' + existingLeadId,
      'Referral Code: ' + existingReferralCode,
      'Email:         ' + (p.email   || 'n/a'),
      'Phone:         ' + (p.phone   || 'n/a'),
      'Role:          ' + category,
      payload.message ? '\nNew message:\n' + payload.message : '',
      '',
      'The existing record has been updated. No duplicate row was created.',
      '',
      'Sheet: https://docs.google.com/spreadsheets/d/' + getProp('SPREADSHEET_ID'),
    ].filter(function(l) { return l !== undefined; }).join('\n'),
    { name: CONFIG.SENDER_NAME }
  );
}

/* ── Row builder ── */
function buildLeadRow(payload, status, leadId, referralCode, referralMatch, meetLink) {
  var p   = payload.person   || {};
  var b   = payload.booking  || null;
  var q   = payload.qualData || {};
  var now = new Date();
  var rm  = referralMatch || { found: false, matchType: 'none' };

  var message = payload.message || '';
  if (payload.role === 'submit_referral' && payload.referred) {
    var ref = payload.referred;
    var refFirstName = ref.firstName || '';
    var refLastName  = ref.lastName  || '';
    var refName = [refFirstName, refLastName].filter(Boolean).join(' ') || ref.name || '';
    var refNote = [
      'Referred person:',
      refName  ? '  Name: '  + refName  : '',
      ref.email ? '  Email: ' + ref.email : '',
      ref.phone ? '  Phone: ' + ref.phone : '',
      ref.notes ? '  Notes: ' + ref.notes : '',
    ].filter(Boolean).join('\n');
    message = refNote + (message ? '\n\n' + message : '');
  }

  return [
    payload.timestamp || now.toISOString(),                            // 0  Timestamp
    leadId            || '',                                           // 1  Lead ID
    referralCode      || '',                                           // 2  Referral Code
    p.firstName       || '',                                           // 3  First Name
    p.lastName        || '',                                           // 4  Last Name
    p.email           || '',                                           // 5  Email
    p.phone           || '',                                           // 6  Phone
    p.company         || '',                                           // 7  Company
    payload.role      || '',                                           // 8  Role
    roleToCategory(payload.role),                                      // 9  Category
    assetClassFromQualData(q),                                         // 10 Asset Class
    message,                                                           // 11 Message
    (payload.preferences || []).join(', '),                            // 12 Preferences
    b ? (b.date || '') : '',                                           // 13 Booking Date
    b ? (b.slot || b.time || '') : '',                                 // 14 Booking Time
    b ? (b.meetType || '') : '',                                       // 15 Meet Type
    b ? (b.phone || '') : '',                                          // 16 Booking Phone
    leadSource(payload),                                               // 17 Source (origin only)
    status,                                                            // 18 Status
    rm.found ? rm.referrerLeadId : '',                                 // 19 Referred By Lead ID
    rm.found ? rm.referrerName   : '',                                 // 20 Referred By Name
    rm.found ? rm.referrerEmail  : '',                                 // 21 Referred By Email
    rm.found ? rm.referrerCode   : '',                                 // 22 Referred By Code
    rm.matchType || 'none',                                            // 23 Match Type
    rm.found ? rm.chain : '',                                          // 24 Referral Chain
    rm.found ? rm.depth : 0,                                           // 25 Chain Depth
    0,                                                                 // 26 Direct Referrals
    0,                                                                 // 27 Total Downstream
    '',                                                                // 28 Last Referral Date
    meetLink || '',                                                    // 29 Meet Link
    leadHeardAbout(payload),                                           // 30 Heard About (self-reported)
  ];
}

/* ── Helpers ── */
function roleToCategory(role) {
  return {
    investor: 'Investor', referral: 'Referral Partner',
    pro: 'RE Professional',
    existing_asset_owner: 'Existing Asset Owner',
    submit_referral: 'Referral',
  }[role] || '';
}

function assetClassFromQualData(q) {
  var a = q && q.assetClasses;
  return Array.isArray(a) && a.length ? a.join(', ') : '';
}

/* ── Lead origin (the CRM "Source" column) ──
   Reflects only the real, actual origin/channel of a submission, NOT the
   visitor's "How did you hear about us?" answer (which arrives as
   `payload.heardAbout` and is intentionally kept out of this column).
     • QR microsite → "QR"   (frontend sends payload.source === 'qr')
     • normal site  → ''     (direct — left blank on purpose)
   `payload.page` is deliberately NOT used as a fallback here: every main-site
   submission carries page === 'axispoint.llc', which would wrongly stamp the
   domain into Source on every row. Any other explicit, non-empty origin passes
   through verbatim so a future channel doesn't silently vanish. */
function leadSource(payload) {
  var s = String((payload && payload.source) || '').trim();
  if (!s) return '';
  if (s.toLowerCase() === 'qr') return 'QR';
  return s;
}

/* ── Self-reported attribution (the CRM "Heard About" column) ──
   The visitor's own answer to "How did you hear about us?", sent by the frontend
   as payload.heardAbout on every buildPayload role (buildEAOPayload has no such
   step, so EAO rows are blank here). This is a separate question from
   leadSource(): Source is the technical channel a submission physically arrived
   through, Heard About is what the person says brought them. Never merge them.
   Internal-only: it lands in the Sheet and the partner notification, and is
   deliberately absent from every client-facing surface (confirmation email,
   calendar event, .ics). */
function leadHeardAbout(payload) {
  return String((payload && payload.heardAbout) || '').trim();
}

function categoryTabForRole(role) {
  return {
    investor:             CONFIG.TABS.INVESTORS,
    referral:             CONFIG.TABS.REFERRAL_PARTNERS,
    pro:                  CONFIG.TABS.RE_PROFESSIONALS,
    existing_asset_owner: CONFIG.TABS.ASSET_OWNER,
    // submit_referral intentionally has no per-role tab: the submitter's own lead
    // lives in Active/Lifetime only, while the referral relationship is logged to
    // the Referrals tab. Returning null here preserves that by-design behavior.
  }[role] || null;
}

/* ── Existing Asset Owner normalization ──
   Reshapes the flat EAO payload emitted by buildEAOPayload (frontend) into the
   generic lead payload every other role uses, so buildLeadRow, dedupe, the
   partner notification and the booking flow all work with zero role branching.
     • person       ← name (split into first/last) + email + phone
     • message      ← pressing_issue        (renders in the Message column + email)
     • qualData     ← { assetClasses: [readable one-line asset summary] }
     • preferences  ← [JSON summary of every property/situation field]  (nothing lost) */
function normalizeEaoPayload(payload) {
  var fullName  = String(payload.name || '').trim();
  var nameParts = fullName ? fullName.split(/\s+/) : [];
  var firstName = nameParts.shift() || '';
  var lastName  = nameParts.join(' ');

  payload.person = {
    firstName: firstName,
    lastName:  lastName,
    email:     payload.email || '',
    phone:     payload.phone || '',
    company:   '',
  };
  payload.message     = payload.pressing_issue || payload.message || '';
  payload.qualData    = { assetClasses: [eaoAssetClassLabel(payload)].filter(Boolean) };
  payload.preferences = [eaoDetailsSummary(payload)];
  return payload;
}

/** Readable one-line asset summary for the Asset Class column, from the EAO
 *  property object. Fed through qualData.assetClasses so assetClassFromQualData()
 *  and the partner-notification "Asset Class" row both pick it up generically. */
function eaoAssetClassLabel(payload) {
  if (Array.isArray(payload.asset_breakdown) && payload.asset_breakdown.length) {
    var types = payload.asset_breakdown.map(function(b) {
      return Array.isArray(b.property_type) ? b.property_type.join('/') : b.property_type;
    }).filter(Boolean);
    return 'Mixed portfolio: ' + types.join(', ');
  }
  var label = payload.property_type || '';
  if (payload.portfolio_type === 'portfolio') return label ? 'Portfolio: ' + label : 'Portfolio';
  return label ? 'Single: ' + label : '';
}

/** JSON-stringified capture of every EAO-specific field, stored in the
 *  Preferences column so no detail is lost despite there being no dedicated
 *  column per EAO field. */
function eaoDetailsSummary(payload) {
  var summary = { portfolio_type: payload.portfolio_type || '' };
  if (payload.portfolio_composition) summary.portfolio_composition = payload.portfolio_composition;
  if (payload.property_type)         summary.property_type         = payload.property_type;
  if (payload.units != null)         summary.units                 = payload.units;
  if (payload.sqft)                  summary.sqft                  = payload.sqft;
  if (payload.asset_breakdown)       summary.asset_breakdown       = payload.asset_breakdown;
  if (payload.current_situation)     summary.current_situation     = payload.current_situation;
  if (payload.pressing_issue)        summary.pressing_issue        = payload.pressing_issue;
  return JSON.stringify(summary);
}

/* ── Referral URL helpers ── */
function referralLinkFor(code) {
  return code ? 'https://axispoint.llc/contact?ref=' + code : '';
}
function sharePageUrlFor(code) {
  return code ? 'https://axispoint.llc/share/' + code : '';
}

/**
 * Splits a booking date string into the parts the email templates need:
 *   { month: 'JUN', day: '27', dow: 'Fri' }
 */
function bookingDateParts(dateStr, timeStr) {
  var d = parseBookingDateTime(dateStr, timeStr || '12:00 PM');
  if (!d) return { month: '', day: '', dow: '' };
  return {
    month: Utilities.formatDate(d, 'America/Chicago', 'MMM').toUpperCase(),
    day:   Utilities.formatDate(d, 'America/Chicago', 'd'),
    dow:   Utilities.formatDate(d, 'America/Chicago', 'EEE'),
  };
}

/* ── Visitor confirmation email (HTML templates) ── */
function sendVisitorConfirmation(payload, referralCode, meetLink, leadId) {
  var p = payload.person || {};
  if (!p.email) return;

  var name         = p.firstName || 'there';
  var referralLink = referralLinkFor(referralCode);
  var b            = payload.booking;
  var hasBooking   = b && b.date;

  // Per-role note that reflects back what the visitor actually told us. Empty
  // string for roles/payloads with nothing substantive to echo; renderTemplate
  // strips the unfilled {{personalNote}} placeholder to '' in that case.
  var personalNote = buildVisitorPersonalNote(payload);

  var html, subject;

  if (hasBooking) {
    var parts = bookingDateParts(b.date, b.slot || b.time || '');
    var vars  = {
      firstName:        name,
      personalNote:     personalNote,
      bookingMonth:     parts.month,
      bookingDay:       parts.day,
      bookingDayOfWeek: parts.dow,
      bookingTime:      b.slot || b.time || '',
      referralCode:     referralCode || '',
      referralLink:     referralLink,
    };

    if (b.meetType === 'meet') {
      vars.meetLink = meetLink || '';
      html = renderTemplate(TEMPLATE_VISITOR_MEET, vars);
    } else {
      vars.bookingPhone = b.phone || p.phone || '';
      html = renderTemplate(TEMPLATE_VISITOR_PHONE, vars);
    }
    subject = 'Your call with AxisPoint is set';
  } else {
    html = renderTemplate(TEMPLATE_VISITOR_NO_BOOKING, {
      firstName:    name,
      personalNote: personalNote,
      referralCode: referralCode || '',
      referralLink: referralLink,
    });
    subject = 'We received your message';
  }

  var mailOpts = {
    name:     CONFIG.SENDER_NAME,
    replyTo:  CONFIG.FROM_EMAIL,
    htmlBody: html,
    inlineImages: { logo: LOGO_BLOB },
  };

  // Attach a fully-detailed .ics so the visitor can add the call to any
  // calendar app, independent of Google's native attendee invite. Backup only,
  // never a hard dependency: if generation fails, the email still sends.
  if (hasBooking) {
    try {
      var icsBlob = buildBookingIcs(payload, leadId, meetLink);
      if (icsBlob) mailOpts.attachments = [icsBlob];
    } catch (err) {
      Logger.log('buildBookingIcs failed: ' + err);
    }
  }

  GmailApp.sendEmail(p.email, subject, 'Thank you for reaching out to AxisPoint Partners.', mailOpts);
}

/* ── Per-role personalized confirmation note ──
   Reflects back what the visitor actually submitted, using only fields that
   role really captures (see docs/frontend-payload-schemas.md). Returns a ready
   HTML callout, or '' when there is nothing substantive to echo. All
   interpolated values are escaped; option-list values are fixed strings but are
   escaped anyway for safety. Rendered into the {{personalNote}} placeholder that
   every visitor template carries, so it works for booking and no-booking alike. */
function buildVisitorPersonalNote(payload) {
  var role = payload.role;
  var q    = payload.qualData || {};
  var label = '';
  var body  = '';

  if (role === 'investor') {
    label = 'Your investor profile';
    var aum = (q.aum && q.aum !== 'Prefer not to say') ? q.aum : '';
    var exp = (Array.isArray(q.experience) ? q.experience : [])
      .filter(function(x) { return x && x !== 'Never invested in CRE'; });
    if (aum && exp.length) {
      body = 'You mentioned capital in the ' + escapeHtml(aum) + ' range, with a background that includes ' + escapeHtml(humanList(exp)) + '. We will frame the conversation around exactly where you are.';
    } else if (aum) {
      body = 'You mentioned capital in the ' + escapeHtml(aum) + ' range. We will tailor the conversation to your goals and timeline.';
    } else if (exp.length) {
      body = 'Thanks for sharing your CRE background, which includes ' + escapeHtml(humanList(exp)) + '. We will pick up right there when we talk.';
    } else {
      body = 'Thanks for sharing where you are as an investor. We will tailor the conversation to your goals.';
    }

  } else if (role === 'pro') {
    label = 'Your practice';
    var proRole = q.proRole || '';
    var markets = Array.isArray(q.markets) ? q.markets : [];
    if (proRole && markets.length) {
      body = 'Great to connect with someone in ' + escapeHtml(proRole) + ' working across ' + escapeHtml(humanList(markets)) + '. We are always open to smart collaboration.';
    } else if (proRole) {
      body = 'Great to connect with someone in ' + escapeHtml(proRole) + '. We are always open to smart collaboration.';
    } else if (markets.length) {
      body = 'Good to connect with someone working across ' + escapeHtml(humanList(markets)) + '. We are always open to smart collaboration.';
    } else {
      body = 'Great to connect with a fellow CRE professional. We are always open to smart collaboration.';
    }

  } else if (role === 'referral') {
    label = 'Your practice';
    var profession = q.profession || '';
    var closer = referralIntentClause(q.referralIntent || '');
    if (profession) {
      body = 'Great to connect with a ' + escapeHtml(profession) + '. ' + closer;
    } else {
      body = 'Thank you for thinking of AxisPoint for your clients. ' + closer;
    }

  } else if (role === 'existing_asset_owner') {
    label = 'What you told us';
    var issue     = String(payload.pressing_issue   || '').trim();
    var situation = String(payload.current_situation || '').trim();
    if (issue) {
      body = 'You told us the most pressing thing on your plate is: “' + escapeHtml(issue) + '”. That is exactly where we will start.';
    } else if (situation) {
      body = 'You described your current situation as: “' + escapeHtml(situation) + '”. We will dig into that when we connect.';
    } else {
      body = 'We reviewed the details on your portfolio and situation, and we will come prepared to talk specifics.';
    }

  } else if (role === 'submit_referral') {
    label = 'Your referral';
    var ref = payload.referred || {};
    var refName = [ref.firstName, ref.lastName].filter(Boolean).join(' ').trim() || String(ref.name || '').trim();
    if (refName) {
      body = 'Thank you for thinking of us. We will personally reach out to ' + escapeHtml(refName) + ' and take good care of the introduction. You will not be left wondering what happened next.';
    } else {
      body = 'Thank you for the referral. We will personally reach out to the person you introduced and take good care of it from here.';
    }

  } else {
    return '';
  }

  if (!body) return '';

  return [
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border-left:3px solid #9F328C;border-radius:0 6px 6px 0;margin:0 0 20px;">',
    '<tr><td style="padding:12px 16px;">',
    '<p style="font-size:10px;font-weight:600;color:#9490A8;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 5px;">' + escapeHtml(label) + '</p>',
    '<p style="font-size:13px;color:#1C1628;line-height:1.6;margin:0;">' + body + '</p>',
    '</td></tr>',
    '</table>',
  ].join('');
}

/** Joins a list into readable prose: "A", "A and B", "A, B and C". */
function humanList(arr) {
  var a = (arr || []).filter(Boolean);
  if (a.length <= 1) return a.join('');
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

/** Closing sentence for a referral partner, keyed off their stated intent. */
function referralIntentClause(intent) {
  return {
    'I actively refer CRE opportunities': 'We look forward to a lasting referral relationship.',
    'I have a specific client in mind':   'We would love to hear about the client you have in mind.',
    'Building a referral relationship':   'We look forward to building a referral relationship with you.',
    'Exploring if there is a fit':        'We are glad to explore whether there is a fit.',
  }[intent] || 'We look forward to connecting.';
}

/* ── Immediate partner notification (HTML template) ── */
function sendPartnerNotification(payload, leadId, referralCode, referralMatch, meetLink, calendarLink, calendarStatus) {
  var p  = payload.person  || {};
  var b  = payload.booking || null;
  var q  = payload.qualData || {};
  var rm = referralMatch   || { found: false };
  var cs = calendarStatus  || { requested: false, created: false, degraded: false, error: '' };

  // Three distinct booking outcomes, three distinct signals in this email:
  //   failed   → no event exists at all. Loud red banner.
  //   degraded → an event exists but carries no link (CalendarApp fallback, or
  //              an insert response without htmlLink). Amber notice, because the
  //              missing "View in calendar" link is expected here, not a mystery.
  //   healthy  → event + link. No banner.
  var calendarFailed   = !!(cs.requested && !cs.created);
  var calendarDegraded = !!(cs.requested && cs.created && !calendarLink);
  var calendarError    = cs.error || '';

  var name     = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
  var category = roleToCategory(payload.role);
  var subject  = 'New lead: ' + name + ' (' + category + '), ' + (leadId || '');

  var initials = ((p.firstName || '').charAt(0) + (p.lastName || '').charAt(0)).toUpperCase() || '–';
  // Real origin only (QR / direct); the "how did you hear about us" answer lives
  // in payload.heardAbout and is deliberately not conflated with origin here.
  var source   = leadSource(payload) || 'Direct';

  // ── Capital range row (investor only) ──
  var capitalRangeRow = '';
  if (payload.role === 'investor' && q && q.aum) {
    capitalRangeRow =
      '<tr>' +
      '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Capital range</td>' +
      '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">' + escapeHtml(q.aum) + '</td>' +
      '</tr>';
  }

  // ── "How did you hear about us?" row (internal only) ──
  // Deliberately its own row, directly under Source and clearly labeled, so the
  // person's self-reported attribution is never mistaken for the technical
  // origin channel. Omitted entirely when the visitor did not answer (EAO has no
  // such step). Never rendered on any client-facing surface.
  var heardAboutRow = '';
  var heardAbout = leadHeardAbout(payload);
  if (heardAbout) {
    heardAboutRow =
      '<tr>' +
      '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Heard about us</td>' +
      '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">' + escapeHtml(heardAbout) + '</td>' +
      '</tr>';
  }

  // ── Referred-by row with match-type badge ──
  var referredByRow = '';
  if (rm.found) {
    var badge =
      '<span style="display:inline-block;background:#EEEAF5;color:#38285D;font-size:10px;font-weight:600;' +
      'letter-spacing:0.04em;text-transform:uppercase;padding:2px 8px;border-radius:8px;margin-left:6px;">' +
      escapeHtml(rm.matchType) + ' match</span>';
    referredByRow =
      '<tr>' +
      '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Referred by</td>' +
      '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">' +
      escapeHtml(rm.referrerName || '') + badge + '</td>' +
      '</tr>';
  }

  // ── Message block ──
  var messageBlock = '';
  if (payload.message) {
    messageBlock =
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border:1px solid #E8E4F0;border-radius:8px;margin:0 0 20px;">' +
      '<tr><td style="padding:14px 16px;">' +
      '<p style="font-size:10px;font-weight:600;color:#9490A8;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 6px;">Message</p>' +
      '<p style="font-size:13px;color:#1C1628;line-height:1.6;margin:0;white-space:pre-wrap;">' + escapeHtml(payload.message) + '</p>' +
      '</td></tr></table>';
  }

  // ── Booking block (calendar design) ──
  var bookingBlock = '';
  if (b && b.date) {
    var parts = bookingDateParts(b.date, b.slot || b.time || '');
    var isMeet = b.meetType === 'meet';
    var detailLabel = isMeet ? 'Google Meet' : 'Phone call';
    // A Meet booking whose conference was never provisioned has no link. Render a
    // plain marker rather than an anchor with an empty href, which looks like a
    // working "Join Google Meet" button and silently goes nowhere.
    var actionHtml;
    if (isMeet && meetLink) {
      actionHtml = '<a href="' + escapeHtml(meetLink) + '" style="display:inline-block;background:#E8F7FA;border:1px solid #B8E6EF;border-radius:5px;padding:4px 10px;font-size:11px;color:#1A8799;font-weight:500;text-decoration:none;">Join Google Meet &nbsp;→</a>';
    } else if (isMeet) {
      actionHtml = '<span style="display:inline-block;background:#FCEEEC;border:1px solid #E7B7AF;border-radius:5px;padding:4px 10px;font-size:11px;color:#B23B2E;font-weight:500;">No Google Meet link was created</span>';
    } else {
      actionHtml = '<span style="display:inline-block;background:#E8F7FA;border:1px solid #B8E6EF;border-radius:5px;padding:4px 10px;font-size:11px;color:#1A8799;font-weight:500;">Call them at ' + escapeHtml(b.phone || p.phone || '') + '</span>';
    }

    // Link to the actual calendar event (captured from the booking insert), so
    // a partner can open it, reschedule, or check attendee responses directly.
    var calendarLinkHtml = calendarLink
      ? '<a href="' + escapeHtml(calendarLink) + '" style="display:inline-block;margin-left:8px;background:#F1EEF8;border:1px solid #DDD6EC;border-radius:5px;padding:4px 10px;font-size:11px;color:#5A4A87;font-weight:500;text-decoration:none;">View in calendar &nbsp;→</a>'
      : '';

    // Loud warning when the booking came in but no Calendar event was actually
    // created. This is the signal that used to be swallowed — a config/access
    // failure now shows up right in the notification instead of only in the logs.
    var calendarWarningHtml = calendarFailed
      ? '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FCEEEC;border:1px solid #E7B7AF;border-radius:8px;margin:0 0 20px;">' +
        '<tr><td style="padding:12px 16px;">' +
        '<p style="font-size:11px;font-weight:700;color:#B23B2E;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 4px;">⚠ Calendar event was NOT created</p>' +
        '<p style="font-size:12px;color:#7A2C22;line-height:1.5;margin:0;">This booking has no event on the shared calendar and no invite reached the visitor. ' +
        'Check the BOOKING_CALENDAR_ID Script Property and the deploying account\'s edit access, then add the event manually.' +
        (calendarError ? '<br><span style="font-size:11px;color:#9A4A3E;">' + escapeHtml(calendarError) + '</span>' : '') +
        '</p></td></tr></table>'
      : '';

    // The event exists and the invite went out, but no link could be captured.
    // Distinct from the failure above: nothing needs to be created by hand, the
    // link just has to be found in the calendar. Without this, the absent "View
    // in calendar" link looked identical to a bug.
    var calendarDegradedHtml = calendarDegraded
      ? '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDF6E7;border:1px solid #E8D3A0;border-radius:8px;margin:0 0 20px;">' +
        '<tr><td style="padding:12px 16px;">' +
        '<p style="font-size:11px;font-weight:700;color:#8A6516;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 4px;">⚠ Calendar event created, but no link captured</p>' +
        '<p style="font-size:12px;color:#6B4F11;line-height:1.5;margin:0;">The event is on the shared calendar and the invite was sent, so no manual booking is needed. ' +
        'The "View in calendar" link is unavailable for this one, open the AxisPoint Bookings calendar directly.' +
        (calendarError ? '<br><span style="font-size:11px;color:#8A6516;">' + escapeHtml(calendarError) + '</span>' : '') +
        '</p></td></tr></table>'
      : '';

    // Internal-only detail dump (goes to NOTIFY_EMAILS only, never to the
    // visitor). Kept out of the shared Calendar event / .ics on purpose.
    var internalDetailHtml =
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border:1px dashed #DDD6EC;border-radius:8px;margin:0 0 20px;">' +
      '<tr><td style="padding:12px 16px;">' +
      '<p style="font-size:10px;font-weight:600;color:#9490A8;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 6px;">Booking details (internal only)</p>' +
      '<p style="font-size:12px;color:#5A5270;line-height:1.6;margin:0;white-space:pre-wrap;font-family:\'SFMono-Regular\',Consolas,Menlo,monospace;">' +
      escapeHtml(bookingEventInternalDescription(payload, leadId)) + '</p>' +
      '</td></tr></table>';

    bookingBlock =
      calendarWarningHtml +
      calendarDegradedHtml +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E4F0;border-radius:8px;overflow:hidden;margin:0 0 20px;">' +
      '<tr><td colspan="2" style="background:#38285D;padding:8px 14px;">' +
      '<span style="font-size:10px;font-weight:500;color:#C9C4D6;letter-spacing:0.1em;text-transform:uppercase;">Scheduled call</span>' +
      '</td></tr><tr>' +
      '<td width="100" style="background:#F7F5FB;padding:14px 18px;text-align:center;border-right:1px solid #E8E4F0;vertical-align:middle;">' +
      '<p style="font-size:10px;font-weight:500;color:#9490A8;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 3px;">' + parts.month + '</p>' +
      '<p style="font-size:30px;font-weight:500;color:#38285D;line-height:1;margin:0 0 3px;">' + parts.day + '</p>' +
      '<p style="font-size:10px;color:#9490A8;margin:0;">' + parts.dow + '</p>' +
      '</td>' +
      '<td style="padding:14px 18px;vertical-align:middle;">' +
      '<p style="font-size:17px;font-weight:500;color:#1C1628;margin:0 0 3px;white-space:nowrap;">' + escapeHtml(b.slot || b.time || '') + ' CT</p>' +
      '<p style="font-size:12px;color:#5A5270;margin:0 0 10px;white-space:nowrap;">30 minutes &nbsp;·&nbsp; ' + detailLabel + '</p>' +
      actionHtml + calendarLinkHtml +
      '</td></tr></table>' +
      internalDetailHtml;
  }

  var html = renderTemplate(TEMPLATE_PARTNER_NOTIFICATION, {
    initials:        initials,
    fullName:        name,
    role:            category || (payload.role || ''),
    source:          source,
    leadId:          leadId || 'n/a',
    email:           p.email || 'n/a',
    phone:           p.phone || 'n/a',
    company:         p.company || 'n/a',
    assetClass:      assetClassFromQualData(q) || 'n/a',
    capitalRangeRow: capitalRangeRow,
    heardAboutRow:   heardAboutRow,
    referredByRow:   referredByRow,
    messageBlock:    messageBlock,
    bookingBlock:    bookingBlock,
    crmUrl:          'https://docs.google.com/spreadsheets/d/' + getProp('SPREADSHEET_ID'),
  });

  GmailApp.sendEmail(CONFIG.NOTIFY_EMAILS.join(','), subject, 'A new lead just came in.', {
    name:     CONFIG.SENDER_NAME,
    htmlBody: html,
    inlineImages: { logo: LOGO_BLOB },
  });
}


/* ════════════════════════════════════════════════════════════
   JOB 2 — DAILY DIGEST  (6 pm CT)
   ════════════════════════════════════════════════════════════ */

function sendDailyDigest() {
  try {
    var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
    if (!sheet) return;

    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    var rows  = sheet.getDataRange().getValues().slice(1).filter(function(r) {
      // Timestamp is an ISO string; compare its CT calendar date to today's.
      var ts = new Date(r[COLS.TIMESTAMP]);
      if (isNaN(ts)) return false;
      return Utilities.formatDate(ts, 'America/Chicago', 'MM/dd/yyyy') === today;
    });

    if (rows.length === 0) {
      Logger.log('sendDailyDigest: no new leads today.');
      return;
    }

    var n = rows.length;
    var blocks = rows.map(function(r) {
      var name     = [r[COLS.FIRST_NAME], r[COLS.LAST_NAME]].filter(Boolean).join(' ') || 'Unknown';
      var refLine  = r[COLS.REF_BY_NAME]
        ? 'Referred By: ' + r[COLS.REF_BY_NAME] + ' (' + r[COLS.MATCH_TYPE] + ')'
        : '';
      return [
        'Lead ID:     ' + r[COLS.LEAD_ID],
        'Name:        ' + name,
        'Role:        ' + r[COLS.CATEGORY],
        'Email:       ' + r[COLS.EMAIL],
        'Phone:       ' + r[COLS.PHONE],
        'Asset Class: ' + r[COLS.ASSET_CLASS],
        r[COLS.BOOKING_DATE]
          ? 'Booking:     ' + r[COLS.BOOKING_DATE] + ' at ' + r[COLS.BOOKING_TIME]
          : '',
        'Source:      ' + r[COLS.SOURCE],
        refLine,
      ].filter(function(l) { return l && l.slice(-1) !== ':'; }).join('\n');
    });

    GmailApp.sendEmail(
      CONFIG.NOTIFY_EMAILS.join(','),
      'AxisPoint: ' + n + ' new lead' + (n > 1 ? 's' : '') + ' today (' + today + ')',
      [
        n + ' new lead' + (n > 1 ? 's' : '') + ' submitted on ' + today + '.',
        '',
        blocks.join('\n\n───────────────────────────\n\n'),
        '',
        'Sheet: https://docs.google.com/spreadsheets/d/' + getProp('SPREADSHEET_ID'),
      ].join('\n'),
      { name: CONFIG.SENDER_NAME }
    );

    Logger.log('sendDailyDigest: emailed digest for ' + n + ' lead(s).');
  } catch (err) {
    Logger.log('sendDailyDigest error: ' + err);
  }
}


/* ════════════════════════════════════════════════════════════
   JOB 2b — MONTHLY REFERRAL SUMMARIES  (1st of month, 9 am CT)
   ════════════════════════════════════════════════════════════ */

function sendMonthlyReferralSummaries() {
  try {
    var partnersSheet = tab(CONFIG.TABS.REFERRAL_PARTNERS);
    if (!partnersSheet) { Logger.log('sendMonthlyReferralSummaries: no Referral Partners tab.'); return; }

    // Tally referrals per referrer Lead ID from the Referrals tab.
    var totals = {};   // leadId -> total count
    var months = {};   // leadId -> this-month count
    var now    = new Date();
    var curMon = now.getMonth();
    var curYr  = now.getFullYear();

    var refSheet = tab(CONFIG.TABS.REFERRALS);
    if (refSheet) {
      var refData = refSheet.getDataRange().getValues();
      for (var r = 1; r < refData.length; r++) {
        var referrerLeadId = String(refData[r][1] || '');  // Referrer Lead ID
        if (!referrerLeadId) continue;
        totals[referrerLeadId] = (totals[referrerLeadId] || 0) + 1;

        var dateVal = refData[r][11];  // Date column
        var d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (!isNaN(d) && d.getMonth() === curMon && d.getFullYear() === curYr) {
          months[referrerLeadId] = (months[referrerLeadId] || 0) + 1;
        }
      }
    }

    var partners = partnersSheet.getDataRange().getValues();
    var sent = 0;

    for (var i = 1; i < partners.length; i++) {
      var row    = partners[i];
      var status = String(row[COLS.STATUS] || '');
      if (status === 'Cold' || status === 'Archive') continue;

      // Skip partners who have explicitly opted out (Reports Enabled = FALSE).
      // Blank or TRUE keeps them enabled.
      var reportsEnabled = row[REPORTS_ENABLED_COL];
      if (reportsEnabled === false || String(reportsEnabled).trim().toUpperCase() === 'FALSE') continue;

      var leadId = String(row[COLS.LEAD_ID] || '');
      var email  = String(row[COLS.EMAIL]   || '').trim();
      if (!leadId || !email) continue;

      var totalReferrals = totals[leadId] || 0;
      if (totalReferrals <= 0) continue;

      var monthReferrals = months[leadId] || 0;
      var firstName      = String(row[COLS.FIRST_NAME] || '') || 'there';
      var code           = String(row[COLS.REFERRAL_CODE] || '');

      var html = renderTemplate(TEMPLATE_REFERRER_MONTHLY, {
        firstName:      firstName,
        totalReferrals: totalReferrals,
        monthReferrals: monthReferrals,
        referralLink:   referralLinkFor(code),
        sharePageUrl:   sharePageUrlFor(code),
      });

      try {
        GmailApp.sendEmail(
          email,
          'Your AxisPoint referral summary',
          'Here is a quick look at your referral activity with AxisPoint.',
          { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL, htmlBody: html, inlineImages: { logo: LOGO_BLOB } }
        );
        sent++;
      } catch (e) {
        Logger.log('sendMonthlyReferralSummaries: failed for ' + email + ': ' + e);
      }
    }

    Logger.log('sendMonthlyReferralSummaries: sent ' + sent + ' summary email(s).');
  } catch (err) {
    Logger.log('sendMonthlyReferralSummaries error: ' + err);
  }
}


/* ════════════════════════════════════════════════════════════
   JOB 3 — COLD LEAD MIGRATION  (Monday 8 am CT)
   ════════════════════════════════════════════════════════════ */

function moveColdLeads() {
  try {
    var activeSheet = tab(CONFIG.TABS.ACTIVE_LEADS);
    if (!activeSheet) return;

    var data   = activeSheet.getDataRange().getValues();
    var now    = new Date();
    var active = ['New Lead', 'Contacted', 'Active'];
    var moved  = [];

    for (var i = data.length - 1; i >= 1; i--) {
      var row    = data[i];
      var status = String(row[COLS.STATUS] || '');
      if (active.indexOf(status) === -1) continue;

      var submitted = new Date(row[COLS.TIMESTAMP]);
      if (isNaN(submitted)) continue;

      var age = (now - submitted) / 86400000;
      if (age <= CONFIG.COLD_LEAD_DAYS) continue;

      row[COLS.STATUS] = 'Cold';
      appendRow(CONFIG.TABS.COLD_LEADS, row);
      activeSheet.deleteRow(i + 1);
      setCategoryTabStatus(row, 'Cold');

      try { moveContactToCold(row[COLS.EMAIL]); }
      catch (e) { Logger.log('moveContactToCold failed for ' + row[COLS.EMAIL] + ': ' + e); }

      moved.push(row);
    }

    if (moved.length === 0) { Logger.log('moveColdLeads: nothing to move.'); return; }

    var blocks = moved.map(function(r) {
      return [
        'Lead ID:        ' + r[COLS.LEAD_ID],
        'Name:           ' + [r[COLS.FIRST_NAME], r[COLS.LAST_NAME]].filter(Boolean).join(' '),
        'Role:           ' + r[COLS.CATEGORY],
        'Email:          ' + r[COLS.EMAIL],
        'Submitted:      ' + Utilities.formatDate(new Date(r[COLS.TIMESTAMP]), 'America/Chicago', 'MM/dd/yyyy'),
      ].join('\n');
    });

    GmailApp.sendEmail(
      CONFIG.NOTIFY_EMAILS.join(','),
      'AxisPoint: Leads moved to cold this week',
      [
        moved.length + ' lead' + (moved.length > 1 ? 's were' : ' was') + ' moved to Cold.',
        '',
        blocks.join('\n\n───────────────────────────\n\n'),
        '',
        'Update their status in the Sheet to move them back to Active at any time.',
        '',
        'Sheet: https://docs.google.com/spreadsheets/d/' + getProp('SPREADSHEET_ID'),
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
  if (leadsGroup) { try { contact.removeFromGroup(leadsGroup); } catch (e) {} }
  contact.addToGroup(ensureContactGroup(CONFIG.CONTACT_GROUPS.COLD));
}


/* ════════════════════════════════════════════════════════════
   JOB 4 — SHEET EDIT SYNC  (installable onEdit trigger)
   Watches Status, Category, and Referred By Email columns.
   ════════════════════════════════════════════════════════════ */

function onSheetEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet     = e.range.getSheet();
    var sheetName = sheet.getName();
    var col       = e.range.getColumn();  // 1-indexed
    var row       = e.range.getRow();
    if (row <= 1) return;

    var statusCol   = COLS.STATUS       + 1;
    var categoryCol = COLS.CATEGORY     + 1;
    var refByEmail  = COLS.REF_BY_EMAIL + 1;

    if (col !== statusCol && col !== categoryCol && col !== refByEmail) return;

    var newValue = String(e.range.getValue());
    var rowData  = sheet.getRange(row, 1, 1, LEAD_HEADERS.length).getValues()[0];

    if (col === statusCol)  { handleStatusEdit(sheetName, row, rowData, newValue); }
    else if (col === categoryCol) { handleCategoryEdit(rowData, newValue); }
    else if (col === refByEmail)  { handleManualReferralLink(sheet, row, rowData, newValue); }
  } catch (err) {
    Logger.log('onSheetEdit error: ' + err);
  }
}

function handleManualReferralLink(sheet, row, rowData, referredByEmail) {
  if (!referredByEmail) return;
  var email = referredByEmail.toLowerCase().trim();

  var lifetimeSheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!lifetimeSheet) return;
  var data = lifetimeSheet.getDataRange().getValues();
  var referrerRow = null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COLS.EMAIL] || '').toLowerCase().trim() === email) {
      referrerRow = data[i];
      break;
    }
  }

  if (!referrerRow) return;

  var referrerLeadId = String(referrerRow[COLS.LEAD_ID] || '');
  var referrerName   = [referrerRow[COLS.FIRST_NAME], referrerRow[COLS.LAST_NAME]].filter(Boolean).join(' ');
  var referrerCode   = String(referrerRow[COLS.REFERRAL_CODE] || '');
  var referrerChain  = String(referrerRow[COLS.REFERRAL_CHAIN] || '').trim();
  var chain          = referrerChain ? referrerChain + '|' + referrerLeadId : referrerLeadId;
  var depth          = chain ? chain.split('|').length : 1;

  sheet.getRange(row, COLS.REF_BY_LEAD_ID + 1).setValue(referrerLeadId);
  sheet.getRange(row, COLS.REF_BY_NAME    + 1).setValue(referrerName);
  sheet.getRange(row, COLS.REF_BY_EMAIL   + 1).setValue(email);
  sheet.getRange(row, COLS.REF_BY_CODE    + 1).setValue(referrerCode);
  sheet.getRange(row, COLS.MATCH_TYPE     + 1).setValue('manual');
  sheet.getRange(row, COLS.REFERRAL_CHAIN + 1).setValue(chain);
  sheet.getRange(row, COLS.CHAIN_DEPTH    + 1).setValue(depth);

  updateReferrerStats(referrerLeadId);

  // Log to Referrals tab
  var refSheet = tab(CONFIG.TABS.REFERRALS);
  if (refSheet) {
    var seq   = nextReferralSequence();
    var refId = buildReferralTabId(seq);
    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    var referredLeadId = String(rowData[COLS.LEAD_ID] || '');
    var referredName   = [rowData[COLS.FIRST_NAME], rowData[COLS.LAST_NAME]].filter(Boolean).join(' ');
    var referredEmail  = String(rowData[COLS.EMAIL] || '');
    refSheet.appendRow([
      refId, referrerLeadId, referrerName, email, referrerCode,
      referredLeadId, referredName, referredEmail,
      'manual', depth, chain, today, 'manual',
    ]);
  }

  // Send referrer notification
  var firstName = String(referrerRow[COLS.FIRST_NAME] || '');
  sendReferrerNotification(email, firstName, referrerCode);
}

function handleStatusEdit(sheetName, rowNum, rowData, newStatus) {
  var email = rowData[COLS.EMAIL];

  switch (newStatus) {
    case 'Cold':
      if (sheetName === CONFIG.TABS.ACTIVE_LEADS) {
        rowData[COLS.STATUS] = 'Cold';
        appendRow(CONFIG.TABS.COLD_LEADS, rowData);
        tab(CONFIG.TABS.ACTIVE_LEADS).deleteRow(rowNum);
        try { moveContactToCold(email); } catch (e) {}
      }
      break;

    case 'Client':
      appendRow(CONFIG.TABS.CLIENTS, rowData);
      try {
        var contacts = ContactsApp.getContactsByEmailAddress(email);
        if (contacts && contacts.length) {
          contacts[0].addToGroup(ensureContactGroup(CONFIG.CONTACT_GROUPS.CLIENTS));
        }
      } catch (e) { Logger.log('Client contact label error: ' + e); }
      break;

    case 'Archive':
      if (sheetName === CONFIG.TABS.ACTIVE_LEADS) {
        appendRow(CONFIG.TABS.ARCHIVE, rowData);
        tab(CONFIG.TABS.ACTIVE_LEADS).deleteRow(rowNum);
      }
      break;

    case 'New Lead':
    case 'Active':
    case 'Contacted':
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

    var categoryGroups = [
      CONFIG.CONTACT_GROUPS.INVESTORS,
      CONFIG.CONTACT_GROUPS.REFERRAL_PARTNERS,
      CONFIG.CONTACT_GROUPS.RE_PROFESSIONALS,
      CONFIG.CONTACT_GROUPS.CLIENTS,
    ];
    categoryGroups.forEach(function(gName) {
      try { var g = ContactsApp.getContactGroup(gName); if (g) contact.removeFromGroup(g); } catch (e) {}
    });

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
   ════════════════════════════════════════════════════════════ */

function handleSubscribe(payload) {
  try {
    var email       = String(payload.email || '').toLowerCase().trim();
    var firstName   = String(payload.firstName || '').trim();
    var preferences = payload.preferences || [];

    if (!email) return jsonResponse({ success: false, error: 'Email is required.' });

    var sheet = tab(CONFIG.TABS.SUBSCRIBERS);
    if (!sheet) return jsonResponse({ success: false, error: 'Subscribers tab not found.' });

    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][SCOLS.EMAIL] || '').toLowerCase().trim() === email) {
        return jsonResponse({ success: true, alreadySubscribed: true });
      }
    }

    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    sheet.appendRow([email, firstName, today, preferences.join(', '), true, '']);

    try { sendWelcomeEmail(email, firstName, preferences); }
    catch (e) { Logger.log('Welcome email failed: ' + e); }

    return jsonResponse({ success: true, alreadySubscribed: false });
  } catch (err) {
    Logger.log('handleSubscribe error: ' + err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function sendWelcomeEmail(email, firstName, preferences) {
  var name = firstName || 'there';

  // Preference catalog: dot color + title + description. Only show what the
  // subscriber selected. Matching is fuzzy on keywords so it tolerates the
  // exact label strings the form sends.
  var catalog = [
    { keys: ['article', 'insight'], color: '#24A5BC',
      title: 'New articles and insights',
      desc:  'When Zachary or Ethaniel publish something new on CRE, asset management, or the Texas market.' },
    { keys: ['investment', 'opportunit', 'deal'], color: '#9F328C',
      title: 'Investment opportunities',
      desc:  'When a deal or acquisition opportunity worth sharing comes across our desk.' },
    { keys: ['firm', 'update', 'news'], color: '#38285D',
      title: 'Firm updates',
      desc:  'What AxisPoint is working on, new capabilities, and firm news.' },
  ];

  var prefsLower = (preferences || []).map(function(x) { return String(x).toLowerCase(); });
  var rows = '';
  catalog.forEach(function(item) {
    var selected = prefsLower.some(function(pref) {
      return item.keys.some(function(k) { return pref.indexOf(k) !== -1; });
    });
    if (!selected) return;
    rows +=
      '<tr><td style="padding:8px 0;vertical-align:top;">' +
      '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td width="22" style="vertical-align:top;padding-top:5px;">' +
      '<div style="width:9px;height:9px;border-radius:50%;background:' + item.color + ';"></div></td>' +
      '<td style="vertical-align:top;">' +
      '<p style="font-size:14px;font-weight:500;color:#1C1628;margin:0 0 2px;">' + item.title + '</p>' +
      '<p style="font-size:12px;color:#5A5270;line-height:1.6;margin:0;">' + item.desc + '</p>' +
      '</td></tr></table></td></tr>';
  });

  // If nothing matched, fall back to listing everything in the catalog.
  if (!rows) {
    catalog.forEach(function(item) {
      rows +=
        '<tr><td style="padding:8px 0;vertical-align:top;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td width="22" style="vertical-align:top;padding-top:5px;">' +
        '<div style="width:9px;height:9px;border-radius:50%;background:' + item.color + ';"></div></td>' +
        '<td style="vertical-align:top;">' +
        '<p style="font-size:14px;font-weight:500;color:#1C1628;margin:0 0 2px;">' + item.title + '</p>' +
        '<p style="font-size:12px;color:#5A5270;line-height:1.6;margin:0;">' + item.desc + '</p>' +
        '</td></tr></table></td></tr>';
    });
  }

  var unsubscribeUrl = getProp('SCRIPT_URL') + '?unsubscribe=' + encodeURIComponent(email);

  var html = renderTemplate(TEMPLATE_WELCOME_SUBSCRIBER, {
    firstName:      name,
    preferenceList: rows,
    unsubscribeUrl: unsubscribeUrl,
  });

  GmailApp.sendEmail(
    email,
    'You are on the list',
    'You are on the list.',
    { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL, htmlBody: html, inlineImages: { logo: LOGO_BLOB } }
  );
}


/* ════════════════════════════════════════════════════════════
   JOB 6 — PUBLISH NOTIFICATION
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

    var email     = String(rows[i][SCOLS.EMAIL]      || '').trim();
    var firstName = String(rows[i][SCOLS.FIRST_NAME] || '').trim();
    if (!email) continue;

    var unsubUrl = getProp('SCRIPT_URL') + '?unsubscribe=' + encodeURIComponent(email);

    try {
      GmailApp.sendEmail(
        email,
        'New from AxisPoint: ' + title,
        [
          firstName ? 'Hi ' + firstName + ',' : 'Hi,',
          '',
          title,
          '',
          excerpt || '',
          '',
          'Read it here: ' + url,
          '',
          'Zachary and Ethaniel',
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
   JOB 7 — UNSUBSCRIBE HANDLER
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
              'You have been unsubscribed',
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
  var p = payload.person  || {};
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
    'Role:        ' + (payload.role   || ''),
    'Category:    ' + roleToCategory(payload.role),
    'Asset Class: ' + assetClassFromQualData(q),
    'Preferences: ' + (payload.preferences || []).join(', '),
    b && b.date
      ? 'Booking:     ' + b.date + ' at ' + (b.slot || b.time || '') +
        (b.meetType ? ' (' + b.meetType + ')' : '')
      : null,
    'Submitted:   ' + (payload.timestamp || new Date().toISOString()),
  ].filter(Boolean).join('\n'));

  contact.addToGroup(ensureContactGroup(CONFIG.CONTACT_GROUPS.LEADS));

  var catGroupName = contactGroupForCategory(roleToCategory(payload.role));
  if (catGroupName) contact.addToGroup(ensureContactGroup(catGroupName));
}

function ensureContactGroup(name) {
  var group = ContactsApp.getContactGroup(name);
  return group || ContactsApp.createContactGroup(name);
}


/* ════════════════════════════════════════════════════════════
   GOOGLE CALENDAR
   ════════════════════════════════════════════════════════════ */

/* ── Booking-event content: CLIENT-FACING vs INTERNAL ──
   PRIVACY-CRITICAL SPLIT. The visitor is added as an attendee on the real
   Calendar event, so the event's own title/description land in the visitor's
   personal calendar, and the .ics attachment goes straight to their inbox.
   Those two surfaces MUST use the client-facing helpers below and must never
   carry CRM internals (Lead ID, Source, asset class, internal category label).

   The full internal detail dump (bookingEventInternalDescription) is used ONLY
   in the internal partner-notification email, which goes to NOTIFY_EMAILS. */

/** Client-facing event title. The visitor sees this in their own calendar, so
    it carries NO internal category label. */
function bookingEventTitle(payload) {
  var p = payload.person || {};
  var name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  return name ? ('AxisPoint Partners intro call with ' + name) : 'AxisPoint Partners intro call';
}

/** Client-facing event description. Used for the real Calendar EVENT (visitor
    is an attendee and sees it) AND the .ics attachment sent to the visitor.
    Warm and minimal — deliberately NO Lead ID, Source, asset class, or any
    other CRM internal. */
function bookingEventClientDescription(payload) {
  var b = payload.booking || {};
  var p = payload.person  || {};
  var isPhone        = b.meetType === 'phone';
  var callbackNumber = (isPhone && b.phone) ? b.phone : (p.phone || '');

  var lines = [];
  lines.push('Looking forward to talking with you.');
  lines.push('');
  if (isPhone) {
    lines.push(callbackNumber
      ? ('We will call you at ' + callbackNumber + ' at the scheduled time.')
      : 'We will call you at the scheduled time.');
  } else {
    lines.push('We will meet by Google Meet. The join link is in this invite and in your confirmation email.');
  }
  lines.push('');
  lines.push('This is a 30-minute introductory call to understand your situation and where we can help. Bring whatever is top of mind.');
  lines.push('');
  lines.push('Zach and Ethaniel');
  lines.push('AxisPoint Partners');
  return lines.join('\n');
}

/** INTERNAL-ONLY detail dump. Never attached to the shared Calendar event or
    the visitor .ics — used solely inside the partner-notification email body,
    which is sent only to NOTIFY_EMAILS. */
function bookingEventInternalDescription(payload, leadId) {
  var p = payload.person   || {};
  var b = payload.booking  || {};
  var q = payload.qualData || {};
  var isPhone        = b.meetType === 'phone';
  var name           = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Guest';
  var category       = roleToCategory(payload.role) || payload.role || 'Lead';
  var callbackNumber = (isPhone && b.phone) ? b.phone : (p.phone || '');

  var lines = [];
  lines.push('Lead: ' + name + ' (' + category + ')');
  lines.push('Lead ID: ' + (leadId || 'n/a'));
  if (p.email) lines.push('Email: ' + p.email);
  if (p.phone) lines.push('Phone: ' + p.phone);
  if (isPhone) lines.push('Preferred callback number: ' + (callbackNumber || 'not provided'));
  var assetClass = assetClassFromQualData(q);
  if (assetClass) lines.push('Asset class: ' + assetClass);
  if (payload.role === 'existing_asset_owner' && payload.current_situation) {
    lines.push('Current situation: ' + payload.current_situation);
  }
  var origin = leadSource(payload) || payload.page;
  if (origin) lines.push('Source: ' + origin);
  if (payload.message) {
    lines.push('');
    lines.push('Message / pressing issue:');
    lines.push(payload.message);
  }
  return lines.join('\n');
}

/* ── iCalendar (.ics) attachment for the visitor confirmation ──
   A fully-detailed VEVENT the visitor can add to any calendar app. This is a
   deliberate belt-and-suspenders backup to Google's own native attendee invite
   (which may be delayed, spam-filtered, or useless to a non-Google visitor):
   an attached .ics works everywhere and needs no Google account. METHOD:PUBLISH
   (not REQUEST) so clients treat it as an event to add, not an RSVP flow.
   Times are emitted in America/Chicago wall-clock with a real VTIMEZONE block,
   matching CONFIG / the project time zone. Returns a Blob, or null when the
   booking can't be resolved. */
function buildBookingIcs(payload, leadId, meetLink) {
  var b = payload.booking;
  if (!b || !b.date) return null;

  var start = parseBookingDateTime(b.date, b.slot || b.time || '');
  if (!start) return null;
  var end = new Date(start.getTime() + 30 * 60 * 1000);

  var isPhone        = b.meetType === 'phone';
  var p              = payload.person || {};
  var callbackNumber = (isPhone && b.phone) ? b.phone : (p.phone || '');
  var location = isPhone
    ? ('Phone call' + (callbackNumber ? ': ' + callbackNumber : ''))
    : (meetLink || 'Google Meet');

  // Client-facing content only — this .ics is delivered straight to the visitor.
  var title = bookingEventTitle(payload);
  var desc  = bookingEventClientDescription(payload);

  var tz    = 'America/Chicago';
  var fmtLocal = function(d) { return Utilities.formatDate(d, tz, "yyyyMMdd'T'HHmmss"); };
  var stampUtc = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  var uid = 'axp-' + (leadId || 'booking') + '-' + (payload.timestamp || Date.now()) + '@axispoint.llc';

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AxisPoint Partners//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:America/Chicago',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0500',
    'TZNAME:CDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + stampUtc,
    'DTSTART;TZID=America/Chicago:' + fmtLocal(start),
    'DTEND;TZID=America/Chicago:' + fmtLocal(end),
    'SUMMARY:' + icsEscape(title),
    'DESCRIPTION:' + icsEscape(desc),
    'LOCATION:' + icsEscape(location),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  var ics = lines.map(icsFold).join('\r\n') + '\r\n';
  return Utilities.newBlob(ics, 'text/calendar', 'axispoint-call.ics');
}

/** Escape a value for an iCalendar TEXT field (RFC 5545 §3.3.11). */
function icsEscape(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold a content line at 75 octets per RFC 5545 §3.1 (continuations start with a space). */
function icsFold(line) {
  if (line.length <= 75) return line;
  var out = line.slice(0, 75);
  var rest = line.slice(75);
  while (rest.length > 74) {
    out += '\r\n ' + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return out + '\r\n ' + rest;
}

/**
 * Creates the intro-call event on the shared "AxisPoint Bookings" calendar.
 *
 * Both booking types are inserted through the Advanced Calendar Service
 * (Calendar.Events.insert):
 *   - meetType === 'meet'  → a real Google Meet conference is provisioned.
 *   - meetType === 'phone' → a plain event (no conference), callback number in
 *     the location/description.
 * The advanced service is used for the phone path too (not CalendarApp) so we
 * can capture the event's htmlLink for the partner email — CalendarApp's
 * createEvent does not cleanly expose it. CalendarApp remains only as a
 * last-resort fallback if the advanced insert throws.
 *
 * All three parties are added as attendees (zach@ + ethaniel@ from
 * NOTIFY_EMAILS, plus the visitor) and Google sends real invites
 * (sendUpdates: 'all' / sendInvites: true), so the event lands on the
 * partners' personal calendars and the visitor gets a proper Google invite.
 *
 * Returns { meetLink, calendarLink } (each '' when unavailable).
 */
function createBookingEvent(payload, leadId) {
  var p = payload.person   || {};
  var b = payload.booking;
  var q = payload.qualData || {};
  // `created`, `degraded` and `error` let the caller distinguish three outcomes
  // that otherwise look alike from the outside: no event at all, an event with a
  // usable link, and an event created through the CalendarApp fallback whose
  // htmlLink (and Meet conference) could never be captured. The fail-safe design
  // (never break submission) had been masking config/access problems: a booking
  // that quietly created no event looked identical to a healthy one, and so did
  // one created without a link. Callers now report all three differently.
  var result = { meetLink: '', calendarLink: '', created: false, degraded: false, error: '' };

  // All booking events go on the shared "AxisPoint Bookings" calendar, never a
  // personal default calendar. If the property isn't configured, skip cleanly
  // (this call is wrapped in try/catch upstream) rather than write to the wrong
  // calendar. A missing ID is a setup error, surfaced in the logs AND the email.
  var calId = CONFIG.BOOKING_CALENDAR_ID;
  if (!calId) {
    result.error = 'BOOKING_CALENDAR_ID Script Property is not set (re-run setProperties()).';
    Logger.log('createBookingEvent: ' + result.error + ' Skipping event creation.');
    return result;
  }

  var start = parseBookingDateTime(b.date, b.slot || b.time || '');
  if (!start) {
    result.error = 'Could not parse booking date/time "' + b.date + ' ' + (b.slot || b.time) + '".';
    Logger.log('createBookingEvent: ' + result.error);
    return result;
  }
  var end = new Date(start.getTime() + 30 * 60 * 1000);

  var isPhone        = b.meetType === 'phone';
  var callbackNumber = (isPhone && b.phone) ? b.phone : (p.phone || '');

  // The visitor is an attendee on this event, so its title/description show up
  // in THEIR calendar. Both must be the client-facing versions — never the
  // internal CRM dump (see bookingEventInternalDescription).
  var title = bookingEventTitle(payload);
  var desc  = bookingEventClientDescription(payload);

  var location = isPhone
    ? ('Phone call' + (callbackNumber ? ': ' + callbackNumber : ''))
    : 'Google Meet';

  var guests = CONFIG.NOTIFY_EMAILS.slice();
  if (p.email) guests.push(p.email);

  // ── Advanced Calendar Service insert (both meet and phone paths). ──
  try {
    var eventResource = {
      summary:     title,
      description: desc,
      location:    location,
      start:       { dateTime: start.toISOString(), timeZone: 'America/Chicago' },
      end:         { dateTime: end.toISOString(),   timeZone: 'America/Chicago' },
      attendees:   guests.map(function(g) { return { email: g }; }),
    };

    var insertOpts = { sendUpdates: 'all' };
    if (!isPhone) {
      var requestId = 'axp-' + (payload.timestamp || Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
      eventResource.conferenceData = {
        createRequest: {
          requestId:             requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
      insertOpts.conferenceDataVersion = 1;
    }

    var created = Calendar.Events.insert(eventResource, calId, insertOpts);
    result.created = true;
    result.calendarLink = (created && created.htmlLink) ? created.htmlLink : '';
    if (!result.calendarLink) {
      result.degraded = true;
      result.error = 'Calendar.Events.insert succeeded but returned no htmlLink, so there is no "View in calendar" link for this event.';
      Logger.log('createBookingEvent: ' + result.error);
    }

    if (!isPhone) {
      var entryPoints = created && created.conferenceData && created.conferenceData.entryPoints;
      if (entryPoints && entryPoints.length) {
        for (var i = 0; i < entryPoints.length; i++) {
          if (entryPoints[i].entryPointType === 'video' && entryPoints[i].uri) {
            result.meetLink = entryPoints[i].uri;
            break;
          }
        }
        if (!result.meetLink) result.meetLink = entryPoints[0].uri || '';
      } else if (created && created.hangoutLink) {
        result.meetLink = created.hangoutLink;
      }
    }
    return result;
  } catch (err) {
    result.error = 'Calendar.Events.insert failed: ' + err;
    Logger.log('createBookingEvent: ' + result.error + '. Falling back to CalendarApp.');
  }

  // ── Fallback: plain CalendarApp event. ──
  // CalendarApp.createEvent exposes no htmlLink and provisions no Meet
  // conference, so an event created here is real but link-less. That is a
  // DEGRADED success, not a healthy one: keep `degraded` set and preserve the
  // advanced-insert error that forced us down this path, so the partner email
  // can say why the "View in calendar" link (and, for a Meet booking, the Meet
  // link) is missing. Clearing `error` here is what previously made this state
  // indistinguishable from a clean insert.
  var advancedError = result.error;
  var cal = CalendarApp.getCalendarById(calId);
  if (!cal) {
    result.error = 'No Calendar access for BOOKING_CALENDAR_ID=' + calId +
                   ' (the deploying account needs edit access). ' + advancedError;
    Logger.log('createBookingEvent: ' + result.error + ' Skipping event creation.');
    return result;
  }
  cal.createEvent(title, start, end, {
    description: desc,
    location:    location,
    guests:      guests.join(','),
    sendInvites: true,
  });
  result.created  = true;
  result.degraded = true;
  result.error    = 'Event was created through the CalendarApp fallback, so it has no ' +
                    '"View in calendar" link' + (isPhone ? '' : ' and no Google Meet conference') +
                    '. Underlying cause: ' + advancedError;
  Logger.log('createBookingEvent: ' + result.error);
  return result;
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
   JOB — CALENDAR AVAILABILITY (read-only GET endpoint)
   ════════════════════════════════════════════════════════════ */

/**
 * Read-only availability endpoint.
 *   GET  ?action=availability&date=<"June 27, 2026">
 *
 * Queries the SHARED booking calendar's free/busy for that calendar day and
 * returns which of the fixed BOOKING_SLOTS are still free. It reads exactly the
 * same CONFIG.BOOKING_CALENDAR_ID that createBookingEvent() writes to, so the
 * availability shown and the events actually booked can never reference
 * different calendars.
 *
 * Response shape (always 200; the frontend keys off `success`):
 *   { success:true, date:"June 27, 2026",
 *     slots:{ "8:00 AM":true, "9:00 AM":false, ... } }   // true = free
 *   { success:false, error:"…" }                          // frontend falls back
 *                                                         // to all-available
 */
function handleAvailability(dateStr) {
  try {
    var calId = CONFIG.BOOKING_CALENDAR_ID;
    if (!calId) {
      return jsonResponse({ success: false, error: 'BOOKING_CALENDAR_ID not configured' });
    }

    var dayStart = parseBookingDateTime(dateStr, '12:00 AM');
    if (!dayStart) {
      return jsonResponse({ success: false, error: 'Unparseable date: ' + dateStr });
    }
    var dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    var resp = Calendar.Freebusy.query({
      timeMin:  dayStart.toISOString(),
      timeMax:  dayEnd.toISOString(),
      timeZone: 'America/Chicago',
      items:    [{ id: calId }],
    });

    var calBusy = resp && resp.calendars && resp.calendars[calId];
    var busy = (calBusy && calBusy.busy) || [];

    var slots = computeSlotAvailability(dateStr, busy, BOOKING_SLOTS);
    return jsonResponse({ success: true, date: dateStr, slots: slots });
  } catch (err) {
    Logger.log('handleAvailability error: ' + err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Pure slot/busy overlap logic — no GAS globals except parseBookingDateTime
 * (itself pure) — so it is unit-testable in Node with a stubbed Freebusy
 * response (see scripts/gas tests). For each slot label it builds the
 * [start, start+30min) interval on `dateStr` and marks the slot unavailable
 * (false) when that interval overlaps ANY busy period.
 *
 * @param {string} dateStr       e.g. "June 27, 2026"
 * @param {Array}  busyPeriods   [{ start:ISO, end:ISO }, …] from Freebusy.query
 * @param {Array}  slots         slot labels, e.g. BOOKING_SLOTS
 * @return {Object}              { "8:00 AM":true, … }  (true = free)
 */
function computeSlotAvailability(dateStr, busyPeriods, slots) {
  var SLOT_MIN = 30;
  var intervals = (busyPeriods || []).map(function(bp) {
    return { start: new Date(bp.start).getTime(), end: new Date(bp.end).getTime() };
  });

  var out = {};
  for (var i = 0; i < slots.length; i++) {
    var label = slots[i];
    var slotStart = parseBookingDateTime(dateStr, label);
    if (!slotStart) { out[label] = true; continue; }  // unparseable → don't block

    var sStart = slotStart.getTime();
    var sEnd   = sStart + SLOT_MIN * 60 * 1000;

    var free = true;
    for (var j = 0; j < intervals.length; j++) {
      // half-open overlap: [sStart,sEnd) intersects [busyStart,busyEnd)
      if (sStart < intervals[j].end && sEnd > intervals[j].start) { free = false; break; }
    }
    out[label] = free;
  }
  return out;
}


/* ════════════════════════════════════════════════════════════
   CUSTOM SHEETS MENU
   ════════════════════════════════════════════════════════════ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AxisPoint')
    .addItem('📣  Send publish notification',  'openPublishDialog')
    .addSeparator()
    .addItem('❄️  Run Cold Lead Sweep Now',     'moveColdLeads')
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
 * Stores SPREADSHEET_ID and SCRIPT_URL in Script Properties.
 * Run this once (STEP 4). Values persist across all future redeploys and
 * never need to be set again unless the credentials themselves change.
 */
function setProperties() {
  PropertiesService.getScriptProperties().setProperties({
    'SPREADSHEET_ID': '1Z5Eyn9F4SoOYg4dJ0cDDorfnvqVbn_uYsUxDkPn12wY',
    'SCRIPT_URL': 'https://script.google.com/macros/s/AKfycbzfFHPUSP4bUc-Xu1Ma9179bk_dsprrqswaKljeV8ZUmB5Q0gOl9UVtPTqKt4IXeZgBqg/exec',
    // Dedicated shared "AxisPoint Bookings" calendar (see CONFIG.BOOKING_CALENDAR_ID).
    // The deploying account must have EDIT access to this calendar. Re-run this
    // function after pasting the real ID, then clasp push + clasp deploy -i.
    'BOOKING_CALENDAR_ID': 'c_c6da83c28bffd2cb7bb374dc8376bbc54d31eac404f3b26023d82e42dffae709@group.calendar.google.com'
  });
  Logger.log('Properties set successfully');
}

function setupSpreadsheet() {
  var id = getProp('SPREADSHEET_ID');
  if (!id) {
    throw new Error('Run setProperties() first to configure SPREADSHEET_ID and SCRIPT_URL');
  }
  var ss = SpreadsheetApp.openById(id);

  var leadTabs = [
    { name: CONFIG.TABS.ACTIVE_LEADS,      color: '#24A5BC' },
    { name: CONFIG.TABS.LIFETIME_LEADS,    color: '#38285D' },
    { name: CONFIG.TABS.COLD_LEADS,        color: '#5A5270' },
    { name: CONFIG.TABS.INVESTORS,         color: '#24A5BC' },
    { name: CONFIG.TABS.REFERRAL_PARTNERS, color: '#38285D' },
    { name: CONFIG.TABS.RE_PROFESSIONALS,  color: '#9F328C' },
    { name: CONFIG.TABS.ASSET_OWNER,       color: '#1A8799' },
    { name: CONFIG.TABS.CLIENTS,           color: '#1A8799' },
    { name: CONFIG.TABS.ARCHIVE,           color: '#9490A8' },
  ];

  leadTabs.forEach(function(cfg) {
    var sheet = ss.getSheetByName(cfg.name) || ss.insertSheet(cfg.name);
    if (sheet.getLastRow() === 0) {
      // Every lead tab shares LEAD_HEADERS. The Referral Partners tab carries one
      // extra "Reports Enabled" column (monthly-summary opt-out toggle).
      var headers = cfg.name === CONFIG.TABS.REFERRAL_PARTNERS
        ? LEAD_HEADERS.concat(['Reports Enabled'])
        : LEAD_HEADERS;
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground(cfg.color)
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });

  // Referrals tab
  var refSheet = ss.getSheetByName(CONFIG.TABS.REFERRALS) || ss.insertSheet(CONFIG.TABS.REFERRALS);
  if (refSheet.getLastRow() === 0) {
    refSheet.appendRow(REFERRAL_HEADERS);
    refSheet.getRange(1, 1, 1, REFERRAL_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#24A5BC')
      .setFontColor('#FFFFFF');
    refSheet.setFrozenRows(1);
  }

  // Subscribers tab
  var subSheet = ss.getSheetByName(CONFIG.TABS.SUBSCRIBERS) || ss.insertSheet(CONFIG.TABS.SUBSCRIBERS);
  if (subSheet.getLastRow() === 0) {
    subSheet.appendRow(SUBSCRIBER_HEADERS);
    subSheet.getRange(1, 1, 1, SUBSCRIBER_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#9F328C')
      .setFontColor('#FFFFFF');
    subSheet.setFrozenRows(1);
  }

  Logger.log('setupSpreadsheet: all 11 tabs ready.');
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .create();

  ScriptApp.newTrigger('moveColdLeads')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  ScriptApp.newTrigger('sendMonthlyReferralSummaries')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();

  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.openById(getProp('SPREADSHEET_ID')))
    .onEdit()
    .create();

  Logger.log('setupTriggers: all triggers created.');
}


/* ════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ════════════════════════════════════════════════════════════ */

function tab(name) {
  return SpreadsheetApp.openById(getProp('SPREADSHEET_ID')).getSheetByName(name);
}

function appendRow(tabName, row) {
  var sheet = tab(tabName);
  if (!sheet) { Logger.log('appendRow: tab not found: ' + tabName); return; }
  sheet.appendRow(row);
}

function escapeHtml(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
