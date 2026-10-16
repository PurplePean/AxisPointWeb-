import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { formatManagedSqft, managedStatText } from '../src/content/proof.ts';

test('formatManagedSqft returns "100,000 sq ft managed"', () => {
  assert.equal(formatManagedSqft(), '100,000 sq ft managed');
});

test('managedStatText returns the stat when proof is shown', () => {
  assert.equal(managedStatText(true), '100,000 sq ft managed');
});

test('managedStatText returns null when proof is hidden', () => {
  assert.equal(managedStatText(false), null);
});

test('proof.ts contains no "%" or "$"', () => {
  const src = readFileSync(new URL('../src/content/proof.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('%'), 'found "%" in proof.ts');
  assert.ok(!src.includes('$'), 'found "$" in proof.ts');
});
