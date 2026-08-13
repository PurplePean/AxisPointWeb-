import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, launchReadyLocales, proofLocales, type Locale } from '../src/i18n/locales';
import {
  buildLocalePath,
  localeEquivalentUrl,
  parseLocalePath,
} from '../src/i18n/route';

/*
 * The public locale URL contract (PR 5).
 *
 * These are the rules a visitor and a crawler both depend on, so they are tested as pure
 * functions rather than through a router: a routing bug here is a wrong address, and a wrong
 * address is either a 404 for a real page or an indexed page that should not exist.
 *
 * TWO REAL BUGS FOUND BY THE RENDERED BASELINE, both fixed and pinned below. React Router
 * ranks a dynamic segment above a splat, so `/no-such-page` matched `/:locale` and rendered
 * the home page; and the refused-locale 404 initially rendered without the site chrome.
 */

const PRODUCTION: readonly Locale[] = launchReadyLocales();
const PREVIEW: readonly Locale[] = proofLocales();

/* ── Parsing ──────────────────────────────────────────────────────────────── */

test('English routes are unprefixed and parse as English', () => {
  for (const path of ['/', '/contact', '/property-management', '/partners']) {
    const r = parseLocalePath(path, PRODUCTION, LOCALES);
    assert.equal(r.code, 'en', path);
    assert.equal(r.innerPath, path, path);
    assert.equal(r.prefix, null, path);
    assert.equal(r.unavailable, false, path);
  }
});

test('a path that is not a locale is left entirely alone', () => {
  // This is what makes `/property-management` a page rather than a locale called "property".
  const r = parseLocalePath('/no-such-page', PRODUCTION, LOCALES);
  assert.equal(r.prefix, null);
  assert.equal(r.innerPath, '/no-such-page');
  assert.equal(r.unavailable, false);
});

test('a disabled locale prefix is refused, never silently rewritten to English', () => {
  /*
   * The whole launch gate rests on this. Falling back would publish a URL the gate says is
   * unavailable, invite a crawler to index an address that will later mean something else,
   * and hide the gate from anyone testing it.
   */
  for (const code of ['es', 'ur', 'zh-Hans', 'pa']) {
    const r = parseLocalePath(`/${code}/contact`, PRODUCTION, LOCALES);
    assert.equal(r.unavailable, true, `${code} must be refused in production`);
    assert.equal(r.prefix, code, `${code} must be recognised as a locale prefix`);
    assert.equal(r.innerPath, '/contact', `${code} must still expose the inner route`);
  }
});

test('the preview gate makes every locale reachable, and only for preview', () => {
  const previewed = parseLocalePath('/ur/contact', PREVIEW, LOCALES);
  assert.equal(previewed.unavailable, false);
  assert.equal(previewed.code, 'ur');
  assert.equal(previewed.innerPath, '/contact');

  const production = parseLocalePath('/ur/contact', PRODUCTION, LOCALES);
  assert.equal(production.unavailable, true);
});

test('an explicit /en prefix is refused so English has one canonical address', () => {
  // Otherwise `/en/contact` and `/contact` are two addresses for one page: duplicate content.
  const r = parseLocalePath('/en/contact', PREVIEW, LOCALES);
  assert.equal(r.unavailable, true);
  assert.equal(r.prefix, 'en');
});

test('a trailing slash does not create a second address', () => {
  assert.deepEqual(
    parseLocalePath('/es/', PREVIEW, LOCALES).innerPath,
    parseLocalePath('/es', PREVIEW, LOCALES).innerPath,
  );
});

/* ── Building ─────────────────────────────────────────────────────────────── */

test('building is the exact inverse of parsing for every locale', () => {
  for (const locale of LOCALES) {
    for (const inner of ['/', '/contact', '/property-management']) {
      const built = buildLocalePath(locale.code, inner);
      const parsed = parseLocalePath(built, PREVIEW, LOCALES);
      if (locale.code === 'en') {
        assert.equal(built, inner, 'English is never prefixed');
        assert.equal(parsed.code, 'en');
      } else {
        assert.equal(built, `/${locale.code}${inner === '/' ? '' : inner}`);
        assert.equal(parsed.code, locale.code);
      }
      assert.equal(parsed.innerPath, inner === '/' ? '/' : inner);
    }
  }
});

test('English hrefs are byte-identical to what they were before PR 5', () => {
  // The regression that would be invisible until somebody diffed the DOM.
  assert.equal(buildLocalePath('en', '/'), '/');
  assert.equal(buildLocalePath('en', '/contact'), '/contact');
  assert.equal(buildLocalePath('en', '/asset-management'), '/asset-management');
});

/* ── Switching language keeps the reader on the page ──────────────────────── */

test('switching language moves to the same page, not to the home page', () => {
  const url = localeEquivalentUrl('es', '/property-management', PREVIEW, LOCALES);
  assert.equal(url, '/es/property-management');

  const back = localeEquivalentUrl('en', '/es/property-management', PREVIEW, LOCALES);
  assert.equal(back, '/property-management');
});

test('search and hash travel with a language switch', () => {
  /*
   * A visitor reading `/contact?intent=general#form` who switches language is still reading
   * that form. Dropping the query would silently restart their intake.
   */
  const url = localeEquivalentUrl(
    'ur',
    '/contact',
    PREVIEW,
    LOCALES,
    '?intent=general',
    '#form',
  );
  assert.equal(url, '/ur/contact?intent=general#form');
});

test('switching between two non-English locales replaces the prefix rather than stacking it', () => {
  const url = localeEquivalentUrl('hi', '/es/contact', PREVIEW, LOCALES);
  assert.equal(url, '/hi/contact');
  assert.ok(!url.includes('/es/'), 'the old prefix must not survive');
});

/* ── What may be advertised ───────────────────────────────────────────────── */

test('only enabled and reviewed locales may be advertised, which today is English alone', () => {
  /*
   * `hreflang`, canonical and sitemap entries are all built from this list. An unreviewed
   * locale appearing here would instruct a crawler to index an address that deliberately
   * 404s.
   */
  assert.deepEqual(
    PRODUCTION.map((l) => l.code),
    ['en'],
  );
  for (const locale of LOCALES) {
    if (locale.code === 'en') continue;
    assert.equal(locale.enabled, false, `${locale.code} must stay disabled`);
    assert.equal(locale.review, 'unreviewed', `${locale.code} must stay unreviewed`);
  }
});

test('every advertised locale produces a resolvable address', () => {
  // Whatever is advertised must actually parse back to itself, or the alternate is a lie.
  for (const locale of PRODUCTION) {
    const href = buildLocalePath(locale.code, '/contact');
    const parsed = parseLocalePath(href, PRODUCTION, LOCALES);
    assert.equal(parsed.unavailable, false, `${locale.code} advertised but not reachable`);
    assert.equal(parsed.code, locale.code);
  }
});
