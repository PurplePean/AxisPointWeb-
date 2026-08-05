/**
 * A Node resolver hook that finds TypeScript sources behind extensionless specifiers.
 *
 * WHY THIS EXISTS. The workspace packages are consumed AS SOURCE: `package.json` points
 * `main` at a `.ts` file and Vite compiles it as part of each app's build. That is the
 * established convention here, and the relative imports inside those packages are
 * extensionless, matching `packages/brand` and every app.
 *
 * Node ESM does not resolve extensionless specifiers, so `node --test
 * --experimental-strip-types` cannot follow `./wire` from `index.ts` without help. The
 * alternatives were worse: adding `.ts` extensions everywhere would force
 * `allowImportingTsExtensions` into `apps/web`, which emits from `tsc` and therefore
 * cannot enable it; and adding a build step would mean tests run against a stale artifact
 * whenever somebody forgets to rebuild.
 *
 * This hook is TEST-ONLY. Nothing in a browser bundle or a production build goes near it,
 * and it changes no package's import convention.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Extensions tried, in order, for a specifier that does not resolve as written. */
const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Only rescue a genuine "not found". Anything else is a real problem worth surfacing.
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;

    const parentUrl = context.parentURL;
    if (!parentUrl) throw error;

    // Relative specifiers resolve against the importer; bare ones are left to Node so a
    // missing dependency still reports as a missing dependency.
    if (!specifier.startsWith('.')) throw error;

    const base = new URL(specifier, parentUrl);
    for (const suffix of CANDIDATES) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(fileURLToPath(candidate))) {
        // `format` is deliberately omitted. Naming it 'module' would tell Node the file is
        // plain JavaScript and skip type stripping entirely; letting Node infer from the
        // .ts extension is what keeps --experimental-strip-types in play.
        return { url: candidate.href, shortCircuit: true };
      }
    }

    // A `.js` specifier written by a NodeNext-style source, pointing at a sibling `.ts`.
    if (base.href.endsWith('.js')) {
      const asTs = new URL(base.href.replace(/\.js$/, '.ts'));
      if (existsSync(fileURLToPath(asTs))) {
        return { url: asTs.href, shortCircuit: true };
      }
    }

    throw error;
  }
}

/**
 * Package entry points named in `main`/`exports` resolve through Node's normal algorithm,
 * which already returns the `.ts` path. Nothing extra is needed for those, so there is no
 * `load` hook here: `--experimental-strip-types` handles the transform itself.
 */
export function initialize() {
  return pathToFileURL(process.cwd()).href;
}
