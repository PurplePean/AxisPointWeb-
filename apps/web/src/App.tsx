import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

import HomePage from './pages/HomePage';
import PropertyManagementPage from './pages/PropertyManagementPage';
import AssetManagementPage from './pages/AssetManagementPage';
import InvestorServicesPage from './pages/InvestorServicesPage';
import PartnersPage from './pages/PartnersPage';
import ContactPage from './pages/ContactPage';
import SharePage from './pages/SharePage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * The six approved V2 public routes (design@2026-07-30).
 *
 * The V1 `/services` and `/team` routes are gone: `/services` collapsed three
 * approved pages into one, and `/team` is now `/partners`. No redirect was added for
 * either, because nothing in this repository is deployed and no external link
 * depends on them yet. If that changes before launch, redirects belong to the
 * hosting configuration rather than to client-side routing.
 *
 * `/share/:code` stays exactly as it was, outside the site chrome, with its referral
 * behaviour untouched.
 */
function App() {
  return (
    <Routes>
      {/* Standalone share landing, no site chrome. Untouched V1 referral behaviour. */}
      <Route path="/share/:code" element={<SharePage />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="property-management" element={<PropertyManagementPage />} />
        <Route path="asset-management" element={<AssetManagementPage />} />
        <Route path="investor-services" element={<InvestorServicesPage />} />
        <Route path="partners" element={<PartnersPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
