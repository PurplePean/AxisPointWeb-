import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BOV_STEPS, BOV_TYPES, SALES_SERVICES, contactHref, visibleSections } from '../src/content/sell.ts';

test('null sections do not render', () => {
  const s = visibleSections();
  assert.ok(!s.includes('terms'));
  assert.ok(!s.includes('record'));
  assert.deepEqual(s, ['bov', 'steps', 'sales']);
});

test('rent and sale BOV have distinct roles and links', () => {
  const roles = BOV_TYPES.map((b) => b.role);
  assert.deepEqual(roles, ['bov-rent', 'bov-sale']);
  assert.equal(contactHref('bov-sale'), '/contact?role=bov-sale');
});

test('copy is non-empty and has no numbers, fees or em dashes', () => {
  const all = [...BOV_STEPS, ...SALES_SERVICES, ...BOV_TYPES.flatMap((b) => [b.title, b.question, b.summary, b.cta])];
  for (const t of all) assert.ok(t.trim().length > 0);
  const src = readFileSync(new URL('../src/content/sell.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('%'));
  assert.ok(!src.includes('$'));
  assert.ok(!src.includes('—'));
});
