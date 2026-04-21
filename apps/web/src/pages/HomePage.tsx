function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-dark via-ink to-purple-dark">
        <div className="max-w-[1160px] mx-auto px-7 py-24 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-teal/10 border border-teal/30 text-teal text-eyebrow font-semibold mb-8">
            CRE ASSET MANAGEMENT
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-semibold text-white mb-6 leading-tight">
            Disciplined strategy meets <em className="text-teal not-italic">hands-on execution</em>
          </h1>
          <p className="text-xl text-sub max-w-2xl mx-auto mb-12">
            Institutional-grade commercial real estate asset management for owners and advisors across Texas.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/contact"
              className="px-8 py-4 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all hover:-translate-y-0.5"
            >
              Get Started
            </a>
            <a
              href="/learn"
              className="px-8 py-4 rounded-button border-2 border-white/20 text-white font-semibold hover:bg-white/10 transition-all"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Placeholder for additional sections */}
      <section className="py-24 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <h2 className="text-4xl font-serif text-center mb-12">
            More sections coming soon...
          </h2>
          <p className="text-center text-sub">
            This page will be built to match the exact prototype design.
          </p>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
