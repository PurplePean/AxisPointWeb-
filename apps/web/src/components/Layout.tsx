import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Nav from './Nav';
import Footer from './Footer';

/**
 * The shared public-site shell: skip link, header, main landmark, footer.
 *
 * The header is no longer fixed, so `main` needs no top offset. The approved
 * sources show the header participating in normal document flow with a hairline
 * rule beneath it, not floating over the hero with a blur.
 */
function Layout() {
  const { pathname, hash } = useLocation();

  // Scroll to top on route change, unless the destination carries a hash.
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="min-h-screen flex flex-col bg-v2-surface text-v2-ink">
      {/* Visible only on focus, and it lands on the main landmark. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:items-center focus:rounded-v2 focus:bg-v2-teal focus:px-5 focus:font-bold focus:text-v2-action-label"
        style={{ minHeight: 44 }}
      >
        Skip to main content
      </a>

      <Nav />

      <main id="main" tabIndex={-1} className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export default Layout;
