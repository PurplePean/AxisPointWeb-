import type { LocaleCode } from '../../locales';
import type { Messages } from '../../messages';

/**
 * Reviewed catalogs. THE PRODUCTION GRAPH.
 *
 * This module is imported statically and is present in every build. A catalog listed here
 * ships to real visitors, so nothing reaches it until a native reader has corrected it and
 * the owner has signed the translation off.
 *
 * English is deliberately NOT here. It lives in `messages.ts` as `EN`, because it is the
 * fallback every other catalog is measured against and it must be impossible for a data
 * change to remove it.
 *
 * ── THE PROMOTION PATH ──────────────────────────────────────────────────────
 *
 * Moving a locale from audit candidate to production is exactly three steps, and none of
 * them is an architectural change:
 *
 *   1. A native reader corrects `../audit/<code>.ts`. Their corrections are the content.
 *   2. Move that file to `./<code>.ts`, delete its audit-candidate sentinel and header,
 *      and add one line to `REVIEWED_CATALOGS` below.
 *   3. Flip `enabled: true` and `review: 'reviewed'` for that locale in `../../locales.ts`.
 *
 * Step 2 is what moves the file into the production module graph; step 3 is what lets the
 * selector, the router, and `hreflang` see it. Both are required: a reviewed catalog that
 * is not enabled is unreachable, and an enabled locale with no reviewed catalog falls back
 * to English per the single documented rule rather than rendering blanks.
 *
 * The build-time exclusion in `apps/web/vite.config.ts` applies ONLY to `../audit/`. It
 * does not and must not touch this directory, so promotion never involves editing the
 * build configuration.
 */
export const REVIEWED_CATALOGS: Partial<Record<LocaleCode, Partial<Messages>>> = {
  // No locale has completed native-reader review. Adding a line here ships that language.
};
