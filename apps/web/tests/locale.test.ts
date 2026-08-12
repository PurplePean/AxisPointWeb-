import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGasV2Contract } from './helpers/gasV2';
import { LOCALES, DEFAULT_LOCALE, launchReadyLocales, getLocale } from '../src/i18n/locales';
import { EN, messagesFor, missingKeys, registerTestCatalog, clearTestCatalogs, type Messages } from '../src/i18n/messages';
import { toEnvelopeDraft } from '../src/intake/toWire';
import { emptyDraft, followUpOptions, type IntakeDraft } from '../src/intake/model';
import { candidateDays, candidateSlots } from '../src/intake/booking/availability';

/*
 * Localization readiness.
 *
 * THE BUG THIS FILE EXISTS FOR. The intake select offered "Chinese (Simplified)" while the
 * mapper matched on "Simplified Chinese". Neither matched, the lookup fell through to
 * `null`, and both Chinese follow-up preferences were silently discarded on the way to the
 * wire. Nothing failed, nothing logged, and the visitor's request to be answered in Chinese
 * simply did not exist by the time it reached storage.
 *
 * The regression tests below drive the ACTUAL option values the select renders, so a
 * mismatch between what is shown and what is mapped fails here rather than in production.
 */

const gas = loadGasV2Contract();

/**
 * The options the select really renders.
 *
 * Taken from `followUpOptions`, the SAME exported helper `Intake.tsx` calls. An earlier
 * version of this test rebuilt the list from `LOCALES` itself, which meant it could pass
 * while the real control had reverted to display-name values. That is precisely how the
 * Chinese defect survived the previous suite: the test agreed with the mapper rather than
 * with the UI.
 */
const langOptionValues = followUpOptions().map((o) => o.value);

function draftWith(followUpLanguage: string): IntakeDraft {
  const d = emptyDraft('general-inquiry', 'general-inquiry');
  d.topic = 'question_about_axispoint';
  d.contact.fullName = 'Robin Slate';
  d.contact.email = 'robin@example.test';
  d.contact.followUpLanguage = followUpLanguage;
  return d;
}

function envelopeFor(draft: IntakeDraft, pageLocale = 'en') {
  const d = toEnvelopeDraft(draft, { pageLocale: pageLocale as never, intent: null, sourceDetail: '/contact' });
  return {
    schemaVersion: 1,
    submissionId: '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d',
    submittedAt: '2026-08-08T18:00:00.000Z',
    ...d,
  };
}

const parse = (e: unknown) => gas.parseEnvelope(JSON.stringify(e));

/* ── The registry is canonical and unduplicated ───────────────────────────── */

test('the nine approved locale codes are present and exact', () => {
  assert.deepEqual(
    LOCALES.map((l) => l.code),
    ['en', 'es', 'zh-Hans', 'zh-Hant', 'vi', 'hi', 'ur', 'gu', 'pa'],
  );
});

test('Simplified and Traditional Chinese stay separate, with distinct fonts', () => {
  const hans = getLocale('zh-Hans');
  const hant = getLocale('zh-Hant');
  assert.notEqual(hans.code, hant.code);
  assert.notEqual(hans.fontStack, hant.fontStack);
  assert.notEqual(hans.nativeName, hant.nativeName);
});

test('Urdu is the only RTL locale', () => {
  const rtl = LOCALES.filter((l) => l.direction === 'rtl').map((l) => l.code);
  assert.deepEqual(rtl, ['ur']);
});

test('the frontend registry matches the backend locale list exactly', () => {
  // Array.from crosses the VM realm boundary; deepStrictEqual would fail on the prototype.
  const backend = Array.from(gas.LOCALES as unknown as string[]);
  assert.deepEqual(LOCALES.map((l) => l.code), backend);
});

test('English is the only launch-ready locale, and nothing else is advertised', () => {
  assert.deepEqual(launchReadyLocales().map((l) => l.code), ['en']);
  assert.equal(DEFAULT_LOCALE, 'en');
  LOCALES.filter((l) => l.code !== 'en').forEach((l) => {
    assert.equal(l.enabled, false, `${l.code} must not be enabled`);
    assert.equal(l.review, 'unreviewed', `${l.code} must not claim review`);
  });
});

/* ── The Chinese regression, driven by real option values ─────────────────── */

test('EVERY dropdown option reaches the wire as a valid locale, or as null', () => {
  for (const value of langOptionValues) {
    const envelope = envelopeFor(draftWith(value));
    const result = parse(envelope);
    assert.equal(result.ok, true, `option ${JSON.stringify(value)} rejected: ${result.code}`);

    const locale = (result.value as { locale: { preferredFollowUp: string | null } }).locale;
    if (value === '') {
      assert.equal(locale.preferredFollowUp, null, 'blank means "same as this page"');
    } else {
      assert.equal(locale.preferredFollowUp, value, `option ${value} did not survive`);
    }
  }
});

test('both Chinese preferences survive to the wire', () => {
  // The exact failure that motivated this pass. Before the fix both of these were null.
  const hans = parse(envelopeFor(draftWith('zh-Hans')));
  const hant = parse(envelopeFor(draftWith('zh-Hant')));

  assert.equal((hans.value as never as { locale: { preferredFollowUp: string } }).locale.preferredFollowUp, 'zh-Hans');
  assert.equal((hant.value as never as { locale: { preferredFollowUp: string } }).locale.preferredFollowUp, 'zh-Hant');
});

