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
    // The unified schema's one lead table (UNIFIED_LEAD_HEADERS). It does NOT
    // exist in the live Sheet yet: setupSpreadsheet() still creates the nine
    // legacy tabs below, and creating this one is a later stage of the
    // migration. Named here so the migrated functions have one definition site
    // for it rather than a literal 'Leads' scattered through the file.
    LEADS:             'Leads',

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
    ASSET_OWNERS:      'AxisPoint Existing Asset Owners',
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


/* ════════════════════════════════════════════════════════════
   LEAD TYPE REGISTRY — the single definition site for a lead type
   ════════════════════════════════════════════════════════════

   Adding or changing a lead type means editing THIS OBJECT AND NOTHING ELSE
   in Code.gs. Every consumer below derives from it:

     roleToCategory()          → .category
     categoryTabForRole()      → .tab
     contactGroupForCategory() → .category → .contactGroup
     handleFormSubmission()    → .normalizer, .seedReportsEnabled
     setupSpreadsheet()        → .tab + .tabColor   (leadTabConfigs)
     updateReferrerStatsLegacy() → .tab            (leadTabConfigs)
     handleCategoryEdit()      → .contactGroup      (allCategoryContactGroups)

   Before this registry existed, those seven consumers each carried their own
   hand-maintained copy of the role list, and nothing kept them in sync. When
   `existing_asset_owner` was added, it was entered into some of them and not
   others — most consequentially CONTACT_GROUPS, so every EAO lead was created
   as a Google Contact with no category group. That class of bug is now
   structurally impossible: omitting a field here is a visible hole in one
   object, not a silent absence spread across a 3,000-line file.

   Field contract, per entry:
     category           Category column value. Also the key contactGroupForCategory
                        and the onEdit Category handler match on.
     tab                Per-role category tab name, or null for a role that
                        deliberately has none. Every role additionally lands in
                        Lifetime Leads + Active Leads regardless of this.
     contactGroup       Google Contact group, or null if the role genuinely
                        needs none.
     tabColor           Header-row color used by setupSpreadsheet(). null when
                        tab is null.
     normalizer         Function reshaping a role-specific wire payload into the
                        generic { person, message, qualData, preferences } shape,
                        or null when the payload already arrives generic.
                        Applied by handleFormSubmission before anything reads it.
     seedReportsEnabled Whether a new row on this role's tab gets its
                        'Reports Enabled' toggle seeded TRUE.

   Declaration order is meaningful in exactly one place: setupSpreadsheet()
   creates missing tabs in this order. It matches the pre-registry literal array
   so a fresh spreadsheet comes out tab-for-tab identical to an existing one.

   NOTE: 'Client' is a Category value too, but it is NOT a lead type — it is a
   status a lead is promoted into via the Status column. It is therefore absent
   here and handled explicitly in contactGroupForCategory().

   .tab / .tabColor — DO NOT REMOVE YET (verified Stage 9, 2026-07-14). These become
   meaningless under the unified schema, but they are STILL READ by code that survives
   until cutover: the legacy bodies (persistNewLeadLegacy, onSheetEditLegacy, legacy
   setupSpreadsheet, updateReferrerStatsLegacy) and every §4 delete-at-cutover function
   (the header audit/repair family, eaoBackfillPlan, categoryTabForRole →
   setCategoryTabStatus). Removing these fields now would break the legacy branch the
   staging pattern requires to stay byte-for-byte intact. They come out AT CUTOVER,
   together with the code that reads them — it is a line item on the cutover checklist
   in UNIFIED_SCHEMA_MIGRATION_PLAN.md, not a Stage 9 change. */
var LEAD_TYPES = {
  investor: {
    category:           'Investor',
    tab:                CONFIG.TABS.INVESTORS,
    contactGroup:       CONFIG.CONTACT_GROUPS.INVESTORS,
    tabColor:           '#24A5BC',
    normalizer:         null,
    seedReportsEnabled: false,
    // assetClasses + timeline come from the prefs step, which ONLY the investor
    // flow reaches (ContactForm.tsx:159). aum + experience come from Step2Context.
    detailsFields:      ['aum', 'experience', 'assetClasses', 'timeline'],
    detailsFrom:        'qualData',
  },

  referral: {
    category:           'Referral Partner',
    tab:                CONFIG.TABS.REFERRAL_PARTNERS,
    contactGroup:       CONFIG.CONTACT_GROUPS.REFERRAL_PARTNERS,
    tabColor:           '#38285D',
    // New referral partners default to receiving the monthly referral summary
    // until they explicitly opt out in the sheet.
    normalizer:         null,
    seedReportsEnabled: true,
    detailsFields:      ['profession', 'clients', 'referralIntent'],
    detailsFrom:        'qualData',
  },

  pro: {
    category:           'RE Professional',
    tab:                CONFIG.TABS.RE_PROFESSIONALS,
    contactGroup:       CONFIG.CONTACT_GROUPS.RE_PROFESSIONALS,
    tabColor:           '#9F328C',
    normalizer:         null,
    seedReportsEnabled: false,
    detailsFields:      ['proRole', 'markets', 'proIntent'],
    detailsFrom:        'qualData',
  },

  existing_asset_owner: {
    category:           'Existing Asset Owner',
    tab:                CONFIG.TABS.ASSET_OWNER,   // 'Existing Asset Owners'
    contactGroup:       CONFIG.CONTACT_GROUPS.ASSET_OWNERS,
    tabColor:           '#1A8799',
    // Function declarations are hoisted before these var initializers run, so
    // referencing normalizeEaoPayload here is safe despite it being defined
    // ~1,400 lines below.
    normalizer:         normalizeEaoPayload,
    seedReportsEnabled: false,
    // EAO is the ONE type whose detail fields live on the payload's TOP LEVEL, not
    // in qualData — its flow (buildEAOPayload) never had a qualData step. The
    // normalizer adds the generic fields and never strips these, so they are still
    // readable here.
    detailsFields:      ['portfolio_type', 'portfolio_composition', 'property_type',
                         'units', 'sqft', 'asset_breakdown', 'current_situation',
                         'pressing_issue'],
    detailsFrom:        'payload',
  },

  submit_referral: {
    category:           'Referral',
    // No per-role tab BY DESIGN: the submitter's own lead lives in
    // Active/Lifetime only, while the referral relationship is logged to the
    // Referrals tab. null here is an assertion, not an omission.
    tab:                null,
    // Likewise no contact group: submitting a referral does not itself
    // categorize the submitter.
    contactGroup:       null,
    tabColor:           null,
    normalizer:         null,
    seedReportsEnabled: false,
    // Every one of these three is read by NOTHING today — 100% of this lead type's
    // qualified data is discarded by the legacy row builder. It is the biggest
    // single beneficiary of the unified Details blob. Plus `referred` (see
    // buildLeadDetails), which stops being prose glued onto the message.
    detailsFields:      ['relationship', 'fit', 'awareness'],
    detailsFrom:        'qualData',
  },
};

/** Registry entry for a wire role value, or null if the role is unknown. */
function leadTypeFor(role) {
  return (role && Object.prototype.hasOwnProperty.call(LEAD_TYPES, role))
    ? LEAD_TYPES[role]
    : null;
}

/** Every registry entry that owns a physical category tab, in declaration
 *  order, as { name, color } — the shape setupSpreadsheet() consumes. */
function leadTypeTabConfigs() {
  return Object.keys(LEAD_TYPES)
    .filter(function(role) { return !!LEAD_TYPES[role].tab; })
    .map(function(role) {
      return { name: LEAD_TYPES[role].tab, color: LEAD_TYPES[role].tabColor };
    });
}

/** The full ordered tab list every lead tab shares LEAD_HEADERS across: the
 *  three cross-role tabs, then each role's category tab, then the two terminal
 *  tabs. setupSpreadsheet(), updateReferrerStatsLegacy(), the header audit/repair
 *  functions, and onSheetEdit's lead-tab guard all read this, so the set of "lead
 *  tabs" has exactly one definition — the skew between such lists is what let the
 *  Existing Asset Owners tab go missing.
 *
 *  This whole list dies at the unified-schema cutover: one table, no tab list. */
function leadTabConfigs() {
  return [
    { name: CONFIG.TABS.ACTIVE_LEADS,   color: '#24A5BC' },
    { name: CONFIG.TABS.LIFETIME_LEADS, color: '#38285D' },
    { name: CONFIG.TABS.COLD_LEADS,     color: '#5A5270' },
  ].concat(leadTypeTabConfigs(), [
    { name: CONFIG.TABS.CLIENTS,        color: '#1A8799' },
    { name: CONFIG.TABS.ARCHIVE,        color: '#9490A8' },
  ]);
}

/** Every category-level Google Contact group: one per registry entry that has
 *  one, plus the status-derived Clients group. handleCategoryEdit() clears all
 *  of these off a contact before applying the new one, so a group missing from
 *  this list would linger on a re-categorized contact forever. */
function allCategoryContactGroups() {
  var groups = Object.keys(LEAD_TYPES)
    .map(function(role) { return LEAD_TYPES[role].contactGroup; })
    .filter(Boolean);
  groups.push(CONFIG.CONTACT_GROUPS.CLIENTS);
  return groups;
}

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

/* ── Per-tab extra columns ──
   The Referral Partners tab carries one extra column beyond LEAD_HEADERS: a
   per-partner toggle for the monthly referral-summary email. Blank/TRUE =
   enabled; only an explicit FALSE opts a partner out.

   This column is located by NAME at runtime (headerIndex), never by position.
   It used to be `var REPORTS_ENABLED_COL = LEAD_HEADERS.length`, which silently
   encoded "Reports Enabled is whatever sits right after the standard headers".
   Appending 'Heard About' to LEAD_HEADERS therefore slid the constant from 30 to
   31 while the live sheet still had Reports Enabled at 31 — so the seed write
   landed one cell to the right and the appended lead row overwrote the toggle.
   Name-based lookup means a column can now be inserted anywhere in LEAD_HEADERS
   without anyone having to reason about what it does to the extra columns. */
var REPORTS_ENABLED_HEADER = 'Reports Enabled';   // not in LEAD_HEADERS: a per-tab extra

/* The exact header row a given lead tab is supposed to have, in order.
   Every lead tab is plain LEAD_HEADERS except Referral Partners, which carries
   the extra Reports Enabled toggle after them.

   Single definition site. setupSpreadsheet() writes new tabs from this,
   leadTabHeaderAudit() compares live tabs against it, and
   rewriteLeadTabHeaderRow() rewrites from it — so "what a healthy tab looks
   like" can never mean three different things in three places.

   NOTE: 'Heard About' is ALREADY the last element of LEAD_HEADERS. Anything that
   concatenates it on again produces a duplicate column. */
function expectedHeadersFor(tabName) {
  return tabName === CONFIG.TABS.REFERRAL_PARTNERS
    ? LEAD_HEADERS.concat([REPORTS_ENABLED_HEADER])
    : LEAD_HEADERS.slice();
}

/* Header names DERIVED from the schema rather than re-typed. LEAD_HEADERS + COLS
   are the single source of truth for the standard layout, so any code needing a
   standard column's name reads it from there. A hand-copied literal is a second
   definition site that can silently drift from the first. */
var HEARD_ABOUT_HEADER = LEAD_HEADERS[COLS.HEARD_ABOUT];   // 'Heard About'
var LEAD_ID_HEADER     = LEAD_HEADERS[COLS.LEAD_ID];       // 'Lead ID'
var CATEGORY_HEADER    = LEAD_HEADERS[COLS.CATEGORY];      // 'Category'

/* -- Resilient header matching --
   A header cell typed or pasted by a human is not guaranteed to be byte-identical
   to its LEAD_HEADERS constant. Observed and plausible drift: differing case
   ('Lead Id'), a doubled internal space ('Lead  ID'), a no-break space pasted in
   place of a normal one, or a stray zero-width character. An exact === compare
   rejects all of these and reports the column as ABSENT, which is a far more
   damaging failure than the cosmetic difference that caused it.

   normalizeHeaderName collapses that entire class: zero-width characters are
   deleted, every run of whitespace becomes a single space, then trim + lowercase.
   Two headers a human would call "the same header" compare equal.

   JS \s already matches U+00A0 (no-break space) and U+FEFF (byte-order mark),
   so those need no special case. U+200B..U+200D (zero-width space, non-joiner,
   joiner) are NOT in \s, so they are stripped outright rather than collapsed to
   a space, which would wrongly split "Lead{ZWSP}ID" into two words.

   Applied to header NAMES only, never to cell data. Data values are written by
   this script and are compared exactly, on purpose. */
function normalizeHeaderName(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[\u200B-\u200D]/g, '')      // zero-width chars: delete, do not turn into a space
    .replace(/\s+/g, ' ')            // \s already covers U+00A0 and U+FEFF
    .trim()
    .toLowerCase();
}

/* 0-based index of `headerName` within an already-read header ROW (an array),
   matched resiliently. -1 if absent. */
function findHeaderIndex(headerRow, headerName) {
  var want = normalizeHeaderName(headerName);
  if (!want) return -1;
  for (var i = 0; i < headerRow.length; i++) {
    if (normalizeHeaderName(headerRow[i]) === want) return i;
  }
  return -1;
}

/* Renders a live header row character by character, so a mismatch that is
   invisible on screen (NBSP vs space, trailing zero-width char, wrong case) is
   immediately readable in the execution log. This is the diagnostic that turns
   "header not found" from a dead end into a one-line answer. */
function describeHeaderRow(headerRow) {
  return headerRow.map(function(v, i) {
    var t = String(v === null || v === undefined ? '' : v);
    var codes = t.split('').map(function(c) { return c.charCodeAt(0); }).join(',');
    return '    col ' + (i + 1) + ': "' + t + '"  len=' + t.length + '  codes=[' + codes + ']';
  }).join('\n');
}

/* Builds (and logs) the error thrown when even a resilient lookup finds nothing.
   At this point the problem is real, not cosmetic, so dump everything needed to
   diagnose it without anyone having to write a separate probe function. */
function headerLookupError(sheetName, headerRow, headerName) {
  var msg = 'No "' + headerName + '" header on "' + sheetName + '". ' +
            'Matched case-insensitively, ignoring surrounding and repeated whitespace, ' +
            'so this is a real mismatch, not a formatting one.\n' +
            '  Live header row of "' + sheetName + '", character by character:\n' +
            describeHeaderRow(headerRow) + '\n' +
            '  Expected (from LEAD_HEADERS): "' + headerName + '"  normalized: "' +
            normalizeHeaderName(headerName) + '"';
  Logger.log(msg);
  return new Error(msg);
}

/* 0-based index of `headerName` in a sheet's ACTUAL header row, or -1 if absent.
   Reads the sheet rather than trusting a compile-time constant, so it stays
   correct on tabs that have not yet been migrated to the current layout.

   NOTE: this still matches on trim() + exact case, unlike findHeaderIndex above.
   Its remaining caller (reportsEnabledIndex) treats -1 as a meaningful "column
   absent" state rather than an error, so the exact match is acceptable there and
   is deliberately left as its own concern. (resolveCols, added later, uses the
   resilient findHeaderIndex for the standard columns and THROWS on a real miss.) */
function headerIndex(sheet, headerName) {
  if (!sheet) return -1;
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return -1;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var want = String(headerName).trim();
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === want) return i;
  }
  return -1;
}

/* 0-based index of the Referral Partners "Reports Enabled" toggle, or -1.
   -1 is a real state (un-migrated tab), and every caller treats it as
   "cannot determine → leave the partner enabled" rather than guessing a column. */
function reportsEnabledIndex(sheet) {
  var idx = headerIndex(sheet, REPORTS_ENABLED_HEADER);
  if (idx === -1) {
    Logger.log('reportsEnabledIndex: no "' + REPORTS_ENABLED_HEADER + '" header on "' +
               (sheet ? sheet.getName() : '(null sheet)') + '"');
  }
  return idx;
}

/* ── resolveCols(sheet): name-verified column map for a live lead tab ──
   THE STANDARD for reading a lead tab's columns. Instead of trusting the
   compile-time COLS constant (which encodes where a column SHOULD be), this reads
   the sheet's ACTUAL header row and returns a COLS-shaped object whose every
   value is the column's real position on that tab, resolved by name through the
   same normalizeHeaderName/findHeaderIndex path every other lookup uses.

   WHY THIS EXISTS. Fourteen functions read live rows as row[COLS.SOMETHING] with
   zero verification that the tab's header actually matches COLS. A drifted header
   (a column inserted, deleted, or reordered by hand, or a tab left un-migrated)
   makes every one of those reads silently return the wrong cell — and six of the
   fourteen WRITE, two DELETE rows. That is the exact class of bug behind the
   2026-07-08 header-corruption incident. Resolving by name turns "silently read
   the wrong column" into "read the right column regardless of order".

   FAILS LOUD, NEVER SILENT. If a required standard header is absent, it throws
   headerLookupError (with the full char-by-char header dump) rather than putting a
   -1 into a caller that never checks for it. Callers are wrapped in try/catch that
   logs, so a drifted tab surfaces as a logged, diagnosable error instead of
   corrupted data. Refusing to run on a broken tab is the correct outcome here.

   SCOPE. Resolves the 31 standard LEAD_HEADERS columns (the COLS keys) only. The
   Referral Partners "Reports Enabled" extra is deliberately not included — it is a
   per-tab extra resolved separately by reportsEnabledIndex(). Not for the Referrals
   or Subscribers tabs, which use their own schemas (REFERRAL_HEADERS / SCOLS).

   COST. One getRange read of row 1, then 31 name lookups over a ~31-cell array.
   Call it ONCE per sheet, before any row loop — never per row. */
function resolveCols(sheet) {
  if (!sheet) throw new Error('resolveCols: no sheet provided.');
  var name = sheet.getName();
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    throw new Error('resolveCols: "' + name + '" has no header row to resolve columns from.');
  }
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var resolved = {};
  Object.keys(COLS).forEach(function(key) {
    var headerName = LEAD_HEADERS[COLS[key]];   // canonical name for this COLS key
    var idx = findHeaderIndex(headerRow, headerName);
    if (idx === -1) throw headerLookupError(name, headerRow, headerName);
    resolved[key] = idx;
  });
  return resolved;
}

/* ════════════════════════════════════════════════════════════
   UNIFIED SCHEMA  —  the one "Leads" table
   See /docs/UNIFIED_SCHEMA_MIGRATION_PLAN.md. Being migrated in stages.

   MIGRATION STATE: DONE AND LIVE. All 9 stages are migrated and the cutover has
   happened — USE_UNIFIED_SCHEMA below is the single switch and it is ON, so every
   dispatcher routes to its xxxUnified body and the one "Leads" table is what
   production reads and writes. The two schemas are NOT both live: the xxxLegacy
   bodies survive only as the rollback path, wired to nothing while the switch is
   true. Deleting them is Phase D. (This block read "Stage 1 of N ... it is off"
   until 2026-07-16 — stale since the 2026-07-15 cutover.)

   THE STAGING PATTERN that produced this, kept as the record of how it was done:
     1. Add the unified implementation as its own function (xxxUnified).
     2. Keep the legacy body verbatim, renamed xxxLegacy, marked DELETE-AT-CUTOVER.
     3. Turn the original name into a dispatcher on USE_UNIFIED_SCHEMA.
     4. Test BOTH branches. The legacy test proves prod is still intact today;
        the unified test proves the migration is right before it ships.
   The cutover (final stage) flips this one flag, then deletes every xxxLegacy
   body and this comment. Nothing is deleted before then — that is the rollback
   path (plan §6).

   WHY A FLAG AND NOT "does the Leads tab exist?": tab-existence would silently
   flip the whole backend the moment somebody ran setupSpreadsheet() by hand,
   mid-migration, with half the functions still writing to the old tabs. A flag
   makes the cutover a reviewed line of code instead of a side effect.
   ════════════════════════════════════════════════════════════ */

