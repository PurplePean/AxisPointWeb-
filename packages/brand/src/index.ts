/**
 * @axispoint/brand
 *
 * Shared brand primitives for AxisPoint Partners.
 *
 * This barrel exports exactly what `apps/web` and `apps/qr` import from it today, and
 * nothing else. It used to re-export the V1 contact form tree, `team.ts`, the abandoned
 * articles types, and the vCard helper; all of those were deleted in the 2026-08-15 V1
 * retirement pass. Their historical state is at the `v1-stable` and
 * `pre-v1-retirement-2026-08-14` tags.
 *
 * `colors.ts` and `fonts.ts` are still tracked and still current V2 support code, but no
 * app imports them through this barrel — the design tokens reach the apps through
 * `tailwind.preset.js`, which is consumed by each app's `tailwind.config.js` and is not a
 * TypeScript entry point. They are reachable on their own subpaths (`@axispoint/brand/colors`,
 * `@axispoint/brand/fonts`) if a consumer ever needs the values directly. Re-exporting them
 * here as well would put a second, unused name on every token.
 *
 * Add an export back only when a consumer actually imports it.
 */

/* Approved AxisPoint mark and lockup (design@2026-07-30) */
export { Mark } from './components/Mark';
export type { MarkProps, MarkVariant, MarkMode } from './components/Mark';

/* Dev-only e2e warning banner */
export { E2eBanner } from './components/E2eBanner';
