import type { LocaleCode } from '../../locales';
import type { Messages } from '../../messages';

/**
 * Audit-candidate catalog loader. DEVELOPMENT SERVER ONLY.
 *
 * Every module reachable from here is model-generated text that no native reader has
 * corrected. None of it may appear in a deployable artifact.
 *
 * `apps/web/vite.config.ts` aliases this specifier to `../none.ts` whenever Vite's `command`
 * is `build`, so the eight catalogs leave the module graph entirely for every build, in
 * every mode. Only a running dev server resolves this file. A built preview is deliberately
 * not offered: it would be an artifact containing unreviewed translations, which is exactly
 * what the exclusion exists to prevent.
 *
 * The stub lives one directory up, NOT beside these files, so that `catalogs/audit/` contains
 * unreviewed content and nothing else. That keeps the bundle gate's rule exception-free: any
 * `catalogs/audit` path in any emitted file is a leak. See `../none.ts` for the full reason.
 *
 * The imports below are dynamic so that a locale nobody previews is never even parsed, and
 * so each catalog is a separate chunk in the dev server's graph. In a build they are not
 * chunks at all, because this file is not in the build.
 */
export async function loadAuditCandidate(code: LocaleCode): Promise<Partial<Messages> | null> {
  switch (code) {
    case 'es':
      return (await import('./es')).ES;
    case 'zh-Hans':
      return (await import('./zh-Hans')).ZH_HANS;
    case 'zh-Hant':
      return (await import('./zh-Hant')).ZH_HANT;
    case 'vi':
      return (await import('./vi')).VI;
    case 'hi':
      return (await import('./hi')).HI;
    case 'ur':
      return (await import('./ur')).UR;
    case 'gu':
      return (await import('./gu')).GU;
    case 'pa':
      return (await import('./pa')).PA;
    // English is not an audit candidate. It is `EN` in `../../messages.ts`, the reviewed
    // catalog every other locale falls back to.
    case 'en':
    default:
      return null;
  }
}
