import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Pages (to be created)
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import TeamPage from './pages/TeamPage';
import LearnPage from './pages/LearnPage';
import ArticlePage from './pages/ArticlePage';
import ContactPage from './pages/ContactPage';
import SharePage from './pages/SharePage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      {/* Standalone share landing — no site chrome */}
      <Route path="/share/:code" element={<SharePage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="learn/:slug" element={<ArticlePage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