test('no dropdown option is an English display name any more', () => {
  for (const value of langOptionValues.filter(Boolean)) {
    assert.equal(
      /\s/.test(value),
      false,
      `option ${JSON.stringify(value)} looks like a display label, not a locale code`,
    );
  }
});

/* ── Page locale is carried, not hardcoded ────────────────────────────────── */

test('the active page locale reaches the envelope', () => {
  for (const code of ['en', 'es', 'ur'] as const) {
    const envelope = envelopeFor(draftWith(''), code);
    const result = parse(envelope);
    assert.equal(result.ok, true, `page locale ${code} rejected: ${result.code}`);
    assert.equal((result.value as never as { locale: { page: string } }).locale.page, code);
  }
});

test('page locale and follow-up preference stay two separate facts', () => {
  // Reading English and asking to be answered in Spanish is one of the cases the storage
  // model exists to keep apart.
  const result = parse(envelopeFor(draftWith('es'), 'en'));
  assert.equal(result.ok, true);
  const locale = (result.value as never as { locale: { page: string; preferredFollowUp: string } }).locale;
  assert.equal(locale.page, 'en');
  assert.equal(locale.preferredFollowUp, 'es');
});

/* ── Catalog completeness and fallback ────────────────────────────────────── */

test('the English catalog is complete', () => {
  assert.deepEqual(missingKeys(EN), []);
});

test('an unknown locale falls back to English rather than rendering blanks', () => {
  assert.equal(messagesFor('pa'), EN);
  assert.equal(messagesFor('zh-Hant'), EN);
});

test('a registered test catalog is selected, and an incomplete one is caught', () => {
  clearTestCatalogs();
  const synthetic: Messages = Object.fromEntries(
    (Object.keys(EN) as (keyof Messages)[]).map((k) => [k, `[qa] ${k}`]),
  ) as Messages;

  registerTestCatalog('es', synthetic);
  assert.equal(messagesFor('es').submitLabel, '[qa] submitLabel');
  assert.deepEqual(missingKeys(synthetic), []);

  // A catalog missing a key is reported rather than silently producing an empty string.
  const partial = { ...synthetic, submitLabel: '' };
  assert.deepEqual(missingKeys(partial), ['submitLabel']);

  clearTestCatalogs();
  assert.equal(messagesFor('es'), EN, 'clearing must restore the English fallback');
});

/* ── Booking: same instant, different words ───────────────────────────────── */

test('changing the display language never moves the meeting', () => {
  /*
   * ALL NINE SUPPORTED LOCALES, not a sample.
   *
   * This previously compared only 'en-US' and 'es-MX'. That proved the principle but not the
   * product: the app passes the registry's locale CODE straight through as the display
   * locale (`useIntake.ts` calls `candidateDays(now, pageLocale)`), so the values actually
   * exercised in production are 'en', 'es', 'zh-Hans', 'zh-Hant', 'vi', 'hi', 'ur', 'gu' and
   * 'pa'. Seven of them had no assertion at all, and the browser review could only compare
   * normalised clock digits, which would not catch a genuinely different instant that
   * happened to render with the same digits.
   *
   * The inputs are identical for every locale, so any difference in `slotStart` would mean
   * the display language moved the meeting.
   */
  const now = new Date('2026-08-10T14:00:00Z');
  const codes = LOCALES.map((l) => l.code);
  assert.equal(codes.length, 9, 'expected all nine supported locales');

  const reference = candidateDays(now, codes[0]);
  const referenceSlots = candidateSlots(reference[0], now, codes[0]);

  for (const code of codes) {
    const days = candidateDays(now, code);
    assert.equal(days.length, reference.length, `${code}: day count differs`);
    assert.deepEqual(
      days.map((d) => d.key),
      reference.map((d) => d.key),
      `${code}: candidate days differ`,
    );

    const slots = candidateSlots(days[0], now, code);
    assert.deepEqual(
      slots.map((s) => s.slotStart),
      referenceSlots.map((s) => s.slotStart),
      `${code}: slotStart values differ from ${codes[0]}`,
    );

    // Every slot still carries a real Central offset, in every locale.
    slots.forEach((s) => assert.match(s.slotStart, /[+-]0[56]:00$/));
  }

  /*
   * And the test must not be able to pass because nothing is localised at all. If every
   * locale rendered the same label, the assertions above would hold trivially while the
   * feature was broken, so at least one locale has to differ visibly from English.
   */
  const englishLabels = referenceSlots.map((s) => s.label).join('|');
  const anyDiffers = codes
    .slice(1)
    .some((code) => candidateSlots(candidateDays(now, code)[0], now, code)
      .map((s) => s.label)
      .join('|') !== englishLabels);
  assert.ok(anyDiffers, 'no locale localised its slot labels, so the instant test is vacuous');
});

test('the display language does change the visible words', () => {
  const now = new Date('2026-08-10T14:00:00Z');
  const en = candidateDays(now, 'en-US')[0];
  const es = candidateDays(now, 'es-MX')[0];
  assert.notEqual(en.label, es.label, 'a localized day label should differ from English');
});
