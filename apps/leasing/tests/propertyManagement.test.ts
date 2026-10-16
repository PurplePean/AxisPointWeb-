import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SERVICES, SERVICE_GROUPS, visibleSections } from '../src/content/propertyManagement.ts';

// --- SERVICES ---

test('every SERVICES entry is a non-empty string', () => {
  assert.ok(SERVICES.length > 0, 'SERVICES must not be empty');
  for (const s of SERVICES) {
    assert.ok(typeof s === 'string' && s.trim().length > 0, `empty entry: "${s}"`);
  }
});

test('no "$" appears in any SERVICES entry', () => {
  for (const s of SERVICES) {
    assert.ok(!s.includes('$'), `"$" found in service: "${s}"`);
  }
});

test('no "%" appears in any SERVICES entry', () => {
  for (const s of SERVICES) {
    assert.ok(!s.includes('%'), `"%" found in service: "${s}"`);
  }
});

// --- content file has no fee or percentage characters ---

test('no "%" or "$" appears in the propertyManagement.ts content file', () => {
  const src = readFileSync(
    new URL('../src/content/propertyManagement.ts', import.meta.url),
    'utf8',
  );
  assert.ok(!src.includes('%'), 'found "%" in propertyManagement.ts');
  assert.ok(!src.includes('$'), 'found "$" in propertyManagement.ts');
});

// --- visibleSections: null sections do not render ---

test('visibleSections always includes "services"', () => {
  const sections = visibleSections();
  assert.ok(sections.includes('services'));
});

test('visibleSections does not include "agreement" while AGREEMENT is null', () => {
  // AGREEMENT is typed as null in the content file, so this is a compile-time
  // guarantee as well as a runtime check.
  const sections = visibleSections();
  assert.ok(!sections.includes('agreement'), '"agreement" should not render while null');
});

test('visibleSections does not include "reporting" while REPORTING is null', () => {
  const sections = visibleSections();
  assert.ok(!sections.includes('reporting'), '"reporting" should not render while null');
});

test('SERVICES is the flat list of every SERVICE_GROUPS item', () => {
  const flat = SERVICE_GROUPS.flatMap((g) => [...g.items]);
  assert.deepEqual([...SERVICES], flat);
  for (const g of SERVICE_GROUPS) assert.ok(g.title.trim().length > 0);
});
