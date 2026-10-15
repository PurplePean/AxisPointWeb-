import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { calcVacancyCost } from '../src/lib/vacancy.ts';
import { AGREEMENT, agreementPhaseLabels, agreementSummary } from '../src/content/landlord.ts';

// --- vacancy.ts ---

test('normal values: 2000 sqft at $24/sqft', () => {
  const { monthlyCost, ninetyDayCost } = calcVacancyCost(2000, 24);
  // annual = 48 000; monthly = 4 000
  assert.equal(monthlyCost, 4000);
  // 90-day = 48 000 * 90/365 ≈ 11 835.62
  assert.ok(ninetyDayCost > 11000 && ninetyDayCost < 13000);
});

test('decimal inputs are accepted', () => {
  const { monthlyCost } = calcVacancyCost(1500.5, 18.75);
  assert.ok(isFinite(monthlyCost) && monthlyCost > 0);
});

test('zero sqft throws', () => {
  assert.throws(() => calcVacancyCost(0, 24), RangeError);
});

test('zero rent throws', () => {
  assert.throws(() => calcVacancyCost(2000, 0), RangeError);
});

test('negative sqft throws', () => {
  assert.throws(() => calcVacancyCost(-100, 24), RangeError);
});

test('negative rent throws', () => {
  assert.throws(() => calcVacancyCost(2000, -5), RangeError);
});

test('NaN sqft throws', () => {
  assert.throws(() => calcVacancyCost(NaN, 24), RangeError);
});

test('NaN rent throws', () => {
  assert.throws(() => calcVacancyCost(2000, NaN), RangeError);
});

test('Infinity sqft throws', () => {
  assert.throws(() => calcVacancyCost(Infinity, 24), RangeError);
});

test('absurdly large sqft throws', () => {
  assert.throws(() => calcVacancyCost(10_000_001, 24), RangeError);
});

test('absurdly large rent throws', () => {
  assert.throws(() => calcVacancyCost(2000, 10_000_001), RangeError);
});

// --- AGREEMENT structure ---

test('phases are contiguous: each fromDay is the previous toDay + 1', () => {
  const { phases } = AGREEMENT;
  for (let i = 1; i < phases.length; i++) {
    assert.equal(
      phases[i].fromDay,
      phases[i - 1].toDay + 1,
      `phase ${i} fromDay should be ${phases[i - 1].toDay + 1}, got ${phases[i].fromDay}`,
    );
  }
});

test('last phase toDay equals totalDays', () => {
  const { phases, totalDays } = AGREEMENT;
  const last = phases[phases.length - 1];
  assert.equal(last.toDay, totalDays);
});

// --- agreementPhaseLabels ---

test('labels contain "%" when showRates is true', () => {
  for (const label of agreementPhaseLabels(true)) {
    assert.ok(label.includes('%'), `expected % in "${label}"`);
  }
});

test('labels contain no "%" and no "rate" when showRates is false', () => {
  for (const label of agreementPhaseLabels(false)) {
    assert.ok(!label.includes('%'), `expected no % in "${label}"`);
    assert.ok(!label.toLowerCase().includes('rate'), `expected no "rate" in "${label}"`);
  }
});

// --- agreementSummary ---

test('agreementSummary always starts with "One 90 day agreement"', () => {
  assert.ok(agreementSummary(true).startsWith('One 90 day agreement'));
  assert.ok(agreementSummary(false).startsWith('One 90 day agreement'));
});

test('agreementSummary contains rate sentence only when showRates is true', () => {
  assert.ok(agreementSummary(true).toLowerCase().includes('rate'));
  assert.ok(!agreementSummary(false).toLowerCase().includes('rate'));
});

// --- no leftover 120 ---

test('no "120" appears in landlord.ts source', () => {
  const src = readFileSync(new URL('../src/content/landlord.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('120'), 'found "120" in landlord.ts');
});

test('no "120" appears in LandlordPage.tsx source', () => {
  const src = readFileSync(new URL('../src/pages/LandlordPage.tsx', import.meta.url), 'utf8');
  assert.ok(!src.includes('120'), 'found "120" in LandlordPage.tsx');
});
