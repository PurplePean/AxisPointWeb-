import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcVacancyCost } from '../src/lib/vacancy.ts';
import { AGREEMENT_OPTIONS, formatAgreementLabel } from '../src/content/landlord.ts';

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

// --- SHOW_RATES / formatAgreementLabel ---

test('rates render (contain %) when showRates is true', () => {
  for (const opt of AGREEMENT_OPTIONS) {
    const label = formatAgreementLabel(opt, true);
    assert.ok(label.includes('%'), `expected % in "${label}"`);
  }
});

test('no percent sign in any agreement label when showRates is false', () => {
  for (const opt of AGREEMENT_OPTIONS) {
    const label = formatAgreementLabel(opt, false);
    assert.ok(!label.includes('%'), `expected no % in "${label}"`);
  }
});

test('agreement label without rates still shows the day count', () => {
  const label = formatAgreementLabel(AGREEMENT_OPTIONS[0], false);
  assert.ok(label.includes('90'), `expected day count in "${label}"`);
});
