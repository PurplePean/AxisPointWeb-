import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Pages (to be created)
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import TeamPage from './pages/TeamPage';
import ContactPage from './pages/ContactPage';
import SharePage from './pages/SharePage';
import NotFoundPage from './pages/NotFoundPage';
// Learn is not part of the launch site. The LearnPage / ArticlePage components were
// removed (git history preserves them); rebuild Learn deliberately with the new
// design system and real articles when content publishing returns.

function App() {
  return (
    <Routes>
      {/* Standalone share landing — no site chrome */}
      <Route path="/share/:code" element={<SharePage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
