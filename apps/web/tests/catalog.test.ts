import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { LOCALES, type LocaleCode } from '../src/i18n/locales';
import {
  EN,
  PLACEHOLDERS,
  interpolate,
  mergeCatalog,
  messagesFor,
  missingKeys,
  resolveCatalog,
  type Messages,
} from '../src/i18n/messages';
import { REVIEWED_CATALOGS } from '../src/i18n/catalogs/reviewed/index';
import { ES } from '../src/i18n/catalogs/audit/es';
import { ZH_HANS } from '../src/i18n/catalogs/audit/zh-Hans';
import { ZH_HANT } from '../src/i18n/catalogs/audit/zh-Hant';
import { VI } from '../src/i18n/catalogs/audit/vi';
import { HI } from '../src/i18n/catalogs/audit/hi';
import { UR } from '../src/i18n/catalogs/audit/ur';
import { GU } from '../src/i18n/catalogs/audit/gu';
import { PA } from '../src/i18n/catalogs/audit/pa';

/*
 * Catalog invariants for the Multilingual Content Rollout pass.
 *
 * WHAT THIS FILE IS GUARDING. Eight catalogs of model-generated text now exist in the
 * repository. None of it has been read by a speaker of the language. The danger is not that
 * it is wrong, which is expected and is the point of calling it an audit candidate: it is
 * that it could stop being obviously unreviewed. A locale flag flipped by accident, a
 * catalog quietly listed as reviewed, or a key silently dropped would all turn "clearly
 * provisional" into "apparently finished", and the second one ships.
 *
 * So these tests assert the STATUS as strictly as the content.
 */

const AUDIT: [LocaleCode, Partial<Messages>][] = [
  ['es', ES],
  ['zh-Hans', ZH_HANS],
  ['zh-Hant', ZH_HANT],
  ['vi', VI],
  ['hi', HI],
  ['ur', UR],
  ['gu', GU],
  ['pa', PA],
];

const EN_KEYS = Object.keys(EN) as (keyof Messages)[];

/* ── The launch gate is intact ────────────────────────────────────────────── */

test('English is the only enabled and reviewed locale', () => {
  const live = LOCALES.filter((l) => l.enabled && l.review === 'reviewed');
  assert.deepEqual(
    live.map((l) => l.code),
    ['en'],
    'a locale became launch-ready. Audit candidates must never be enabled.',
  );
});

test('every audit-candidate locale is disabled and unreviewed', () => {
  for (const [code] of AUDIT) {
    const locale = LOCALES.find((l) => l.code === code);
    assert.ok(locale, `${code} is missing from the registry`);
    assert.equal(locale.enabled, false, `${code} must stay disabled`);
    assert.equal(locale.review, 'unreviewed', `${code} must stay unreviewed`);
  }
});

test('no catalog has been promoted to reviewed', () => {
  assert.deepEqual(
    Object.keys(REVIEWED_CATALOGS),
    [],
    'a catalog was listed as reviewed. That ships it to visitors, so it needs a native reader.',
  );
});

/* ── Shape ────────────────────────────────────────────────────────────────── */

test('every audit catalog covers all 92 English keys', () => {
  for (const [code, catalog] of AUDIT) {
    assert.deepEqual(missingKeys(catalog), [], `${code} is missing keys`);
  }
});

test('no audit catalog invents a key English does not have', () => {
  for (const [code, catalog] of AUDIT) {
    const unknown = Object.keys(catalog).filter((k) => !EN_KEYS.includes(k as keyof Messages));
    assert.deepEqual(unknown, [], `${code} has keys absent from Messages`);
  }
});

test('the catalog count is exactly the eight non-English locales', () => {
  assert.equal(AUDIT.length, 8);
  assert.equal(LOCALES.length, 9);
});

/* ── Content properties a reviewer should not have to check by hand ───────── */

test('no catalog value contains an em dash', () => {
  const all: [string, Partial<Messages>][] = [['en', EN], ...AUDIT];
  for (const [code, catalog] of all) {
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(
        !String(value).includes('—'),
        `${code}.${key} contains an em dash, which the project's copy standard forbids`,
      );
    }
  }
});

test('followUpSameAsPage names its own language, never English', () => {
  /*
   * A REAL TRAP. The English value reads "Same as this page, English". Translating the
   * sentence while leaving the language name alone produces "Igual que esta página, inglés",
   * which tells a Spanish reader the follow-up will be in English. The string has to name the
   * locale it belongs to.
   */
  const expected: Record<string, string> = {
    es: 'español',
    'zh-Hans': '简体中文',
    'zh-Hant': '繁體中文',
    vi: 'tiếng Việt',
    hi: 'हिन्दी',
    ur: 'اردو',
    gu: 'ગુજરાતી',
    pa: 'ਪੰਜਾਬੀ',
  };
  for (const [code, catalog] of AUDIT) {
    const value = catalog.followUpSameAsPage ?? '';
    assert.ok(
      value.includes(expected[code]),
      `${code}.followUpSameAsPage should name ${expected[code]}, got ${JSON.stringify(value)}`,
    );
    assert.ok(
      !value.includes('English'),
      `${code}.followUpSameAsPage still says English`,
    );
  }
});

