/**
 * Re-exports the shared V2 backend contract loader.
 *
 * The loader lives in `apps/web/tests/helpers` because that is where it was first needed.
 * Re-exporting rather than copying is the point: two copies of a VM loader would drift, and
 * a drifted loader would quietly stop proving the thing it exists to prove.
 *
 * READ-ONLY. Nothing here modifies `scripts/gas-v2`, and no test using it may.
 */

export { loadGasV2Contract } from '../../../web/tests/helpers/gasV2';
export type { GasV2Contract, ParseResult } from '../../../web/tests/helpers/gasV2';
