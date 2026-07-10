'use strict';

/*
 * BOOKING_SLOTS (backend, Code.gs) must stay in sync with SLOTS (frontend,
 * packages/brand/src/components/form/utils.ts). The availability endpoint keys
 * its free/busy response by these exact labels, so a mismatch means the frontend
 * asks about slots the backend never answers for (or vice versa) and availability
 * silently degrades. Both files carry a "keep in sync" comment; nothing enforced
 * it until now.
 *
 * The frontend value is extracted from the .ts source by regex rather than
 * imported — the test must not depend on a TypeScript toolchain being present.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadCode } = require('./helpers/load-code.js');

const S = loadCode();
const UTILS_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'brand',
  'src',
  'components',
  'form',
  'utils.ts'
);

/** Extracts the SLOTS array literal from utils.ts and parses out its string
 *  entries. Deliberately narrow: it matches `export const SLOTS = [ ... ];`. */
function readFrontendSlots() {
  const src = fs.readFileSync(UTILS_PATH, 'utf8');
  const m = src.match(/export\s+const\s+SLOTS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(m, 'could not locate `export const SLOTS = [ ... ]` in utils.ts');
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const q = s.match(/^['"](.*)['"]$/);
      assert.ok(q, `unexpected SLOTS entry (not a quoted string): ${s}`);
      return q[1];
    });
}

test('BOOKING_SLOTS (backend) exactly equals SLOTS (frontend), same order', () => {
  // Array.from lifts the vm-realm array into the host realm; without it
  // deepStrictEqual fails on the cross-realm prototype even when contents match.
  const backend = Array.from(S.BOOKING_SLOTS);
  const frontend = readFrontendSlots();
  assert.deepEqual(
    backend,
    frontend,
    'BOOKING_SLOTS and frontend SLOTS have drifted. Reconcile Code.gs and packages/brand utils.ts.'
  );
});

test('BOOKING_SLOTS is the expected 16-slot CT schedule (sanity anchor)', () => {
  assert.equal(S.BOOKING_SLOTS.length, 16);
  assert.equal(S.BOOKING_SLOTS[0], '8:00 AM');
  assert.equal(S.BOOKING_SLOTS[S.BOOKING_SLOTS.length - 1], '4:30 PM');
});