test('the brand name is never translated', () => {
  for (const [code, catalog] of AUDIT) {
    assert.equal(catalog.bookingWithLabel, 'AxisPoint Partners', `${code} translated the brand`);
    assert.ok(
      String(catalog.generalTopicQuestion).includes('AxisPoint'),
      `${code}.generalTopicQuestion lost the brand name`,
    );
  }
});

test('no bidi control characters are embedded in the RTL catalog', () => {
  /*
   * U+200E/U+200F and the isolate marks would paper over a layout bug inside this one file
   * while leaving it broken everywhere else, and they travel into stored data and outbound
   * mail where nobody expects them. Direction comes from `<html dir>`, not from the strings.
   */
  const BIDI = /[‎‏‪-‮⁦-⁩]/;
  for (const [key, value] of Object.entries(UR)) {
    assert.ok(!BIDI.test(String(value)), `ur.${key} embeds a bidi control character`);
  }
});

test('Simplified and Traditional Chinese are genuinely different text', () => {
  /*
   * Guards against one file being pasted or character-converted over the other, which the
   * approved design forbids: they are separate locales with separate font families, and a
   * conversion produces mainland phrasing wearing traditional characters.
   *
   * SOME KEYS ARE LEGITIMATELY IDENTICAL, and an assertion that ignored this would be
   * noise rather than a check. 立即, 公司, 您的留言 and the rest below use characters that
   * are simply the same in both scripts. They are listed explicitly rather than tolerated by
   * a threshold, so a NEW identical value fails here and gets looked at.
   */
  const SCRIPT_NEUTRAL: (keyof Messages)[] = [
    'situationMoveAway', // 不再自行管理
    'situationExploring', // 正在了解管理方案
    'timingImmediately', // 立即
    'timing30to60', // 30 至 60 天
    'timing60to90', // 60 至 90 天
    'scaleUnitsPlaceholder', // 例如 184
    'scaleSqftPlaceholder', // 例如 42,000
    'generalNoteLabel', // 您的留言
    'organizationLabel', // 公司
    'bookingWithLabel', // brand name, untranslated everywhere
    'footerFirm', // 公司
    'footerCopyright', // brand name and a year
    'homeWhyOr', // 或者
    'pmStrengthAssignmentsItem1', // 管理方交接
    'pmStrengthAssignmentsItem2', // 招租期
    'backToAxisPoint', // 返回 AxisPoint
    'scheduleSelectedSummary', // {day} {time}，{mode} — placeholders plus a full-width comma
    'labelFormat', // 形式
    'scheduledWhenValue', // {day}，{time} Central
    'fieldFullName', // 姓名
    'fieldPhonePlaceholder', // (713) 000 0000 — a format example, not translated
    'fieldPropertyCountPlaceholder', // 例如 6
    'backLabel', // 返回
  ];

  const shared = EN_KEYS.filter((k) => ZH_HANS[k] === ZH_HANT[k]);
  assert.deepEqual(
    shared,
    SCRIPT_NEUTRAL,
    'the two Chinese catalogs match on an unexpected key. Either one was copied from the ' +
      'other, or a genuinely script-neutral string needs adding to SCRIPT_NEUTRAL.',
  );

  /*
   * And the bulk must actually differ, so the allowlist cannot quietly grow to cover a paste.
   * Stated as a proportion rather than a fixed count so it does not need editing every time
   * the catalog grows, which is the kind of churn that trains people to relax a threshold.
   */
  const differing = EN_KEYS.length - shared.length;
  assert.ok(
    differing / EN_KEYS.length >= 0.85,
    `only ${differing} of ${EN_KEYS.length} keys differ between the two Chinese catalogs`,
  );
});

/* ── Interpolation (PR 4) ─────────────────────────────────────────────────── */

test('every placeholder used in the catalog is a declared one', () => {
  /*
   * A translation that invents `{naam}` or drops a brace would otherwise reach a visitor as
   * literal text. `interpolate` deliberately leaves unknown tokens alone rather than blanking
   * them, so this is where the mistake has to be caught.
   */
  const declared = new Set(PLACEHOLDERS as readonly string[]);
  const all: [string, Partial<Messages>][] = [['en', EN], ...AUDIT];
  for (const [code, catalog] of all) {
    for (const [key, value] of Object.entries(catalog)) {
      for (const token of String(value).match(/\{[^}]*\}/g) ?? []) {
        assert.ok(
          declared.has(token),
          `${code}.${key} uses undeclared placeholder ${token}`,
        );
      }
    }
  }
});

test('each interpolated key carries the same placeholders in every locale', () => {
  // A dropped `{email}` is a sentence that silently loses the address it promised.
  const interpolated = EN_KEYS.filter((k) => /\{[^}]+\}/.test(EN[k]));
  assert.ok(interpolated.length >= 8, 'expected the interpolated keys to be found');

  for (const key of interpolated) {
    const expected = [...String(EN[key]).match(/\{[^}]+\}/g)!].sort();
    for (const [code, catalog] of AUDIT) {
      const actual = [...String(catalog[key] ?? '').match(/\{[^}]+\}/g) ?? []].sort();
      assert.deepEqual(
        actual,
        expected,
        `${code}.${key} placeholders differ from English`,
      );
    }
  }
});

