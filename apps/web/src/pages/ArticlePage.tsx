import { useParams, Link } from 'react-router-dom';

function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen bg-card">
      <div className="max-w-3xl mx-auto px-7 py-24">
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-sm text-sub hover:text-teal mb-12"
        >
          ← Back to Learn
        </Link>

        <article>
          <h1 className="text-4xl md:text-5xl font-serif font-semibold mb-6">
            Article: {slug}
          </h1>
          <p className="text-sub mb-12">Article content will be loaded from markdown files</p>
        </article>
      </div>
    </div>
  );
}

export default ArticlePage;
