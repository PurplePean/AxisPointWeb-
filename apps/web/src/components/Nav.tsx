import { Link, NavLink } from 'react-router-dom';

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-nav bg-body/92 backdrop-blur-nav border-b border-border">
      <div className="max-w-[1160px] mx-auto px-7 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <div className="text-2xl font-serif font-semibold text-ink">
            AxisPoint
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <NavLink
            to="/services"
            className={({ isActive }) =>
              isActive
                ? 'text-sm font-medium text-purple'
                : 'text-sm font-medium text-sub hover:text-ink transition-colors'
            }
          >
            Services
          </NavLink>
          <NavLink
            to="/team"
            className={({ isActive }) =>
              isActive
                ? 'text-sm font-medium text-purple'
                : 'text-sm font-medium text-sub hover:text-ink transition-colors'
            }
          >
            Team
          </NavLink>
          <NavLink
            to="/learn"
            className={({ isActive }) =>
              isActive
                ? 'text-sm font-medium text-purple'
                : 'text-sm font-medium text-sub hover:text-ink transition-colors'
            }
          >
            Learn
          </NavLink>
          <NavLink
            to="/contact"
            className={({ isActive }) =>
              isActive
                ? 'text-sm font-medium text-purple'
                : 'text-sm font-medium text-sub hover:text-ink transition-colors'
            }
          >
            Contact
          </NavLink>

          {/* CTA Button */}
          <Link
            to="/contact"
            className="px-5 py-2.5 rounded-button bg-purple text-white text-sm font-semibold hover:brightness-110 transition-all hover:-translate-y-0.5"
          >
            Let's Talk
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Nav;
