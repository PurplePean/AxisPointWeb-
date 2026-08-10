import type { LocaleCode } from '../locales';
import type { Messages } from '../messages';

/**
 * The build-time replacement for `./audit/active.ts`.
 *
 * WHY THIS FILE EXISTS. Audit-candidate catalogs are model-generated text that no native
 * reader has checked. They must not exist in any deployable artifact, not merely be absent
 * from the entry chunk: a dynamic import still emits a fetchable chunk, and with
 * `sourcemap: true` a module that survives in the graph carries its full original source
 * into the `.map` files even when it is tree-shaken out of the JavaScript.
 *
 * So exclusion is structural rather than an optimization we hope for. `apps/web/vite.config.ts`
 * aliases `./catalogs/audit/active` to this module for every `vite build`, which means no
 * import path from any entry can reach `./audit/es.ts` and its seven siblings. Rollup has
 * nothing to eliminate because nothing references them.
 *
 * This is deliberately not an `import.meta.env.DEV` guard around a dynamic import. That would
 * depend on Rollup discarding a dynamic import inside a provably-false branch, which is a
 * bundler optimization rather than a guarantee, and side-effect conservatism can defeat it.
 *
 * ── WHY IT SITS HERE AND NOT IN `./audit/` ──────────────────────────────────
 *
 * It was originally `./audit/none.ts`, and `scripts/test/inspect-bundle.mjs` correctly failed
 * the first clean build because of it: the gate treats any `catalogs/audit` path named in a
 * sourcemap as a leak, and this stub legitimately IS in the graph, so it matched.
 *
 * The fix was to move the stub rather than to add an exception. `catalogs/audit/` now holds
 * unreviewed content and nothing else, which makes the rule exception-free: ANY audit path in
 * ANY emitted file is a leak, with no allowlist that a future real leak could hide inside.
 * An allowlist entry is exactly the kind of thing that gets widened once under time pressure
 * and never narrowed again.
 */
export async function loadAuditCandidate(_code: LocaleCode): Promise<Partial<Messages> | null> {
  return null;
}
