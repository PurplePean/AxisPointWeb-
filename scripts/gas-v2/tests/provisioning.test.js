'use strict';

/*
 * Provisioning.
 *
 * WHAT THESE TESTS GUARD.
 *
 * 1. An empty spreadsheet gets exactly the right six tabs with exactly the right
 *    headers — including Work's real 11-column layout, which was previously documented
 *    as 9 columns in stale notes. This test class is the correct documentation now.
 *
 * 2. Running provisionSheet twice produces the same sheet state as running it once.
 *    Idempotency is the core promise: both a rehearsal Sheet and the later production
 *    Sheet must end up byte-identical by running the same function.
 *
 * 3. An already-correct sheet is recognised as such, and nothing is written.
 *
 * 4. The property verifier classifies all 13 Script Properties correctly.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const { FakeSpreadsheet, buildBook } = require('./helpers/fake-sheets.js');

const ctx = load();

/* ── helpers ──────────────────────────────────────────────────────────────── */

function emptyBook() {
  return new FakeSpreadsheet({});
}

function fakeReader(map) {
  return { get: (key) => (Object.prototype.hasOwnProperty.call(map, key) ? map[key] : '') };
}

function fakeWriter() {
  const written = {};
  return {
    written,
    setProperty(key, value) { written[key] = value; },
  };
}

/* ── 1. Creates all six tabs from scratch ─────────────────────────────────── */

test('provisions all six tabs on an empty spreadsheet', () => {
  const book = emptyBook();
  const result = ctx.provisionSheet(book);

  assert.ok(result.ok, 'ok should be true when all tabs created successfully');
  assert.equal(result.results.length, 6);
  result.results.forEach((r) => {
    assert.equal(r.action, 'created', `expected tab ${r.tab} to be created, got ${r.action}`);
  });
});

test('all six tabs are present and named correctly after provisioning', () => {
  const book = emptyBook();
  ctx.provisionSheet(book);

  const expected = ['Submissions', 'Deliveries', 'Leads', 'Contacts', 'Log', 'Work'];
  expected.forEach((name) => {
    assert.ok(book.getSheetByName(name), `tab "${name}" should exist after provisioning`);
  });
});

/* ── 2. Work tab has exactly 11 columns ───────────────────────────────────── */

/*
 * This test pins the exact Work-tab layout that provisionSheet must create.
 *
 * The Work tab has 9 base columns (WORK_HEADERS) plus idempotencyKey and payload,
 * for a total of 11. Stale documentation described 9 columns. This test is the
 * correct specification: if provisionSheet ever writes the wrong column count or
 * the wrong column names, this test fails before any real Sheet is touched.
 */
test('Work tab gets exactly 11 columns in the correct order', () => {
  const book = emptyBook();
  ctx.provisionSheet(book);

  const workSheet = book.getSheetByName('Work');
  assert.ok(workSheet, 'Work tab must exist');

  const values = workSheet.getDataRange().getValues();
  assert.equal(values.length, 1, 'only the header row should be present');
  const headers = values[0];

  const expected = [
    'workId', 'createdAt', 'kind', 'subjectId', 'state',
    'attempts', 'nextAttemptAt', 'lastError', 'completedAt',
    'idempotencyKey', 'payload'
  ];

  assert.equal(headers.length, expected.length,
    `Work tab must have ${expected.length} columns, found ${headers.length}: ${JSON.stringify(headers)}`);
  assert.deepEqual(headers, expected, 'Work tab headers must match exactly, in order');
});

test('each non-Work tab gets the header count from its expected layout', () => {
  const book = emptyBook();
  ctx.provisionSheet(book);

  const layout = ctx.expectedTabLayout();
  layout.forEach((tab) => {
    const sheet = book.getSheetByName(tab.name);
    const values = sheet.getDataRange().getValues();
    assert.equal(values[0].length, tab.headers.length,
      `${tab.name} tab: expected ${tab.headers.length} headers, found ${values[0].length}`);
  });
});

/* ── 3. Idempotency ───────────────────────────────────────────────────────── */

test('running provisionSheet twice produces no additional writes', () => {
  const book = emptyBook();

  const first = ctx.provisionSheet(book);
  const secondResult = ctx.provisionSheet(book);

  // All tabs were created in the first run.
  assert.ok(first.ok);
  first.results.forEach((r) => assert.equal(r.action, 'created'));

  // Second run finds everything already correct — nothing is written again.
  assert.ok(secondResult.ok);
  secondResult.results.forEach((r) => {
    assert.equal(r.action, 'already_correct',
      `second run: tab ${r.tab} should be already_correct, got ${r.action}`);
  });
});

