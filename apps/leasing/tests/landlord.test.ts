import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { calcVacancyCost, parseNumericInput } from '../src/lib/vacancy.ts';
import {
  AGREEMENT,
  agreementPhaseLabels,
  agreementSummary,
  SALES_CYCLE_FAQ,
  salesCycleFaqEntries,
  whoToTalkAnswer,
  agreementPhases,
  SPEED_PROMISES,
} from '../src/content/landlord.ts';

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

// --- SALES_CYCLE_FAQ ---

test('every SALES_CYCLE_FAQ entry has non-empty question and answer', () => {
  assert.ok(SALES_CYCLE_FAQ.length > 0, 'SALES_CYCLE_FAQ must not be empty');
  for (const entry of SALES_CYCLE_FAQ) {
    assert.ok(typeof entry.question === 'string' && entry.question.trim().length > 0,
      `empty question in entry`);
    assert.ok(typeof entry.answer === 'string' && entry.answer.trim().length > 0,
      `empty answer in entry: "${entry.question}"`);
  }
});

test('no SALES_CYCLE_FAQ answer contains "%"', () => {
  for (const entry of SALES_CYCLE_FAQ) {
    assert.ok(!entry.answer.includes('%'), `"%" found in answer: "${entry.question}"`);
  }
});

test('no SALES_CYCLE_FAQ answer contains "$"', () => {
  for (const entry of SALES_CYCLE_FAQ) {
    assert.ok(!entry.answer.includes('$'), `"$" found in answer: "${entry.question}"`);
  }
});

test('no SALES_CYCLE_FAQ answer contains a digit followed by "days" or "months"', () => {
  const pattern = /\d+\s*(days|months)/i;
  for (const entry of SALES_CYCLE_FAQ) {
    assert.ok(!pattern.test(entry.answer),
      `invented timeline found in answer: "${entry.question}"`);
  }
});

// --- salesCycleFaqEntries / EXTENSION_FAQ null ---

test('salesCycleFaqEntries returns all SALES_CYCLE_FAQ entries', () => {
  const entries = salesCycleFaqEntries();
  assert.equal(entries.length, SALES_CYCLE_FAQ.length,
    'expected only SALES_CYCLE_FAQ entries when EXTENSION_FAQ is null');
});

test('salesCycleFaqEntries does not include an extension entry while EXTENSION_FAQ is null', () => {
  const entries = salesCycleFaqEntries();
  const hasExtension = entries.some((e) =>
    e.question.toLowerCase().includes('extension') ||
    e.answer.toLowerCase().includes('extension'),
  );
  assert.ok(!hasExtension, 'extension FAQ must not appear while EXTENSION_FAQ is null');
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

// --- parseNumericInput ---

test('parseNumericInput handles commas, dollar sign and leading dot', () => {
  assert.equal(parseNumericInput('2,000'), 2000);
  assert.equal(parseNumericInput('$24.50'), 24.5);
  assert.equal(parseNumericInput('.5'), 0.5);
  assert.equal(parseNumericInput('  1,250.75  '), 1250.75);
});

test('parseNumericInput rejects non-numeric input', () => {
  for (const bad of ['abc', '', '1e3', '12.', '-5', '1,2,x', '$', '2 000']) {
    assert.equal(parseNumericInput(bad), null, `expected null for "${bad}"`);
  }
});

// --- FAQ wording comes from content ---

test('whoToTalkAnswer says "button", never "form", and uses SPEED_PROMISES', () => {
  const a = whoToTalkAnswer();
  assert.ok(a.includes('button'));
  assert.ok(!a.toLowerCase().includes('form'));
  assert.ok(a.includes(SPEED_PROMISES[0]));
});

test('LandlordPage has no <dl>, no invented sentence and no hardcoded reply time', () => {
  const src = readFileSync(new URL('../src/pages/LandlordPage.tsx', import.meta.url), 'utf8');
  assert.ok(!src.includes('<dl'), 'found <dl>');
  assert.ok(!src.includes('make it right'), 'found invented sentence');
  assert.ok(!src.toLowerCase().includes('same business day'), 'hardcoded reply time');
});

// --- agreementPhases ---

test('agreementPhases has rates and day weights when showRates is true', () => {
  const phases = agreementPhases(true);
  assert.equal(phases.length, AGREEMENT.phases.length);
  for (const p of phases) assert.ok(p.rate !== null && p.rate.includes('%'));
  assert.equal(phases.reduce((n, p) => n + p.days, 0), AGREEMENT.totalDays);
});

test('agreementPhases collapses to one range with no rate when showRates is false', () => {
  const phases = agreementPhases(false);
  assert.equal(phases.length, 1);
  assert.equal(phases[0].rate, null);
  assert.equal(phases[0].days, AGREEMENT.totalDays);
  assert.ok(!phases[0].range.includes('%'));
});
