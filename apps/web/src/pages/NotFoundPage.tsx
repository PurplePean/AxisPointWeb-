import { Link } from 'react-router-dom';
import { useMessages } from '../i18n/LocaleProvider';

/**
 * The "404" numeral itself is deliberately NOT a catalog key. It is a status code rather
 * than copy, it is the same glyph sequence in every locale this site supports, and making
 * it translatable would invite a well-meaning reviewer to localise the digits into a form
 * the reader would no longer recognise as an HTTP status.
 */
function NotFoundPage() {
  const t = useMessages();

  return (
    <div className="min-h-screen flex items-center justify-center bg-card">
      <div className="text-center px-7">
        <h1 className="text-6xl font-serif font-semibold mb-4">404</h1>
        <p className="text-xl text-sub mb-8">{t.notFoundMessage}</p>
        <Link
          to="/"
          className="inline-block px-8 py-4 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all"
        >
          {t.notFoundAction}
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