/* THE SWITCH. true = every function reads/writes the one unified Leads table.
   false = the legacy per-role tabs.

   FLIPPED TO true 2026-07-15 — cutover Phase B, step 4 (plan §8). All 9 stages are
   migrated. This is a code change only; it ships NOTHING on its own — the live
   /exec endpoint is a pinned deployment, so this goes live only via
   `clasp push` + `clasp deploy -i <prod id>`.

   PHASE A IS DONE (confirmed 2026-07-16): `setupSpreadsheetUnified()` was run by
   hand from the Apps Script editor and reported "Leads + Referrals + Subscribers
   ready (3 tabs)", and the switch has since been pushed and deployed to the pinned
   production deployment (@25). Live Investor and EAO submissions through the real
   endpoint both produced correct Leads rows. (This block carried a "that manual run
   has NOT happened, do not deploy" warning until 2026-07-16 — stale once Phase A
   ran. The ordering it describes still binds any future rebuild of the tab: with
   the switch true and the Leads tab absent, every migrated function throws.)

   ROLLBACK: set back to false, `clasp push` + `clasp deploy -i`. The legacy tabs and
   xxxLegacy bodies are intact until Phase D. */
var USE_UNIFIED_SCHEMA = true;

/* How long updateReferrerStats waits for the script lock before giving up and
   logging a repairable failure. Ten seconds is far longer than the critical
   section (one sheet read + a handful of cell writes) needs, so hitting it means
   real contention, not slowness — while still being short enough that a jammed
   lock cannot hold a form submission hostage. */
var REFERRAL_STATS_LOCK_MS = 10000;

/* How long the cold sweep waits for the same script lock. Longer than the
   referral-credit timeout because the sweep is a background job that nobody is
   waiting on, and because its critical section is genuinely bigger (a full table
   read plus a Status write per stale lead). Giving up is cheap and safe: the next
   scheduled sweep picks up exactly the same leads, only staler. */
var COLD_SWEEP_LOCK_MS = 30000;

/* How long a human's Status edit waits for the same lock. Short: an onEdit trigger
   should not sit blocked behind a long sweep. Losing the race here costs only the
   Contacts group update — the Status edit itself is already saved in the Sheet by
   the UI before this handler ever runs. */
var STATUS_EDIT_LOCK_MS = 10000;

/* How long a hand-linked referral waits for the same lock before giving up. Like
   the status edit, this is an onEdit trigger with a human watching, so it should
   not sit blocked behind a long sweep. Losing the race costs nothing permanent:
   nothing partial is written, and re-typing the email in the cell retries. */
var MANUAL_LINK_LOCK_MS = 10000;

/* How long a resubmission waits for the same lock before giving up. A visitor is
   waiting on this request, so it must not block for long. Losing the race costs the
   new message (logged for manual repair), never the lead itself — the row already
   exists and its ID is still returned. */
var RESUBMISSION_LOCK_MS = 10000;

/* Column order is the plan's §1 table, verbatim. Order carries NO meaning at
   runtime — every live read resolves by NAME through resolveUnifiedCols(), and
   only a fresh row being constructed is positional. The grouping (identity, then
   the referral block that must stay searchable, then contact/context, then the
   blob) is for the reader of THIS file, not for anyone eyeballing the Sheet:
   grid legibility is explicitly not a design input here (see the Architecture
   Decision in backend-architecture.md). */
var UNIFIED_LEAD_HEADERS = [
  'Lead ID', 'Timestamp', 'Category', 'Status',
  'Email', 'First Name', 'Last Name',
  'Referral Code',
  'Referred By Lead ID', 'Referred By Name', 'Referred By Email', 'Referred By Code',
  'Match Type', 'Referral Chain', 'Chain Depth',
  'Direct Referrals', 'Total Downstream', 'Last Referral Date',
  'Phone', 'Company', 'Role', 'Source', 'Heard About',
  'Reports Enabled',
  'Details',
];

/* 0-based indexes into UNIFIED_LEAD_HEADERS. Like COLS, this records where a
   column SHOULD be — it is the layout builder (a future buildLeadRow) writes,
   never how a live row is read. Live reads go through resolveUnifiedCols(). */
var UCOLS = {
  LEAD_ID:            0,
  TIMESTAMP:          1,
  CATEGORY:           2,
  STATUS:             3,
  EMAIL:              4,
  FIRST_NAME:         5,
  LAST_NAME:          6,
  REFERRAL_CODE:      7,
  REF_BY_LEAD_ID:     8,
  REF_BY_NAME:        9,
  REF_BY_EMAIL:       10,
  REF_BY_CODE:        11,
  MATCH_TYPE:         12,
  REFERRAL_CHAIN:     13,
  CHAIN_DEPTH:        14,
  DIRECT_REFERRALS:   15,
  TOTAL_DOWNSTREAM:   16,
  LAST_REFERRAL_DATE: 17,
  PHONE:              18,
  COMPANY:            19,
  ROLE:               20,
  SOURCE:             21,
  HEARD_ABOUT:        22,
  REPORTS_ENABLED:    23,
  DETAILS:            24,
};

/* resolveCols() for the unified table. Identical contract, deliberately:
   resolve every column by NAME through the same resilient findHeaderIndex path,
   and THROW headerLookupError on a genuine miss — never return a silent -1 that
   a caller will happily use as a column index. One table does not mean a trusted
   header row; a human can still mangle it in the live Sheet.

   Call once per sheet, before any row loop. Never per row. */
function resolveUnifiedCols(sheet) {
  if (!sheet) throw new Error('resolveUnifiedCols: no sheet provided.');
  var name = sheet.getName();
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    throw new Error('resolveUnifiedCols: "' + name + '" has no header row to resolve columns from.');
  }
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var resolved = {};
  Object.keys(UCOLS).forEach(function(key) {
    var headerName = UNIFIED_LEAD_HEADERS[UCOLS[key]];
    var idx = findHeaderIndex(headerRow, headerName);
    if (idx === -1) throw headerLookupError(name, headerRow, headerName);
    resolved[key] = idx;
  });
  return resolved;
}

/** The one lead table. null when it does not exist (i.e. before the cutover). */
function leadsTable() {
  return tab(CONFIG.TABS.LEADS);
}

/* The ancestors of a lead, from its Referral Chain cell: origin first, IMMEDIATE
   REFERRER LAST. The chain is built as `referrer's chain + '|' + referrer's Lead
   ID` (buildReferralMatch), so it holds every ancestor and nobody else — in
   particular NOT the lead's own ID, which is only appended to the NEXT lead's
   chain. That is what makes multi-level attribution a plain split, with no
   filtering and no walking of parent rows.

   Deduped: a hand-edited or malformed chain that repeats an ID must still credit
   that ancestor exactly once, because the counter is a count of downstream leads,
   not a count of chain entries. */
function chainAncestors(chain) {
  var seen = {};
  return String(chain || '')
    .split('|')
    .map(function(id) { return String(id || '').trim(); })
    .filter(function(id) {
      if (!id) return false;
      if (Object.prototype.hasOwnProperty.call(seen, id)) return false;
      seen[id] = true;
      return true;
    });
}

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
/* ── existingReferralCodes: the collision set ── MIGRATED (Stage 7).
   generateReferralCode() collision-checks against this. If it silently returns an
   empty map (missing tab), codes stop being collision-checked — a silent failure,
   and the second reason handleFormSubmission could not migrate alone. */
function existingReferralCodes() {
  return USE_UNIFIED_SCHEMA ? existingReferralCodesUnified() : existingReferralCodesLegacy();
}

function existingReferralCodesUnified() {
  var map   = {};
  var sheet = leadsTable();
  if (!sheet || sheet.getLastRow() < 2) return map;   // no data rows → nothing to collide with
  var C = resolveUnifiedCols(sheet);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var code = String(data[i][C.REFERRAL_CODE] || '').toUpperCase();
    if (code) map[code] = true;
  }
  return map;
}

/* LEGACY — unchanged. DELETE AT CUTOVER. */
function existingReferralCodesLegacy() {
  var map   = {};
  var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return map;   // no data rows → nothing to collide with
  var C = resolveCols(sheet);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var c = String(data[i][C.REFERRAL_CODE] || '').toUpperCase();
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
    // Some roles arrive with a role-specific wire shape (Existing Asset Owner
    // sends a flat contact/property object). Their registry entry names a
    // normalizer that reshapes the payload IN PLACE into the generic
    // { person, message, qualData, preferences } form, so every downstream step
    // below runs through one code path with no per-role branching.
    var leadType = leadTypeFor(payload.role);
    if (leadType && leadType.normalizer) leadType.normalizer(payload);

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

    /* The ONLY schema-dependent step in this function. Everything else here — the
       normalizer, the booking event, Contacts, both emails, the JSON response — is
       identical under both schemas, and the other schema-dependent calls
       (findExistingLead, matchReferrer, buildLeadRow, updateReferrerStats) are
       already dispatchers of their own. So the switch lives on the persistence
       block rather than on a duplicated copy of this whole orchestration: two
       copies of the booking/email logic to hand-sync until cutover is precisely
       the failure mode that keeps biting this project (see the email-template
       mirrors in CLAUDE.md). */
    persistNewLead(row, leadId, leadType);

    // Update referrer stats if matched
    if (referralMatch.found) {
      // The chain is the new lead's ancestors — every one of them is credited a
      // Total Downstream, not just referrerLeadId. See updateReferrerStats.
      updateReferrerStats(referralMatch.referrerLeadId, referralMatch.chain);
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

/* ── persistNewLead: write the new lead row ── MIGRATED (Stage 7).
   This is the schema boundary inside the submission path. */
function persistNewLead(row, leadId, leadType) {
  return USE_UNIFIED_SCHEMA
    ? persistNewLeadUnified(row)
    : persistNewLeadLegacy(row, leadId, leadType);
}

/* ONE row, ONE table, ONE append. The whole reason this migration exists.
   No Lifetime + Active + category-tab triplication, no category-tab-exists check, no
   seedReportsEnabled seed (buildLeadRowUnified already wrote Reports Enabled as an
   ordinary column, Stage 6), and therefore none of the ways those could silently
   drop a row — which is exactly how every EAO category row was lost. */
function persistNewLeadUnified(row) {
  var sheet = leadsTable();
  if (!sheet) {
    // Never silent: with one table there is no second copy to fall back on.
    throw new Error('persistNewLead: the "' + CONFIG.TABS.LEADS + '" table does not exist. ' +
                    'Run setupSpreadsheet() from the Apps Script editor before enabling the ' +
                    'unified schema.');
  }

  /* ── The append is NAME-PROJECTED, not positional ──
     buildLeadRowUnified hands us the CANONICAL layout (UNIFIED_LEAD_HEADERS order).
     Appending that array directly would assume the live header is still in that
     order — and every reader in this file has, for good reason, refused to make that
     assumption for years.

     THE BUG THIS CLOSES: a human reorders (or inserts a column into) the live Leads
     header. Every reader keeps working, because resolveUnifiedCols matches by name.
     The writer, appending positionally, silently writes Email into Category, the
     Details blob into Phone, and so on — corrupting every subsequent lead with
     nothing anywhere to catch it. The readers' tolerance is exactly what would have
     hidden it: the sheet looks fine and the code never complains.

     resolveUnifiedCols throws headerLookupError on a genuine miss, so a header that
     is broken rather than merely reordered REFUSES the write instead of guessing at
     a column. Refusing to run on a broken tab is the intended outcome — the same
     contract every reader already has. */
  var C     = resolveUnifiedCols(sheet);
  var width = Math.max(UNIFIED_LEAD_HEADERS.length, sheet.getLastColumn());
  sheet.appendRow(projectLeadRowByName(row, C, width));
}

/* Re-lays a canonical lead row onto a sheet's REAL column positions.

   `canonicalRow` is indexed by UCOLS (where a column SHOULD be); `cols` is a
   resolveUnifiedCols map (where it ACTUALLY is). Every value is moved from the
   former to the latter, so the two can differ freely.

   `width` is the sheet's real width, so a human's extra columns beyond the 25 are
   preserved as blanks rather than being clipped off the end of the appended row. */
function projectLeadRowByName(canonicalRow, cols, width) {
  var out = [];
  for (var i = 0; i < width; i++) out.push('');

  Object.keys(UCOLS).forEach(function(key) {
    var value = canonicalRow[UCOLS[key]];
    out[cols[key]] = (value === undefined || value === null) ? '' : value;
  });
  return out;
}

/* LEGACY — unchanged. DELETE AT CUTOVER. Appends the SAME row to Lifetime Leads,
   Active Leads, and the role's category tab: three copies of one lead. */
function persistNewLeadLegacy(row, leadId, leadType) {
  appendRow(CONFIG.TABS.LIFETIME_LEADS, row);
  appendRow(CONFIG.TABS.ACTIVE_LEADS,   row);

  // Same value categoryTabForRole(payload.role) returned: the registry's .tab.
  var categoryTab = leadType ? leadType.tab : null;
  if (categoryTab) {
      // appendRow() logs and returns when a tab is absent, so a category tab that
      // was never created drops this row silently. Check first and log loudly:
      // this is exactly how every Existing Asset Owner category row was lost
      // before the tab existed. Lifetime/Active already hold the lead, so a
      // missing tab must not fail the submission — but it must not be quiet either.
      if (!tab(categoryTab)) {
        Logger.log('handleFormSubmission: category tab "' + categoryTab + '" does not exist; ' +
                   'lead ' + leadId + ' was written to Lifetime/Active only. ' +
                   'Run setupSpreadsheet() to create it, then backfill.');
      } else {
        appendRow(categoryTab, row);
        // Registry-driven: referral partners default to "Reports Enabled = TRUE"
        // so they receive the monthly summary until explicitly opted out.
        if (leadType && leadType.seedReportsEnabled) {
          var partnerSheet = tab(categoryTab);
          var reCol = reportsEnabledIndex(partnerSheet);
          if (reCol >= 0) {
            partnerSheet.getRange(partnerSheet.getLastRow(), reCol + 1).setValue(true);
          } else {
            // Blank reads as enabled downstream, so the partner still gets their
            // summary; log loudly rather than writing the seed to a guessed cell.
            Logger.log('handleFormSubmission: "' + REPORTS_ENABLED_HEADER + '" column missing on ' +
                       categoryTab + '; skipped seeding it for lead ' + leadId +
                       '. Run repairAllDriftedLeadTabHeaders() to repair the tab layout.');
          }
        }
      }
  }
}

/* ── Dedupe handler ── */
/* ── handleResubmission ── MIGRATED (Stage 7).
   The other branch of handleFormSubmission's dedupe decision: a known email came
   back, so update the row it already has instead of creating a second one. */
function handleResubmission(existing, payload) {
  return USE_UNIFIED_SCHEMA
    ? handleResubmissionUnified(existing, payload)
    : handleResubmissionLegacy(existing, payload);
}

/* THE UNIFIED IMPLEMENTATION.

   WHY THIS TAKES THE LOCK, even though it "looks like a simple append":
   it is a READ-MODIFY-WRITE OF THE DETAILS JSON BLOB on a row it did not create.
   Parse the blob, append to Details.message, re-stringify, write it back. Two
   resubmissions landing together — or a resubmission racing the cold sweep — can
   interleave read-read-write-write and LOSE one of the messages entirely, silently.
   That is the same shape as the counter race in Stage 1, and a blob is worse than a
   counter: a lost increment is a wrong number, a lost blob write is a lost paragraph
   the visitor actually typed.

   The lock is scoped to the read-modify-write ONLY, per the Stage-5 reentrancy rule:
   the Gmail notification happens after it is released, and nothing inside the
   critical section takes the script lock again. */
function handleResubmissionUnified(existing, payload) {
  var sheet = leadsTable();
  if (!sheet) {
    Logger.log('handleResubmission: no "' + CONFIG.TABS.LEADS + '" tab.');
    return jsonResponse({ success: false, error: 'Leads table not found.' });
  }

  var rowIndex = existing.rowIndex;   // 1-based sheet row
  var today    = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
  var p        = payload.person || {};

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(RESUBMISSION_LOCK_MS)) {
    /* Non-fatal, loud, and honest to the VISITOR too. The submission is not lost as
       far as they are concerned — their original lead row still exists and we still
       return its Lead ID — but their new message did NOT land, so say so in the log
       with everything needed to re-apply it by hand. Failing the request outright
       would tell a returning visitor their form is broken because somebody else
       submitted at the same moment. */
    Logger.log('handleResubmission: MANUAL REPAIR NEEDED. Could not acquire the script lock ' +
               'within ' + RESUBMISSION_LOCK_MS + 'ms, so row ' + rowIndex + ' was NOT updated. ' +
               'The lead already exists and its ID is being returned, but this resubmission\'s ' +
               'new details were dropped. Message that did not land: "' +
               String(leadMessageText(payload) || '(none)') + '"');
    var known = existing.rowData || [];
    var kc    = existing.cols || UCOLS;
    return jsonResponse({
      success: true,
      leadId: known[kc.LEAD_ID] || '',
      referralCode: known[kc.REFERRAL_CODE] || '',
      resubmission: true,
    });
  }

  var leadId, referralCode;
  try {
    // Re-read the row UNDER the lock. `existing.rowData` was read before we held it,
    // so treating it as current is exactly the stale-snapshot bug this lock exists
    // to prevent.
    var C   = resolveUnifiedCols(sheet);
    var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

    leadId       = String(row[C.LEAD_ID] || '');
    referralCode = String(row[C.REFERRAL_CODE] || '');

    // Fill in fields that were previously blank. A resubmission adds information;
    // it never overwrites what we already knew.
    if (!row[C.FIRST_NAME] && p.firstName) sheet.getRange(rowIndex, C.FIRST_NAME + 1).setValue(p.firstName);
    if (!row[C.LAST_NAME]  && p.lastName)  sheet.getRange(rowIndex, C.LAST_NAME  + 1).setValue(p.lastName);
    if (!row[C.PHONE]      && p.phone)     sheet.getRange(rowIndex, C.PHONE      + 1).setValue(p.phone);
    if (!row[C.COMPANY]    && p.company)   sheet.getRange(rowIndex, C.COMPANY    + 1).setValue(p.company);

    /* ── The Details read-modify-write ──
       Message is a Details key now, not a column (settled 2026-07-14), and so is
       booking. A malformed blob must not destroy a resubmission: parse defensively
       and rebuild rather than throwing away the visitor's new message. */
    var details = {};
    var raw = row[C.DETAILS];
    if (raw) {
      try { details = JSON.parse(raw) || {}; }
      catch (e) {
        Logger.log('handleResubmission: Details on row ' + rowIndex + ' is not valid JSON (' + e +
                   '). Preserving it under Details._unparsed rather than discarding it.');
        details = { _unparsed: String(raw) };
      }
    }

    var note = 'Resubmission on ' + today + ' (' + leadId + ')';
    var newMsg = leadMessageText(payload);   // EAO's is pressing_issue; see helper
    if (newMsg) note += '\n\nNew message: ' + newMsg;
    var prior = details.message || '';
    details.message = prior ? prior + '\n\n' + note : note;

    // A booking only lands if we did not already have one — same "add, never
    // overwrite" rule as the columns above.
    var hasBooking = details.booking && details.booking.date;
    if (!hasBooking && payload.booking && payload.booking.date) {
      details.booking = {
        date:     payload.booking.date     || '',
        slot:     payload.booking.slot     || payload.booking.time || '',
        meetType: payload.booking.meetType || '',
        phone:    payload.booking.phone    || '',
        meetLink: (details.booking && details.booking.meetLink) || '',
      };
    }

    sheet.getRange(rowIndex, C.DETAILS + 1).setValue(JSON.stringify(details));
    SpreadsheetApp.flush();   // commit before the lock goes
  } finally {
    lock.releaseLock();
  }

  // Outside the lock: Gmail is slow and the script lock is process-wide.
  try { sendResubmissionNotification(payload, leadId, referralCode); }
  catch (err) { Logger.log('sendResubmissionNotification failed: ' + err); }

  return jsonResponse({
    success: true,
    leadId: leadId,
    referralCode: referralCode,
    resubmission: true,
  });
}

/* LEGACY — unchanged. DELETE AT CUTOVER. It appends the note to the Message COLUMN,
   which the unified schema does not have. */
function handleResubmissionLegacy(existing, payload) {
  var sheet    = tab(CONFIG.TABS.LIFETIME_LEADS);
  var rowIndex = existing.rowIndex;  // 1-based sheet row
  var rowData  = existing.rowData;
  // rowData was read from Lifetime Leads by findExistingLead; resolve the same
  // sheet's live layout so both the reads below and the writes target real cells.
  var C = resolveCols(sheet);
  var existingLeadId       = rowData[C.LEAD_ID];
  var existingReferralCode = rowData[C.REFERRAL_CODE];
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
  var p = payload.person || {};

  // Update any previously-empty fields with new info
  var updates = {};
  if (!rowData[C.FIRST_NAME]   && p.firstName)   updates[C.FIRST_NAME]   = p.firstName;
  if (!rowData[C.LAST_NAME]    && p.lastName)     updates[C.LAST_NAME]    = p.lastName;
  if (!rowData[C.PHONE]        && p.phone)        updates[C.PHONE]        = p.phone;
  if (!rowData[C.COMPANY]      && p.company)      updates[C.COMPANY]      = p.company;
  if (!rowData[C.BOOKING_DATE] && payload.booking && payload.booking.date) {
    updates[C.BOOKING_DATE] = payload.booking.date;
    updates[C.BOOKING_TIME] = payload.booking.slot || payload.booking.time || '';
    updates[C.MEET_TYPE]    = payload.booking.meetType || '';
    updates[C.BOOKING_PHONE]= payload.booking.phone   || '';
  }

  for (var col in updates) {
    sheet.getRange(rowIndex, parseInt(col, 10) + 1).setValue(updates[col]);
  }

  // Append resubmission note to message column
  var existingMsg   = rowData[C.MESSAGE] || '';
  var resubNote     = 'Resubmission on ' + today + ' (' + existingLeadId + ')';
  if (payload.message) resubNote += '\n\nNew message: ' + payload.message;
  var newMsg = existingMsg ? existingMsg + '\n\n' + resubNote : resubNote;
  sheet.getRange(rowIndex, C.MESSAGE + 1).setValue(newMsg);

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

/* ── findExistingLead: the dedupe key ── MIGRATED (Stage 7). */
function findExistingLead(email) {
  return USE_UNIFIED_SCHEMA ? findExistingLeadUnified(email) : findExistingLeadLegacy(email);
}

/* Scans the ONE table instead of Lifetime Leads. If this ever silently returns null
   because the tab is missing, EVERY resubmission becomes a duplicate lead — which is
   exactly why handleFormSubmission could not be migrated before this function was. */
function findExistingLeadUnified(email) {
  if (!email) return null;
  var sheet = leadsTable();
  if (!sheet || sheet.getLastRow() < 2) return null;   // no data rows → no match possible
  var C = resolveUnifiedCols(sheet);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][C.EMAIL] || '').toLowerCase().trim() === email) {
      return { rowIndex: i + 1, rowData: data[i], cols: C };
    }
  }
  return null;
}

