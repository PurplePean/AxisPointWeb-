import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  DEFAULT_LOCALE,
  LOCALES,
  fontHrefFor,
  getLocale,
  launchReadyLocales,
  proofLocales,
  type Locale,
  type LocaleCode,
} from './locales';
import {
  messagesFor,
  registerTestCatalog,
  resolveCatalog,
  syntheticCatalog,
  type Messages,
} from './messages';
import { localeEquivalentUrl, parseLocalePath } from './route';

/**
 * App-level locale state, derived from the URL.
 *
 * WHAT CHANGED IN PR 5. The locale used to live in `useState` above the router, which meant
 * it survived in-app navigation and reset on every reload, direct link, and new tab. The URL
 * is now the single source of truth, so a locale survives all of those for the only reason
 * that actually holds: it is in the address bar. Nothing is written to a cookie or to
 * `localStorage`, deliberately, because a stored locale can disagree with the URL and then
 * one of them has to lose silently.
 *
 * THE PROVIDER NOW SITS INSIDE THE ROUTER. It has to: reading the URL means reading the
 * router's location, and changing the locale means navigating.
 *
 * PAGE LOCALE IS STILL NOT FOLLOW-UP LANGUAGE. This governs the language the page is read in.
 * What the visitor asked to be answered in is a separate field on the envelope and is
 * untouched by navigating.
 */

