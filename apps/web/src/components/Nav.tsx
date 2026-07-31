import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Mark } from '@axispoint/brand';

/**
 * Shared site header, built from the approved V2 sources (design@2026-07-30):
 * the header row in `AxisPointPage.dc.html` and `AxisPoint System Studies.dc.html`.
 *
 * Approved treatment held here: 20px vertical padding on the approved gutters,
 * a single hairline bottom rule, the 23px lockup, 13.5px/500 links at 72% ink,
 * and one filled teal action carrying #0F1F27 at weight 700 on a 2px radius.
 * The action is the only filled element in the navigation, which is what keeps
 * the management pathway dominant.
 *
 * Several destinations below land on routes that arrive in Code Pass 3. They are
 * deliberately real hrefs rather than placeholder pages or redirects, so the
 * staged dependency stays visible instead of being papered over. Tracked in
 * docs/STATUS.md.
 */

const LINKS: { to: string; label: string }[] = [
  { to: '/property-management', label: 'Property Management' },
  { to: '/asset-management', label: 'Asset Management' },
  { to: '/investor-services', label: 'Investor Services' },
  { to: '/partners', label: 'Partners' },
];

const CTA = { to: '/contact?intent=property-management', label: 'Request a Management Proposal' };

/**
 * The approved closed-state English control, rendered as an honest static label.
 *
 * The full selector (open/hover/focus states, nine locales, routing, persistence)
 * belongs to the localization pass. Rendering a button that opens nothing, or an
 * empty menu, would be fabricated behaviour, so this is deliberately not
 * interactive: no button element, no aria-haspopup, no tab stop. It reports the
 * current language and nothing more.
 */
function CurrentLanguage({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-v2 border border-[rgba(28,22,40,0.22)] font-semibold text-v2-ink"
      style={{ minHeight: 40, padding: compact ? '0 10px' : '0 12px', fontSize: 13 }}
    >
      <span className="sr-only">Current language: </span>
      English
      <span aria-hidden="true" style={{ color: 'rgba(28,22,40,0.5)' }}>&#9662;</span>
    </span>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const { pathname, search } = useLocation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Close on route change. Focus is not forced back to the trigger here: the user
  // is navigating away, and stealing focus would fight the destination page.
  useEffect(() => {
    setOpen(false);
  }, [pathname, search]);

  // Lock body scroll while the panel is open; always restore on cleanup.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes and returns focus. Tab is trapped inside the panel so focus can
  // never land on the page behind an open full-screen menu.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  // Move focus into the panel when it opens, so keyboard order continues where
  // the user was rather than restarting at the top of the document.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
  }, [open]);

  return (
    <>
      <header
        className="relative z-40 border-b border-[rgba(28,22,40,0.12)] bg-v2-surface"
        style={{ paddingTop: 20, paddingBottom: 20 }}
      >
        <div className="flex items-center justify-between gap-6 px-5 md:px-10 lg:px-[72px]">
          <Link
            to="/"
            className="inline-flex items-center rounded-v2"
            /* The approved lockup is 23px, which is well under a 44px touch target.
               Vertical padding grows the hit area and an equal negative margin pulls
               the layout back, so the header keeps its approved 63px height. */
            style={{ padding: '11px 0', margin: '-11px 0' }}
            aria-label="AxisPoint, home"
          >
            <Mark variant="fullcolor" mode="lockup" height={23} />
          </Link>

          {/* Desktop navigation. Below 1024px this collapses to the approved menu:
              the four labels plus the full CTA wording cannot hold their measure at
              834px without wrapping, and the approved sources specify no tablet
              composition, so the mobile treatment carries that width. */}
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-[30px]">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    'inline-flex items-center font-medium transition-colors hover:text-v2-teal-support rounded-v2',
                    isActive ? 'text-v2-ink' : 'text-[rgba(28,22,40,0.72)]',
                  ].join(' ')
                }
                /* The approved link is 13.5px type in a 63px header. Padding grows the
                   hit area to 44px and an equal negative margin keeps the header at its
                   approved height, the same technique used on the lockup. */
                style={{ fontSize: 13.5, minHeight: 44, padding: '12px 0', margin: '-12px 0' }}
              >
                {link.label}
              </NavLink>
            ))}

            <CurrentLanguage />

            <Link
              to={CTA.to}
              className="inline-flex items-center rounded-v2 bg-v2-teal font-bold text-v2-action-label transition-colors hover:bg-v2-teal-support hover:text-white"
              style={{ fontSize: 13, padding: '11px 18px', minHeight: 44 }}
            >
              {CTA.label}
            </Link>
          </nav>

          {/* Mobile control cluster: the approved static language label, the word
              Menu, and the approved two-bar treatment. */}
          <div className="flex lg:hidden items-center gap-3.5">
            <CurrentLanguage compact />
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="inline-flex items-center gap-2.5 rounded-v2 px-1"
              style={{ minHeight: 44 }}
            >
              <span
                className="font-bold uppercase text-[rgba(28,22,40,0.6)]"
                style={{ fontSize: 12, letterSpacing: '0.12em' }}
              >
                Menu
              </span>
              <span aria-hidden="true" className="grid gap-[5px]">
                <span className="block bg-v2-ink" style={{ width: 22, height: 1.5 }} />
                <span className="block bg-v2-ink" style={{ width: 22, height: 1.5 }} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="lg:hidden fixed inset-0 z-50 flex flex-col bg-v2-surface"
        >
          <div
            className="flex items-center justify-between gap-6 border-b border-[rgba(28,22,40,0.12)] px-5"
            style={{ paddingTop: 20, paddingBottom: 20 }}
          >
            <Link
              to="/"
              className="inline-flex items-center rounded-v2"
              style={{ padding: '11px 0', margin: '-11px 0' }}
              aria-label="AxisPoint, home"
            >
              <Mark variant="fullcolor" mode="lockup" height={23} />
            </Link>
            <button
              type="button"
              onClick={() => close()}
              aria-label="Close menu"
              className="inline-flex items-center justify-center rounded-v2"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav aria-label="Primary" className="flex-1 overflow-y-auto px-5 py-2">
            <div className="grid border-t border-[rgba(28,22,40,0.14)]">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    [
                      'flex items-center justify-between gap-4 border-b border-[rgba(28,22,40,0.1)] font-semibold rounded-v2',
                      isActive ? 'text-v2-teal-support' : 'text-v2-ink',
                    ].join(' ')
                  }
                  style={{ minHeight: 54, fontSize: 15 }}
                >
                  {link.label}
                  <span aria-hidden="true" style={{ fontSize: 17, color: 'rgba(28,22,40,0.45)' }}>&#8594;</span>
                </NavLink>
              ))}
            </div>

            <Link
              to={CTA.to}
              className="mt-6 flex items-center justify-center gap-2.5 rounded-v2 bg-v2-teal font-bold text-v2-action-label transition-colors hover:bg-v2-teal-support hover:text-white"
              style={{ minHeight: 54, fontSize: 15, padding: '0 22px' }}
            >
              {CTA.label}
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}

export default Nav;
