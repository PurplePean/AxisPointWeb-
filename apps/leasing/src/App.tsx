import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LandlordPage from './pages/LandlordPage';
import TenantPage from './pages/TenantPage';
import ListingsPage from './pages/ListingsPage';
import ContactPage from './pages/ContactPage';
import PropertyManagementPage from './pages/PropertyManagementPage';
import SellPage from './pages/SellPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="landlord" element={<LandlordPage />} />
        <Route path="tenant" element={<TenantPage />} />
        <Route path="sell" element={<SellPage />} />
        <Route path="listings" element={<ListingsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="property-management" element={<PropertyManagementPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
