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
    CURIOUS:           'Curious',
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

  COLD_THRESHOLD_DAYS: 60,
};


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
  '<img src="https://raw.githubusercontent.com/PurplePean/AxisPointWeb-/main/apps/web/public/images/logo-email.png" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
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
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">We received your message. See you at the time below.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
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
  '<img src="https://raw.githubusercontent.com/PurplePean/AxisPointWeb-/main/apps/web/public/images/logo-email.png" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
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
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">We received your message. See you at the time below.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
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
  '<img src="https://raw.githubusercontent.com/PurplePean/AxisPointWeb-/main/apps/web/public/images/logo-email.png" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
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
  '<p style="font-size:15px;color:#1C1628;line-height:1.6;margin:0 0 20px;">We received your message. Expect a personal reply within one business day.</p>',
  '',
  '<div style="border-top:1px solid #E8E4F0;margin:0 0 20px;"></div>',
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
  '<img src="https://raw.githubusercontent.com/PurplePean/AxisPointWeb-/main/apps/web/public/images/logo-email.png" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
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
  '<img src="https://raw.githubusercontent.com/PurplePean/AxisPointWeb-/main/apps/web/public/images/logo-email.png" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
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
  '<img src="https://raw.githubusercontent.com/PurplePean/AxisPointWeb-/main/apps/web/public/images/logo-email.png" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
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
  '<p style="font-size:10px;color:#9490A8;line-height:1.6;margin:0;">AxisPoint Partners LLC &nbsp;·&nbsp; Houston, Texas &nbsp;·&nbsp; Internal notification — do not forward.</p>',
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
  '<img src="https://raw.githubusercontent.com/PurplePean/AxisPointWeb-/main/apps/web/public/images/logo-email.png" width="200" height="60" alt="AxisPoint Partners" style="display:block;border:0;outline:0;" border="0">',
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
  DATE_SUBMITTED:     19,
  REF_BY_LEAD_ID:     20,
  REF_BY_NAME:        21,
  REF_BY_EMAIL:       22,
  REF_BY_CODE:        23,
  MATCH_TYPE:         24,
  REFERRAL_CHAIN:     25,
  CHAIN_DEPTH:        26,
  DIRECT_REFERRALS:   27,
  TOTAL_DOWNSTREAM:   28,
  LAST_REFERRAL_DATE: 29,
  MEET_LINK:          30,   // Google Meet URL when meetType === 'meet'
};

var LEAD_HEADERS = [
  'Timestamp', 'Lead ID', 'Referral Code',
  'First Name', 'Last Name', 'Email', 'Phone',
  'Company', 'Role', 'Category', 'Asset Class', 'Message',
  'Preferences', 'Booking Date', 'Booking Time', 'Meet Type',
  'Booking Phone', 'Source', 'Status', 'Date Submitted',
  'Referred By Lead ID', 'Referred By Name', 'Referred By Email', 'Referred By Code',
  'Match Type', 'Referral Chain', 'Chain Depth',
  'Direct Referrals', 'Total Downstream', 'Last Referral Date', 'Meet Link',
];

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
    if (payload.booking && payload.booking.date) {
      try { meetLink = createBookingEvent(payload) || ''; }
      catch (err) { Logger.log('createBookingEvent failed: ' + err); }
    }

    var row = buildLeadRow(payload, 'New Lead', leadId, referralCode, referralMatch, meetLink);

    appendRow(CONFIG.TABS.LIFETIME_LEADS, row);
    appendRow(CONFIG.TABS.ACTIVE_LEADS,   row);

    var categoryTab = categoryTabForRole(payload.role);
    if (categoryTab) appendRow(categoryTab, row);

    // Update referrer stats if matched
    if (referralMatch.found) {
      updateReferrerStats(referralMatch.referrerLeadId);
      logReferralEntry(referralMatch, leadId, payload, row);
      sendReferrerNotification(referralMatch.referrerEmail, referralMatch.referrerFirstName, referralMatch.referrerCode);
    }

    try { createContact(payload); }
    catch (err) { Logger.log('createContact failed: ' + err); }

    try { sendVisitorConfirmation(payload, referralCode, meetLink); }
    catch (err) { Logger.log('sendVisitorConfirmation failed: ' + err); }

    try { sendPartnerNotification(payload, leadId, referralCode, referralMatch, meetLink); }
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
  var resubNote     = 'Resubmission on ' + today + ' — ' + existingLeadId;
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
    CONFIG.TABS.RE_PROFESSIONALS, CONFIG.TABS.CURIOUS, CONFIG.TABS.COLD_LEADS,
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
    { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL, htmlBody: html }
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
      'Email:         ' + (p.email   || '—'),
      'Phone:         ' + (p.phone   || '—'),
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
  if (payload.role === 'refer' && payload.referred) {
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
    payload.source || payload.page || '',                              // 17 Source
    status,                                                            // 18 Status
    Utilities.formatDate(now, 'America/Chicago', 'MM/dd/yyyy'),        // 19 Date Submitted
    rm.found ? rm.referrerLeadId : '',                                 // 20 Referred By Lead ID
    rm.found ? rm.referrerName   : '',                                 // 21 Referred By Name
    rm.found ? rm.referrerEmail  : '',                                 // 22 Referred By Email
    rm.found ? rm.referrerCode   : '',                                 // 23 Referred By Code
    rm.matchType || 'none',                                            // 24 Match Type
    rm.found ? rm.chain : '',                                          // 25 Referral Chain
    rm.found ? rm.depth : 0,                                           // 26 Chain Depth
    0,                                                                 // 27 Direct Referrals
    0,                                                                 // 28 Total Downstream
    '',                                                                // 29 Last Referral Date
    meetLink || '',                                                    // 30 Meet Link
  ];
}