test('interpolate substitutes every declared placeholder and leaves no braces', () => {
  const out = interpolate(EN.scheduleSelectedSummary, {
    day: 'Tuesday, August 11',
    time: '11:00 AM',
    mode: 'Phone call',
  });
  assert.equal(out, 'Tuesday, August 11 at 11:00 AM, Phone call');
  assert.ok(!/\{[^}]+\}/.test(out), 'no placeholder survived substitution');
});

test('interpolate leaves an unknown placeholder visible rather than blanking it', () => {
  // The failure has to be loud. A silently emptied token looks like correct copy.
  const out = interpolate('Hello {name}, see {unknown}.', { name: 'Robin' });
  assert.equal(out, 'Hello Robin, see {unknown}.');
});

test('no locale resolves an interpolated string to leftover placeholders', () => {
  const vars = {
    name: 'Robin',
    email: 'robin@example.test',
    count: '3',
    day: 'Tuesday',
    time: '9:00 AM',
    mode: 'Phone call',
    language: 'Spanish',
  };
  const all: [string, Partial<Messages>][] = [['en', EN], ...AUDIT];
  for (const [code, catalog] of all) {
    for (const key of EN_KEYS) {
      const value = catalog[key];
      if (typeof value !== 'string') continue;
      const out = interpolate(value, vars);
      assert.ok(!/\{[^}]+\}/.test(out), `${code}.${key} still contains a placeholder: ${out}`);
    }
  }
});

/* ── The firm's time zone is never translated away ────────────────────────── */

test('the booking instant label keeps the firm zone in every locale', () => {
  /*
   * `scheduledWhenValue` renders the time the visitor booked. The INSTANT is computed in
   * America/Chicago regardless of the reader's language, so naming a different zone here
   * would describe a different meeting. Translating the surrounding words is fine.
   */
  for (const [code, catalog] of AUDIT) {
    assert.ok(
      String(catalog.scheduledWhenValue).includes('Central'),
      `${code}.scheduledWhenValue dropped the firm's zone`,
    );
  }
});

/* ── Every key is actually rendered ───────────────────────────────────────── */

test('no catalog key is an orphan', () => {
  /*
   * A key nothing renders is a claim of coverage the site does not have, and it is how a
   * catalog silently rots: the string stays, the JSX that used it is rewritten, and a
   * translator keeps paying to maintain copy no visitor will ever see. The previous pass
   * deleted 49 such keys for exactly this reason rather than leaving them as scaffolding.
   *
   * The search is a plain substring over application source, which covers both direct
   * `t.someKey` access and the indirect `labelKey: 'someKey'` form the navigation and footer
   * use. Catalog and test files are excluded, since a key trivially appears in its own
   * definition.
   */
  const srcRoot = path.join(import.meta.dirname, '..', 'src');
  const sources: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (abs.includes(path.join('i18n', 'catalogs'))) continue;
        walk(abs);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (abs.endsWith(path.join('i18n', 'messages.ts'))) continue;
      sources.push(readFileSync(abs, 'utf8'));
    }
  };
  walk(srcRoot);

  const haystack = sources.join('\n');
  const orphans = EN_KEYS.filter((key) => !haystack.includes(key));
  assert.deepEqual(orphans, [], 'catalog keys that nothing in src renders');
});

/* ── Resolution ───────────────────────────────────────────────────────────── */

test('mergeCatalog falls back per key, not per catalog', () => {
  const partial: Partial<Messages> = { submitLabel: 'Enviar consulta', nameHelp: '' };
  const merged = mergeCatalog(partial);

  assert.equal(merged.submitLabel, 'Enviar consulta', 'a present value should win');
  assert.equal(merged.nameHelp, EN.nameHelp, 'an empty string counts as missing');
  assert.equal(merged.gatewayTitle, EN.gatewayTitle, 'an absent key falls back to English');
  assert.deepEqual(missingKeys(merged), [], 'the merged result is always complete');
});

test('mergeCatalog of nothing is English', () => {
  assert.equal(mergeCatalog(null), EN);
  assert.equal(mergeCatalog(undefined), EN);
});

test('messagesFor never returns audit content', () => {
  /*
   * The synchronous path is what a production first paint uses. It must answer from reviewed
   * catalogs alone, so an audit candidate cannot reach a visitor even if one were somehow
   * present in the graph.
   */
  for (const [code] of AUDIT) {
    assert.equal(
      messagesFor(code),
      EN,
      `${code} resolved synchronously to something other than English`,
    );
  }
});

test('resolveCatalog reaches the audit candidate, and it is complete', async () => {
  // In the test environment the real loader is present, which is how the preview path is
  // exercised at all. In any build this same call returns English.
  const es = await resolveCatalog('es');
  assert.equal(es.submitLabel, ES.submitLabel);
  assert.deepEqual(missingKeys(es), []);
});

test('resolveCatalog returns English for English without loading anything', async () => {
  assert.equal(await resolveCatalog('en'), EN);
});