test('tab contents are byte-identical after a second provision run', () => {
  const book = emptyBook();
  ctx.provisionSheet(book);

  // Snapshot the grid of every tab after the first run.
  const layout = ctx.expectedTabLayout();
  const snapshots = {};
  layout.forEach((tab) => {
    snapshots[tab.name] = JSON.stringify(book.getSheetByName(tab.name).getDataRange().getValues());
  });

  // Run again.
  ctx.provisionSheet(book);

  // Grid must be byte-identical.
  layout.forEach((tab) => {
    const after = JSON.stringify(book.getSheetByName(tab.name).getDataRange().getValues());
    assert.equal(after, snapshots[tab.name],
      `${tab.name} tab content changed on second provision run`);
  });
});

test('the second run reports ok:true', () => {
  const book = emptyBook();
  ctx.provisionSheet(book);
  const second = ctx.provisionSheet(book);
  assert.ok(second.ok);
});

/* ── 4. Already-correct sheet is left untouched ───────────────────────────── */

test('a correctly structured sheet reports all tabs as already_correct', () => {
  const layout = ctx.expectedTabLayout();
  const book = buildBook(layout);

  const result = ctx.provisionSheet(book);

  assert.ok(result.ok);
  result.results.forEach((r) => {
    assert.equal(r.action, 'already_correct',
      `tab ${r.tab} should be already_correct, got ${r.action}`);
  });
});

test('a correctly structured sheet has no new insertedSheets', () => {
  const layout = ctx.expectedTabLayout();
  const book = buildBook(layout);

  ctx.provisionSheet(book);

  assert.equal(book.insertedSheets.length, 0,
    'no tabs should be inserted into an already-correct spreadsheet');
});

/* ── 5. Partial and mismatched sheets ─────────────────────────────────────── */

test('only missing tabs are created when some tabs already exist correctly', () => {
  const layout = ctx.expectedTabLayout();

  // Pre-seed only three tabs.
  const partial = buildBook(layout.slice(0, 3));
  const result = ctx.provisionSheet(partial);

  const created = result.results.filter((r) => r.action === 'created').map((r) => r.tab);
  const correct = result.results.filter((r) => r.action === 'already_correct').map((r) => r.tab);

  assert.equal(created.length, 3, 'three missing tabs should be created');
  assert.equal(correct.length, 3, 'three existing tabs should be already_correct');
  assert.ok(result.ok);
});

test('a tab with wrong headers is reported as header_mismatch without ok', () => {
  const layout = ctx.expectedTabLayout();
  const book = buildBook(layout);

  // Corrupt the Work tab's headers to a short, wrong list.
  const workSheet = book.getSheetByName('Work');
  workSheet.grid[0] = ['workId', 'state', 'kind'];

  const result = ctx.provisionSheet(book);

  const mismatch = result.results.find((r) => r.tab === 'Work');
  assert.ok(mismatch, 'Work tab result must be in the results');
  assert.equal(mismatch.action, 'header_mismatch', 'corrupted headers should be detected');
  assert.deepEqual(mismatch.expected, layout.find((t) => t.name === 'Work').headers);
  assert.deepEqual(mismatch.found, ['workId', 'state', 'kind']);
  assert.equal(result.ok, false, 'ok must be false when any tab has a mismatch');
});

test('a header_mismatch does not modify the existing tab', () => {
  const layout = ctx.expectedTabLayout();
  const book = buildBook(layout);

  // Add a data row to the Work tab, then corrupt its headers.
  const workSheet = book.getSheetByName('Work');
  const original = workSheet.grid[0].slice();
  workSheet.grid[0] = ['workId', 'state'];

  ctx.provisionSheet(book);

  // The tab header must be unchanged — provisionSheet does not auto-correct data.
  assert.deepEqual(workSheet.grid[0], ['workId', 'state'],
    'header_mismatch must not rewrite the existing header row');
});

/* ── 6. Property verification ─────────────────────────────────────────────── */

test('verifyProperties returns ok when all required properties are set', () => {
  const PROP_KEYS = ctx.PROP_KEYS;
  const allRequired = {
    [PROP_KEYS.SHEET_ID]: 'sheet-1',
    [PROP_KEYS.CALENDAR_ID]: 'cal-1',
    [PROP_KEYS.PARTNER_NOTIFY_TO]: 'a@b.test',
    [PROP_KEYS.PARTNER_EMAIL_MAP]: '{"zachary_russell":"z@x.test"}',
    [PROP_KEYS.REPLY_TO]: 'r@b.test',
    [PROP_KEYS.FROM_NAME]: 'AxisPoint',
    [PROP_KEYS.FIRM_EMAIL]: 'f@b.test',
    [PROP_KEYS.WEBSITE_URL]: 'https://example.test',
    [PROP_KEYS.RUN_MODE]: 'dry_run',
  };

  const result = ctx.verifyProperties(fakeReader(allRequired));

  assert.ok(result.ok, 'all required properties set → ok should be true');
  result.required.forEach((r) => {
    assert.ok(r.present, `required property ${r.key} should be present`);
  });
});

