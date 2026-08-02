/**
 * Sheet-backed repository adapters.
 *
 * Columns are resolved BY HEADER NAME, every time, never by position. Someone will
 * eventually drag a column in the Sheet, and when they do the correct outcome is that
 * nothing breaks, not that phone numbers start landing in the notes field.
 *
 * These adapters take a `book` object with getSheetByName(name). That is the only
 * Apps Script surface they know about, so the whole repository layer runs under Node
 * against a fake spreadsheet in tests.
 */

var TAB_NAMES = {
  LEADS: 'Leads',
  CONTACTS: 'Contacts',
  LOG: 'Log',
  WORK: 'Work'
};

/**
 * Header index for a tab. Case and surrounding whitespace are normalized, because a
 * header typed by hand in the Sheet will not match a constant exactly.
 */
function indexHeaders(headerRow) {
  var index = {};
  for (var i = 0; i < headerRow.length; i++) {
    var key = lowerTrim(headerRow[i]);
    if (key !== '' && index[key] === undefined) index[key] = i;
  }
  return index;
}

function columnOf(index, name) {
  var col = index[lowerTrim(name)];
  if (col === undefined) {
    // Naming the column is safe; it is a schema fact, not data.
    throw new Error('missing column: ' + name);
  }
  return col;
}

/** Reads a tab into records keyed by header name. Row numbers are 1-based Sheet rows. */
function readTable(sheet, expectedHeaders) {
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return { index: {}, rows: [], headerRow: [] };

  var index = indexHeaders(values[0]);
  var rows = [];

  for (var r = 1; r < values.length; r++) {
    var record = {};
    var empty = true;
    for (var h = 0; h < expectedHeaders.length; h++) {
      var name = expectedHeaders[h];
      var col = index[lowerTrim(name)];
      var raw = col === undefined ? '' : values[r][col];
      if (raw === 'TRUE') raw = true;
      else if (raw === 'FALSE') raw = false;
      record[name] = raw === undefined || raw === null ? '' : raw;
      if (record[name] !== '' && record[name] !== false) empty = false;
    }
    if (!empty) {
      record.__row = r + 1;
      rows.push(record);
    }
  }
  return { index: index, rows: rows, headerRow: values[0] };
}

/** Appends in the tab's real column order, whatever that order currently is. */
function appendRecord(sheet, expectedHeaders, record) {
  var values = sheet.getDataRange().getValues();
  var headerRow = values.length > 0 ? values[0] : [];
  var index = indexHeaders(headerRow);

  var row = new Array(headerRow.length);
  for (var i = 0; i < row.length; i++) row[i] = '';

  for (var h = 0; h < expectedHeaders.length; h++) {
    var name = expectedHeaders[h];
    var col = index[lowerTrim(name)];
    if (col === undefined) continue;
    var v = record[name];
    if (v === undefined || v === null) v = '';
    if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
    row[col] = v;
  }
  sheet.appendRow(row);
}

/** Writes only the named fields, leaving every other cell in the row untouched. */
function patchRecord(sheet, headerIndex, rowNumber, patch) {
  Object.keys(patch).forEach(function (name) {
    var col = columnOf(headerIndex, name);
    var v = patch[name];
    if (v === undefined || v === null) v = '';
    if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
    sheet.getRange(rowNumber, col + 1).setValue(v);
  });
}

function requireSheet(book, name) {
  var sheet = book.getSheetByName(name);
  if (!sheet) throw new Error('missing tab: ' + name);
  return sheet;
}

/* ── Leads ────────────────────────────────────────────────────────────────── */

function makeLeadRepository(book) {
  function sheet() { return requireSheet(book, TAB_NAMES.LEADS); }

  return {
    insertLead: function (lead) {
      appendRecord(sheet(), LEAD_HEADERS, lead);
      return lead.leadId;
    },

    findLeadById: function (leadId) {
      var table = readTable(sheet(), LEAD_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        if (String(table.rows[i].leadId) === String(leadId)) return table.rows[i];
      }
      return null;
    },

    findLeadBySubmissionId: function (submissionId) {
      var table = readTable(sheet(), LEAD_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        if (String(table.rows[i].submissionId) === String(submissionId)) return table.rows[i];
      }
      return null;
    },

    updateLeadFields: function (leadId, patch) {
      var s = sheet();
      var table = readTable(s, LEAD_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        if (String(table.rows[i].leadId) === String(leadId)) {
          patchRecord(s, table.index, table.rows[i].__row, patch);
          return true;
        }
      }
      return false;
    }
  };
}

/* ── Contacts ─────────────────────────────────────────────────────────────── */

