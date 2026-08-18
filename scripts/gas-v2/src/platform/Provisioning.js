/**
 * Idempotent provisioning for the V2 Apps Script backend.
 *
 * Two independent operations:
 *
 *   provisionSheet(book)          — creates or verifies all six tabs with correct headers
 *   verifyProperties(reader)      — reports the 13 Script Properties against their tiers
 *   setProperties(writer, values) — writes a targeted set of Script Properties
 *
 * Neither function is called during normal request handling. They are administrative
 * operations designed to be run once against a rehearsal Sheet and once against the
 * production Sheet, guaranteeing both end up byte-identical in structure.
 *
 * GAS entry points that open the real spreadsheet or property store are at the bottom
 * of this file. Tests call the pure functions directly with injected fakes.
 */

/**
 * The 13 Script Properties, classified by tier.
 *
 * 'required': without this property the named capability cannot run.
 * 'warning':  absent, the system degrades gracefully — the effect field says how.
 *
 * Reading PROP_KEYS inside a function body rather than at load time avoids a
 * cross-file evaluation-order dependency. Config.js may or may not be loaded first.
 */
function propertySchema() {
  return [
    { key: PROP_KEYS.SHEET_ID,              tier: 'required', capability: 'intake' },
    { key: PROP_KEYS.CALENDAR_ID,           tier: 'required', capability: 'booking' },
    { key: PROP_KEYS.PARTNER_NOTIFY_TO,     tier: 'required', capability: 'notify' },
    { key: PROP_KEYS.PARTNER_EMAIL_MAP,     tier: 'required', capability: 'digest' },
    { key: PROP_KEYS.REPLY_TO,              tier: 'required', capability: 'acknowledge, qr_acknowledge' },
    { key: PROP_KEYS.FROM_NAME,             tier: 'required', capability: 'notify, acknowledge, qr_acknowledge, digest' },
    { key: PROP_KEYS.FIRM_EMAIL,            tier: 'required', capability: 'qr_acknowledge' },
    { key: PROP_KEYS.WEBSITE_URL,           tier: 'required', capability: 'qr_acknowledge' },
    {
      key: PROP_KEYS.RUN_MODE,
      tier: 'required',
      capability: 'mail, calendar',
      note: "Defaults to 'dry_run' when absent. Must be set to 'live' for production."
    },
    { key: PROP_KEYS.LOGO_URL,                  tier: 'warning', effect: 'Emails render the wordmark as text. Nothing is lost.' },
    { key: PROP_KEYS.FIRM_PHONE,                tier: 'warning', effect: 'Firm phone row omitted rather than shown empty.' },
    { key: PROP_KEYS.PARTNER_DIRECT_EMAIL_MAP,  tier: 'warning', effect: 'QR acknowledgements fall back to the firm address.' },
    { key: PROP_KEYS.PARTNER_DIRECT_PHONE_MAP,  tier: 'warning', effect: 'Partner phone row omitted from QR acknowledgements.' }
  ];
}

/**
 * Provisions all six tabs on the given spreadsheet.
 *
 * For each tab in expectedTabLayout():
 *   - Tab absent: creates it and writes the header row. Action: 'created'.
 *   - Tab present, headers correct: leaves it untouched. Action: 'already_correct'.
 *   - Tab present, headers wrong: reports the mismatch, touches nothing.
 *     Action: 'header_mismatch'. ok on the return value is false.
 *
 * The mismatch case never auto-corrects because the tab may already contain data
 * rows, and rewriting headers without knowing the data layout is destructive.
 *
 * `book` must implement:
 *   - getSheetByName(name) → Sheet | null
 *   - insertSheet(name) → Sheet (new, empty)
 * where Sheet has:
 *   - getDataRange().getValues() → string[][]
 *   - appendRow(string[]) → void
 */
function provisionSheet(book) {
  var layout = expectedTabLayout();
  var results = [];
  var allOk = true;

  for (var i = 0; i < layout.length; i++) {
    var tab = layout[i];
    var sheet = book.getSheetByName(tab.name);

    if (!sheet) {
      sheet = book.insertSheet(tab.name);
      sheet.appendRow(tab.headers);
      results.push({ tab: tab.name, action: 'created' });
    } else {
      var data = sheet.getDataRange().getValues();
      var existingHeaders = data.length > 0 ? data[0] : [];
      if (provisionHeadersMatch(existingHeaders, tab.headers)) {
        results.push({ tab: tab.name, action: 'already_correct' });
      } else {
        results.push({
          tab: tab.name,
          action: 'header_mismatch',
          expected: tab.headers,
          found: existingHeaders
        });
        allOk = false;
      }
    }
  }

  return { ok: allOk, results: results };
}

function provisionHeadersMatch(existing, expected) {
  if (existing.length !== expected.length) return false;
  for (var i = 0; i < expected.length; i++) {
    if (String(existing[i]).trim() !== String(expected[i]).trim()) return false;
  }
  return true;
}

/**
 * Verifies the 13 Script Properties against their documented tiers.
 *
 * `reader` must implement get(key) → string (returns '' for absent keys).
 *
 * Returns:
 *   {
 *     ok: boolean,           // true only when every required property is present
 *     required: [...],       // { key, capability, present, note? }
 *     warnings: [...]        // { key, effect, present }
 *   }
 */
function verifyProperties(reader) {
  var schema = propertySchema();
  var required = [];
  var warnings = [];

  for (var i = 0; i < schema.length; i++) {
    var entry = schema[i];
    var value = reader.get(entry.key);
    var present = typeof value === 'string' && value.trim() !== '';

    if (entry.tier === 'required') {
      var item = { key: entry.key, capability: entry.capability, present: present };
      if (entry.note) item.note = entry.note;
      required.push(item);
    } else {
      warnings.push({ key: entry.key, effect: entry.effect, present: present });
    }
  }

  return {
    ok: required.every(function (r) { return r.present; }),
    required: required,
    warnings: warnings
  };
}

/**
 * Sets Script Properties from a plain-object map.
 *
 * Only the keys present in `values` are written. Keys absent from `values` are
 * left untouched — this is a targeted write, not a full replace.
 *
 * `writer` must implement setProperty(key, value).
 *
 * Returns { ok: true, set: [array of keys written] }.
 */
function setProperties(writer, values) {
  var keys = Object.keys(values || {});
  for (var i = 0; i < keys.length; i++) {
    writer.setProperty(keys[i], String(values[keys[i]]));
  }
  return { ok: true, set: keys.slice() };
}

/**
 * GAS entry point. Opens a spreadsheet by ID and provisions its tabs.
 *
 * This function calls SpreadsheetApp directly and can only run in a real Apps
 * Script runtime. Tests call provisionSheet(book) with a fake book instead.
 */
function runSheetProvisioning(sheetId) {
  var book = SpreadsheetApp.openById(sheetId);
  return provisionSheet(book);
}
