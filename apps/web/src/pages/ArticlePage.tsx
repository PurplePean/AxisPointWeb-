import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';

function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [readProgress, setReadProgress] = useState(0);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!articleRef.current) return;
      const { top, height } = articleRef.current.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = Math.max(0, -top);
      const total = height - viewH;
      const pct = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
      setReadProgress(pct);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-body">

      {/* Reading progress bar */}
      <div className="fixed top-[68px] left-0 right-0 z-40 h-0.5 bg-border">
        <div
          className="h-full bg-teal transition-all duration-75"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      <article ref={articleRef} className="max-w-[720px] mx-auto px-7 pt-28 pb-24">

        {/* Back link */}
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-sm text-sub hover:text-teal transition-colors mb-12"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Learn
        </Link>

        {/* Placeholder content — real articles loaded from markdown */}
        <div className="inline-flex px-3 py-1 rounded-full bg-teal text-white text-xs font-medium mb-6">
          Article
        </div>

        <h1 className="text-4xl md:text-5xl font-serif font-semibold text-ink mb-6 leading-tight">
          {slug?.replace(/-/g, ' ')}
        </h1>

        <div className="flex items-center gap-4 mb-10 pb-10 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal/15 border border-teal/30 flex items-center justify-center">
              <span className="text-teal text-xs font-semibold">ZR</span>
            </div>
            <div>
              <div className="text-sm font-medium text-ink">Zachary Russell</div>
              <div className="text-xs text-hint">Partner, AxisPoint</div>
            </div>
          </div>
          <span className="text-hint text-sm">·</span>
          <span className="text-hint text-sm">Article content coming soon</span>
        </div>

        <div className="prose prose-lg max-w-none text-sub">
          <p className="text-sub leading-relaxed text-lg">
            Article content will be loaded from markdown files. This page layout includes a reading progress bar, clean article typography, and author attribution.
          </p>
        </div>

      </article>
    </div>
  );
}

export default ArticlePage;
