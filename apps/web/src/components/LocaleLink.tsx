import { Link, NavLink, type LinkProps, type NavLinkProps } from 'react-router-dom';

import { useLocalePath } from '../i18n/LocaleProvider';

/**
 * Internal links that carry the active locale.
 *
 * WHY A WRAPPER RATHER THAN EDITING TWENTY-ONE `to` PROPS. Every internal destination in the
 * app is written as an English-relative path (`/contact?intent=general`), and prefixing has
 * to happen at exactly one place or it will eventually be forgotten at one call site. A
 * reader on `/es/contact` following a link built as `/property-management` would be silently
 * returned to English mid-journey, which is the failure this exists to prevent.
 *
 * `to` is therefore always the INNER path, exactly as it was before PR 5, and the prefix is
 * applied here. English resolves to the unchanged path, so English hrefs are byte-identical
 * to what they were.
 *
 * External links and `mailto:` deliberately keep the plain `Link` or `<a>`: neither is a
 * localised page. The V1 `/share/:code` route was a third such case until it was deleted in
 * the 2026-08-15 V1 retirement pass.
 */

export function LocaleLink({ to, ...rest }: Omit<LinkProps, 'to'> & { to: string }) {
  const localePath = useLocalePath();
  return <Link to={localePath(to)} {...rest} />;
}

export function LocaleNavLink({ to, ...rest }: Omit<NavLinkProps, 'to'> & { to: string }) {
  const localePath = useLocalePath();
  return <NavLink to={localePath(to)} {...rest} />;
}
