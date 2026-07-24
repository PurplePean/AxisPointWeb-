import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Nav from './Nav';
import Footer from './Footer';

function Layout() {
  const { pathname, hash } = useLocation();

  // Scroll to top on route change, unless the destination carries a hash. The
  // homepage routes into /services#property-management, #asset-management and
  // #investor-services; without this the unconditional scroll-to-top landed
  // every one of those links at the top of the page. Targets carry scroll-mt
  // so they clear the fixed nav.
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 pt-nav">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default Layout;
