/**
 * Loads the real V2 backend contract for compatibility testing.
 *
 * WHY THIS EXISTS. A hand-written TypeScript type that says `'multifamily'` proves
 * nothing: it proves the frontend agrees with itself. The only thing that establishes the
 * two sides agree is running an envelope this app produced through the actual
 * `parseEnvelope` the backend uses to accept or reject it.
 *
 * The backend is plain ES5-era JavaScript with no module system, because Apps Script
 * concatenates every file into one global scope. So the files are evaluated, in order,
 * into a single VM context, exactly as the backend's own test loader does.
 *
 * This is READ-ONLY. Nothing here modifies `scripts/gas-v2`, and no test using it may.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(HERE, '../../../../scripts/gas-v2/src');

export interface ParseResult {
  ok: boolean;
  code?: string;
  field?: string | null;
  value?: Record<string, unknown>;
}

export interface GasV2Contract {
  parseEnvelope(rawBody: string): ParseResult;
  REJECTED_DISPLAY_STRINGS: string[];
  SCHEMA_VERSION: number;
  [key: string]: unknown;
}

/**
 * Evaluates every backend source file into one shared global, with only the globals Apps
 * Script actually provides. `require` and `module` are deliberately absent: if the backend
 * ever grows a Node dependency, this fails here rather than after a deploy.
 */
export function loadGasV2Contract(): GasV2Contract {
  const sandbox: Record<string, unknown> = {
    JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  };

  const context = vm.createContext(sandbox);
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).sort();

  if (files.length === 0) throw new Error('no backend source files found');

  for (const file of files) {
    vm.runInContext(readFileSync(path.join(SRC_DIR, file), 'utf8'), context, {
      filename: `gas-v2/src/${file}`,
    });
  }

  return sandbox as unknown as GasV2Contract;
}

/** Convenience: parse an envelope object the way the endpoint would. */
export function parse(contract: GasV2Contract, envelope: unknown): ParseResult {
  return contract.parseEnvelope(JSON.stringify(envelope));
}