test('verifyProperties returns ok:false when a required property is missing', () => {
  const PROP_KEYS = ctx.PROP_KEYS;

  // Every required property present EXCEPT SHEET_ID.
  const missing = {
    [PROP_KEYS.CALENDAR_ID]: 'cal-1',
    [PROP_KEYS.PARTNER_NOTIFY_TO]: 'a@b.test',
    [PROP_KEYS.PARTNER_EMAIL_MAP]: '{"z":"z@x.test"}',
    [PROP_KEYS.REPLY_TO]: 'r@b.test',
    [PROP_KEYS.FROM_NAME]: 'AxisPoint',
    [PROP_KEYS.FIRM_EMAIL]: 'f@b.test',
    [PROP_KEYS.WEBSITE_URL]: 'https://example.test',
    [PROP_KEYS.RUN_MODE]: 'dry_run',
  };

  const result = ctx.verifyProperties(fakeReader(missing));

  assert.equal(result.ok, false, 'a missing required property must make ok false');

  const sheetIdEntry = result.required.find((r) => r.key === PROP_KEYS.SHEET_ID);
  assert.ok(sheetIdEntry, 'SHEET_ID must appear in required');
  assert.equal(sheetIdEntry.present, false, 'SHEET_ID should be reported as not present');
});

test('verifyProperties reports exactly 9 required and 4 warning properties', () => {
  const result = ctx.verifyProperties(fakeReader({}));

  assert.equal(result.required.length, 9,
    `expected 9 required properties, found ${result.required.length}`);
  assert.equal(result.warnings.length, 4,
    `expected 4 warning properties, found ${result.warnings.length}`);
});

test('verifyProperties correctly classifies warning-tier properties', () => {
  const PROP_KEYS = ctx.PROP_KEYS;
  const warningKeys = [
    PROP_KEYS.LOGO_URL,
    PROP_KEYS.FIRM_PHONE,
    PROP_KEYS.PARTNER_DIRECT_EMAIL_MAP,
    PROP_KEYS.PARTNER_DIRECT_PHONE_MAP,
  ];

  const result = ctx.verifyProperties(fakeReader({}));
  const reportedWarningKeys = result.warnings.map((w) => w.key);

  warningKeys.forEach((key) => {
    assert.ok(reportedWarningKeys.includes(key),
      `${key} should be in the warning tier`);
  });
});

/* ── 7. Property setter ───────────────────────────────────────────────────── */

test('setProperties writes every provided key', () => {
  const PROP_KEYS = ctx.PROP_KEYS;
  const writer = fakeWriter();
  const values = {
    [PROP_KEYS.SHEET_ID]: 'sheet-abc',
    [PROP_KEYS.RUN_MODE]: 'dry_run',
    [PROP_KEYS.FROM_NAME]: 'AxisPoint',
  };

  const result = ctx.setProperties(writer, values);

  assert.ok(result.ok);
  assert.equal(result.set.length, 3);
  assert.equal(writer.written[PROP_KEYS.SHEET_ID], 'sheet-abc');
  assert.equal(writer.written[PROP_KEYS.RUN_MODE], 'dry_run');
  assert.equal(writer.written[PROP_KEYS.FROM_NAME], 'AxisPoint');
});

test('setProperties does not touch keys absent from values', () => {
  const PROP_KEYS = ctx.PROP_KEYS;
  const writer = fakeWriter();

  ctx.setProperties(writer, { [PROP_KEYS.SHEET_ID]: 'x' });

  // Only SHEET_ID should be in written — nothing else.
  const keys = Object.keys(writer.written);
  assert.equal(keys.length, 1);
  assert.equal(keys[0], PROP_KEYS.SHEET_ID);
});

test('setProperties returns ok:true and the list of set keys', () => {
  const PROP_KEYS = ctx.PROP_KEYS;
  const writer = fakeWriter();
  const result = ctx.setProperties(writer, {
    [PROP_KEYS.SHEET_ID]: 'x',
    [PROP_KEYS.FROM_NAME]: 'y',
  });

  assert.ok(result.ok);
  assert.equal(result.set.length, 2);
  assert.ok(result.set.includes(PROP_KEYS.SHEET_ID));
  assert.ok(result.set.includes(PROP_KEYS.FROM_NAME));
});
