import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { installRenderGlobals, renderModule } from './helpers/render';

/*
 * THE E2E WARNING BANNER IS ACTUALLY MOUNTED IN THIS APP.
 *
 * WHY THIS TEST EXISTS. `apps/qr/vite.config.ts` has always computed `__E2E_MODE__` and
 * printed the terminal warning, but `main.tsx` stopped rendering `<E2eBanner />` when the
 * V1 contact form was removed. The reasoning recorded at the time was that the card
 * "submits nothing and consumes no endpoint", which was true then and stopped being true
 * when the Contact Exchange was built: this app now resolves a real V2 endpoint and posts a
 * real `contact_exchange` envelope. So half the warning was live and half was silently
 * missing, and nothing failed, because no test had ever rendered this app's tree.
 *
 * `endpoint.test.ts` next door proves the fail-closed side: a missing endpoint, or a lone
 * V1-style `VITE_FORM_ENDPOINT`, throws at config time. This file proves the visible side.
 * The two are additive. The banner is a warning to whoever is driving the browser, not a
 * protection, and it does not replace a single one of those guards.
 *
 * HOW IT RENDERS, AND WHY NO MACHINE-LOCAL ENV FILE IS READ, now live in
 * `helpers/render.ts`, which `singlePage.test.ts` shares. The short version: Vite's
 * programmatic SSR API compiles the real tree, and `__E2E_MODE__` is supplied directly
 * rather than resolved, so both values of the flag are reachable without either mode's real
 * preconditions.
 */

/**
 * The banner's own words, as a reader would see them.
 *
 * KEPT IN SYNC WITH TWO OTHER PLACES ON PURPOSE: `packages/brand/src/components/E2eBanner.tsx`
 * is where the copy lives, and `scripts/test/inspect-bundle.mjs` forbids this same sentence
 * in a production bundle. If the copy is reworded, all three move together and the assertion
 * below is what fails first.
 */
const BANNER_SENTENCE = 'E2E MODE: a real backend is enabled';

let e2eHtml = '';
let devHtml = '';
let appOnlyHtml = '';

before(async () => {
  installRenderGlobals();
  e2eHtml = await renderModule('/src/Root.tsx', { e2e: true });
  devHtml = await renderModule('/src/Root.tsx');
  /* The card on its own, with no root wrapper, for the "nothing else moved" comparison. */
  appOnlyHtml = await renderModule('/src/App.tsx');
});

after(() => {
  /*
   * A guard against the whole file passing vacuously. Every assertion below is about the
   * presence or absence of a substring, and an empty string satisfies every absence check.
   * If `before` ever silently produced nothing, the negative tests would all "pass".
   */
  assert.ok(e2eHtml.length > 0, 'the e2e render produced no markup at all');
  assert.ok(devHtml.length > 0, 'the development render produced no markup at all');
});

test('the banner is rendered in e2e mode', () => {
  assert.ok(
    e2eHtml.includes(BANNER_SENTENCE),
    'e2e mode rendered no banner. This is the defect the test exists for: the terminal ' +
      'warning printed while the browser showed nothing.',
  );
  // A warning nobody can find is not a warning. It is fixed to the top of the viewport, and
  // it announces itself to assistive technology rather than only to sighted users.
  assert.match(e2eHtml, /role="alert"/);
  assert.match(e2eHtml, /position:fixed/);
});

test('the banner does not claim a submission creates a calendar event', () => {
  // The QR exchange creates a Contact record and sends acknowledgement mail. It books
  // nothing. Overstating the blast radius trains people to discount the warning.
  assert.match(e2eHtml, /does not create a calendar event/);
});

test('the banner is absent in ordinary development', () => {
  assert.ok(
    !devHtml.includes(BANNER_SENTENCE),
    'a red backend warning appeared during plain `pnpm dev`, where the exchange is simulated',
  );
  assert.ok(!devHtml.includes('role="alert"'));
});

test('mounting the banner changed nothing else the card renders', () => {
  // The non-e2e root must be the card and only the card. Byte-for-byte, so a stray wrapper
  // element or a shifted attribute order fails here rather than being noticed in review.
  assert.equal(devHtml, appOnlyHtml);
});

test('the card itself still renders in e2e mode', () => {
  /*
   * The banner is additive, not a replacement screen. Comparing the e2e render to the card
   * render with the banner stripped proves the visitor still gets the whole card underneath.
   */
  const withoutBanner = e2eHtml.slice(e2eHtml.indexOf('</div>') + '</div>'.length);
  assert.equal(withoutBanner, appOnlyHtml);
});

/*
 * "ABSENT FROM PRODUCTION BUILDS" IS PROVEN ELSEWHERE, ON PURPOSE.
 *
 * It is a property of an emitted artifact, not of a render, so asserting it here would mean
 * running a production build inside a unit test and then trusting that this test's build
 * matches the one CI actually ships. `scripts/test/inspect-bundle.mjs` forbids
 * BANNER_SENTENCE in every deliverable file, and CI runs it against `apps/web/dist` and
 * `apps/qr/dist` after the real builds. That is the same string asserted present above, so
 * the two gates meet: present when the flag is on, absent from what ships.
 */