export interface LocaleContextValue {
  locale: Locale;
  code: LocaleCode;
  /** Resolved catalog. Falls back to English by the single documented rule. */
  t: Messages;
  /** Navigates to the equivalent page in the requested locale. */
  setLocale: (code: LocaleCode) => void;
  /**
   * The locales a visitor may actually reach right now: launch-ready in production, all nine
   * behind the development preview gate.
   *
   * THIS IS PUBLISHED DELIBERATELY, reversing the PR 1 note that said it should not be. Back
   * then only the selector needed the answer, so a second copy on the context would have been
   * pure duplication. Routing now needs the same answer to decide whether `/es/contact` is a
   * page or a 404, and two independent computations of "which locales exist" is precisely how
   * a menu comes to offer a link that the router refuses.
   */
  available: Locale[];
  /** The current route with any locale prefix removed. */
  innerPath: string;
  /** True when the URL names a locale that is not available. The route tree renders 404. */
  localeUnavailable: boolean;
  /**
   * The first path segment when it was consumed as a locale prefix, else null.
   *
   * The prefixed route tree needs this to tell "a locale that is not available" from "not a
   * locale at all". React Router ranks a dynamic segment above a splat, so `/no-such-page`
   * matches `/:locale` rather than the catch-all, and without this distinction it rendered
   * the home page instead of the 404. The rendered-English baseline caught exactly that.
   */
  localePrefix: string | null;
  /** Builds a href in the active locale. Every internal link goes through this. */
  localePath: (innerPath: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Development-only synthetic catalog activation. Unchanged from PR 1 except that it reads the
 * router's search rather than `window.location`, so it behaves identically under SSR.
 */
function useSyntheticCatalog(code: LocaleCode, search: string): void {
  if (!import.meta.env.DEV) return;
  if (new URLSearchParams(search).get('catalog') !== 'qa') return;
  registerTestCatalog(code, syntheticCatalog());
}

/**
 * The preview gate, read from the router.
 *
 * `?locale-preview=all` exposes every locale for local review. It is `import.meta.env.DEV`
 * only, so in production `available` is exactly the launch-ready set and a prefixed URL for
 * any other locale is a 404. `verify:bundle` asserts the machinery is absent from a build.
 */
function usePreviewMode(search: string): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(search).get('locale-preview') === 'all';
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  const preview = usePreviewMode(search);
  const available = useMemo(
    () => (preview ? proofLocales() : launchReadyLocales()),
    [preview],
  );

  const parsed = useMemo(
    () => parseLocalePath(pathname, available, LOCALES),
    [pathname, available],
  );
  const locale = getLocale(parsed.code);

  useSyntheticCatalog(locale.code, search);

  const [catalog, setCatalog] = useState<Messages>(() => messagesFor(locale.code));

  useEffect(() => {
    let cancelled = false;
    setCatalog(messagesFor(locale.code));
    resolveCatalog(locale.code)
      .then((resolved) => {
        if (!cancelled) setCatalog(resolved);
      })
      .catch(() => {
        /* A failed chunk load leaves reviewed copy in place. See PR 1. */
      });
    return () => {
      cancelled = true;
    };
  }, [locale.code]);

  /*
   * Document language and direction. Assistive technology, the browser's own hyphenation and
   * quote selection, and CSS logical properties all read `<html lang>` and `<html dir>`.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale.code;
    document.documentElement.dir = locale.direction;
  }, [locale.code, locale.direction]);

  /*
   * Script fonts, applied to page content rather than only to the language menu.
   *
   * WHY A STYLESHEET AND NOT AN INLINE STYLE ON `body`. The first version set
   * `body.style.fontFamily`, and the browser review showed why that is not enough: headings
   * carry `font-serif` (Cormorant Garamond), which sets its own family and therefore beats
   * anything inherited from `body`. Cormorant has no Devanagari, Gujarati, Gurmukhi, Arabic or
   * CJK glyphs at all, so every heading on those pages was being rendered by whatever the
   * browser happened to substitute. A scoped rule outranks the utility class and fixes the
   * headings without touching the elements that were already correct.
   *
   * WHY ONLY THE SIX NON-LATIN LOCALES. Spanish and Vietnamese are written in the Latin
   * alphabet, which Cormorant and Figtree cover completely, so overriding their headings would
   * throw away the brand serif to fix nothing. They keep the ordinary cascade, which also
   * keeps their typography byte-identical to English rather than gratuitously different.
   *
   * ENGLISH IS DELIBERATELY LEFT ALONE for the same reason, and the `[lang]` scope means no
   * rule can match it even if one were emitted.
   *
   * The line height comes from the registry: Devanagari, Gujarati, Gurmukhi and Arabic carry
   * 1.55 because their marks sit above and below the base line and clip at Latin leading.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const ID = 'axp-locale-font';
    const existing = document.getElementById(ID);
    const needsScriptFont = locale.code !== DEFAULT_LOCALE && fontHrefFor(locale.code) !== null;

    if (!needsScriptFont) {
      if (existing) existing.remove();
      return;
    }

    const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
    style.id = ID;
    const at = `[lang="${locale.code}"]`;
    style.textContent =
      `${at} body{font-family:${locale.fontStack};line-height:${locale.lineHeight};}` +
      `${at} h1,${at} h2,${at} h3,${at} h4,${at} h5,${at} h6,` +
      `${at} .font-serif{font-family:${locale.fontStack};}`;
    if (!existing) document.head.appendChild(style);
  }, [locale.code, locale.fontStack, locale.lineHeight]);

  /*
   * Load ONLY the script family the active locale needs, once.
   *
   * English needs none, so production loads no Noto family at all and its font payload is
   * unchanged by this pass. A reader on the Hindi preview gets Devanagari and not the other
   * five.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const href = fontHrefFor(locale.code);
    if (!href) return;
    if (document.head.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.axpLocaleFont = locale.code;
    document.head.appendChild(link);
  }, [locale.code]);

  const setLocale = useCallback(
    (next: LocaleCode) => {
      navigate(localeEquivalentUrl(next, pathname, available, LOCALES, search, hash));
    },
    [navigate, pathname, available, search, hash],
  );

  /**
   * Builds an internal href in the active locale.
   *
   * Call sites pass real hrefs, several of which carry a query (`/contact?intent=general`),
   * so the query and hash are split off before the path is prefixed. Prefixing the whole
   * string would produce `/es/contact?intent=general` only by accident and
   * `/es/contact%3Fintent=general` in the cases that matter.
   */
  const localePath = useCallback(
    (href: string) => {
      const hashAt = href.indexOf('#');
      const withoutHash = hashAt === -1 ? href : href.slice(0, hashAt);
      const hashPart = hashAt === -1 ? '' : href.slice(hashAt);
      const queryAt = withoutHash.indexOf('?');
      const pathPart = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
      const queryPart = queryAt === -1 ? '' : withoutHash.slice(queryAt);
      return localeEquivalentUrl(locale.code, pathPart, available, LOCALES, queryPart, hashPart);
    },
    [locale.code, available],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      code: locale.code,
      t: catalog,
      setLocale,
      available,
      innerPath: parsed.innerPath,
      localeUnavailable: parsed.unavailable,
      localePrefix: parsed.prefix,
      localePath,
    }),
    [
      locale,
      catalog,
      setLocale,
      available,
      parsed.innerPath,
      parsed.unavailable,
      parsed.prefix,
      localePath,
    ],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Reads the active locale.
 *
 * Throws outside a provider rather than silently defaulting to English: a component rendering
 * the wrong language because its provider is missing is a bug that should surface in
 * development, not a page that quietly looks fine in the one language already shipping.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside a LocaleProvider');
  return ctx;
}

/** The active catalog, for components that need copy but not the locale itself. */
export function useMessages(): Messages {
  return useLocale().t;
}

/** Builds an internal href in the active locale. See `localePath`. */
export function useLocalePath(): (innerPath: string) => string {
  return useLocale().localePath;
}
