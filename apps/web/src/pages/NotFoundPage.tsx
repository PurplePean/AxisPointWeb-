import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-card">
      <div className="text-center px-7">
        <h1 className="text-6xl font-serif font-semibold mb-4">404</h1>
        <p className="text-xl text-sub mb-8">Page not found</p>
        <Link
          to="/"
          className="inline-block px-8 py-4 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
