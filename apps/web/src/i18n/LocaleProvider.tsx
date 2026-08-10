import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_LOCALE, getLocale, type Locale, type LocaleCode } from './locales';
import {
  messagesFor,
  registerTestCatalog,
  resolveCatalog,
  syntheticCatalog,
  type Messages,
} from './messages';

/**
 * App-level locale state.
 *
 * PREVIOUSLY THIS LIVED IN THE NAVIGATION, which meant the selector changed a value nothing
 * else could see. The intake hardcoded `pageLocale: 'en'` because it had no way to ask what
 * the visitor had chosen, so a locale selection could never reach a submission. Lifting the
 * state here is what closes that gap.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. There is no URL routing and no persistence, and the
 * owner has explicitly left that decision open.
 *
 * LIFETIME, STATED PRECISELY. Because the state lives above the router, a chosen locale
 * survives normal in-app navigation for as long as the application stays loaded. It resets
 * on a full reload, on a direct load of any URL, and in a new tab, because nothing is
 * written to the URL or to storage.
 *
 * The approved sources settle the selector and the registry; they do not settle a public
 * locale-routing contract, and inventing one would ship a URL shape a later decision has to
 * break. `setLocale` is the seam a routing decision plugs into when it is made.
 */

export interface LocaleContextValue {
  locale: Locale;
  code: LocaleCode;
  /** Resolved catalog. Falls back to English by the single documented rule. */
  t: Messages;
  setLocale: (code: LocaleCode) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/*
 * There is deliberately NO "available locales" list on this context.
 *
 * `LanguageSelector` already owns that decision: production offers only launch-ready
 * locales, and the development preview relaxes the gate behind an explicit
 * `?locale-preview=all`. Publishing a second, subtly different answer here is exactly the
 * duplication this pass exists to remove, and mine disagreed with the selector's within an
 * hour of being written. One rule, in the component that renders the choice.
 */

/**
 * Development-only synthetic catalog activation.
 *
 * `?catalog=qa` fills every key with `[qa] <key>`, so a reviewer, and the browser seam
 * verifier, can watch all 92 catalogued keys change language without a translation existing.
 * It is deliberately unreadable rather than plausible: nobody can mistake it for content.
 *
 * That is the catalogued intake surfaces only, not the whole intake. Step headings, field
 * labels, placeholders, and the submission-state screens are still hardcoded English and
 * will not change; migrating them belongs to the Multilingual Content Rollout pass.
 *
 * Behind `import.meta.env.DEV`, so the query parameter does nothing in production and
 * `verify:bundle` asserts the machinery is absent from the bundle entirely.
 */
function useSyntheticCatalog(code: LocaleCode): void {
  if (!import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  const requested = new URLSearchParams(window.location.search).get('catalog');
  if (requested !== 'qa') return;
  registerTestCatalog(code, syntheticCatalog());
}

export function LocaleProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  /** Test seam. Production always starts at the default. */
  initial?: LocaleCode;
}) {
  const [code, setCode] = useState<LocaleCode>(initial ?? DEFAULT_LOCALE);

  const locale = getLocale(code);

  // Dev-only. No effect in production; see the note above.
  useSyntheticCatalog(locale.code);

  /*
   * The active catalog is state because an audit candidate arrives asynchronously.
   *
   * IT IS SEEDED SYNCHRONOUSLY, which is the part that matters. `messagesFor` answers from
   * reviewed content alone, so English, and any locale that has been promoted, is correct on
   * the very first render. There is no loading state, no flash of the wrong language, and no
   * Suspense boundary on a path that ships.
   *
   * The async step only ever adds an audit candidate on the development server. In every
   * build `resolveCatalog` resolves to the same object `messagesFor` already returned, so the
   * effect below settles to a no-op rather than re-rendering.
   */
  const [catalog, setCatalog] = useState<Messages>(() => messagesFor(locale.code));

  /*
   * The document element carries the language and direction, not a wrapper div.
   *
   * Assistive technology, the browser's own hyphenation and quote selection, and CSS
   * logical properties all read `<html lang>` and `<html dir>`. Setting them on a nested
   * element leaves the page announced in the wrong language even when it looks right.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale.code;
    document.documentElement.dir = locale.direction;
  }, [locale.code, locale.direction]);

  /*
   * Reviewed copy first, then the audit candidate if one exists.
   *
   * `cancelled` matters because a visitor can change language faster than a chunk loads.
   * Without it, a slow load for the locale they left could land after the fast load for the
   * one they chose, and the page would settle into the wrong language with no way back
   * except changing it again.
   */
  useEffect(() => {
    let cancelled = false;

    setCatalog(messagesFor(locale.code));

    resolveCatalog(locale.code)
      .then((resolved) => {
        if (!cancelled) setCatalog(resolved);
      })
      .catch(() => {
        /*
         * A failed chunk load leaves the reviewed catalog in place, which is English today.
         * Deliberately silent for the visitor and deliberately not a retry: the only way to
         * get here is a dev-server module failure, and the correct page is already rendered.
         */
      });

    return () => {
      cancelled = true;
    };
  }, [locale.code]);

  const setLocale = useCallback((next: LocaleCode) => {
    setCode(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      code: locale.code,
      t: catalog,
      setLocale,
    }),
    [locale, catalog, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Reads the active locale.
 *
 * Throws outside a provider rather than silently defaulting to English: a component that
 * renders the wrong language because its provider is missing is a bug that should surface
 * in development, not a page that quietly looks fine in the one language already shipping.
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
