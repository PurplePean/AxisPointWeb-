import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { useLocale } from './i18n/LocaleProvider';

import HomePage from './pages/HomePage';
import PropertyManagementPage from './pages/PropertyManagementPage';
import AssetManagementPage from './pages/AssetManagementPage';
import InvestorServicesPage from './pages/InvestorServicesPage';
import PartnersPage from './pages/PartnersPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * The six approved V2 public routes, served unprefixed for English and under a locale prefix
 * for any launch-ready non-English locale (design decision recorded in docs/STATUS.md).
 *
 * THE SAME PAGES ARE DECLARED TWICE, ONCE UNDER `/` AND ONCE UNDER `/:locale`, and that is
 * deliberate rather than an oversight. The obvious alternative, a router `basename` of
 * `/es`, cannot work here: a basename is fixed for the life of the router, so switching
 * language would require a full document reload instead of a navigation. Sharing one
 * `children` fragment keeps the two trees from drifting.
 *
 * There used to be a seventh route, the V1 referral landing at `/share/:code`, sitting
 * outside the chrome and outside localisation. It was deleted in the 2026-08-15 V1
 * retirement pass and deliberately NOT replaced with a redirect: it was never a published
 * address of this build, so a redirect would only preserve V1 behaviour under a new name.
 * `?ref=` attribution is unaffected — the intake reads it straight off the query string.
 */

/** The page routes themselves, identical under both trees. */
const pageRoutes = (
  <>
    <Route index element={<HomePage />} />
    <Route path="property-management" element={<PropertyManagementPage />} />
    <Route path="asset-management" element={<AssetManagementPage />} />
    <Route path="investor-services" element={<InvestorServicesPage />} />
    <Route path="partners" element={<PartnersPage />} />
    <Route path="contact" element={<ContactPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </>
);

/**
 * Guards the prefixed tree. Two different things reach it, and both are 404s.
 *
 * A first segment that names a locale which is NOT available renders the not-found
 * experience. It is never rewritten to the English page: `/es/contact` today is an address
 * that does not exist, and saying so is the honest answer. Redirecting would publish a URL
 * the launch gate says is unavailable and would hide the gate from anyone testing it.
 * `/en/...` is refused for the same reason in the other direction: English is unprefixed and
 * canonical, so a second address for the same page would be duplicate content.
 *
 * A first segment that is NOT A LOCALE AT ALL also lands here, which is not what the first
 * version of this assumed. React Router ranks a dynamic segment above a splat, so
 * `/no-such-page` matches `/:locale` rather than the catch-all in the unprefixed tree, and
 * with no `localePrefix` check it rendered the home page: the `index` route matched because
 * the remaining path was empty. The rendered-English baseline caught it. Anything reaching
 * here without a real locale prefix would have matched a static English route if it were a
 * real page, so it is a 404 by definition.
 */
function LocaleGate() {
  const { localeUnavailable, localePrefix } = useLocale();
  const refused = localeUnavailable || localePrefix === null;
  /* The 404 renders INSIDE the chrome, exactly as the English one always has. A bare
     not-found page with no header, footer, or skip link would be a regression. */
  return refused ? (
    <Layout>
      <NotFoundPage />
    </Layout>
  ) : (
    <Layout />
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {pageRoutes}
      </Route>

      <Route path="/:locale" element={<LocaleGate />}>
        {pageRoutes}
      </Route>
    </Routes>
  );
}

export default App;
