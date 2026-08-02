'use strict';

/*
 * The wire vocabulary.
 *
 * WHAT THESE TESTS ARE FOR. These tokens are stored in the Sheet forever. Once a row
 * says 'pm_plus_am', renaming the token orphans every historical row that used the old
 * one, silently, with no error anywhere. So the expected values below are HAND-TYPED
 * literals, deliberately not derived from the constants: this file is the tripwire
 * that makes a rename a visible, reviewed decision rather than an accident.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');

const ctx = load();

/**
 * The source runs inside a VM realm, so an array it creates has that realm's
 * Array.prototype and never compares reference-equal to a Node literal. Copying into
 * a Node array keeps the assertions about VALUES, which is what these tests are about.
 */
const arr = (value) => Array.from(value);

test('schema version is 1', () => {
  assert.equal(ctx.SCHEMA_VERSION, 1);
});

test('submission kinds are exactly the three the contract defines', () => {
  assert.deepEqual(arr(ctx.SUBMISSION_KINDS), ['service_inquiry', 'contact_exchange', 'booking_request']);
});

test('pathway tokens are stable', () => {
  assert.deepEqual(arr(ctx.PATHWAYS), ['management_proposal', 'investor_services', 'general_inquiry']);
});

test('service scope tokens are stable', () => {
  assert.deepEqual(arr(ctx.SERVICE_SCOPES), ['pm', 'pm_plus_am', 'undecided']);
});

test('property tokens are stable', () => {
  assert.deepEqual(arr(ctx.PROPERTY_TYPES), ['multifamily', 'retail', 'mixed_portfolio', 'another_property_type']);
  assert.deepEqual(arr(ctx.PROPERTY_SCOPES), ['one_property', 'portfolio']);
});

test('timing tokens are stable', () => {
  assert.deepEqual(arr(ctx.TIMINGS), [
    'immediately',
    'within_30_days',
    'days_30_to_60',
    'days_60_to_90',
    'still_exploring',
  ]);
});

test('locale codes are BCP-47 identifiers, not project enums', () => {
  // zh-Hans and zh-Hant keep their script subtags and their case. Lowercasing them or
  // collapsing them to 'zh' would merge two languages that are never substituted for
  // one another.
  assert.deepEqual(arr(ctx.LOCALES), ['en', 'es', 'zh-Hans', 'zh-Hant', 'vi', 'hi', 'ur', 'gu', 'pa']);
});

test('only English is launch-ready for outbound correspondence', () => {
  assert.deepEqual(arr(ctx.LAUNCH_READY_LOCALES), ['en']);
});

test('partner slugs are hyphenated and partner tokens are not', () => {
  // The slug is a URL path segment; the token is a stored value. They are different
  // things and the mapping between them is explicit for exactly that reason.
  assert.deepEqual(arr(ctx.PARTNER_SLUGS), ['zachary-russell', 'ethaniel-vu']);
  assert.deepEqual(arr(ctx.PARTNERS), ['zachary_russell', 'ethaniel_vu']);
  assert.equal(ctx.SLUG_TO_PARTNER['zachary-russell'], 'zachary_russell');
  assert.equal(ctx.SLUG_TO_PARTNER['ethaniel-vu'], 'ethaniel_vu');
});

test('every token in every list is snake_case or a BCP-47 locale', () => {
  const localeSet = new Set(ctx.LOCALES);
  const lists = [
    ctx.SUBMISSION_KINDS,
    ctx.PATHWAYS,
    ctx.SERVICE_SCOPES,
    ctx.INTENT_TOKENS,
    ctx.PROPERTY_TYPES,
    ctx.PROPERTY_SCOPES,
    ctx.SITUATIONS,
    ctx.INVOLVEMENTS,
    ctx.TIMINGS,
    ctx.TOPICS_INVESTOR,
    ctx.TOPICS_GENERAL,
    ctx.BOOKING_MODES,
    ctx.CONTACT_CATEGORIES,
    ctx.SOURCE_CATEGORIES,
    ctx.PARTNERS,
  ];
  lists.forEach((list) => {
    list.forEach((token) => {
      if (localeSet.has(token)) return;
      assert.match(token, /^[a-z][a-z0-9_]*$/, `token "${token}" is not snake_case`);
    });
  });
});

test('scope maps onto exactly one involvement, with no scope left unmapped', () => {
  assert.deepEqual(Object.keys(ctx.SCOPE_TO_INVOLVEMENT).sort(), arr(ctx.SERVICE_SCOPES).sort());
  Object.keys(ctx.SCOPE_TO_INVOLVEMENT).forEach((scope) => {
    assert.ok(
      ctx.INVOLVEMENTS.indexOf(ctx.SCOPE_TO_INVOLVEMENT[scope]) !== -1,
      `scope ${scope} maps to an involvement that does not exist`,
    );
  });
});

test('no display string collides with a wire token', () => {
  // If it ever did, the rejection rule would start rejecting a legitimate token.
  const allTokens = new Set(
    []
      .concat(ctx.PATHWAYS, ctx.SERVICE_SCOPES, ctx.PROPERTY_TYPES, ctx.PROPERTY_SCOPES)
      .concat(ctx.SITUATIONS, ctx.INVOLVEMENTS, ctx.TIMINGS, ctx.TOPICS_INVESTOR)
      .concat(ctx.TOPICS_GENERAL, ctx.BOOKING_MODES, ctx.CONTACT_CATEGORIES),
  );
  ctx.REJECTED_DISPLAY_STRINGS.forEach((display) => {
    assert.equal(allTokens.has(display), false, `display string "${display}" is also a token`);
  });
});

test('isKnownToken is exact, not fuzzy', () => {
  assert.equal(ctx.isKnownToken(ctx.PATHWAYS, 'management_proposal'), true);
  assert.equal(ctx.isKnownToken(ctx.PATHWAYS, 'Management_Proposal'), false);
  assert.equal(ctx.isKnownToken(ctx.PATHWAYS, ' management_proposal '), false);
  assert.equal(ctx.isKnownToken(ctx.PATHWAYS, null), false);
});