/* ── Helpers ── */
function roleToCategory(role) {
  return {
    investor: 'Investor', referral: 'Referral Partner',
    pro: 'RE Professional', curious: 'Curious', refer: 'Referral',
  }[role] || '';
}

function assetClassFromQualData(q) {
  var a = q && q.assetClasses;
  return Array.isArray(a) && a.length ? a.join(', ') : '';
}

function categoryTabForRole(role) {
  return {
    investor: CONFIG.TABS.INVESTORS,
    referral: CONFIG.TABS.REFERRAL_PARTNERS,
    pro:      CONFIG.TABS.RE_PROFESSIONALS,
    curious:  CONFIG.TABS.CURIOUS,
  }[role] || null;
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
function sendVisitorConfirmation(payload, referralCode, meetLink) {
  var p = payload.person || {};
  if (!p.email) return;

  var name         = p.firstName || 'there';
  var referralLink = referralLinkFor(referralCode);
  var b            = payload.booking;
  var hasBooking   = b && b.date;

  var html, subject;

  if (hasBooking) {
    var parts = bookingDateParts(b.date, b.slot || b.time || '');
    var vars  = {
      firstName:        name,
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
      referralCode: referralCode || '',
      referralLink: referralLink,
    });
    subject = 'We received your message — AxisPoint Partners';
  }

  GmailApp.sendEmail(p.email, subject, 'Thank you for reaching out to AxisPoint Partners.', {
    name:     CONFIG.SENDER_NAME,
    replyTo:  CONFIG.FROM_EMAIL,
    htmlBody: html,
  });
}

