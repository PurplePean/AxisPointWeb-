import { useEffect } from 'react';

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

export function useDocumentMeta({ title, description, path, ogType = 'website' }: PageMeta) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;

    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertCanonical(url);
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', ogType);
  }, [title, description, path, ogType]);
}