/* LEGACY — unchanged. DELETE AT CUTOVER. */
function findExistingLeadLegacy(email) {
  if (!email) return null;
  var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return null;   // no data rows → no match possible
  var C = resolveCols(sheet);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][C.EMAIL] || '').toLowerCase().trim();
    if (rowEmail === email) {
      return { rowIndex: i + 1, rowData: data[i] };
    }
  }
  return null;
}

/* ── Referral matching ── MIGRATED (Stage 7).

   buildReferralMatch is deliberately NOT migrated and NOT duplicated: it takes a row
   plus a COLUMN MAP, and every key it touches (LEAD_ID, FIRST_NAME, LAST_NAME, EMAIL,
   REFERRAL_CODE, REFERRAL_CHAIN) exists in BOTH COLS and UCOLS. It is schema-agnostic
   already, so both branches below call the same one. */
function matchReferrer(payload) {
  return USE_UNIFIED_SCHEMA ? matchReferrerUnified(payload) : matchReferrerLegacy(payload);
}

/* Priority is unchanged and load-bearing: code → email → name. A name match is the
   weakest and is flagged 'pending' downstream, so it must stay last. */
function matchReferrerUnified(payload) {
  var code  = (payload.referralCode    || '').trim();
  var email = (payload.referredByEmail || '').toLowerCase().trim();
  var name  = (payload.referredByName  || '').trim();

  if (!code && !email && !name) return { found: false, matchType: 'none' };

  var sheet = leadsTable();
  if (!sheet || sheet.getLastRow() < 2) return { found: false, matchType: 'none' };
  var C = resolveUnifiedCols(sheet);
  var data = sheet.getDataRange().getValues();

  // 1: referral code
  if (code) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][C.REFERRAL_CODE] || '').toUpperCase() === code.toUpperCase()) {
        return buildReferralMatch(data[i], 'code', C);
      }
    }
  }

  // 2: email
  if (email) {
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][C.EMAIL] || '').toLowerCase().trim() === email) {
        return buildReferralMatch(data[j], 'email', C);
      }
    }
  }

  // 3: name (weakest — flagged for review downstream)
  if (name) {
    var wanted = name.toLowerCase();
    for (var k = 1; k < data.length; k++) {
      var full = (String(data[k][C.FIRST_NAME] || '') + ' ' +
                  String(data[k][C.LAST_NAME]  || '')).toLowerCase().trim();
      if (full && full === wanted) {
        return buildReferralMatch(data[k], 'name', C);
      }
    }
  }

  return { found: false, matchType: 'none' };
}

/* LEGACY — unchanged. DELETE AT CUTOVER. */
function matchReferrerLegacy(payload) {
  var code  = (payload.referralCode    || '').trim();
  var email = (payload.referredByEmail || '').toLowerCase().trim();
  var name  = (payload.referredByName  || '').trim();

  if (!code && !email && !name) {
    return { found: false, matchType: 'none' };
  }

  var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return { found: false, matchType: 'none' };
  var C = resolveCols(sheet);
  var data = sheet.getDataRange().getValues();

  // Priority 1: code match
  if (code) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][C.REFERRAL_CODE] || '').toUpperCase() === code.toUpperCase()) {
        return buildReferralMatch(data[i], 'code', C);
      }
    }
  }

  // Priority 2: email match
  if (email) {
    for (var j = 1; j < data.length; j++) {
      var rowEmail = String(data[j][C.EMAIL] || '').toLowerCase().trim();
      if (rowEmail === email) {
        return buildReferralMatch(data[j], 'email', C);
      }
    }
  }

  // Priority 3: name match (flag for review)
  if (name) {
    var nameLower = name.toLowerCase();
    for (var k = 1; k < data.length; k++) {
      var full = (String(data[k][C.FIRST_NAME] || '') + ' ' + String(data[k][C.LAST_NAME] || '')).toLowerCase().trim();
      if (full && full === nameLower) {
        return buildReferralMatch(data[k], 'name', C);
      }
    }
  }

  return { found: false, matchType: 'none' };
}

/* `cols` is the resolved column map for the sheet referrerRow was read from
   (Lifetime Leads, via matchReferrer). Defaults to COLS only for safety. */
function buildReferralMatch(referrerRow, matchType, cols) {
  var C = cols || COLS;
  var referrerChain = String(referrerRow[C.REFERRAL_CHAIN] || '').trim();
  var referrerLeadId = String(referrerRow[C.LEAD_ID] || '');
  var chain = referrerChain
    ? referrerChain + '|' + referrerLeadId
    : referrerLeadId;
  var depth = chain ? chain.split('|').length : 1;

  return {
    found:             true,
    matchType:         matchType,
    referrerLeadId:    referrerLeadId,
    referrerName:      [referrerRow[C.FIRST_NAME], referrerRow[C.LAST_NAME]].filter(Boolean).join(' '),
    referrerFirstName: String(referrerRow[C.FIRST_NAME] || ''),
    referrerEmail:     String(referrerRow[C.EMAIL] || ''),
    referrerCode:      String(referrerRow[C.REFERRAL_CODE] || ''),
    chain:             chain,
    depth:             depth,
  };
}

/* ── updateReferrerStats: credit a new referral up the chain ──
   MIGRATED (Stage 1 of the unified-schema migration). This is a dispatcher; the
   two implementations below are the real thing. See the UNIFIED SCHEMA block
   above for the staging pattern and the cutover procedure.

   `chain` is the NEW LEAD's Referral Chain — its ancestors, origin first,
   immediate referrer last (buildReferralMatch / handleManualReferralLink both
   build it that way). It is what makes multi-level Total Downstream possible.

   The two counters mean different things, and conflating them is THE
   implementation slip to avoid:
     Direct Referrals  → the IMMEDIATE referrer only. Never propagates up.
     Total Downstream  → EVERY ancestor in the chain, at any depth.
   John refers Steven; Steven refers Maria. Maria's submission gives Steven +1
   Direct and +1 Downstream, and John +1 Downstream ONLY. */
function updateReferrerStats(referrerLeadId, chain) {
  return USE_UNIFIED_SCHEMA
    ? updateReferrerStatsUnified(referrerLeadId, chain)
    : updateReferrerStatsLegacy(referrerLeadId);
}

/* THE UNIFIED IMPLEMENTATION. One row per lead, so crediting an ancestor is a
   single-row lookup by Lead ID — N lookups for a chain of depth N, against one
   table read once. The nine-tab loop, the per-tab resolveCols, the per-tab
   try/catch and the break-after-first-match all vanish with the duplication that
   forced them.

   Last Referral Date tracks the immediate referrer only, deliberately: a lead
   referred by someone three levels below you is not YOUR referral, and dating it
   as one would make the cold-lead and partner-summary reads lie. Total Downstream
   is the field that says "something happened in your subtree". */
function updateReferrerStatsUnified(referrerLeadId, chain) {
  if (!referrerLeadId) return;

  var sheet = leadsTable();
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('updateReferrerStats: no "' + CONFIG.TABS.LEADS + '" rows; nothing to credit.');
    return;
  }

  /* ── The lock, and why the READ is inside it ──
     Crediting a chain is a read-modify-write of counters on N rows. Two
     submissions landing on overlapping chains (a common case: two people
     referred by the same partner, or anyone deep in a popular chain) can
     interleave read-read-write-write and lose a count permanently — and the
     counter is the number the referral product is measured by, so a lost
     increment is silent, permanent, and unnoticeable.

     The whole read-modify-write must be inside the lock, not just the writes.
     Locking only the writes would leave the race completely intact: both
     executions would have already read the same stale counter.

     tryLock, not waitLock: a blocked execution should give up and say so, not
     sit on a GAS execution slot indefinitely and then die on the 6-minute
     runtime cap having done half the work. */
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(REFERRAL_STATS_LOCK_MS)) {
    /* NOT silent, and NOT fatal.

       Not fatal: this runs inside handleFormSubmission's main try, so throwing
       would turn a contended lock into a FAILED SUBMISSION — the visitor is
       told their form broke because someone else submitted at the same moment.
       The lead row itself is already written and correct; only the referrer's
       counters are behind.

       Not silent: the log line below carries everything needed to replay the
       credit by hand, which is what makes "we skipped it" recoverable rather
       than lost. If this ever fires in practice it is the signal to move the
       counters off read-modify-write (e.g. derive them from the Referrals tab)
       rather than to raise the timeout. */
    Logger.log('updateReferrerStats: MANUAL REPAIR NEEDED. Could not acquire the script lock ' +
               'within ' + REFERRAL_STATS_LOCK_MS + 'ms, so referral credit was NOT applied. ' +
               'Referrer: "' + referrerLeadId + '". Chain: "' + String(chain || '') + '". ' +
               'Nothing was written — no partial credit was applied. To repair: increment ' +
               'Total Downstream by 1 for every Lead ID in that chain, and Direct Referrals ' +
               'by 1 for the referrer only.');
    return;
  }

  try {
    creditReferralChain(sheet, referrerLeadId, chain);
    // Commit before releasing: a queued write that lands after the lock is gone
    // is a write that happened outside it, which is the race the lock exists to
    // prevent.
    SpreadsheetApp.flush();
  } finally {
    // finally, not a trailing call: resolveUnifiedCols throws on a mangled
    // header, and a lock leaked by that path would block every subsequent
    // submission until the execution times out.
    lock.releaseLock();
  }
}

/* The critical section: the actual read-modify-write. Separated from the locking
   so the counting logic can be read and tested without the ceremony around it.
   MUST only be called while holding the script lock — updateReferrerStatsUnified
   is the only caller, and that is deliberate. */
function creditReferralChain(sheet, referrerLeadId, chain) {
  // Throws on a mangled header rather than writing a counter into a guessed
  // cell. A referral stat silently landing in the wrong column is worse than a
  // logged failure — the caller's try/catch turns this into a diagnosable error.
  var C = resolveUnifiedCols(sheet);
  var data = sheet.getDataRange().getValues();
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');

  // Index once. A 4-deep chain would otherwise re-scan the table four times.
  var rowByLeadId = {};
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][C.LEAD_ID] || '').trim();
    if (!id) continue;
    // Own-key guarded: a Lead ID of 'constructor' must not resolve to Object's.
    if (Object.prototype.hasOwnProperty.call(rowByLeadId, id)) continue;   // first row wins
    rowByLeadId[id] = i;
  }

  // Every ancestor, not just the last one. An empty/absent chain (a caller that
  // has a referrer but no chain — defensive) still credits the referrer, who is
  // by definition their own chain's last entry.
  var ancestors = chainAncestors(chain);
  if (ancestors.indexOf(referrerLeadId) === -1) ancestors.push(referrerLeadId);

  ancestors.forEach(function(ancestorLeadId) {
    var rowIdx = rowByLeadId[ancestorLeadId];
    if (rowIdx === undefined) {
      // A chain naming a lead that is not in the table is a data-integrity
      // problem, not a reason to abandon the ancestors that ARE there.
      Logger.log('updateReferrerStats: chain ancestor "' + ancestorLeadId +
                 '" has no row in "' + CONFIG.TABS.LEADS + '"; skipped crediting it.');
      return;
    }
    var row = data[rowIdx];
    var sheetRow = rowIdx + 1;   // 1-based, header included

    var downstream = parseInt(row[C.TOTAL_DOWNSTREAM] || '0', 10) || 0;
    sheet.getRange(sheetRow, C.TOTAL_DOWNSTREAM + 1).setValue(downstream + 1);

    // The immediate referrer, and ONLY the immediate referrer, also gets the
    // direct count and the date. This is the line the multi-level change must
    // not "helpfully" hoist out of the guard.
    if (ancestorLeadId === referrerLeadId) {
      var direct = parseInt(row[C.DIRECT_REFERRALS] || '0', 10) || 0;
      sheet.getRange(sheetRow, C.DIRECT_REFERRALS   + 1).setValue(direct + 1);
      sheet.getRange(sheetRow, C.LAST_REFERRAL_DATE + 1).setValue(today);
    }
  });
}

/* THE LEGACY IMPLEMENTATION — unchanged, still what production runs.
   DELETE AT CUTOVER, together with USE_UNIFIED_SCHEMA and this comment.
   It credits Direct Referrals only, on up to nine duplicate copies of the
   referrer's row, and has never written Total Downstream. */
function updateReferrerStatsLegacy(referrerLeadId) {
  if (!referrerLeadId) return;
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
  // Derived from the registry, not a hand-kept list. The old literal omitted
  // Clients and Archive, so a referrer promoted to Client (or archived) stopped
  // having their Direct Referrals / Last Referral Date updated. leadTabConfigs()
  // is every lead tab, so a new lead type's tab is covered automatically.
  var tabsToCheck = leadTabConfigs().map(function(cfg) { return cfg.name; });
  tabsToCheck.forEach(function(tabName) {
    // Per-tab guard: one drifted tab (resolveCols throws) must not stop the stats
    // update on the others. The referrer's row usually lives on several tabs.
    try {
      var sheet = tab(tabName);
      if (!sheet || sheet.getLastRow() < 2) return;   // no data rows → nothing to update
      var C = resolveCols(sheet);
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][C.LEAD_ID] || '') === referrerLeadId) {
          var current = parseInt(data[i][C.DIRECT_REFERRALS] || '0', 10);
          sheet.getRange(i + 1, C.DIRECT_REFERRALS + 1).setValue(current + 1);
          sheet.getRange(i + 1, C.LAST_REFERRAL_DATE + 1).setValue(today);
          break;
        }
      }
    } catch (e) {
      Logger.log('updateReferrerStats: skipped "' + tabName + '": ' + e);
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
  var message  = leadMessageText(payload);   // EAO's free text is pressing_issue

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
      message ? '\nNew message:\n' + message : '',
      '',
      'The existing record has been updated. No duplicate row was created.',
      '',
      'Sheet: https://docs.google.com/spreadsheets/d/' + getProp('SPREADSHEET_ID'),
    ].filter(function(l) { return l !== undefined; }).join('\n'),
    { name: CONFIG.SENDER_NAME }
  );
}

/* ── Row builder ──
   MIGRATED (Stage 6). Dispatcher; the two implementations are below.

   THIS IS WHERE THE TWO DATA-FIDELITY FIXES ACTUALLY SHIP. They were decided in
   docs on 2026-07-13 and, until this stage, existed nowhere in code:

     §2a  All 13 qualData fields persist. Legacy writes exactly ONE (assetClasses →
          the Asset Class column) and silently discards the other twelve: six render
          a sentence in an email and are thrown away, six are read by nothing at all.
          The visitor answers the question, the browser sends the answer, and the
          backend drops it. That ends here.
     §2b  submit_referral's referred-person block becomes a structured
          Details.referred object instead of a newline-joined prose paragraph
          prepended to the Message column. The prose builder is DELETED, not ported.

   A row is still built POSITIONALLY, and that is still correct: this function
   CONSTRUCTS the canonical layout rather than reading a possibly-drifted one.
   Reading a live row still goes through resolveUnifiedCols. */
function buildLeadRow(payload, status, leadId, referralCode, referralMatch, meetLink) {
  return USE_UNIFIED_SCHEMA
    ? buildLeadRowUnified(payload, status, leadId, referralCode, referralMatch, meetLink)
    : buildLeadRowLegacy(payload, status, leadId, referralCode, referralMatch, meetLink);
}

