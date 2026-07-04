import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

type Filter = 'all' | 'pub';

function LearnPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  useReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-[#2d1f50] to-ink pt-[calc(68px+28px)] md:pt-[calc(68px+64px)] pb-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-teal/8 blur-[70px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-purple/6 blur-[70px]" />
        </div>
        <div className="relative max-w-[1160px] mx-auto px-7">
          <div className="rv inline-flex items-center px-3 py-1 rounded-full bg-teal text-white text-xs font-medium mb-5">
            Insights & Knowledge
          </div>
          <h1 className="rv d1 font-serif font-semibold text-white leading-[1.1] mb-3.5" style={{ fontSize: 'clamp(2.7rem,4.8vw,4rem)' }}>
            Learn from <em className="not-italic text-teal">practitioners</em>
          </h1>
          <p className="rv d2 text-white leading-[1.7] max-w-[760px]" style={{ fontSize: '1.15rem' }}>
            Articles, guides, and papers written by Zachary and Ethaniel on commercial real estate strategy, asset management, and the Texas market.
          </p>
        </div>
      </section>

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="sticky z-40 bg-card border-b border-border" style={{ top: 68 }}>
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="flex gap-0 overflow-x-auto tab-scroll">
            {([['all', 'All'], ['pub', 'Publications']] as [Filter, string][]).map(([id, label]) => {
              const active = activeFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveFilter(id)}
                  className={`flex-none px-5 py-4 text-sm border-b-2 border-transparent transition-colors whitespace-nowrap -mb-px ${
                    active
                      ? 'md:border-purple text-purple font-semibold'
                      : 'text-hint hover:text-sub font-medium'
                  }`}
                >
                  {/* Mobile: indicator hugs text width; desktop: full-width underline. */}
                  <span className={active ? 'max-md:inline-block max-md:border-b-2 max-md:border-purple max-md:pb-1' : undefined}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <section className="py-24 bg-body">
        <div className="max-w-[1160px] mx-auto px-7">

          {/* Empty state */}
          <div className="text-center py-24">
            <div className="w-14 h-14 rounded-full bg-teal/10 border border-teal/20 flex items-center justify-center mx-auto mb-6">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#24a5bc" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="rv font-serif font-semibold text-ink mb-4" style={{ fontSize: '1.8rem' }}>Articles coming soon</h2>
            <p className="rv d1 text-sub leading-[1.7] mb-8 max-w-md mx-auto" style={{ fontSize: '1rem' }}>
              We're writing guides and insights based on what we see in the field. Subscribe to be notified when we publish.
            </p>
            <Link
              to="/contact"
              className="rv d2 inline-block px-7 py-3.5 rounded-button bg-purple text-white font-semibold hover:brightness-110 transition-all text-center max-md:w-full"
            >
              Subscribe for Updates
            </Link>
          </div>

        </div>
      </section>

      {/* ── Subscribe bar ────────────────────────────────── */}
      <section className="py-14 bg-card border-t border-border">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="font-serif font-semibold text-ink mb-1" style={{ fontSize: '1.1rem' }}>Stay in the loop</h3>
              <p className="text-sub" style={{ fontSize: '0.875rem' }}>We'll notify you when we publish new content. No spam.</p>
            </div>
            <Link
              to="/contact"
              className="flex-none px-6 py-2.5 rounded-button bg-purple text-white text-sm font-semibold hover:brightness-110 transition-all text-center max-md:w-full"
            >
              Subscribe
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

export default LearnPage;
