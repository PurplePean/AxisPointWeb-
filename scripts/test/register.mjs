/**
 * Registers the test-only TypeScript resolver hook.
 *
 * Used as `node --import ./scripts/test/register.mjs --test --experimental-strip-types`.
 * See `ts-resolver.mjs` for why it is needed and why it is confined to tests.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-resolver.mjs', pathToFileURL(import.meta.filename));
