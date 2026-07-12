'use strict';

/*
 * resolveCols(sheet) is the fix for the whole positional-read bug class, so it
 * gets the hardest test in the suite: it must resolve columns by NAME against a
 * header row that is deliberately NOT LEAD_HEADERS (reordered + re-cased +
 * whitespace-mangled). A tautological fixture (header built from LEAD_HEADERS)
 * would pass even a broken positional implementation — that is precisely the
 * failure mode this suite exists to prevent, so it is avoided on purpose here.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadCode } = require('./helpers/load-code.js');
const { FakeSheet } = require('./helpers/fake-sheets.js');

const S = loadCode();
const LEAD_HEADERS = S.LEAD_HEADERS;
const COLS = S.COLS;

/** Build a header row that is a genuine PERMUTATION of the canonical columns:
 *  reversed order, alternating case, some doubled/again mangled whitespace. Every
 *  standard column is still present (by name), just nowhere near its COLS index. */
function mangledHeaderRow() {
  const reversed = LEAD_HEADERS.slice().reverse();
  return reversed.map((h, i) => {
    if (i % 3 === 0) return h.toUpperCase();
    if (i % 3 === 1) return '  ' + h.replace(/ /g, '  ') + ' '; // doubled spaces + padding
    return h.toLowerCase();
  });
}

test('resolveCols: resolves every COLS key to its REAL position on a mangled header', () => {
  const header = mangledHeaderRow();
  // Prove the fixture is not accidentally canonical.
  assert.notDeepEqual(header, LEAD_HEADERS);

  const sheet = new FakeSheet('Lifetime Leads', [header, ['some', 'data', 'row']]);
  const C = S.resolveCols(sheet);

  // For each key, the resolved index must point at a cell whose NAME normalizes
  // to the canonical header name — i.e. it found the real column, not COLS's guess.
  Object.keys(COLS).forEach((key) => {
    const canonicalName = LEAD_HEADERS[COLS[key]];
    const idx = C[key];
    assert.equal(
      S.normalizeHeaderName(header[idx]),
      S.normalizeHeaderName(canonicalName),
      `${key}: resolved to col ${idx} ("${header[idx]}"), expected the "${canonicalName}" column`
    );
  });

  // And crucially, at least one key must have moved OFF its compile-time index,
  // otherwise the header wasn't really shuffled and the test proves nothing.
  const moved = Object.keys(COLS).some((key) => C[key] !== COLS[key]);
  assert.ok(moved, 'expected the mangled header to place at least one column off its COLS index');
});

test('resolveCols: canonical header resolves to the identity COLS map', () => {
  // When the header IS canonical, resolveCols must agree with COLS exactly.
  const sheet = new FakeSheet('Investors', [LEAD_HEADERS.slice(), ['row']]);
  const C = S.resolveCols(sheet);
  Object.keys(COLS).forEach((key) => {
    assert.equal(C[key], COLS[key], `${key} should resolve to its canonical index on a clean header`);
  });
});

test('resolveCols: Referral Partners extra column does not disturb resolution', () => {
  // 32-column header (LEAD_HEADERS + Reports Enabled). The 31 standard columns
  // still resolve; the extra is simply ignored (handled by reportsEnabledIndex).
  const header = LEAD_HEADERS.concat(['Reports Enabled']);
  const sheet = new FakeSheet('Referral Partners', [header]);
  const C = S.resolveCols(sheet);
  assert.equal(C.HEARD_ABOUT, 30);
  assert.equal(C.LEAD_ID, 1);
  assert.ok(!('REPORTS_ENABLED' in C)); // not a standard column
});

test('resolveCols: throws headerLookupError (not -1) when a required header is missing', () => {
  // Drop "Email" entirely — a caller reading C.EMAIL must never get a silent -1.
  const header = LEAD_HEADERS.filter((h) => h !== 'Email');
  const sheet = new FakeSheet('Lifetime Leads', [header, ['x']]);
  assert.throws(
    () => S.resolveCols(sheet),
    (err) => {
      assert.match(err.message, /No "Email" header/);
      assert.match(err.message, /character by character/); // the diagnostic dump
      return true;
    }
  );
});

test('resolveCols: throws on an empty sheet (no header row to resolve)', () => {
  const sheet = new FakeSheet('Cold Leads', []);
  assert.throws(() => S.resolveCols(sheet), /no header row/);
});

test('resolveCols: throws on a null sheet', () => {
  assert.throws(() => S.resolveCols(null), /no sheet provided/);
});
