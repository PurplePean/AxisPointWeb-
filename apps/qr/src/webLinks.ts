import { FIRM } from './profiles';

/**
 * The quiet routes out to the shared AxisPoint website.
 *
 * WHY THIS IS ITS OWN MODULE, AND NOT PART OF `profiles.ts`. It is the only part of the card's
 * configuration that reads `import.meta.env`, and `profiles.ts` is now imported by
 * `exchange/model.ts`, which the Node test runner loads as plain source. Node has no
 * `import.meta.env` at all, so a module-level read there would throw on import.
 *
 * The obvious workaround, reading the env object once through a nullish fallback, is a trap
 * and was briefly taken: `import.meta.env.DEV` must stay in its LITERAL form for the bundler
 * to replace it with `false` and fold the dead branch away. Routing it through a variable
 * makes it a runtime property read, both branches survive, and `http://localhost:3000` ships
 * inside the production bundle. Caught by inspecting the built asset, not by any test.
 *
 * Splitting the file is the fix that keeps both properties: `profiles.ts` is pure data and
 * imports cleanly into Node, and the env reads below stay literal and keep folding.
 */

/**
 * The website base URL is configurable so the local web preview can be used during
 * development without asserting the permanent QR-host routing contract.
 * `VITE_WEB_BASE_URL` overrides it; otherwise production points at the firm site.
 */
export const WEB_BASE_URL: string =
  (import.meta.env.VITE_WEB_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : FIRM.websiteUrl);

/** The approved quiet routes out to the shared website. */
export const WEB_LINKS = {
  managementProposal: `${WEB_BASE_URL}/contact?intent=property-management`,
  propertyManagement: `${WEB_BASE_URL}/property-management`,
  home: `${WEB_BASE_URL}/`,
};
