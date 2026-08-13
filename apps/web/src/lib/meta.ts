import { useEffect } from 'react';

import { useLocale } from '../i18n/LocaleProvider';
import { DEFAULT_LOCALE, launchReadyLocales, type Locale } from '../i18n/locales';
import { buildLocalePath } from '../i18n/route';

/**
 * Per-route document metadata.
 *
 * The app had no metadata mechanism at all: `index.html` carried one static title
 * and description for every route. This is a small hook rather than a dependency
 * like react-helmet, because the requirement is modest and adding a library for it
 * would be more moving parts than the job needs.
 *
 * It sets title, description, canonical, and the Open Graph tags the approved
 * routes need. It deliberately does not emit `og:image`: the 1200x630 social
 * sharing image is a later launch deliverable, and pointing at a file that does
 * not exist would be worse than omitting the tag.
 *
 * Locale-specific metadata, hreflang, and translated titles belong to the
 * localization work, not here.
 */

export const SITE_URL = 'https://axispoint.llc';
export const SITE_NAME = 'AxisPoint Partners';

export interface PageMeta {
  title: string;
  description: string;
  /** Route path, e.g. "/property-management". Used for canonical and og:url. */
  path: string;
  /** Defaults to "website". */
  ogType?: string;
}

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Replaces the full set of `hreflang` alternates.
 *
 * THE LAUNCH GATE DECIDES WHAT IS ADVERTISED. Alternates are emitted only for locales that
 * are both `enabled` and `review: 'reviewed'`, which today is English alone, so a production
 * page carries exactly two links: `en` and `x-default`, both pointing at the unprefixed URL.
 * An unreviewed locale must never appear here: `hreflang` is an instruction to a crawler to
 * index that address, and the address deliberately 404s.
 *
 * Previous alternates are removed rather than added to, so navigating between locales cannot
 * leave a stale set behind.
 */
function upsertAlternates(innerPath: string, locales: readonly Locale[]) {
  document.head
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((el) => el.remove());

  const add = (hreflang: string, href: string) => {
    const el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', hreflang);
    el.setAttribute('href', href);
    document.head.appendChild(el);
  };

  for (const l of locales) {
    add(l.code, `${SITE_URL}${buildLocalePath(l.code, innerPath)}`);
  }
  // English is x-default: it is the unprefixed, canonical address and the one a reader with
  // no matching language should land on.
  add('x-default', `${SITE_URL}${buildLocalePath(DEFAULT_LOCALE, innerPath)}`);
}

/**
 * Per-route document metadata, locale-aware since PR 5.
 *
 * `path` is the INNER route, without a locale prefix. The canonical URL is built for the
 * active locale, so `/es/contact` is canonical to itself rather than to the English page,
 * and English stays unprefixed.
 *
 * A LIMITATION WORTH STATING PLAINLY: all of this is applied by JavaScript after the document
 * loads. The initial HTML that a crawler receives carries only the static title and
 * description from `index.html`. Crawlers that execute JavaScript will see the correct
 * values; those that do not will not. Making metadata available in the initial response
 * requires prerendering or server rendering, which this repository does not do and which this
 * pass did not add. See docs/STATUS.md.
 */
export function useDocumentMeta({ title, description, path, ogType = 'website' }: PageMeta) {
  const { code } = useLocale();
  const advertised = launchReadyLocales();

  useEffect(() => {
    const url = `${SITE_URL}${buildLocalePath(code, path)}`;

    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertCanonical(url);
    upsertAlternates(path, advertised);
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', ogType);
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', code);
  }, [title, description, path, ogType, code, advertised]);
}