/* ── Immediate partner notification (HTML template) ── */
function sendPartnerNotification(payload, leadId, referralCode, referralMatch, meetLink) {
  var p  = payload.person  || {};
  var b  = payload.booking || null;
  var q  = payload.qualData || {};
  var rm = referralMatch   || { found: false };

  var name     = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
  var category = roleToCategory(payload.role);
  var subject  = 'New lead: ' + name + ' (' + category + ') — ' + (leadId || '');

  var initials = ((p.firstName || '').charAt(0) + (p.lastName || '').charAt(0)).toUpperCase() || '–';
  var source   = payload.source || payload.page || '—';

  // ── Capital range row (investor only) ──
  var capitalRangeRow = '';
  if (payload.role === 'investor' && q && q.aum) {
    capitalRangeRow =
      '<tr>' +
      '<td style="padding:6px 0;font-size:12px;color:#9490A8;vertical-align:top;">Capital range</td>' +
      '<td style="padding:6px 0;font-size:13px;color:#1C1628;vertical-align:top;">' + escapeHtml(q.aum) + '</td>' +
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
    var actionHtml = isMeet
      ? '<a href="' + escapeHtml(meetLink || '') + '" style="display:inline-block;background:#E8F7FA;border:1px solid #B8E6EF;border-radius:5px;padding:4px 10px;font-size:11px;color:#1A8799;font-weight:500;text-decoration:none;">Join Google Meet &nbsp;→</a>'
      : '<span style="display:inline-block;background:#E8F7FA;border:1px solid #B8E6EF;border-radius:5px;padding:4px 10px;font-size:11px;color:#1A8799;font-weight:500;">Call them at ' + escapeHtml(b.phone || p.phone || '') + '</span>';

    bookingBlock =
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
      actionHtml +
      '</td></tr></table>';
  }

  var html = renderTemplate(TEMPLATE_PARTNER_NOTIFICATION, {
    initials:        initials,
    fullName:        name,
    role:            category || (payload.role || ''),
    source:          source,
    leadId:          leadId || '—',
    email:           p.email || '—',
    phone:           p.phone || '—',
    company:         p.company || '—',
    assetClass:      assetClassFromQualData(q) || '—',
    capitalRangeRow: capitalRangeRow,
    referredByRow:   referredByRow,
    messageBlock:    messageBlock,
    bookingBlock:    bookingBlock,
    crmUrl:          'https://docs.google.com/spreadsheets/d/' + getProp('SPREADSHEET_ID'),
  });

  GmailApp.sendEmail(CONFIG.NOTIFY_EMAILS.join(','), subject, 'A new lead just came in.', {
    name:     CONFIG.SENDER_NAME,
    htmlBody: html,
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
      return String(r[COLS.DATE_SUBMITTED]) === today;
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
      'AxisPoint — ' + n + ' new lead' + (n > 1 ? 's' : '') + ' today (' + today + ')',
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
          { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL, htmlBody: html }
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

      var submitted = new Date(row[COLS.DATE_SUBMITTED]);
      if (isNaN(submitted)) continue;

      var age = (now - submitted) / 86400000;
      if (age <= CONFIG.COLD_THRESHOLD_DAYS) continue;

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
    'You are on the list — AxisPoint Partners',
    'You are on the list.',
    { name: CONFIG.SENDER_NAME, replyTo: CONFIG.FROM_EMAIL, htmlBody: html }
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

/**
 * Creates the intro-call event on the default calendar.
 * When meetType === 'meet' a real Google Meet link is generated via the
 * Advanced Calendar Service (conferenceDataVersion).
 * Returns the Meet link string ('' when none).
 */
function createBookingEvent(payload) {
  var p = payload.person   || {};
  var b = payload.booking;
  var q = payload.qualData || {};

  var start = parseBookingDateTime(b.date, b.slot || b.time || '');
  if (!start) {
    Logger.log('createBookingEvent: unable to parse "' + b.date + ' ' + (b.slot || b.time) + '"');
    return '';
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

  var guests = CONFIG.NOTIFY_EMAILS.slice();
  if (p.email) guests.push(p.email);

  // ── Google Meet booking: use the Advanced Calendar Service so Google
  //    provisions a real Meet conference and returns its join link. ──
  if (b.meetType === 'meet') {
    try {
      var requestId = 'axp-' + (payload.timestamp || Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
      var eventResource = {
        summary:     title,
        description: desc,
        start:       { dateTime: start.toISOString(), timeZone: 'America/Chicago' },
        end:         { dateTime: end.toISOString(),   timeZone: 'America/Chicago' },
        attendees:   guests.map(function(g) { return { email: g }; }),
        conferenceData: {
          createRequest: {
            requestId:             requestId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };

      var created = Calendar.Events.insert(eventResource, 'primary', {
        conferenceDataVersion: 1,
        sendUpdates:           'all',
      });

      var entryPoints = created && created.conferenceData && created.conferenceData.entryPoints;
      if (entryPoints && entryPoints.length) {
        for (var i = 0; i < entryPoints.length; i++) {
          if (entryPoints[i].entryPointType === 'video' && entryPoints[i].uri) {
            return entryPoints[i].uri;
          }
        }
        return entryPoints[0].uri || '';
      }
      return created && created.hangoutLink ? created.hangoutLink : '';
    } catch (err) {
      Logger.log('createBookingEvent: Meet generation failed, falling back to plain event — ' + err);
    }
  }

  // ── Phone call (or Meet fallback): plain calendar event, no Meet link. ──
  CalendarApp.getDefaultCalendar().createEvent(title, start, end, {
    description: desc,
    guests:      guests.join(','),
    sendInvites: true,
  });
  return '';
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
   CUSTOM SHEETS MENU
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
 * Stores SPREADSHEET_ID and SCRIPT_URL in Script Properties.
 * Run this once (STEP 4). Values persist across all future redeploys and
 * never need to be set again unless the credentials themselves change.
 */
function setProperties() {
  PropertiesService.getScriptProperties().setProperties({
    'SPREADSHEET_ID': '1Z5Eyn9F4SoOYg4dJ0cDDorfnvqVbn_uYsUxDkPn12wY',
    'SCRIPT_URL': 'https://script.google.com/macros/s/AKfycbzfFHPUSP4bUc-Xu1Ma9179bk_dsprrqswaKljeV8ZUmB5Q0gOl9UVtPTqKt4IXeZgBqg/exec'
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
  if (!sheet) { Logger.log('appendRow: tab not found — ' + tabName); return; }
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
