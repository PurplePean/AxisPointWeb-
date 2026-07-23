import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';

const LINKS: { to: string; label: string }[] = [
  { to: '/services', label: 'Services' },
  { to: '/team', label: 'Partners' },
  { to: '/contact', label: 'Contact' },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the overlay is open; always restore on cleanup.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close the menu immediately, restore scroll, then navigate.
  function go(to: string) {
    setOpen(false);
    document.body.style.overflow = '';
    navigate(to);
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[9999] h-nav [will-change:transform]" style={{ background: 'rgba(247,245,251,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E8E4F0' }}>
        <div className="max-w-[1160px] mx-auto px-7 h-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Logo height={36} />
          </Link>

          {/* Desktop navigation links */}
          <div className="hidden md:flex items-center gap-8">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive
                    ? 'text-sm font-medium text-purple'
                    : 'text-sm font-medium text-sub hover:text-ink transition-colors'
                }
              >
                {link.label}
              </NavLink>
            ))}

            {/* CTA Button */}
            <Link
              to="/contact"
              className="px-5 py-2.5 rounded-button bg-purple text-white text-sm font-semibold hover:brightness-110 transition-all hover:-translate-y-0.5"
            >
              Talk with our team
            </Link>
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="md:hidden flex flex-col justify-center items-center gap-[5px] w-10 h-10 -mr-2 text-ink"
          >
            <span className="block w-6 h-[2px] rounded-full bg-current" />
            <span className="block w-6 h-[2px] rounded-full bg-current" />
            <span className="block w-6 h-[2px] rounded-full bg-current" />
          </button>
        </div>
      </nav>

      {/*
        Mobile full-screen overlay menu.
        Rendered as a SIBLING of <nav> (not a child): the nav uses
        `will-change: transform` and `backdrop-filter`, both of which would
        make it the containing block for fixed descendants and trap the
        overlay inside the 68px nav box. Kept outside, `fixed inset-0`
        resolves against the viewport. Conditionally mounted so it fully
        unmounts on close — no faded/stuck remnant over the next page.
      */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-[99999] flex flex-col animate-fade-up"
          style={{ backgroundColor: '#1C1628' }}
        >
          {/* Overlay header with close button */}
          <div className="h-nav px-5 flex items-center justify-between flex-none">
            <button type="button" onClick={() => go('/')} aria-label="Home" className="flex items-center">
              <Logo height={34} className="brightness-0 invert" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="w-10 h-10 -mr-2 flex items-center justify-center text-white"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Overlay links */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8">
            {LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => go(link.to)}
                  className={`w-full text-center py-4 font-serif font-semibold text-[1.7rem] transition-colors ${
                    active ? 'text-teal' : 'text-white hover:text-teal'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => go('/contact')}
              className="mt-6 w-full max-w-xs text-center px-7 py-4 rounded-button bg-teal text-white text-lg font-semibold hover:brightness-110 transition-all"
            >
              Talk with our team
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Nav;
