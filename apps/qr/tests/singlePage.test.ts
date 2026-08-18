import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { installRenderGlobals, renderModule } from './helpers/render';
import { FIRM, PARTNERS } from '../src/profiles';

/*
 * ONE PAGE, BOTH PARTNERS.
 *
 * WHY THIS TEST EXISTS. The owner-directed collapse of 2026-08-17 replaced a three-state
 * template, selected by a `?profile=` query parameter, with a single combined page showing
 * both partners together. Nothing else asserts that outcome: the wire tests cover what is
 * SENT and the vCard tests cover what is SAVED, so without this file the actual visible
 * result of the change would rest on having looked at it once.
 *
 * It renders the real tree through the shared harness in `helpers/render.ts`, the same one
 * `e2eBanner.test.ts` uses, so these assertions are about the markup the app really
 * produces rather than about the fixture data in isolation.
 *
 * WHAT IT DOES NOT COVER. Layout. A string being present in the markup says nothing about
 * whether it fits at 390px, and mobile width is checked by looking at the real thing, not
 * here.
 */

let html = '';

before(async () => {
  installRenderGlobals();
  html = await renderModule('/src/App.tsx');
});

after(() => {
  // Every assertion below is a substring check, and an empty string satisfies every absence
  // check. Without this the negative tests could all pass vacuously.
  assert.ok(html.length > 0, 'the render produced no markup at all');
});

/* ── Both partners are on the one page ────────────────────────────────────── */

test('both partners are named on the same page', () => {
  for (const partner of PARTNERS) {
    assert.ok(html.includes(partner.displayName), `${partner.displayName} is missing from the card`);
  }
});

test("both partners' direct phone numbers are visible on the page", () => {
  // The owner's decision is that the real numbers are ON the page, not hidden behind a tap,
  // so the displayed value is asserted and not merely the tel: href.
  for (const partner of PARTNERS) {
    assert.ok(partner.phone, `precondition: ${partner.displayName} has a confirmed number`);
    assert.ok(html.includes(partner.phone.display), `${partner.displayName}'s number is not shown`);
    assert.ok(html.includes(partner.phone.href), `${partner.displayName} has no Call action`);
  }
});

test("both partners' direct email addresses are visible on the page", () => {
  for (const partner of PARTNERS) {
    assert.ok(partner.email, `precondition: ${partner.displayName} has a confirmed address`);
    assert.ok(html.includes(partner.email), `${partner.displayName}'s address is not shown`);
    assert.ok(html.includes(`mailto:${partner.email}`), `${partner.displayName} has no Email action`);
  }
});

test('each partner is a heading, under the one firm heading', () => {
  // One h1 for the firm, an h2 per partner. That hierarchy is what makes the page read as a
  // single card carrying two people rather than as two competing cards.
  assert.equal(html.split('<h1').length - 1, 1, 'there must be exactly one h1');
  assert.ok(html.includes(`>${FIRM.name}</h1>`), 'the h1 must be the firm');
  for (const partner of PARTNERS) {
    assert.ok(
      new RegExp(`<h2[^>]*>${partner.displayName}</h2>`).test(html),
      `${partner.displayName} must be an h2`,
    );
  }
});

/* ── The three-state template is genuinely gone ───────────────────────────── */

test('the page carries no per-partner variant and no profile selector', () => {
  // The dev preview bar was the only way to switch states and it went with them.
  assert.equal(html.includes('Dev preview'), false);
  assert.equal(html.includes('profile='), false);
  assert.equal(html.includes('Firm fallback'), false);
});

test('the unresolved-card fallback copy is gone with the state it described', () => {
  /*
   * Including the owner-directed 2026-07-31 replacement line. There is no unresolved card to
   * describe when every scan lands on the same page, and leaving the sentence in would tell a
   * visitor their card failed to resolve when nothing failed.
   */
  assert.equal(html.includes('route your inquiry to the right partner'), false);
  assert.equal(html.includes('did not resolve'), false);
  // The redundant partners line went too: the page now names both partners in full, with
  // their details, a few hundred pixels below where that sentence used to sit.
  assert.equal(html.includes('Partner-led from Houston'), false);
});

/* ── The save action describes two records ────────────────────────────────── */

test('the save action is worded for both partners, not one', () => {
  assert.ok(html.includes('Save our contacts'));
  // The default supporting line tells the visitor what they are about to get, which is the
  // page's only honest signal that the file holds two records rather than one.
  assert.ok(html.includes('two separate records'));
});

test('no state on the page claims a contact was actually saved', () => {
  /*
   * The board's honest ceiling, and it survives the collapse unchanged: a web page can open
   * or download a contact file, but it cannot observe whether the operating system's save
   * completed. Copy that claims otherwise is the specific regression worth guarding.
   */
  assert.equal(/saved to your contacts/i.test(html), false);
  assert.equal(/added to your contacts/i.test(html), false);
});
