import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Mark } from '@axispoint/brand';
import { GUTTER } from './ui';

const LINKS = [
  { to: '/#landlord', label: 'Landlord Rep' },
  { to: '/#tenant', label: 'Tenant Rep' },
  { to: '/listings', label: 'Listings' },
];

const linkClass = 'inline-flex min-h-[44px] items-center hover:text-v2-teal-support';

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();

  /* Close the mobile menu whenever navigation happens. */
  useEffect(() => setOpen(false), [pathname, hash]);

  return (
    <header className={`border-b border-v2-ink/[0.12] bg-v2-surface py-2.5 min-[821px]:py-5 ${GUTTER}`}>
      <div className="flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex min-h-[44px] items-center" aria-label="AxisPoint Partners, home">
          <Mark variant="fullcolor" mode="lockup" height={23} />
        </Link>
        <nav
          aria-label="Primary"
          className="flex items-center gap-[30px] text-[13.5px] font-medium text-v2-ink/[0.72]"
        >
          <div className="hidden items-center gap-[30px] min-[821px]:flex">
            {LINKS.map((l) => (
              <NavLink key={l.label} to={l.to} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <Link
            to="/contact"
            className="inline-flex min-h-[44px] items-center rounded-v2 bg-v2-teal px-3.5 text-[13px] font-bold text-v2-action-label hover:brightness-110 min-[821px]:px-[18px] min-[821px]:text-[13.5px]"
          >
            Start a conversation
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-v2-purple min-[821px]:hidden"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M4 4l14 14M18 4L4 18" /> : <path d="M3 6h16M3 11h16M3 16h16" />}
            </svg>
          </button>
        </nav>
      </div>
      {open && (
        <div id="mobile-menu" className="flex flex-col pb-2 pt-1 text-[15px] font-medium min-[821px]:hidden">
          {LINKS.map((l) => (
            <Link key={l.label} to={l.to} className={`${linkClass} border-t border-v2-ink/10`}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