/* The Details blob: everything type-specific, keyed by the names the payload
   already uses. Generalizes the pattern eaoDetailsSummary() has been running in
   production — JSON-stringify the role-specific fields into one cell — from the one
   lead type that needed it to all five.

   WHICH FIELDS BELONG TO WHICH ROLE COMES FROM THE REGISTRY (LEAD_TYPES.detailsFields),
   not from the field names. An earlier draft of the migration plan derived the
   mapping from the names and got FOUR OF THIRTEEN wrong — `awareness` and `fit` are
   submit_referral's, not the investor's; `profession` is the referral partner's, not
   the RE pro's. The registry is the single definition site; do not re-derive it.

   BLANK-FIELD CONTRACT, decided once and pinned by a test: a field the lead type
   ASKS is always PRESENT as a key, holding '' (or [] for a list) when the visitor
   left it blank. A field the lead type does not ask is ABSENT. So "asked and not
   answered" is distinguishable from "never asked" — which is the whole reason for
   putting this in a queryable blob rather than a paragraph. */
function buildLeadDetails(payload, meetLink) {
  var lt      = leadTypeFor(payload.role);
  var q       = payload.qualData || {};
  var b       = payload.booking  || null;
  var details = {};

  if (lt && lt.detailsFields) {
    // EAO's fields sit on the payload's top level; every other type's sit in qualData.
    var src = lt.detailsFrom === 'payload' ? payload : q;
    lt.detailsFields.forEach(function(field) {
      var v = src ? src[field] : undefined;
      if (Array.isArray(v))            details[field] = v.slice();
      else if (v === undefined || v === null) details[field] = '';   // asked, not answered
      else                             details[field] = v;
    });
  }

  /* §2b — the referred person, as a real object. Legacy flattened this into a prose
     block and PREPENDED it to the message, which made getting Jane's email back out
     a regex problem. The keys are always present so a partially-filled referral is
     still machine-readable. */
  if (payload.role === 'submit_referral') {
    var r = payload.referred || {};
    details.referred = {
      firstName: r.firstName || '',
      lastName:  r.lastName  || '',
      email:     r.email     || '',
      phone:     r.phone     || '',
      notes:     r.notes     || '',
    };
  }

  /* Shared across every type. `message` lives HERE, not in a top-level column:
     nothing searches it across rows and onSheetEdit does not watch it, so it fails
     both halves of the top-level-column rule (plan §2b, settled 2026-07-14). */
  details.message = payload.message || '';

  /* Comms opt-ins, exactly as the visitor selected them. EAO used to arrive here
     with a synthetic JSON entry that normalizeEaoPayload stuffed into preferences
     (because the legacy schema gave EAO nowhere else to put its detail fields); that
     hack is gone — EAO's detail fields now have real Details keys above — so there is
     no longer any EAO-specific entry to filter out. */
  details.preferences = (payload.preferences || []).slice();

  details.booking = b ? {
    date:     b.date     || '',
    slot:     b.slot     || b.time || '',
    meetType: b.meetType || '',
    phone:    b.phone    || '',
    meetLink: meetLink   || '',
  } : null;

  /* The derived Asset Class label. It was column 11 in the legacy layout; the plan
     recommends it move into Details, because it is DERIVED (not collected) and
     nothing searches on it — and "so a human can eyeball it in the grid" is
     explicitly not a valid reason for a column. Written only when non-empty. */
  var assetClass = assetClassFromQualData(q);
  if (assetClass) details.assetClass = assetClass;

  return details;
}

/* THE UNIFIED IMPLEMENTATION: the 25-column layout of plan §1, in that exact order,
   plus the serialized Details blob in the last cell. */
function buildLeadRowUnified(payload, status, leadId, referralCode, referralMatch, meetLink) {
  var p  = payload.person || {};
  var lt = leadTypeFor(payload.role);
  var rm = referralMatch || { found: false, matchType: 'none' };

  return [
    leadId       || '',                                   //  1 Lead ID
    payload.timestamp || new Date().toISOString(),        //  2 Timestamp
    roleToCategory(payload.role),                         //  3 Category
    status,                                               //  4 Status
    p.email      || '',                                   //  5 Email
    p.firstName  || '',                                   //  6 First Name
    p.lastName   || '',                                   //  7 Last Name
    referralCode || '',                                   //  8 Referral Code
    rm.found ? rm.referrerLeadId : '',                    //  9 Referred By Lead ID
    rm.found ? rm.referrerName   : '',                    // 10 Referred By Name
    rm.found ? rm.referrerEmail  : '',                    // 11 Referred By Email
    rm.found ? rm.referrerCode   : '',                    // 12 Referred By Code
    rm.matchType || 'none',                               // 13 Match Type
    rm.found ? rm.chain : '',                             // 14 Referral Chain
    rm.found ? rm.depth : 0,                              // 15 Chain Depth
    0,                                                    // 16 Direct Referrals
    0,                                                    // 17 Total Downstream
    '',                                                   // 18 Last Referral Date
    p.phone      || '',                                   // 19 Phone
    p.company    || '',                                   // 20 Company
    payload.role || '',                                   // 21 Role
    leadSource(payload),                                  // 22 Source (arrival channel only)
    leadHeardAbout(payload),                              // 23 Heard About (the visitor's answer)
    // The per-tab extra becomes a normal column, seeded from the registry. The whole
    // REPORTS_ENABLED_COL = LEAD_HEADERS.length bug class dies with the per-tab extra.
    (lt && lt.seedReportsEnabled) ? true : '',            // 24 Reports Enabled
    JSON.stringify(buildLeadDetails(payload, meetLink)),  // 25 Details
  ];
}

/* THE LEGACY IMPLEMENTATION — unchanged, still what production runs.
   DELETE AT CUTOVER. It persists ONE of thirteen qualData fields and flattens the
   referred person into prose on the Message column. Both defects are preserved here
   deliberately: this is what is live, and a migration stage must not quietly change
   production behavior. */
