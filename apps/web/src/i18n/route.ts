import { DEFAULT_LOCALE, type Locale, type LocaleCode } from './locales';

/**
 * The public locale URL contract.
 *
 * SETTLED SHAPE: English is unprefixed and canonical (`/`, `/contact`), and every other
 * locale takes a path prefix (`/es/contact`, `/ur/contact`). The URL is the source of truth
 * for page locale; nothing is written to a cookie or to storage, so a locale survives a
 * reload, a direct link, a new tab, and the back button because it is in the address bar
 * rather than in a place the address bar can disagree with.
 *
 * A DISABLED OR UNKNOWN PREFIX IS NOT SILENTLY REWRITTEN TO ENGLISH. `/es/contact` today is
 * a page that does not exist, and saying so is the honest answer. Redirecting it to the
 * English page would publish a URL the launch gate says is unavailable, invite indexing of an
 * address that will later mean something different, and hide the gate from anyone testing it.
 *
 * These functions are pure so the contract can be tested without a router or a browser.
 */

export interface ParsedLocalePath {
  /** The resolved page locale. */
  code: LocaleCode;
  /** The path with any locale prefix removed, always starting with `/`. */
  innerPath: string;
  /**
   * True when the first segment looked like a locale but is not available. The caller
   * renders the not-found experience; it must not fall back to English content.
   */
  unavailable: boolean;
  /** The raw first segment when it was consumed as a locale prefix, else null. */
  prefix: string | null;
}

/** Every code the registry knows, whether or not it is currently available. */
function isKnownCode(segment: string, all: readonly Locale[]): boolean {
  return all.some((l) => l.code === segment);
}

function normalise(pathname: string): string {
  if (!pathname.startsWith('/')) return `/${pathname}`;
  // Collapse a trailing slash except on the root, so `/es/` and `/es` behave identically.
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Resolve a pathname into a locale and the route beneath it.
 *
 * `available` is the set a visitor may actually reach: launch-ready locales in production,
 * and all nine behind the development preview gate. `all` is the full registry, which is what
 * distinguishes "a locale that exists but is not available" (404) from "not a locale at all"
 * (an ordinary English route).
 */
export function parseLocalePath(
  pathname: string,
  available: readonly Locale[],
  all: readonly Locale[],
): ParsedLocalePath {
  const path = normalise(pathname);
  const [, first = '', ...rest] = path.split('/');

  if (first && isKnownCode(first, all)) {
    // English is never prefixed. `/en/contact` is not a second address for `/contact`:
    // one page, one canonical URL, no duplicate content.
    if (first === DEFAULT_LOCALE) {
      return { code: DEFAULT_LOCALE, innerPath: `/${rest.join('/')}`, unavailable: true, prefix: first };
    }
    const isAvailable = available.some((l) => l.code === first);
    return {
      code: isAvailable ? (first as LocaleCode) : DEFAULT_LOCALE,
      innerPath: `/${rest.join('/')}`,
      unavailable: !isAvailable,
      prefix: first,
    };
  }

  return { code: DEFAULT_LOCALE, innerPath: path, unavailable: false, prefix: null };
}

/**
 * Build the public path for a locale and an inner route.
 *
 * The inverse of `parseLocalePath`, and the single place a prefix is ever added, so a link
 * and the parser cannot disagree about the shape of a URL.
 */
export function buildLocalePath(code: LocaleCode, innerPath: string): string {
  const inner = normalise(innerPath);
  if (code === DEFAULT_LOCALE) return inner;
  return inner === '/' ? `/${code}` : `/${code}${inner}`;
}

/**
 * The equivalent page in another locale.
 *
 * Language switching moves the reader to the SAME page in their language rather than to the
 * home page, which is the behaviour that makes a language selector useful on a deep page.
 * Search and hash travel with it: a visitor reading `/contact?intent=general#form` who
 * switches language is still reading that form.
 */
export function localeEquivalentUrl(
  code: LocaleCode,
  pathname: string,
  available: readonly Locale[],
  all: readonly Locale[],
  search = '',
  hash = '',
): string {
  const { innerPath } = parseLocalePath(pathname, available, all);
  return `${buildLocalePath(code, innerPath)}${search}${hash}`;
}
