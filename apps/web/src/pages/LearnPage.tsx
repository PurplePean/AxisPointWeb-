function LearnPage() {
  // Empty state - no articles yet
  const articles: any[] = [];

  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-purple-dark via-ink to-purple-dark py-32">
        <div className="max-w-[1160px] mx-auto px-7 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-teal/10 border border-teal/30 text-teal text-eyebrow font-semibold mb-6">
            INSIGHTS & KNOWLEDGE
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-semibold text-white mb-6">
            Learn
          </h1>
          <p className="text-xl text-sub max-w-2xl mx-auto">
            Articles, guides, and insights on commercial real estate
          </p>
        </div>
      </section>

      <section className="py-24 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          {articles.length === 0 ? (
            /* Empty State */
            <div className="text-center py-24">
              <h2 className="text-3xl font-serif mb-4">Articles coming soon</h2>
              <p className="text-sub mb-8">
                Subscribe to be notified when we publish new content.
              </p>
              <a
                href="/contact"
                className="inline-block px-8 py-4 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all"
              >
                Subscribe
              </a>
            </div>
          ) : (
            /* Article grid will go here */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Articles will be dynamically loaded */}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default LearnPage;