function buildLeadRowLegacy(payload, status, leadId, referralCode, referralMatch, meetLink) {
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
/* Derived from LEAD_TYPES. '' for an unknown role, as before. */
function roleToCategory(role) {
  var t = leadTypeFor(role);
  return t ? t.category : '';
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

/* Derived from LEAD_TYPES. null both for an unknown role and for a role that
   deliberately has no tab (submit_referral) — see the registry entry. */
function categoryTabForRole(role) {
  var t = leadTypeFor(role);
  return (t && t.tab) || null;
}

/* ── Existing Asset Owner normalization ──
   Reshapes the flat EAO payload emitted by buildEAOPayload (frontend) into the
   generic lead payload every other role uses, so buildLeadRow, dedupe, the
   partner notification and the booking flow all work with zero role branching.
     • person   ← name (split into first/last) + email + phone
     • qualData ← { assetClasses: [readable one-line asset summary] }

   The EAO detail fields (portfolio_type, pressing_issue, current_situation, …)
   stay on the payload's TOP LEVEL and are persisted into the Details blob by name
   via the registry (detailsFrom: 'payload'). Two copies this used to make are gone:
     • It no longer sets `message = pressing_issue`. That copy made Details.message
       duplicate Details.pressing_issue on every EAO lead. The visitor's free text is
       `pressing_issue`; the internal email + booking dump read it via leadMessageText(),
       and the visitor note reads it directly (buildVisitorPersonalNote's EAO branch).
     • It no longer stuffs `preferences = [eaoDetailsSummary(...)]`. Those fields now
       have real Details keys of their own, so the synthetic JSON-string entry — which
       also used to land verbatim in the Google Contact's "Preferences:" note — is
       simply not created. */
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
  payload.qualData = { assetClasses: [eaoAssetClassLabel(payload)].filter(Boolean) };
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

/** JSON-stringified capture of every EAO-specific field. This was the legacy
 *  device for persisting EAO detail — normalizeEaoPayload stuffed its output into
 *  the Preferences column because the per-tab schema gave EAO no dedicated columns.
 *  Under the unified schema those fields have real Details keys (LEAD_TYPES
 *  detailsFields, detailsFrom: 'payload'), so NOTHING wires this into a live path any
 *  more. Retained with its unit test as the reference pattern the Details blob
 *  generalized from; a candidate for deletion in the cutover cleanup. */
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

  /* NO existing_asset_owner BRANCH, deliberately (removed 2026-07-16).
     EAO used to render a "What you told us" callout quoting the visitor's
     pressing_issue / current_situation back at them. It was removed by request;
     falling through to the `return ''` below means an EAO confirmation carries no
     callout at all, which the templates already handle — {{personalNote}} is
     stripped to '' when the note is empty (the same path an unknown role takes).
     pressing_issue is untouched everywhere else: it still persists to
     Details.pressing_issue and still reaches the internal surfaces via
     leadMessageText(). This removes an ECHO, not a field. */

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

/** The visitor's free-text message, for INTERNAL DISPLAY and the resubmission audit
 *  note. Every role except EAO collects a dedicated `message` (buildPayload); the EAO
 *  flow (buildEAOPayload) has no message step — its free text is `pressing_issue` —
 *  so that stands in. This mirrors buildVisitorPersonalNote, whose EAO branch already
 *  reads pressing_issue directly. Non-EAO behavior is unchanged: it returns
 *  payload.message verbatim. Storage is deliberately NOT routed through this — the
 *  stored Details.message stays '' for EAO so it never duplicates Details.pressing_issue
 *  (buildLeadDetails reads payload.message raw); only the display surfaces fall back. */
function leadMessageText(payload) {
  if (payload && payload.message) return payload.message;
  if (payload && payload.role === 'existing_asset_owner') return payload.pressing_issue || '';
  return '';
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
  // EAO has no dedicated message field; its free text is pressing_issue, so
  // leadMessageText() supplies it here (see helper). Every other role is unchanged.
  var messageText = leadMessageText(payload);
  var messageBlock = '';
  if (messageText) {
    messageBlock =
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FB;border:1px solid #E8E4F0;border-radius:8px;margin:0 0 20px;">' +
      '<tr><td style="padding:14px 16px;">' +
      '<p style="font-size:10px;font-weight:600;color:#9490A8;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 6px;">Message</p>' +
      '<p style="font-size:13px;color:#1C1628;line-height:1.6;margin:0;white-space:pre-wrap;">' + escapeHtml(messageText) + '</p>' +
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

/* ── sendDailyDigest ── MIGRATED (Stage 8).
   Read-only: it reads lead rows and emails a digest, writing no cell. So NO lock —
   there is no row it could race anyone on. (Confirmed, not assumed.) */
function sendDailyDigest() {
  return USE_UNIFIED_SCHEMA ? sendDailyDigestUnified() : sendDailyDigestLegacy();
}

/* THE UNIFIED IMPLEMENTATION. Same today-filter, one table instead of Lifetime Leads.

   THE ONE REAL DIFFERENCE beyond the tab: Asset Class and Booking are no longer
   top-level columns — they live in the Details blob (Stage 6). Reading them
   positionally would silently drop them from every digest line, so they are parsed
   back out of Details here. Everything else (name, category, email, phone, source,
   referred-by) is still a real column. */
function sendDailyDigestUnified() {
  try {
    var sheet = leadsTable();
    if (!sheet || sheet.getLastRow() < 2) return;   // no data rows → nothing to digest
    var C = resolveUnifiedCols(sheet);

    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    var rows  = sheet.getDataRange().getValues().slice(1).filter(function(r) {
      var ts = new Date(r[C.TIMESTAMP]);
      if (isNaN(ts)) return false;
      return Utilities.formatDate(ts, 'America/Chicago', 'MM/dd/yyyy') === today;
    });

    if (rows.length === 0) {
      Logger.log('sendDailyDigest: no new leads today.');
      return;
    }

    var n = rows.length;
    var blocks = rows.map(function(r) {
      var name = [r[C.FIRST_NAME], r[C.LAST_NAME]].filter(Boolean).join(' ') || 'Unknown';
      var refLine = r[C.REF_BY_NAME]
        ? 'Referred By: ' + r[C.REF_BY_NAME] + ' (' + r[C.MATCH_TYPE] + ')'
        : '';

      // Asset Class + Booking come out of Details now, not columns. A malformed blob
      // must not break the whole digest, so parse defensively.
      var details = {};
      try { details = JSON.parse(r[C.DETAILS] || '{}') || {}; } catch (e) { details = {}; }
      var assetClass = details.assetClass || '';
      var booking    = details.booking || null;
      var bookingLine = (booking && booking.date)
        ? 'Booking:     ' + booking.date + ' at ' + (booking.slot || '')
        : '';

      return [
        'Lead ID:     ' + r[C.LEAD_ID],
        'Name:        ' + name,
        'Role:        ' + r[C.CATEGORY],
        'Email:       ' + r[C.EMAIL],
        'Phone:       ' + r[C.PHONE],
        assetClass ? 'Asset Class: ' + assetClass : '',
        bookingLine,
        'Source:      ' + r[C.SOURCE],
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

/* LEGACY — unchanged. DELETE AT CUTOVER. Reads Lifetime Leads; Asset Class and
   Booking are still top-level columns here. */
function sendDailyDigestLegacy() {
  try {
    var sheet = tab(CONFIG.TABS.LIFETIME_LEADS);
    if (!sheet || sheet.getLastRow() < 2) return;   // no data rows → nothing to digest
    var C = resolveCols(sheet);

    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    var rows  = sheet.getDataRange().getValues().slice(1).filter(function(r) {
      // Timestamp is an ISO string; compare its CT calendar date to today's.
      var ts = new Date(r[C.TIMESTAMP]);
      if (isNaN(ts)) return false;
      return Utilities.formatDate(ts, 'America/Chicago', 'MM/dd/yyyy') === today;
    });

    if (rows.length === 0) {
      Logger.log('sendDailyDigest: no new leads today.');
      return;
    }

    var n = rows.length;
    var blocks = rows.map(function(r) {
      var name     = [r[C.FIRST_NAME], r[C.LAST_NAME]].filter(Boolean).join(' ') || 'Unknown';
      var refLine  = r[C.REF_BY_NAME]
        ? 'Referred By: ' + r[C.REF_BY_NAME] + ' (' + r[C.MATCH_TYPE] + ')'
        : '';
      return [
        'Lead ID:     ' + r[C.LEAD_ID],
        'Name:        ' + name,
        'Role:        ' + r[C.CATEGORY],
        'Email:       ' + r[C.EMAIL],
        'Phone:       ' + r[C.PHONE],
        'Asset Class: ' + r[C.ASSET_CLASS],
        r[C.BOOKING_DATE]
          ? 'Booking:     ' + r[C.BOOKING_DATE] + ' at ' + r[C.BOOKING_TIME]
          : '',
        'Source:      ' + r[C.SOURCE],
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

/* ── sendMonthlyReferralSummaries ── MIGRATED (Stage 8).
   Read-only (reads partners + the Referrals tab, emails each partner). NO lock. */
function sendMonthlyReferralSummaries() {
  return USE_UNIFIED_SCHEMA
    ? sendMonthlyReferralSummariesUnified()
    : sendMonthlyReferralSummariesLegacy();
}

/* THE UNIFIED IMPLEMENTATION.

   Two changes from legacy, both consequences of one table:
     1. Partners are not a TAB, they are the rows of the one table where
        Category === 'Referral Partner'. So it reads leadsTable() and filters, rather
        than reading a Referral Partners tab that no longer exists.
     2. Reports Enabled is a STANDARD column now (UNIFIED_LEAD_HEADERS), resolved by
        resolveUnifiedCols like every other. The legacy path used reportsEnabledIndex
        / headerIndex precisely because it was a per-tab EXTRA outside LEAD_HEADERS;
        that whole helper pair exists only for that case and is deleted at cutover.

   The Referrals-tab tally is UNCHANGED — that tab keeps its own schema
   (REFERRAL_HEADERS) and is not part of this migration. Its positional reads stay. */
function sendMonthlyReferralSummariesUnified() {
  try {
    var sheet = leadsTable();
    if (!sheet) { Logger.log('sendMonthlyReferralSummaries: no "' + CONFIG.TABS.LEADS + '" tab.'); return; }
    if (sheet.getLastRow() < 2) { Logger.log('sendMonthlyReferralSummaries: no lead rows.'); return; }
    var C = resolveUnifiedCols(sheet);

    // Tally referrals per referrer Lead ID from the Referrals tab (its own schema).
    var totals = {};
    var months = {};
    var now    = new Date();
    var curMon = now.getMonth();
    var curYr  = now.getFullYear();

    var refSheet = tab(CONFIG.TABS.REFERRALS);
    if (refSheet) {
      var refData = refSheet.getDataRange().getValues();
      for (var r = 1; r < refData.length; r++) {
        var referrerLeadId = String(refData[r][1] || '');   // Referrer Lead ID
        if (!referrerLeadId) continue;
        totals[referrerLeadId] = (totals[referrerLeadId] || 0) + 1;

        var dateVal = refData[r][11];   // Date column
        var d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (!isNaN(d) && d.getMonth() === curMon && d.getFullYear() === curYr) {
          months[referrerLeadId] = (months[referrerLeadId] || 0) + 1;
        }
      }
    }

    var rows = sheet.getDataRange().getValues();
    var sent = 0;

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];

      // The tab membership test becomes a category test.
      if (String(row[C.CATEGORY] || '') !== 'Referral Partner') continue;

      var status = String(row[C.STATUS] || '');
      if (status === 'Cold' || status === 'Archive') continue;

      // Reports Enabled is an ordinary resolved column. Blank or TRUE = enabled;
      // only an explicit FALSE opts out — identical rule to legacy.
      var reportsEnabled = row[C.REPORTS_ENABLED];
      if (reportsEnabled === false || String(reportsEnabled).trim().toUpperCase() === 'FALSE') continue;

      var leadId = String(row[C.LEAD_ID] || '');
      var email  = String(row[C.EMAIL]   || '').trim();
      if (!leadId || !email) continue;

      var totalReferrals = totals[leadId] || 0;
      if (totalReferrals <= 0) continue;

      var monthReferrals = months[leadId] || 0;
      var firstName      = String(row[C.FIRST_NAME] || '') || 'there';
      var code           = String(row[C.REFERRAL_CODE] || '');

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

/* LEGACY — unchanged. DELETE AT CUTOVER. Reads the Referral Partners tab and its
   per-tab Reports Enabled extra via reportsEnabledIndex. */
function sendMonthlyReferralSummariesLegacy() {
  try {
    var partnersSheet = tab(CONFIG.TABS.REFERRAL_PARTNERS);
    if (!partnersSheet) { Logger.log('sendMonthlyReferralSummaries: no Referral Partners tab.'); return; }
    if (partnersSheet.getLastRow() < 2) { Logger.log('sendMonthlyReferralSummaries: no partner rows.'); return; }
    // Referral Partners layout resolved by name; the Referrals tab below uses its
    // own schema (REFERRAL_HEADERS), so its positional reads are left as-is.
    var C = resolveCols(partnersSheet);

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

    // Resolved once by name, outside the loop — never derived from array length.
    var reCol = reportsEnabledIndex(partnersSheet);

    for (var i = 1; i < partners.length; i++) {
      var row    = partners[i];
      var status = String(row[C.STATUS] || '');
      if (status === 'Cold' || status === 'Archive') continue;

      // Skip partners who have explicitly opted out (Reports Enabled = FALSE).
      // Blank or TRUE keeps them enabled; an absent column (reCol < 0) is treated
      // as blank, so a layout problem can never silently mute every partner.
      var reportsEnabled = reCol >= 0 ? row[reCol] : '';
      if (reportsEnabled === false || String(reportsEnabled).trim().toUpperCase() === 'FALSE') continue;

      var leadId = String(row[C.LEAD_ID] || '');
      var email  = String(row[C.EMAIL]   || '').trim();
      if (!leadId || !email) continue;

      var totalReferrals = totals[leadId] || 0;
      if (totalReferrals <= 0) continue;

      var monthReferrals = months[leadId] || 0;
      var firstName      = String(row[C.FIRST_NAME] || '') || 'there';
      var code           = String(row[C.REFERRAL_CODE] || '');

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

/* ── moveColdLeads: sweep stale Active leads to Cold ──
   MIGRATED (Stage 2 of the unified-schema migration). Dispatcher; the two
   implementations are below. See the UNIFIED SCHEMA block at the top of the file
   for the staging pattern and the cutover procedure.

   THE SHAPE OF THE CHANGE: legacy PHYSICALLY RELOCATES a row — append it to Cold
   Leads, deleteRow() it from Active Leads, then re-sync the duplicate on the
   category tab. Unified sets one cell: Status = 'Cold'. The row never moves,
   because there is nowhere to move it to. Row deletion — the most dangerous
   operation in this file — is REMOVED, not ported. */
function moveColdLeads() {
  return USE_UNIFIED_SCHEMA ? moveColdLeadsUnified() : moveColdLeadsLegacy();
}

/* THE UNIFIED IMPLEMENTATION.
   One table, one row per lead, so "move to cold" is what it always actually was:
   a status change. No append, no deleteRow, no setCategoryTabStatus (there is no
   duplicate to keep in sync). The Contact-group side effect and the summary email
   are unchanged. */
function moveColdLeadsUnified() {
  try {
    var sheet = leadsTable();
    if (!sheet || sheet.getLastRow() < 2) {
      Logger.log('moveColdLeads: no "' + CONFIG.TABS.LEADS + '" rows; nothing to sweep.');
      return;
    }

    /* ── The lock, and an honest account of what it does and does not protect ──
       This sweep has TWO entry points: the weekly Monday trigger, and the
       "Run Cold Lead Sweep Now" menu item. Both can be in flight at once — a
       human clicking the menu while the trigger runs is not hypothetical, it is
       one click. Two concurrent sweeps read the same snapshot, both decide the
       same rows are stale, and both do the follow-on work: two Contacts writes
       per lead and TWO summary emails claiming the same leads went cold.

       PROTECTS: sweep vs sweep. Both entry points reach this same lock, and the
       GAS script lock is process-wide, so it also serializes against
       updateReferrerStats' critical section.

       DOES NOT PROTECT: sweep vs a human's Status edit. handleStatusEdit does not
       take this lock (it is not migrated yet — Stage 3), so a human promoting a
       lead to 'Client' during the sweep's window can still be clobbered by a
       stale 'Cold' write. A lock only excludes writers that take it. THAT GAP
       CLOSES WHEN STAGE 3 MIGRATES handleStatusEdit AND HAS IT TAKE THIS LOCK —
       it is written into the plan's Stage-3 notes, and is called out here so it
       cannot be mistaken for a guarantee this stage already provides.

       The sheet read is inside the lock, for the same reason as Stage 1: a lock
       taken after the read protects nothing, because the stale snapshot has
       already been taken. */
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(COLD_SWEEP_LOCK_MS)) {
      /* Non-fatal and loud. Nothing partial happened: the sweep either ran or it
         did not. This is a background job, not a visitor-facing path, so the
         correct response is to skip this run — the next Monday trigger sweeps the
         same leads, which are only staler by then. Nothing is lost. */
      Logger.log('moveColdLeads: could not acquire the script lock within ' +
                 COLD_SWEEP_LOCK_MS + 'ms — another sweep (or a referral-stats update) is ' +
                 'already running. Skipped this run entirely; NOTHING was swept and no ' +
                 'email was sent. The next scheduled sweep picks up the same leads.');
      return;
    }

    var swept;
    try {
      swept = sweepStaleLeadsToCold(sheet);
      // Commit before releasing: a write that lands after the lock is gone is a
      // write that happened outside it.
      SpreadsheetApp.flush();
    } finally {
      // finally, not a trailing call: resolveUnifiedCols throws on a mangled
      // header, and a leaked lock would block every later sweep and every
      // referral credit until the execution times out.
      lock.releaseLock();
    }

    var C = swept.cols;
    var moved = swept.moved;
    if (moved.length === 0) { Logger.log('moveColdLeads: nothing to move.'); return; }

    /* The Contacts writes and the summary email are deliberately OUTSIDE the
       lock. They are slow external calls (one Contacts round-trip per lead), and
       the lock exists to protect the sheet's read-decide-write, not the downstream
       notifications. Holding a process-wide lock across a Contacts API call would
       block every submission's referral credit for as long as Google takes to
       answer. The sheet is already correct and committed by this point. */
    moved.forEach(function(r) {
      try { moveContactToCold(r[C.EMAIL]); }
      catch (e) { Logger.log('moveContactToCold failed for ' + r[C.EMAIL] + ': ' + e); }
    });

    var blocks = moved.map(function(r) {
      return [
        'Lead ID:        ' + r[C.LEAD_ID],
        'Name:           ' + [r[C.FIRST_NAME], r[C.LAST_NAME]].filter(Boolean).join(' '),
        'Role:           ' + r[C.CATEGORY],
        'Email:          ' + r[C.EMAIL],
        'Submitted:      ' + Utilities.formatDate(new Date(r[C.TIMESTAMP]), 'America/Chicago', 'MM/dd/yyyy'),
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

/* The critical section: read the table, decide who is stale, write Status.
   MUST only be called while holding the script lock — moveColdLeadsUnified is the
   only caller, deliberately. Returns the resolved column map and the moved rows
   (as snapshots) so the caller can do the slow side effects outside the lock.

   Nothing is deleted and nothing is appended. The loop runs FORWARD, unlike the
   legacy one, which had to run backward only because deleteRow() reindexes every
   row beneath it. */
function sweepStaleLeadsToCold(sheet) {
  // Throws on a mangled header rather than stamping 'Cold' into a guessed column.
  var C = resolveUnifiedCols(sheet);
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var activeStatuses = ['New Lead', 'Contacted', 'Active'];
  var moved = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (activeStatuses.indexOf(String(row[C.STATUS] || '')) === -1) continue;

    var submitted = new Date(row[C.TIMESTAMP]);
    if (isNaN(submitted)) continue;   // an unreadable timestamp is not an old lead

    var ageDays = (now - submitted) / 86400000;
    if (ageDays <= CONFIG.COLD_LEAD_DAYS) continue;

    /* ── Re-read the LIVE Status immediately before stamping (added Stage 3) ──
       The snapshot above can be seconds old by the time this row is reached: one
       full-table read, plus a write per stale lead ahead of it. A human typing
       'Client' into this cell during that window would be silently overwritten by
       a decision made before they typed it — and no lock can prevent that write,
       because the SHEETS UI performs it and takes no lock.

       This is the guard that actually closes that gap. It cannot be closed on the
       handleStatusEdit side: by the time that trigger fires, the human's cell is
       already written. Re-checking here shrinks the clobber window from "the whole
       sweep" to the microseconds between this read and the write below.

       Cost: one extra cell read per genuinely-stale lead. Not per row — only rows
       that have already passed the status and age filters get this far. */
    var liveStatus = String(sheet.getRange(i + 1, C.STATUS + 1).getValue() || '');
    if (activeStatuses.indexOf(liveStatus) === -1) {
      Logger.log('moveColdLeads: row ' + (i + 1) + ' (' + row[C.LEAD_ID] + ') changed to "' +
                 liveStatus + '" after this sweep read the table. Leaving it alone — a human ' +
                 'edit beats a stale sweep decision.');
      continue;
    }

    sheet.getRange(i + 1, C.STATUS + 1).setValue('Cold');
    row[C.STATUS] = 'Cold';   // keep the snapshot consistent for the caller's email
    moved.push(row);
  }

  return { cols: C, moved: moved };
}

/* THE LEGACY IMPLEMENTATION — unchanged, still what production runs.
   DELETE AT CUTOVER. It appends the row to Cold Leads, DELETES it from Active
   Leads, and re-syncs the duplicate on the category tab: three writes across
   three tabs to express one status change, and the row-deletion path that makes
   this the most dangerous function in the file. */
function moveColdLeadsLegacy() {
  try {
    var activeSheet = tab(CONFIG.TABS.ACTIVE_LEADS);
    if (!activeSheet) return;

    // Resolve the Active Leads layout by NAME once, up front. Every read of a row
    // below indexes through C, not the compile-time COLS, so a drifted Active tab
    // reads the right cells (or throws here, before any row is deleted) rather than
    // silently deleting the wrong lead — the highest-risk positional read in the
    // file, because this function both reads a Timestamp and deletes rows.
    var C = resolveCols(activeSheet);

    var data   = activeSheet.getDataRange().getValues();
    var now    = new Date();
    var active = ['New Lead', 'Contacted', 'Active'];
    var moved  = [];

    for (var i = data.length - 1; i >= 1; i--) {
      var row    = data[i];
      var status = String(row[C.STATUS] || '');
      if (active.indexOf(status) === -1) continue;

      var submitted = new Date(row[C.TIMESTAMP]);
      if (isNaN(submitted)) continue;

      var age = (now - submitted) / 86400000;
      if (age <= CONFIG.COLD_LEAD_DAYS) continue;

      row[C.STATUS] = 'Cold';
      appendRow(CONFIG.TABS.COLD_LEADS, row);
      activeSheet.deleteRow(i + 1);
      try { setCategoryTabStatus(row, 'Cold', C); }
      catch (e) { Logger.log('setCategoryTabStatus failed for ' + row[C.EMAIL] + ': ' + e); }

      try { moveContactToCold(row[C.EMAIL]); }
      catch (e) { Logger.log('moveContactToCold failed for ' + row[C.EMAIL] + ': ' + e); }

      moved.push(row);
    }

    if (moved.length === 0) { Logger.log('moveColdLeads: nothing to move.'); return; }

    var blocks = moved.map(function(r) {
      return [
        'Lead ID:        ' + r[C.LEAD_ID],
        'Name:           ' + [r[C.FIRST_NAME], r[C.LAST_NAME]].filter(Boolean).join(' '),
        'Role:           ' + r[C.CATEGORY],
        'Email:          ' + r[C.EMAIL],
        'Submitted:      ' + Utilities.formatDate(new Date(r[C.TIMESTAMP]), 'America/Chicago', 'MM/dd/yyyy'),
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

/* srcCols is the resolved column map for the sheet `row` was read from (its
   ROLE/EMAIL are read through it). The category tab is a DIFFERENT sheet and may
   have a different live layout, so it is resolved independently here. */
function setCategoryTabStatus(row, newStatus, srcCols) {
  var sc = srcCols || COLS;
  var tabName = categoryTabForRole(row[sc.ROLE]);
  if (!tabName) return;
  var sheet = tab(tabName);
  if (!sheet) return;
  var C = resolveCols(sheet);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][C.EMAIL] === row[sc.EMAIL]) {
      sheet.getRange(i + 1, C.STATUS + 1).setValue(newStatus);
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

/* ── onSheetEdit: the installable edit trigger ──
   MIGRATED (Stage 4). Dispatcher; the two implementations are below.

   THE SHAPE OF THE CHANGE: the lead-tab guard. Legacy has to ask "is this one of
   the NINE tabs a lead can be duplicated onto?" (leadTabConfigs membership),
   because a lead's Status column exists in nine places. Unified asks "is this the
   Leads table?" — one string compare. Everything else about the dispatch (resolve
   the three watched columns BY NAME, ignore the header row, ignore every other
   column) is deliberately identical: that logic was already right, and the plan
   says not to weaken it. */
function onSheetEdit(e) {
  return USE_UNIFIED_SCHEMA ? onSheetEditUnified(e) : onSheetEditLegacy(e);
}

/* THE UNIFIED IMPLEMENTATION.

   WHAT THIS ACTUALLY WIRES UP — read this before assuming all three handlers work:

     Status            → handleStatusEdit       ✅ migrated (Stage 3). Fully wired.
     Category          → handleCategoryEdit     ✅ works unchanged. It reads NO tab —
                         its only inputs are rowData and a column map, and the only
                         column it touches is EMAIL, a key present in both COLS and
                         UCOLS. It is schema-agnostic and needs no migration.
                         (The plan lists it as needing a retarget. The plan is wrong;
                         see the Stage-4 notes in UNIFIED_SCHEMA_MIGRATION_PLAN.md.)
     Referred By Email → handleManualReferralLink  ✅ migrated (Stage 5). Fully wired.

   All three handlers are now live under the unified schema. Between Stages 4 and 5
   this dispatcher deliberately REFUSED the manual-link path and logged loudly,
   because handleManualReferralLink still scanned Lifetime Leads and its missing-tab
   guard returned SILENTLY — a handler that looked connected and dropped every
   hand-linked referral. Stage 5 retargeted it to the Leads table and the refusal
   was deleted. */
function onSheetEditUnified(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();

    // The entire nine-tab membership guard, collapsed. One table, one check.
    if (sheet.getName() !== CONFIG.TABS.LEADS) return;

    var col = e.range.getColumn();   // 1-indexed
    var row = e.range.getRow();
    if (row <= 1) return;            // the header row is not a lead

    // Resolve the watched columns BY NAME. The dispatch has to know WHICH column
    // changed, so a drifted header must not be able to route a Status edit into
    // the referral handler. resolveUnifiedCols throws rather than returning -1.
    var C = resolveUnifiedCols(sheet);
    var statusCol   = C.STATUS         + 1;
    var categoryCol = C.CATEGORY       + 1;
    var refByEmail  = C.REF_BY_EMAIL   + 1;

    if (col !== statusCol && col !== categoryCol && col !== refByEmail) return;

    var newValue = String(e.range.getValue());
    var rowData  = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (col === statusCol) {
      handleStatusEdit(sheet.getName(), row, rowData, newValue, C);
    } else if (col === categoryCol) {
      handleCategoryEdit(rowData, newValue, C);
    } else if (col === refByEmail) {
      // WIRED as of Stage 5. The Stage-4 refusal that used to sit here is gone:
      // handleManualReferralLink now scans the Leads table, not Lifetime Leads.
      handleManualReferralLink(sheet, row, rowData, newValue, C);
    }
  } catch (err) {
    Logger.log('onSheetEdit error: ' + err);
  }
}

/* THE LEGACY IMPLEMENTATION — unchanged, still what production runs.
   DELETE AT CUTOVER. Its guard exists only because a lead is duplicated across
   nine tabs. */
function onSheetEditLegacy(e) {
  try {
    if (!e || !e.range) return;
    var sheet     = e.range.getSheet();
    var sheetName = sheet.getName();
    var col       = e.range.getColumn();  // 1-indexed
    var row       = e.range.getRow();
    if (row <= 1) return;

    // Only lead tabs carry the Status/Category/Referred By Email columns and the
    // LEAD_HEADERS layout. Editing Referrals or Subscribers must not dispatch a
    // lead handler (and resolveCols would throw on their schema). This guard was
    // absent before: any tab wide enough was dispatched positionally.
    var leadTabNames = leadTabConfigs().map(function(cfg) { return cfg.name; });
    if (leadTabNames.indexOf(sheetName) === -1) return;

    // Resolve the edited tab's real layout so the watched columns are matched by
    // name, not by a compile-time position that a drifted tab would not honor.
    var C = resolveCols(sheet);
    var statusCol   = C.STATUS       + 1;
    var categoryCol = C.CATEGORY     + 1;
    var refByEmail  = C.REF_BY_EMAIL + 1;

    if (col !== statusCol && col !== categoryCol && col !== refByEmail) return;

    var newValue = String(e.range.getValue());
    // Read the row at the tab's real width (Referral Partners is 32 wide).
    var rowData  = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (col === statusCol)  { handleStatusEdit(sheetName, row, rowData, newValue, C); }
    else if (col === categoryCol) { handleCategoryEdit(rowData, newValue, C); }
    else if (col === refByEmail)  { handleManualReferralLink(sheet, row, rowData, newValue, C); }
  } catch (err) {
    Logger.log('onSheetEdit error: ' + err);
  }
}

/* ── handleManualReferralLink: a human hand-links a referral ──
   MIGRATED (Stage 5). Dispatcher; the two implementations are below.

   A human types a referrer's email into the Referred By Email cell. We find that
   referrer, back-fill the seven referral columns on the edited row, credit the
   chain, log the relationship, and notify the referrer.

   THE SHAPE OF THE CHANGE: the referrer lookup moves from a Lifetime Leads scan to
   a scan of the one Leads table. That is the whole difference — and it is exactly
   why Stage 4 had to REFUSE to call this function: under the unified schema
   Lifetime Leads does not exist, and this function's own missing-tab guard returns
   SILENTLY, so a hand-linked referral would have been accepted and dropped with no
   error anywhere. That refusal is deleted with this stage. */
function handleManualReferralLink(sheet, row, rowData, referredByEmail, editedCols) {
  return USE_UNIFIED_SCHEMA
    ? handleManualReferralLinkUnified(row, referredByEmail)
    : handleManualReferralLinkLegacy(sheet, row, rowData, referredByEmail, editedCols);
}

/* THE UNIFIED IMPLEMENTATION.

   WHY THE LOCK IS SCOPED THE WAY IT IS — this is the load-bearing detail, and
   widening it would be a real bug, not a tightening.

   The critical section is ONLY the read-modify-write of the edited row: resolve the
   header, scan for the referrer, and back-fill the seven referral columns. That is a
   read-decide-write on a row this function did not create, so it takes the same
   process-wide script lock every other migrated writer takes, before the read.

   Everything downstream runs OUTSIDE the lock, and MUST:
     - updateReferrerStats() takes the script lock itself (Stage 1).
     - The Referrals append calls nextReferralSequence(), which calls waitLock() on
       the SAME script lock.
   Apps Script does not document the script lock as reentrant. Holding it across
   either call would be a second acquisition of a lock this execution already holds
   — a deadlock or a spurious refusal, and one that would only ever show itself in
   production. Keeping the lock tight around the row write sidesteps the question
   entirely, and matches the "slow side effects outside the lock" rule from Stages
   2 and 3 (Gmail and the Contacts API have no business inside a global lock). */
function handleManualReferralLinkUnified(row, referredByEmail) {
  if (!referredByEmail) return;
  var email = String(referredByEmail).toLowerCase().trim();

  var sheet = leadsTable();
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('handleManualReferralLink: no "' + CONFIG.TABS.LEADS + '" rows; cannot link.');
    return;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(MANUAL_LINK_LOCK_MS)) {
    /* Non-fatal and loud, and NOTHING was half-written. The human's typed email is
       already in the cell (the Sheets UI put it there — that is what fired this
       trigger), so the record of their intent survives; only the link was not
       built. Re-typing the email re-fires the trigger and retries the whole thing. */
    Logger.log('handleManualReferralLink: could not acquire the script lock within ' +
               MANUAL_LINK_LOCK_MS + 'ms (a cold sweep or a referral credit is running). ' +
               'Row ' + row + ' was NOT linked to "' + email + '": no referral columns ' +
               'back-filled, no stats credited, no Referrals row logged, no referrer ' +
               'notified. Nothing partial was written. Re-type the email in the cell to retry.');
    return;
  }

  var linked = null;
  try {
    // Resolve by name and throw on a miss: never write a referral chain into a
    // guessed column.
    var C = resolveUnifiedCols(sheet);
    var data = sheet.getDataRange().getValues();

    var referrerRow = null;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][C.EMAIL] || '').toLowerCase().trim() === email) {
        referrerRow = data[i];
        break;
      }
    }

    if (!referrerRow) {
      // Legacy returns silently here. Under one table this is a real, diagnosable
      // state — the human typed an email that belongs to no lead — so say so.
      Logger.log('handleManualReferralLink: no lead in "' + CONFIG.TABS.LEADS +
                 '" has the email "' + email + '". Row ' + row + ' was not linked.');
      return;   // the finally below still releases the lock
    }

    var referrerLeadId    = String(referrerRow[C.LEAD_ID] || '');
    var referrerFirstName = String(referrerRow[C.FIRST_NAME] || '');
    var referrerName      = [referrerRow[C.FIRST_NAME], referrerRow[C.LAST_NAME]].filter(Boolean).join(' ');
    var referrerCode      = String(referrerRow[C.REFERRAL_CODE] || '');
    var referrerChain     = String(referrerRow[C.REFERRAL_CHAIN] || '').trim();

    // Identical chain construction to buildReferralMatch: the referrer's own chain
    // plus the referrer's Lead ID. So the ancestors are all present and the new
    // lead's own ID is not — which is what makes multi-level Total Downstream work.
    var chain = referrerChain ? referrerChain + '|' + referrerLeadId : referrerLeadId;
    var depth = chain ? chain.split('|').length : 1;

    // Re-read the edited row under the lock rather than trusting the snapshot
    // onSheetEdit captured before we took it.
    var referredRow = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    sheet.getRange(row, C.REF_BY_LEAD_ID + 1).setValue(referrerLeadId);
    sheet.getRange(row, C.REF_BY_NAME    + 1).setValue(referrerName);
    sheet.getRange(row, C.REF_BY_EMAIL   + 1).setValue(email);
    sheet.getRange(row, C.REF_BY_CODE    + 1).setValue(referrerCode);
    sheet.getRange(row, C.MATCH_TYPE     + 1).setValue('manual');
    sheet.getRange(row, C.REFERRAL_CHAIN + 1).setValue(chain);
    sheet.getRange(row, C.CHAIN_DEPTH    + 1).setValue(depth);
    SpreadsheetApp.flush();   // commit before the lock is released

    linked = {
      email:             email,
      referrerLeadId:    referrerLeadId,
      referrerName:      referrerName,
      referrerFirstName: referrerFirstName,
      referrerCode:      referrerCode,
      chain:             chain,
      depth:             depth,
      referredLeadId:    String(referredRow[C.LEAD_ID] || ''),
      referredName:      [referredRow[C.FIRST_NAME], referredRow[C.LAST_NAME]].filter(Boolean).join(' '),
      referredEmail:     String(referredRow[C.EMAIL] || ''),
    };
  } finally {
    // finally: resolveUnifiedCols throws on a mangled header, and a leaked
    // process-wide lock would block every sweep, every status edit, and every
    // referral credit until the execution times out.
    lock.releaseLock();
  }

  if (!linked) return;

  /* ── Everything below is OUTSIDE the lock, deliberately (see the note above) ── */

  // A hand-linked referral is not a second-class one: it credits the full chain
  // exactly as an auto-matched one does. Takes the script lock itself.
  updateReferrerStats(linked.referrerLeadId, linked.chain);

  /* Log to the Referrals tab. Written inline rather than through logReferralEntry
     ON PURPOSE: that helper derives the row's Status as `matchType === 'name' ?
     'pending' : 'linked'`, so routing this through it would silently rewrite the
     Referrals Status column from 'manual' to 'linked' for every hand-linked
     referral. It also takes a `payload`, which an edit trigger does not have. The
     row below is byte-for-byte what the legacy path writes. */
  var refSheet = tab(CONFIG.TABS.REFERRALS);
  if (refSheet) {
    var refId = buildReferralTabId(nextReferralSequence());   // takes the lock itself
    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    refSheet.appendRow([
      refId, linked.referrerLeadId, linked.referrerName, linked.email, linked.referrerCode,
      linked.referredLeadId, linked.referredName, linked.referredEmail,
      'manual', linked.depth, linked.chain, today, 'manual',
    ]);
  }

  sendReferrerNotification(linked.email, linked.referrerFirstName, linked.referrerCode);
}

/* THE LEGACY IMPLEMENTATION — unchanged, still what production runs.
   DELETE AT CUTOVER. Its referrer lookup scans Lifetime Leads.

   editedCols is the resolved column map for `sheet` (the edited tab) — used for
   the writes to it and for reading rowData. The Lifetime Leads referrer lookup
   is a different sheet and is resolved separately (LC). */
function handleManualReferralLinkLegacy(sheet, row, rowData, referredByEmail, editedCols) {
  if (!referredByEmail) return;
  var EC = editedCols || COLS;
  var email = referredByEmail.toLowerCase().trim();

  var lifetimeSheet = tab(CONFIG.TABS.LIFETIME_LEADS);
  if (!lifetimeSheet || lifetimeSheet.getLastRow() < 2) return;
  var LC = resolveCols(lifetimeSheet);
  var data = lifetimeSheet.getDataRange().getValues();
  var referrerRow = null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][LC.EMAIL] || '').toLowerCase().trim() === email) {
      referrerRow = data[i];
      break;
    }
  }

  if (!referrerRow) return;

  var referrerLeadId = String(referrerRow[LC.LEAD_ID] || '');
  var referrerName   = [referrerRow[LC.FIRST_NAME], referrerRow[LC.LAST_NAME]].filter(Boolean).join(' ');
  var referrerCode   = String(referrerRow[LC.REFERRAL_CODE] || '');
  var referrerChain  = String(referrerRow[LC.REFERRAL_CHAIN] || '').trim();
  var chain          = referrerChain ? referrerChain + '|' + referrerLeadId : referrerLeadId;
  var depth          = chain ? chain.split('|').length : 1;

  sheet.getRange(row, EC.REF_BY_LEAD_ID + 1).setValue(referrerLeadId);
  sheet.getRange(row, EC.REF_BY_NAME    + 1).setValue(referrerName);
  sheet.getRange(row, EC.REF_BY_EMAIL   + 1).setValue(email);
  sheet.getRange(row, EC.REF_BY_CODE    + 1).setValue(referrerCode);
  sheet.getRange(row, EC.MATCH_TYPE     + 1).setValue('manual');
  sheet.getRange(row, EC.REFERRAL_CHAIN + 1).setValue(chain);
  sheet.getRange(row, EC.CHAIN_DEPTH    + 1).setValue(depth);

  // A hand-linked referral is not a second-class one: it credits the full chain
  // exactly as an auto-matched one does. `chain` is computed just above.
  updateReferrerStats(referrerLeadId, chain);

  // Log to Referrals tab
  var refSheet = tab(CONFIG.TABS.REFERRALS);
  if (refSheet) {
    var seq   = nextReferralSequence();
    var refId = buildReferralTabId(seq);
    var today = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy');
    var referredLeadId = String(rowData[EC.LEAD_ID] || '');
    var referredName   = [rowData[EC.FIRST_NAME], rowData[EC.LAST_NAME]].filter(Boolean).join(' ');
    var referredEmail  = String(rowData[EC.EMAIL] || '');
    refSheet.appendRow([
      refId, referrerLeadId, referrerName, email, referrerCode,
      referredLeadId, referredName, referredEmail,
      'manual', depth, chain, today, 'manual',
    ]);
  }

  // Send referrer notification
  var firstName = String(referrerRow[LC.FIRST_NAME] || '');
  sendReferrerNotification(email, firstName, referrerCode);
}

/* ── handleStatusEdit: a human changed a lead's Status in the Sheet ──
   MIGRATED (Stage 3 of the unified-schema migration). Dispatcher; the two
   implementations are below.

   THE SHAPE OF THE CHANGE: legacy treats a status as a PLACE. 'Cold' means "copy
   this row to the Cold Leads tab and delete it from Active"; 'Client' means "copy
   it to Clients"; 'Archive' means "copy it to Archive and delete it". Unified
   treats a status as what it is — a value in a cell, which the human has ALREADY
   written by the time this trigger fires. So the row moves nowhere, nothing is
   appended, nothing is deleted, and what remains is only the Google Contacts
   side effects. Most of the function disappears, exactly as the plan says.

   With this stage, NO unified path deletes a lead row anywhere in the file.

   NOTE ON THE SIGNATURE: the unified branch deliberately ignores `sheetName` and
   `editedCols`. Those come from onSheetEdit, which is NOT migrated yet (Stage 4)
   and still resolves LEAD_HEADERS-shaped columns against a legacy tab. Feeding a
   legacy column map to a unified reader is exactly the class of bug this
   migration exists to end, so the unified branch resolves the Leads header itself
   and trusts nothing it was handed. */
function handleStatusEdit(sheetName, rowNum, rowData, newStatus, editedCols) {
  return USE_UNIFIED_SCHEMA
    ? handleStatusEditUnified(rowNum, newStatus)
    : handleStatusEditLegacy(sheetName, rowNum, rowData, newStatus, editedCols);
}

/* THE UNIFIED IMPLEMENTATION.

   WHAT THE LOCK HERE DOES AND DOES NOT DO — read this before "simplifying" it.

   The lock does NOT stop a sweep from overwriting a human's edit. It cannot. The
   human's Status write is performed by the SHEETS UI, not by this code: by the
   time this onEdit trigger fires, the cell is already changed. A lock only
   excludes writers that take it, and the Sheets UI takes nothing. That gap is
   closed on the sweep's side, by moveColdLeads re-reading each row's live Status
   immediately before stamping 'Cold' (see sweepStaleLeadsToCold).

   What the lock DOES do, and why it is still required:
     1. It serializes this handler against the sweep's critical section, so the
        Contacts side effects below can never be decided from a row the sweep is
        halfway through rewriting.
     2. It is the same process-wide script lock moveColdLeads and
        updateReferrerStats take, so all three genuinely contend — there is one
        lock in this file, not three.
     3. Holding it lets this handler read the row's LIVE status and notice when it
        disagrees with the status the human's edit event reported.

   ON THAT DISAGREEMENT: the side effects follow the LIVE value, not the event's,
   so Google Contacts can never disagree with the Sheet. The conflict is logged
   loudly and the cell is deliberately NOT "restored" to the event's value —
   nothing here can distinguish "a sweep stamped Cold over their Client" from "the
   human made a second Status edit a second later", and auto-restoring would
   silently revert a deliberate human edit. Trading one rare bug for a different
   rare bug is not a fix. */
function handleStatusEditUnified(rowNum, newStatus) {
  var sheet = leadsTable();
  if (!sheet) {
    Logger.log('handleStatusEdit: no "' + CONFIG.TABS.LEADS + '" tab; nothing to do.');
    return;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(STATUS_EDIT_LOCK_MS)) {
    /* Non-fatal and loud, as everywhere else. The human's Status edit is ALREADY
       saved in the Sheet — that is what triggered this — so the record is correct
       regardless. Only the Contacts side effect is skipped, and a contact whose
       group is stale is a far smaller problem than a handler that throws inside an
       onEdit trigger. */
    Logger.log('handleStatusEdit: could not acquire the script lock within ' +
               STATUS_EDIT_LOCK_MS + 'ms (a cold sweep or a referral credit is running). ' +
               'The Status edit itself IS saved — the Sheet is correct. Only the Google ' +
               'Contacts group update for row ' + rowNum + ' was skipped. Re-apply it by ' +
               're-typing the status once the other job finishes.');
    return;
  }

  var email, effectiveStatus;
  try {
    // Resolve by name, throw on a miss: never read a status out of a guessed column.
    var C = resolveUnifiedCols(sheet);
    var row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];

    email = String(row[C.EMAIL] || '');
    effectiveStatus = String(row[C.STATUS] || '');

    if (effectiveStatus !== newStatus) {
      Logger.log('handleStatusEdit: CONFLICT on row ' + rowNum + '. The edit event reported "' +
                 newStatus + '" but the live cell now reads "' + effectiveStatus + '" — another ' +
                 'writer (most likely the cold sweep) changed it, or the human edited again. ' +
                 'Acting on the LIVE value so Contacts cannot disagree with the Sheet. The cell ' +
                 'is NOT being auto-restored: this cannot tell a clobbered edit apart from a ' +
                 'deliberate second one, and reverting a real human edit would be worse.');
    }
  } finally {
    // finally: resolveUnifiedCols throws on a mangled header, and a leaked
    // process-wide lock would block every sweep and every referral credit.
    lock.releaseLock();
  }

  /* Contacts calls are OUTSIDE the lock — they are slow external round-trips, and
     the script lock is process-wide. The sheet has not been touched by this
     function at all, so there is nothing to flush and nothing to protect. */
  applyStatusContactSideEffect(email, effectiveStatus);
}

/* The Google Contacts side effect of a lead reaching a given status, extracted so
   the onEdit handler and setLeadStatus drive IDENTICAL behavior from one body.

   This is not tidying: an installable onEdit trigger does NOT fire for a write
   made by Apps Script itself, so setLeadStatus cannot rely on handleStatusEdit to
   run afterwards. Without a shared helper the choice is to duplicate this switch
   (two bodies that will drift) or to let a menu-driven status change silently skip
   the Contacts move that the identical hand-typed change performs.

   MUST be called OUTSIDE the script lock: these are slow external round-trips and
   the lock is process-wide. Every branch is try/caught — a Contacts failure must
   never turn a saved, correct Status write into a thrown error. */
function applyStatusContactSideEffect(email, status) {
  if (!email) return;

  switch (status) {
    case 'Cold':
      try { moveContactToCold(email); }
      catch (e) { Logger.log('moveContactToCold failed for ' + email + ': ' + e); }
      break;

    case 'Client':
      try {
        var contacts = ContactsApp.getContactsByEmailAddress(email);
        if (contacts && contacts.length) {
          contacts[0].addToGroup(ensureContactGroup(CONFIG.CONTACT_GROUPS.CLIENTS));
        }
      } catch (e) { Logger.log('Client contact label error: ' + e); }
      break;

    /* 'Archive', 'New Lead', 'Active', 'Contacted': no Contacts side effect, which
       matches legacy exactly — legacy's work for these statuses was ENTIRELY the
       row move, and the row no longer moves. Listed rather than defaulted so the
       silence is visibly deliberate. */
    default:
      break;
  }
}

/* THE LEGACY IMPLEMENTATION — unchanged, still what production runs.
   DELETE AT CUTOVER. Every branch below is a row copy plus, in three of them, a
   deleteRow: the status-as-a-place model the unified schema deletes. */
function handleStatusEditLegacy(sheetName, rowNum, rowData, newStatus, editedCols) {
  var C = editedCols || COLS;
  var email = rowData[C.EMAIL];

  switch (newStatus) {
    case 'Cold':
      if (sheetName === CONFIG.TABS.ACTIVE_LEADS) {
        rowData[C.STATUS] = 'Cold';
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
        rowData[C.STATUS] = newStatus;
        appendRow(CONFIG.TABS.ACTIVE_LEADS, rowData);
        tab(CONFIG.TABS.COLD_LEADS).deleteRow(rowNum);
      }
      break;
  }
}

/* editedCols is the resolved column map for the edited tab rowData came from. */
function handleCategoryEdit(rowData, newCategory, editedCols) {
  var C = editedCols || COLS;
  var email = rowData[C.EMAIL];
  try {
    var contacts = ContactsApp.getContactsByEmailAddress(email);
    if (!contacts || !contacts.length) return;
    var contact = contacts[0];

    // Registry-derived, so a newly added lead type's group is cleared here the
    // moment it is defined — no second list to remember to update.
    allCategoryContactGroups().forEach(function(gName) {
      try { var g = ContactsApp.getContactGroup(gName); if (g) contact.removeFromGroup(g); } catch (e) {}
    });

    var newGroup = contactGroupForCategory(newCategory);
    if (newGroup) contact.addToGroup(ensureContactGroup(newGroup));
  } catch (err) {
    Logger.log('handleCategoryEdit error: ' + err);
  }
}

/* Category label → Google Contact group, derived from LEAD_TYPES.
   'Client' is included explicitly because it is a status-derived category, not
   a lead type (no wire role produces it) — see the note on LEAD_TYPES.
   Returns null for a category whose lead type genuinely has no group
   (submit_referral / 'Referral') and for any unknown category. */
function contactGroupForCategory(category) {
  var map = { 'Client': CONFIG.CONTACT_GROUPS.CLIENTS };
  Object.keys(LEAD_TYPES).forEach(function(role) {
    var t = LEAD_TYPES[role];
    if (t.contactGroup) map[t.category] = t.contactGroup;
  });
  return map[category] || null;
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
    // Route through leadSource() like every other consumer: real origin only
    // (QR / blank), never payload.page, which would stamp the domain into the
    // contact's Source note on every main-site submission (the same integrity
    // bug fixed in the Sheet's Source column).
    'Source:      ' + leadSource(payload),
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
  // Reading payload.role / payload.current_situation directly is correct here, not
  // a pre-normalization leftover. Normalizers mutate the payload IN PLACE and ADD
  // the generic fields (person/message/qualData/preferences); they never strip the
  // role-specific ones. So by the time this runs (one call site: the partner
  // notification, well after handleFormSubmission normalizes) both are still set.
  // Do NOT "fix" this by parsing current_situation back out of the Preferences
  // JSON blob — that would re-derive a value that is already sitting on the payload.
  if (payload.role === 'existing_asset_owner' && payload.current_situation) {
    lines.push('Current situation: ' + payload.current_situation);
  }
  var origin = leadSource(payload) || payload.page;
  if (origin) lines.push('Source: ' + origin);
  // For EAO the free text is pressing_issue (no dedicated message field); the label
  // already reads "Message / pressing issue" for exactly this reason.
  var messageText = leadMessageText(payload);
  if (messageText) {
    lines.push('');
    lines.push('Message / pressing issue:');
    lines.push(messageText);
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
    .addItem('📬  Send daily digest now',       'forceDailyDigestNow_ui')
    .addItem('📊  Send partner summary now',    'forcePartnerSummaryNow_ui')
    .addSeparator()
    .addItem('🏷️  Set lead status…',            'promptSetLeadStatus')
    .addItem('📈  Set reports enabled…',        'promptSetReportsEnabled')
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
   ADMIN ACTIONS  —  menu-callable operations on the live Leads table

   MENU-CALLABLE ONLY, DELIBERATELY. None of these is wired into doPost/doGet,
   and that is the current scope, not an oversight: every one of them mutates or
   emails from live CRM data, so exposing them on the public /exec endpoint would
   need an auth story this backend does not have yet (doPost is unauthenticated —
   it has to be, the contact form is anonymous). An API-callable pass is a separate
   change that must bring authentication with it.

   THE SPLIT, and why there are two functions per action: the `xxx()` body is the
   real operation and takes plain arguments, so it is callable from the Apps Script
   editor, from another function, and from a test with no UI in the room. The
   `promptXxx()` wrapper is UI-only — it collects arguments, then reports the
   result. SpreadsheetApp.getUi() throws outside a spreadsheet-bound context, so
   keeping it out of the operation is what makes the operation testable at all.

   ERRORS THROW, they do not return a flag. A menu wrapper catches and alerts; a
   scripted caller gets a real exception rather than a false success it might
   ignore. */

/* The Status vocabulary, and the single site that defines it.

   Derived from nothing — hand-listed on purpose, because these six values are a
   CONTRACT with the live Sheet's data-validation dropdown, not an internal enum.
   The three "active" statuses that moveColdLeads sweeps are a SUBSET of this list
   (see sweepStaleLeadsToCold); the other three are terminal-ish states with their
   own Contacts side effects (applyStatusContactSideEffect). */
var LEAD_STATUSES = ['New Lead', 'Contacted', 'Active', 'Cold', 'Client', 'Archive'];

/* Row index (0-based, into a getDataRange() values array) of a Lead ID, or -1.
   Trimmed + case-insensitive: a Lead ID pasted into a prompt by a human carries
   stray whitespace far more often than not, and 'axp-2026-0041' is unambiguously
   the same lead as 'AXP-2026-0041'. */
function findLeadRowIndexByLeadId(data, C, leadId) {
  var wanted = String(leadId || '').trim().toUpperCase();
  if (!wanted) return -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][C.LEAD_ID] || '').trim().toUpperCase() === wanted) return i;
  }
  return -1;
}

/* Opens the Leads table for a single-row admin write, or throws an actionable
   error. Shared by setLeadStatus and setReportsEnabled, which differ only in the
   column they write. */
function openLeadsForAdmin() {
  var sheet = leadsTable();
  if (!sheet) {
    throw new Error('No "' + CONFIG.TABS.LEADS + '" tab exists. Run setupSpreadsheetUnified() first.');
  }
  if (sheet.getLastRow() < 2) {
    throw new Error('The "' + CONFIG.TABS.LEADS + '" tab has no lead rows yet.');
  }
  return sheet;
}

/* ── setLeadStatus(leadId, newStatus) ──
   Sets the Status column for ONE lead, by Lead ID, exactly as if a human had typed
   it into the cell — INCLUDING the Google Contacts side effect.

   WHY THE SIDE EFFECT IS APPLIED HERE RATHER THAN LEFT TO onSheetEdit: an
   installable onEdit trigger does not fire for a write made by Apps Script. So
   this function's write will NOT be seen by handleStatusEditUnified, and without
   the explicit call below a status set from the menu would update the Sheet while
   silently skipping the Contacts move that the identical hand-typed edit performs.
   The two paths share one body (applyStatusContactSideEffect) so they cannot drift.

   Returns { leadId, row, previousStatus, newStatus, changed }. */
function setLeadStatus(leadId, newStatus) {
  var id     = String(leadId || '').trim();
  var status = String(newStatus || '').trim();

  if (!id)     throw new Error('setLeadStatus: a Lead ID is required.');
  if (!status) throw new Error('setLeadStatus: a status is required.');

  /* Validate BEFORE touching the sheet. An unrecognized status written into the
     column is not a harmless typo: moveColdLeads only sweeps the three active
     values and handleStatusEdit only reacts to the six, so a misspelled 'Cold '
     would sit there looking correct while the lead silently falls out of every
     automation that keys on it. */
  if (LEAD_STATUSES.indexOf(status) === -1) {
    throw new Error('setLeadStatus: "' + status + '" is not a valid status. Use one of: ' +
                    LEAD_STATUSES.join(', ') + '.');
  }

  var sheet = openLeadsForAdmin();

  /* The same process-wide script lock every other writer takes, so this genuinely
     contends with the cold sweep, the referral credit, and the onEdit handler
     rather than racing them. tryLock, not waitLock: consistent with the rest of the
     file — give up and say so rather than sit on an execution slot. */
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(STATUS_EDIT_LOCK_MS)) {
    throw new Error('setLeadStatus: could not acquire the script lock within ' +
                    STATUS_EDIT_LOCK_MS + 'ms (a cold sweep or referral credit is running). ' +
                    'NOTHING was written. Try again in a moment.');
  }

  var email, previousStatus, sheetRow;
  try {
    // Resolve by name and throw on a miss: never write a status into a guessed cell.
    var C    = resolveUnifiedCols(sheet);
    var data = sheet.getDataRange().getValues();

    var idx = findLeadRowIndexByLeadId(data, C, id);
    if (idx === -1) {
      throw new Error('setLeadStatus: no lead with Lead ID "' + id + '" in "' +
                      CONFIG.TABS.LEADS + '". Nothing was written.');
    }

    sheetRow       = idx + 1;                                  // 1-based, header included
    previousStatus = String(data[idx][C.STATUS] || '');
    email          = String(data[idx][C.EMAIL]  || '');

    sheet.getRange(sheetRow, C.STATUS + 1).setValue(status);
    // Commit before releasing: a write that lands after the lock is gone is a write
    // that happened outside it.
    SpreadsheetApp.flush();
  } finally {
    // finally: resolveUnifiedCols throws on a mangled header, and a leaked
    // process-wide lock would block every sweep and every referral credit.
    lock.releaseLock();
  }

  // OUTSIDE the lock — slow external round-trips, and the sheet write is done.
  applyStatusContactSideEffect(email, status);

  Logger.log('setLeadStatus: ' + id + ' (row ' + sheetRow + ') "' + previousStatus +
             '" → "' + status + '".');

  return {
    leadId:         id,
    row:            sheetRow,
    previousStatus: previousStatus,
    newStatus:      status,
    changed:        previousStatus !== status,
  };
}

/* ── setReportsEnabled(leadId, enabled) ──
   Toggles ONE lead's Reports Enabled column: the monthly-referral-summary opt-out.

   PER-LEAD, NOT GLOBAL. Reports Enabled is a per-partner choice
   (sendMonthlyReferralSummariesUnified reads it row by row), so a single-argument
   global version would have to mass-write every Referral Partner row and destroy
   each partner's individual opt-out — a bulk mutation of live data that no git
   revert can undo.

   THE STORED VALUE MATCHES THE READER'S RULE, which is asymmetric: the summary
   sender skips a row only on an EXPLICIT FALSE (blank and TRUE both mean enabled).
   So this writes real booleans — true / false — never the strings 'TRUE'/'FALSE'
   and never '' for the disabled case, which would read back as ENABLED and make
   the opt-out silently fail.

   Returns { leadId, row, previousValue, enabled }. */
function setReportsEnabled(leadId, enabled) {
  var id = String(leadId || '').trim();
  if (!id) throw new Error('setReportsEnabled: a Lead ID is required.');

  /* Coerced deliberately, and NOT with a bare Boolean(): this is reachable from a
     prompt, where the argument arrives as the STRING 'false' — and Boolean('false')
     is true, which would silently enable a partner the user just asked to disable.
     Only the recognized spellings pass; anything else throws. */
  var on = normalizeEnabledFlag(enabled);

  var sheet = openLeadsForAdmin();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(STATUS_EDIT_LOCK_MS)) {
    throw new Error('setReportsEnabled: could not acquire the script lock within ' +
                    STATUS_EDIT_LOCK_MS + 'ms. NOTHING was written. Try again in a moment.');
  }

  try {
    var C    = resolveUnifiedCols(sheet);
    var data = sheet.getDataRange().getValues();

    var idx = findLeadRowIndexByLeadId(data, C, id);
    if (idx === -1) {
      throw new Error('setReportsEnabled: no lead with Lead ID "' + id + '" in "' +
                      CONFIG.TABS.LEADS + '". Nothing was written.');
    }

    var sheetRow      = idx + 1;
    var previousValue = data[idx][C.REPORTS_ENABLED];
    var category      = String(data[idx][C.CATEGORY] || '');

    /* A warning, NOT a refusal. Only Referral Partners are read by the monthly
       summary, so setting this on any other category is inert — but it is also
       harmless, and refusing would block the legitimate case of pre-setting the
       flag on a lead about to be re-categorized. Say so and proceed. */
    if (category !== 'Referral Partner') {
      Logger.log('setReportsEnabled: NOTE — ' + id + ' is category "' + category +
                 '", not "Referral Partner". Only Referral Partners receive the monthly ' +
                 'summary, so this flag has no effect until the category changes.');
    }

    sheet.getRange(sheetRow, C.REPORTS_ENABLED + 1).setValue(on);
    SpreadsheetApp.flush();

    Logger.log('setReportsEnabled: ' + id + ' (row ' + sheetRow + ') "' +
               previousValue + '" → ' + on + '.');

    return { leadId: id, row: sheetRow, previousValue: previousValue, enabled: on };
  } finally {
    lock.releaseLock();
  }
}

/* The accepted spellings of a boolean flag, in one place. Throws on anything
   unrecognized rather than guessing — see setReportsEnabled on why Boolean('false')
   is the specific trap being avoided. */
function normalizeEnabledFlag(value) {
  if (value === true  || value === false) return value;
  var s = String(value == null ? '' : value).trim().toLowerCase();
  if (s === 'true'  || s === 'yes' || s === 'y' || s === 'on'  || s === '1') return true;
  if (s === 'false' || s === 'no'  || s === 'n' || s === 'off' || s === '0') return false;
  throw new Error('Expected a true/false value, got "' + value + '". Use TRUE or FALSE.');
}

/* ── forcePartnerSummaryNow() / forceDailyDigestNow() ──
   Run the two scheduled emails immediately, off-schedule.

   These are THIN ON PURPOSE. Each calls the very same dispatcher the time-based
   trigger calls, with no flags and no "manual run" mode, so a forced run and a
   scheduled run cannot diverge in behavior — which is the entire point of having a
   force button: to observe what the schedule will actually do.

   NOT DRY RUNS. Both send real email to real recipients (NOTIFY_EMAILS for the
   digest; every eligible referral partner for the summary). The menu wrappers
   confirm before firing for exactly that reason.

   Each returns what its underlying send returns, so a scripted caller can assert
   on the outcome. */
function forcePartnerSummaryNow() {
  Logger.log('forcePartnerSummaryNow: manual off-schedule run of sendMonthlyReferralSummaries.');
  return sendMonthlyReferralSummaries();
}

function forceDailyDigestNow() {
  Logger.log('forceDailyDigestNow: manual off-schedule run of sendDailyDigest.');
  return sendDailyDigest();
}


/* ── The menu wrappers ──
   UI only. They collect arguments, call the operation, and report. All the real
   behavior lives above, where it is testable without a spreadsheet UI. */

function promptSetLeadStatus() {
  var ui = SpreadsheetApp.getUi();

  var r1 = ui.prompt('Set lead status (1/2)', 'Lead ID (e.g. AXP-2026-0041):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var leadId = r1.getResponseText().trim();
  if (!leadId) { ui.alert('A Lead ID is required.'); return; }

  var r2 = ui.prompt('Set lead status (2/2)',
                     'New status — one of:\n' + LEAD_STATUSES.join(', '),
                     ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var status = r2.getResponseText().trim();

  try {
    var res = setLeadStatus(leadId, status);
    ui.alert(res.changed
      ? 'Row ' + res.row + ': ' + res.leadId + '\n\n"' + res.previousStatus + '" → "' + res.newStatus + '"'
      : 'Row ' + res.row + ': ' + res.leadId + '\n\nAlready "' + res.newStatus + '". No change.');
  } catch (err) {
    ui.alert('Error: ' + err.message);
  }
}

function promptSetReportsEnabled() {
  var ui = SpreadsheetApp.getUi();

  var r1 = ui.prompt('Set reports enabled (1/2)', 'Lead ID (e.g. AXP-2026-0041):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var leadId = r1.getResponseText().trim();
  if (!leadId) { ui.alert('A Lead ID is required.'); return; }

  var r2 = ui.prompt('Set reports enabled (2/2)',
                     'Receives the monthly referral summary?\n\nTRUE = yes, FALSE = opted out.',
                     ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;

  try {
    var res = setReportsEnabled(leadId, r2.getResponseText().trim());
    ui.alert('Row ' + res.row + ': ' + res.leadId + '\n\nReports Enabled → ' +
             (res.enabled ? 'TRUE (receives the monthly summary)' : 'FALSE (opted out)'));
  } catch (err) {
    ui.alert('Error: ' + err.message);
  }
}

/* Both force wrappers CONFIRM FIRST. These send real email the moment they are
   clicked, and the menu item sits one row away from the others — a misclick that
   emails every referral partner is not recoverable. */
function forceDailyDigestNow_ui() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Send daily digest now?',
                    'This emails today\'s leads to ' + CONFIG.NOTIFY_EMAILS.join(', ') +
                    ' immediately, outside the 6pm schedule.\n\nIt is silent if there are no leads today.',
                    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  try {
    forceDailyDigestNow();
    ui.alert('Daily digest run complete. Check the execution log for what was sent.');
  } catch (err) {
    ui.alert('Error: ' + err.message);
  }
}

function forcePartnerSummaryNow_ui() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Send partner summary now?',
                    'This emails the monthly referral summary to EVERY eligible referral ' +
                    'partner immediately, outside the schedule.\n\nThis is not a dry run.',
                    ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  try {
    forcePartnerSummaryNow();
    ui.alert('Partner summary run complete. Check the execution log for what was sent.');
  } catch (err) {
    ui.alert('Error: ' + err.message);
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

/* ── setupSpreadsheetUnified: create the ONE lead table + Referrals + Subscribers ──
   MIGRATED (Stage 9). Deliberately NOT a dispatcher on USE_UNIFIED_SCHEMA, and NOT a
   rewrite of setupSpreadsheet — it is a SEPARATE, explicitly-named entry point. Two
   reasons, both about how this function is actually used:

   1. It is a MANUAL admin action, run by hand from the Apps Script editor — never
      from a request path. `clasp deploy` does not create tabs; running this is what
      makes the Leads tab exist for the first time.

   2. Chicken-and-egg with the switch. The Leads tab must exist BEFORE
      USE_UNIFIED_SCHEMA flips (a migrated function pointed at a missing tab throws).
      So at cutover you run THIS, and only then flip the switch. A switch-gated setup
      function would create the LEGACY tabs while the switch is still off — exactly
      backwards. A separate name means the operator calls the thing they mean.

   The legacy setupSpreadsheet() below is left completely untouched: it still creates
   and repairs the 11 legacy tabs, which is needed right up until cutover.

   THE EMPTY-TAB GUARD IS KEPT (getLastRow() === 0). Never touch a tab that already
   holds data — the same hard-won Sheet-safety rule the legacy function follows. On a
   second run this is all no-ops. */
function setupSpreadsheetUnified() {
  var id = getProp('SPREADSHEET_ID');
  if (!id) {
    throw new Error('Run setProperties() first to configure SPREADSHEET_ID and SCRIPT_URL');
  }
  var ss = SpreadsheetApp.openById(id);

  /* Exactly three tabs. Referrals and Subscribers keep their OWN schemas
     (REFERRAL_HEADERS / SUBSCRIBER_HEADERS) — verified against §1 of the migration
     plan: they were never part of this migration, so their headers here are the same
     literals the legacy setup writes. Only the lead table changes: nine tabs sharing
     LEAD_HEADERS collapse to one Leads tab on UNIFIED_LEAD_HEADERS (25 cols incl.
     Details). */
  var specs = [
    { name: CONFIG.TABS.LEADS,       headers: UNIFIED_LEAD_HEADERS, color: '#24A5BC' },
    { name: CONFIG.TABS.REFERRALS,   headers: REFERRAL_HEADERS,     color: '#38285D' },
    { name: CONFIG.TABS.SUBSCRIBERS, headers: SUBSCRIBER_HEADERS,   color: '#9F328C' },
  ];

  specs.forEach(function(spec) {
    var sheet = ss.getSheetByName(spec.name) || ss.insertSheet(spec.name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(spec.headers);
      sheet.getRange(1, 1, 1, spec.headers.length)
        .setFontWeight('bold')
        .setBackground(spec.color)
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });

  Logger.log('setupSpreadsheetUnified: Leads + Referrals + Subscribers ready (3 tabs).');
}

function setupSpreadsheet() {
  var id = getProp('SPREADSHEET_ID');
  if (!id) {
    throw new Error('Run setProperties() first to configure SPREADSHEET_ID and SCRIPT_URL');
  }
  var ss = SpreadsheetApp.openById(id);

  // Registry-derived: every lead type that owns a tab gets one created here.
  var leadTabs = leadTabConfigs();

  leadTabs.forEach(function(cfg) {
    var sheet = ss.getSheetByName(cfg.name) || ss.insertSheet(cfg.name);
    if (sheet.getLastRow() === 0) {
      var headers = expectedHeadersFor(cfg.name);
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

  // Derived, not a hardcoded "11" — the count moves with the registry.
  Logger.log('setupSpreadsheet: all ' + (leadTabs.length + 2) + ' tabs ready.');
}

/* ── One-time backfill: Existing Asset Owner category rows ──
   WHY THIS IS NEEDED. appendRow() logs and returns when its target tab is
   absent. The "Existing Asset Owners" tab was named in CONFIG but setupSpreadsheet()
   was never re-run after the EAO lead type shipped, so the tab never existed and
   every EAO submission's category-tab write was silently dropped. Lifetime Leads
   and Active Leads always received the row, so nothing was truly lost — Lifetime
   Leads is the complete record this backfill reads from.

   ORDER OF OPERATIONS (both are manual, from the Apps Script editor):
     1. setupSpreadsheet()      — creates the missing tab with the current headers
     2. backfillEaoCategoryRows() — copies the dropped rows into it
   Running (2) before (1) throws with that instruction rather than doing nothing.

   IDEMPOTENT. Rows are keyed by Lead ID against the destination tab, so a second
   run inserts nothing. Safe to re-run after new EAO leads arrive, too — it will
   only ever copy rows that are genuinely absent.

   Columns are mapped BY HEADER NAME from Lifetime Leads onto the destination
   tab's real header row, never by position, so the two tabs may legitimately
   differ in column order or width (e.g. one migrated, one not). */

/** Opens the CRM spreadsheet, or throws the actionable "run setProperties" error. */
function openCrmSpreadsheet() {
  var id = getProp('SPREADSHEET_ID');
  if (!id) throw new Error('Run setProperties() first to configure SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

/** Pure-ish read pass shared by the count and the write, so a dry run can never
 *  report a different number than the backfill actually inserts. Performs no
 *  mutation. Returns { dst, matched, alreadyPresent, blankLeadId, toInsert }. */
function eaoBackfillPlan(ss) {
  var leadType = LEAD_TYPES.existing_asset_owner;
  var srcName  = CONFIG.TABS.LIFETIME_LEADS;

  var src = ss.getSheetByName(srcName);
  if (!src) throw new Error('Source tab "' + srcName + '" not found.');

  var dst = ss.getSheetByName(leadType.tab);
  if (!dst) {
    throw new Error('Tab "' + leadType.tab + '" does not exist yet. ' +
                    'Run setupSpreadsheet() once to create it, then re-run this function.');
  }
  if (dst.getLastRow() < 1 || dst.getLastColumn() < 1) {
    throw new Error('Tab "' + leadType.tab + '" has no header row. ' +
                    'Run setupSpreadsheet() once to write its headers, then re-run this function.');
  }

  var trim = function(v) { return String(v === null || v === undefined ? '' : v).trim(); };

  // Header rows are read RAW (not trimmed) so the diagnostic can report exactly
  // what is in each cell. All comparison goes through normalizeHeaderName.
  var srcHeaders = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0];
  var dstHeaders = dst.getRange(1, 1, 1, dst.getLastColumn()).getValues()[0];

  // Expected names come from LEAD_HEADERS/COLS, never re-typed here.
  var srcCategoryIdx = findHeaderIndex(srcHeaders, CATEGORY_HEADER);
  var srcLeadIdIdx   = findHeaderIndex(srcHeaders, LEAD_ID_HEADER);
  var dstLeadIdIdx   = findHeaderIndex(dstHeaders, LEAD_ID_HEADER);
  if (srcCategoryIdx === -1) throw headerLookupError(srcName, srcHeaders, CATEGORY_HEADER);
  if (srcLeadIdIdx === -1)   throw headerLookupError(srcName, srcHeaders, LEAD_ID_HEADER);
  if (dstLeadIdIdx === -1)   throw headerLookupError(leadType.tab, dstHeaders, LEAD_ID_HEADER);

  // Lead IDs already on the destination tab — the idempotency key.
  var seen = {};
  if (dst.getLastRow() > 1) {
    dst.getRange(2, dstLeadIdIdx + 1, dst.getLastRow() - 1, 1)
       .getValues()
       .forEach(function(r) { var id = trim(r[0]); if (id) seen[id] = true; });
  }

  // Normalized source header -> index, built once rather than re-scanned per row.
  // First occurrence wins, so a duplicated header cannot shadow the real column.
  var srcIndexByHeader = {};
  srcHeaders.forEach(function(h, i) {
    var key = normalizeHeaderName(h);
    if (key && !Object.prototype.hasOwnProperty.call(srcIndexByHeader, key)) {
      srcIndexByHeader[key] = i;
    }
  });

  var plan = { dst: dst, matched: 0, alreadyPresent: 0, blankLeadId: 0, toInsert: [] };
  if (src.getLastRow() < 2) return plan;

  src.getRange(2, 1, src.getLastRow() - 1, src.getLastColumn())
     .getValues()
     .forEach(function(row) {
       if (trim(row[srcCategoryIdx]) !== leadType.category) return;
       plan.matched++;

       var leadId = trim(row[srcLeadIdIdx]);
       if (!leadId)     { plan.blankLeadId++;    return; }
       if (seen[leadId]) { plan.alreadyPresent++; return; }
       seen[leadId] = true;  // also dedupes within Lifetime Leads itself

       // Name-based projection onto the destination layout, matched with the same
       // normalization as the lookups above. An exact compare here would silently
       // blank any column whose two header cells differ only in case or spacing —
       // including Lead ID itself, which would insert rows with an empty key and
       // so destroy idempotency: the next run would not see them and would insert
       // duplicates. A destination column genuinely absent from the source (none
       // today) is left blank.
       plan.toInsert.push(dstHeaders.map(function(h) {
         var key = normalizeHeaderName(h);
         return Object.prototype.hasOwnProperty.call(srcIndexByHeader, key)
           ? row[srcIndexByHeader[key]]
           : '';
       }));
     });

  return plan;
}

/** Read-only. Reports how many Existing Asset Owner rows in Lifetime Leads are
 *  missing from the Existing Asset Owners tab. Writes nothing. */
function countMissingEaoCategoryRows() {
  var plan = eaoBackfillPlan(openCrmSpreadsheet());
  var out = [
    'countMissingEaoCategoryRows:',
    '  Lifetime Leads rows with Category = "' + LEAD_TYPES.existing_asset_owner.category + '": ' + plan.matched,
    '  already present on "' + LEAD_TYPES.existing_asset_owner.tab + '": ' + plan.alreadyPresent,
    '  missing (would be inserted): ' + plan.toInsert.length,
    '  skipped, blank Lead ID: ' + plan.blankLeadId,
  ].join('\n');
  Logger.log(out);
  return out;
}

/** One-time (but idempotent) backfill of the dropped EAO category-tab rows.
 *  Run setupSpreadsheet() first if the tab does not exist yet. */
function backfillEaoCategoryRows() {
  var plan = eaoBackfillPlan(openCrmSpreadsheet());

  if (plan.toInsert.length) {
    // Single batched write rather than N appendRow() calls.
    plan.dst
        .getRange(plan.dst.getLastRow() + 1, 1, plan.toInsert.length, plan.toInsert[0].length)
        .setValues(plan.toInsert);
  }

  var out = [
    'backfillEaoCategoryRows:',
    '  matched in Lifetime Leads: ' + plan.matched,
    '  already present (skipped): ' + plan.alreadyPresent,
    '  inserted: ' + plan.toInsert.length,
    '  skipped, blank Lead ID: ' + plan.blankLeadId,
    plan.toInsert.length ? '  → re-running now is a no-op.' : '  → nothing to do.',
  ].join('\n');
  Logger.log(out);
  return out;
}

/* ── Read-only header audit: the analysis, separated from its rendering ──
   Reads one lead tab and returns a structured verdict. Writes nothing.

   Two functions render this: auditLeadTabHeadersSummary (one line per tab) and
   auditLeadTabHeaderDetail (every column of one tab). Splitting analysis from
   rendering is what keeps them from disagreeing — a summary that said OK while the
   detail said DRIFT would be worse than having no summary at all.

   `safeToRewrite` deliberately means "drifted AND empty", not merely "empty". A
   healthy tab has nothing to rewrite, so the flag stays false and only ever points
   at tabs that both need a repair and can take one. */
function leadTabHeaderAudit(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return { name: tabName, missing: true };

  var expected = expectedHeadersFor(tabName);
  var dataRows = Math.max(0, sheet.getLastRow() - 1);
  var lastCol  = sheet.getLastColumn();
  var actual   = lastCol > 0 && sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  var cell = function(v) { return String(v === null || v === undefined ? '' : v); };

  // Compare with the same normalization every runtime lookup uses, so a header this
  // audit calls "OK" is exactly one findHeaderIndex() will resolve.
  var diffs = [];
  var width = Math.max(expected.length, actual.length);
  for (var i = 0; i < width; i++) {
    var same = i < expected.length && i < actual.length &&
               normalizeHeaderName(expected[i]) === normalizeHeaderName(actual[i]);
    if (!same) {
      diffs.push({
        col:      i + 1,
        expected: i < expected.length ? expected[i]       : '(none)',
        actual:   i < actual.length   ? cell(actual[i])   : '(none)',
      });
    }
  }

  // Headers the runtime looks up by name. Their absence is what actually breaks
  // things, independent of ordering.
  var missingCritical = [LEAD_ID_HEADER, CATEGORY_HEADER, HEARD_ABOUT_HEADER]
    .filter(function(h) { return findHeaderIndex(actual, h) === -1; });

  return {
    name: tabName, missing: false,
    expected: expected, actual: actual, dataRows: dataRows,
    diffs: diffs, missingCritical: missingCritical,
    drift: diffs.length > 0,
    safeToRewrite: diffs.length > 0 && dataRows === 0,
  };
}

/* Renders one audited tab's full per-column detail as an array of lines. */
function renderLeadTabHeaderDetail(a) {
  if (a.missing) return ['MISSING  "' + a.name + '": tab not found'];

  var lines = [
    (a.drift ? 'DRIFT   ' : 'OK      ') + '"' + a.name + '"' +
      '  dataRows=' + a.dataRows +
      '  cols=' + a.actual.length + ' (expected ' + a.expected.length + ')',
    '    header: ' + a.actual.map(function(v) {
      var t = String(v === null || v === undefined ? '' : v);
      return t === '' ? '(blank)' : t;
    }).join(' | '),
  ];

  if (a.missingCritical.length) {
    lines.push('    !! missing name-looked-up header(s): ' + a.missingCritical.join(', '));
  }
  if (a.diffs.length) {
    lines.push('    mismatched cells (' + a.diffs.length + '):');
    a.diffs.forEach(function(d) {
      lines.push('      col ' + d.col + ': expected "' + d.expected + '"  actual "' + d.actual + '"');
    });
    lines.push(a.dataRows > 0
      ? '    → HAS DATA: do NOT rewrite the header. Needs column realignment.'
      : '    → empty: safe to rewrite the header row from expectedHeadersFor().');
  }
  return lines;
}

/* ── Condensed audit: one line per tab ──
   WHY THIS IS THE DEFAULT ONE TO RUN. A full per-column dump of every tab emits a
   31-column header row per tab, and the Apps Script log viewer truncates the
   message before the later tabs (Referral Partners onward) are ever reached — so
   the tabs nobody had looked at were precisely the ones the audit could not show.
   A summary that always fits is worth more than a detailed one that stops early.
   (The all-tabs full dump was removed for that reason; use this plus the per-tab
   detail below.)

   Budget: ~9 tabs at well under 200 chars each, a single Logger.log call. The
   per-column detail lives in auditLeadTabHeaderDetail(tabName), which is scoped to
   one tab and so cannot be crowded out by the other eight. */
function auditLeadTabHeadersSummary() {
  var ss = openCrmSpreadsheet();

  var audits = leadTabConfigs().map(function(cfg) {
    return leadTabHeaderAudit(ss, cfg.name);
  });

  // Pad to the longest tab name so the columns line up in the log.
  var pad = audits.reduce(function(m, a) { return Math.max(m, a.name.length); }, 0);
  var padded = function(s) {
    var out = s;
    while (out.length < pad) out += ' ';
    return out;
  };

  var lines = ['auditLeadTabHeadersSummary:'];

  audits.forEach(function(a) {
    if (a.missing) { lines.push('  MISSING  ' + padded(a.name) + '  tab not found'); return; }

    // Only the COUNT of missing critical headers here, never the names: three long
    // header names on nine tabs is exactly the unbounded growth this mode exists to
    // avoid. auditLeadTabHeaderDetail() names them.
    var note = a.drift
      ? '  rewrite=' + (a.safeToRewrite ? 'SAFE' : 'NO(has data)') +
        (a.missingCritical.length ? '  missingKeyCols=' + a.missingCritical.length : '')
      : '';

    lines.push('  ' + (a.drift ? 'DRIFT' : 'OK   ') + '  ' + padded(a.name) +
               '  rows=' + a.dataRows +
               '  cols=' + a.actual.length + '/' + a.expected.length +
               note);
  });

  var drifted = audits.filter(function(a) { return !a.missing && a.drift; });
  lines.push('');
  lines.push('  ' + drifted.length + ' of ' + audits.length + ' tab(s) drifted' +
             (drifted.length ? ': ' + drifted.map(function(a) { return a.name; }).join(', ') : ''));
  if (drifted.length) {
    lines.push('  → auditLeadTabHeaderDetail("<tab name>") for the per-column diff.');
  }
  var safe = drifted.filter(function(a) { return a.safeToRewrite; });
  if (safe.length) {
    lines.push('  → repairAllDriftedLeadTabHeaders() rewrites the ' + safe.length +
               ' empty drifted tab(s); it skips any tab holding data.');
  }

  var text = lines.join('\n');
  Logger.log(text);
  return text;
}

/* Full per-column detail for ONE tab. The drill-down after the summary flags a tab,
   and the only way to see a drifted tab's columns without the nine-tab audit being
   truncated out from under it. */
function auditLeadTabHeaderDetail(tabName) {
  if (!tabName) throw new Error('auditLeadTabHeaderDetail: pass a tab name, e.g. "Lifetime Leads".');
  var known = leadTabConfigs().map(function(cfg) { return cfg.name; });
  if (known.indexOf(tabName) === -1) {
    throw new Error('"' + tabName + '" is not a lead tab. Known: ' + known.join(', '));
  }

  var text = ['auditLeadTabHeaderDetail:']
    .concat(renderLeadTabHeaderDetail(leadTabHeaderAudit(openCrmSpreadsheet(), tabName)))
    .join('\n');
  Logger.log(text);
  return text;
}

/* ── Header repair ──
   WHY A HEADER REWRITE IS DANGEROUS, and therefore why everything below is built
   around one guard. leadRow() builds a positional 31-value array and appendRow()
   writes it without ever consulting the header row. So the header being wrong
   tells you nothing about whether the ROWS are wrong. If rows written under an
   older, narrower layout are present, swapping the header underneath them
   silently relabels every column: data that was 'Date Submitted' starts reporting
   itself as 'Status', and name-based readers like eaoBackfillPlan() would then
   copy the wrong cells into the category tabs while looking completely healthy.
   That corruption is unrecoverable without a backup, and it is caused BY the
   repair. Realigning a data-bearing tab is a separate, careful task.

   Hence: a header row is only ever rewritten on a tab with ZERO data rows. That
   invariant is asserted in exactly one place, rewriteLeadTabHeaderRow() below, so
   no caller can route around it. */

/** The refusal every data-bearing repair path raises. One string, so the single
 *  and bulk paths cannot explain the same danger two different ways. */
function headerRewriteRefusal(tabName, dataRows) {
  return 'REFUSING to rewrite the header of "' + tabName + '": it has ' + dataRows + ' data row(s).\n' +
    'A header rewrite only relabels columns, it does not move cells, so any row written\n' +
    'under the old layout would end up silently mislabeled. Run auditLeadTabHeaderDetail("' + tabName + '")\n' +
    'to see the live layout, then realign the columns as its own reviewed change.';
}

/* Mechanical rewrite of one lead tab's header row. Clears row 1 across the sheet's
   full width and rewrites it from expectedHeadersFor(tabName) — 31 columns for every
   lead tab, 32 for Referral Partners.

   THE ZERO-DATA-ROW ASSERT LIVES HERE. Callers are expected to have decided the tab
   is repairable (leadTabHeaderAudit().safeToRewrite), but this is the function that
   would do the damage, so it re-checks rather than trusting them.

   Returns { before, after } — the header row as it was and as it now is. */
function rewriteLeadTabHeaderRow(sheet, tabName) {
  var dataRows = Math.max(0, sheet.getLastRow() - 1);
  if (dataRows > 0) throw new Error(headerRewriteRefusal(tabName, dataRows));

  var expected = expectedHeadersFor(tabName);
  var before   = sheet.getLastColumn() > 0 && sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];

  // Widen if narrower than the target; the old header may also be WIDER (stray
  // trailing cells), so clear row 1 across the full sheet width before writing.
  if (sheet.getMaxColumns() < expected.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), expected.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, sheet.getMaxColumns()).clearContent();

  sheet.getRange(1, 1, 1, expected.length).setValues([expected]);

  // Styling comes from the same registry entry setupSpreadsheet() would have used,
  // rather than a colour re-typed here.
  var cfg = leadTabConfigs().filter(function(c) { return c.name === tabName; })[0];
  if (cfg) {
    sheet.getRange(1, 1, 1, expected.length)
      .setFontWeight('bold')
      .setBackground(cfg.color)
      .setFontColor('#FFFFFF');
  }

  // A tab that was WIDER than expected keeps the old header's bold fill on the
  // now-empty trailing cells, which reads as a real column. Strip it.
  if (sheet.getMaxColumns() > expected.length) {
    sheet.getRange(1, expected.length + 1, 1, sheet.getMaxColumns() - expected.length).clearFormat();
  }

  sheet.setFrozenRows(1);
  return { before: before, after: expected };
}

/** Header row rendered for a log line: blanks made visible, nothing else changed. */
function formatHeaderRowForLog(row) {
  return row.map(function(v) {
    var t = String(v === null || v === undefined ? '' : v);
    return t === '' ? '(blank)' : t;
  }).join(' | ');
}

/* ── Repair ONE lead tab's header row ──
   Works for any tab in leadTabConfigs(), not just Lifetime Leads. Reuses
   leadTabHeaderAudit() for the verdict rather than re-deriving "is this drifted,
   is this empty" a second time.

   Throws on a data-bearing drifted tab (see headerRewriteRefusal). A tab whose
   header already matches is left completely alone — an untouched healthy tab is a
   better outcome than an idempotent rewrite of it. */
function repairLeadTabHeader(tabName) {
  if (!tabName) throw new Error('repairLeadTabHeader: pass a tab name, e.g. "Lifetime Leads".');
  var known = leadTabConfigs().map(function(cfg) { return cfg.name; });
  if (known.indexOf(tabName) === -1) {
    throw new Error('"' + tabName + '" is not a lead tab. Known: ' + known.join(', '));
  }

  var ss = openCrmSpreadsheet();
  var a  = leadTabHeaderAudit(ss, tabName);

  if (a.missing) {
    throw new Error('Tab "' + tabName + '" does not exist. Run setupSpreadsheet() first.');
  }
  if (!a.drift) {
    var ok = 'repairLeadTabHeader:\n  "' + tabName + '" header already matches (' +
             a.actual.length + ' cols). Nothing rewritten.';
    Logger.log(ok);
    return ok;
  }
  if (!a.safeToRewrite) throw new Error(headerRewriteRefusal(tabName, a.dataRows));

  var r = rewriteLeadTabHeaderRow(ss.getSheetByName(tabName), tabName);

  var out = [
    'repairLeadTabHeader:',
    '  tab: "' + tabName + '"  (0 data rows, clean rewrite)',
    '  before (' + r.before.length + ' cols): ' + formatHeaderRowForLog(r.before),
    '  after  (' + r.after.length + ' cols): ' + r.after.join(' | '),
    '  → verify with auditLeadTabHeadersSummary()',
  ].join('\n');
  Logger.log(out);
  return out;
}

/* ── Repair EVERY drifted lead tab that is safe to repair ──
   The bulk counterpart to auditLeadTabHeadersSummary(): same iteration, same
   per-tab verdict from leadTabHeaderAudit(), except that a tab reporting
   rewrite=SAFE gets its header row rewritten instead of merely reported.

   THE GUARD IS a.safeToRewrite, TAKEN VERBATIM FROM THE AUDIT. It means "drifted
   AND zero data rows". Any other verdict — healthy, data-bearing, tab missing — is
   skipped and logged, never written to. This function is only correct because the
   audit already refuses to call a data-bearing tab safe; it does not get a vote of
   its own, and rewriteLeadTabHeaderRow() re-asserts the zero-row invariant beneath
   it regardless.

   Idempotent: every repaired tab reports OK on the next run, so a second run is
   all-skips. */
function repairAllDriftedLeadTabHeaders() {
  var ss = openCrmSpreadsheet();

  var audits = leadTabConfigs().map(function(cfg) {
    return leadTabHeaderAudit(ss, cfg.name);
  });

  var pad = audits.reduce(function(m, a) { return Math.max(m, a.name.length); }, 0);
  var padded = function(s) {
    var out = s;
    while (out.length < pad) out += ' ';
    return out;
  };

  var lines = ['repairAllDriftedLeadTabHeaders:'];
  var repaired = 0, skippedOk = 0, skippedUnsafe = 0, skippedMissing = 0;

  audits.forEach(function(a) {
    if (a.missing) {
      skippedMissing++;
      lines.push('  SKIPPED   ' + padded(a.name) + '  (tab not found)');
      return;
    }

    if (!a.drift) {
      skippedOk++;
      lines.push('  SKIPPED   ' + padded(a.name) +
                 '  (already OK)  cols=' + a.actual.length);
      return;
    }

    if (!a.safeToRewrite) {
      skippedUnsafe++;
      lines.push('  SKIPPED   ' + padded(a.name) +
                 '  (unsafe: has data, needs manual review)' +
                 '  rows=' + a.dataRows +
                 '  cols=' + a.actual.length + '/' + a.expected.length);
      return;
    }

    var r = rewriteLeadTabHeaderRow(ss.getSheetByName(a.name), a.name);
    repaired++;
    lines.push('  REPAIRED  ' + padded(a.name) +
               '  cols ' + r.before.length + ' → ' + r.after.length);
  });

  lines.push('');
  lines.push('  ' + repaired + ' repaired, ' + skippedOk + ' already OK, ' +
             skippedUnsafe + ' unsafe (skipped), ' + skippedMissing + ' missing');
  if (skippedUnsafe) {
    lines.push('  → the unsafe tab(s) hold data. auditLeadTabHeaderDetail("<tab name>"), then');
    lines.push('    realign the columns by hand. A header rewrite there would mislabel real rows.');
  }
  lines.push('  → verify with auditLeadTabHeadersSummary()');

  var text = lines.join('\n');
  Logger.log(text);
  return text;
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