function makeContactRepository(book) {
  function sheet() { return requireSheet(book, TAB_NAMES.CONTACTS); }

  return {
    insertContact: function (contact) {
      appendRecord(sheet(), CONTACT_HEADERS, contact);
      return contact.contactId;
    },

    findContactById: function (contactId) {
      var table = readTable(sheet(), CONTACT_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        if (String(table.rows[i].contactId) === String(contactId)) return table.rows[i];
      }
      return null;
    },

    /**
     * Narrows the candidate set before matching runs.
     *
     * The filter is deliberately generous: it returns anything sharing an email, a
     * phone, or a name. Matching decides confidence. A narrow filter here would hide
     * the exact duplicates the suggestion list exists to surface.
     */
    listContactCandidates: function (keys) {
      var table = readTable(sheet(), CONTACT_HEADERS);
      return table.rows.filter(function (row) {
        if (keys.emailKey && emailKey(row.email) === keys.emailKey) return true;
        if (keys.phoneKey && phoneKey(row.phone) === keys.phoneKey) return true;
        if (keys.nameKey && lowerTrim(row.fullName) === keys.nameKey) return true;
        return false;
      });
    },

    updateContact: function (contact) {
      var s = sheet();
      var table = readTable(s, CONTACT_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        if (String(table.rows[i].contactId) === String(contact.contactId)) {
          // Rewrite only the columns this tab actually has. A whole-record update is
          // not a schema assertion, and it must degrade the same way an append does:
          // a value with nowhere to go is dropped, not fatal. Targeted patches keep
          // the strict behaviour, so a mistyped field name there still fails loudly.
          var patch = {};
          for (var h = 0; h < CONTACT_HEADERS.length; h++) {
            var name = CONTACT_HEADERS[h];
            if (table.index[lowerTrim(name)] === undefined) continue;
            patch[name] = contact[name];
          }
          patchRecord(s, table.index, table.rows[i].__row, patch);
          return true;
        }
      }
      return false;
    }
  };
}

/* ── Log ──────────────────────────────────────────────────────────────────── */

function makeLogRepository(book, ids, clock) {
  return {
    append: function (entry) {
      var sheet = book.getSheetByName(TAB_NAMES.LOG);
      // The log is a convenience, not the record of truth. If its tab is missing, the
      // submission must still succeed rather than failing over a diagnostic write.
      if (!sheet) return false;
      appendRecord(sheet, LOG_HEADERS, {
        logId: ids.newId(),
        at: toIso(clock.now()),
        level: entry.level || 'info',
        event: entry.event || '',
        submissionId: entry.submissionId || '',
        leadId: entry.leadId || '',
        detail: entry.detail || ''
      });
      return true;
    }
  };
}

/* ── Work queue ───────────────────────────────────────────────────────────── */

function makeWorkRepository(book) {
  function sheet() { return requireSheet(book, TAB_NAMES.WORK); }

  var STORED_HEADERS = WORK_HEADERS.concat(['idempotencyKey', 'payload']);

  function serialize(item) {
    var out = clone(item);
    out.payload = JSON.stringify(item.payload || {});
    return out;
  }

  function deserialize(row) {
    var out = clone(row);
    try {
      out.payload = row.payload ? JSON.parse(row.payload) : {};
    } catch (e) {
      out.payload = {};
    }
    out.attempts = Number(row.attempts) || 0;
    return out;
  }

  return {
    enqueue: function (item) {
      var s = sheet();
      var table = readTable(s, STORED_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        // Already queued or already done. Re-enqueuing would be a second email.
        if (table.rows[i].idempotencyKey === item.idempotencyKey) return table.rows[i].workId;
      }
      appendRecord(s, STORED_HEADERS, serialize(item));
      return item.workId;
    },

    findByIdempotencyKey: function (key) {
      var table = readTable(sheet(), STORED_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        if (table.rows[i].idempotencyKey === key) return deserialize(table.rows[i]);
      }
      return null;
    },

    claimDue: function (nowIso, limit) {
      var table = readTable(sheet(), STORED_HEADERS);
      var due = [];
      for (var i = 0; i < table.rows.length && due.length < limit; i++) {
        var row = table.rows[i];
        if (row.state !== 'pending') continue;
        if (row.nextAttemptAt && String(row.nextAttemptAt) > nowIso) continue;
        due.push(deserialize(row));
      }
      return due;
    },

    markSucceeded: function (workId, next) { return this.__patch(workId, next); },
    markFailed: function (workId, next) { return this.__patch(workId, next); },
    markAbandoned: function (workId, next) { return this.__patch(workId, next); },

    __patch: function (workId, next) {
      var s = sheet();
      var table = readTable(s, STORED_HEADERS);
      for (var i = 0; i < table.rows.length; i++) {
        if (String(table.rows[i].workId) === String(workId)) {
          patchRecord(s, table.index, table.rows[i].__row, {
            state: next.state,
            attempts: next.attempts,
            nextAttemptAt: next.nextAttemptAt,
            lastError: next.lastError,
            completedAt: next.completedAt
          });
          return true;
        }
      }
      return false;
    }
  };
}

/** Header rows a provisioning run would write. Declared here, never applied here. */
function expectedTabLayout() {
  return [
    { name: TAB_NAMES.LEADS, headers: LEAD_HEADERS },
    { name: TAB_NAMES.CONTACTS, headers: CONTACT_HEADERS },
    { name: TAB_NAMES.LOG, headers: LOG_HEADERS },
    { name: TAB_NAMES.WORK, headers: WORK_HEADERS.concat(['idempotencyKey', 'payload']) }
  ];
}
