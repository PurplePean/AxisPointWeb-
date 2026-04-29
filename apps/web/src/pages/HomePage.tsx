import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

function HomePage() {
  useReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative flex items-center bg-gradient-to-br from-[#2d1f50] to-ink overflow-hidden" style={{ minHeight: '100vh' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-80px] left-[-80px] w-[500px] h-[500px] rounded-full bg-teal/10 blur-[120px]" />
          <div className="absolute bottom-[-80px] right-[-60px] w-[420px] h-[420px] rounded-full bg-magenta/8 blur-[100px]" />
          <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full bg-purple/8 blur-[80px]" />
        </div>

        <div className="relative max-w-[1160px] mx-auto px-7 pt-[calc(68px+64px)] pb-24 w-full max-w-[720px]">
          <h1 className="rv font-serif font-semibold text-white leading-[1.08] mb-5" style={{ fontSize: 'clamp(2.6rem,5vw,4rem)' }}>
            Commercial real estate,<br />
            <em className="not-italic text-teal">done right.</em>
          </h1>
          <p className="rv d2 text-white/80 leading-relaxed italic mb-4" style={{ fontSize: '1.05rem' }}>
            Most people never invest in CRE because they do not have the right team behind them. That is the problem AxisPoint solves.
          </p>
          <p className="rv d2 text-white/65 leading-relaxed mb-10" style={{ fontSize: '0.95rem' }}>
            We manage commercial real estate on behalf of investors across Texas. We find the deals, run the numbers, execute the business plan, and manage the asset from day one through exit.{' '}
            <strong className="text-white/90 font-semibold">You own the investment. We do the work.</strong>
          </p>
          <div className="rv d3 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-teal/25"
            >
              Let's Talk
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <Link
              to="/services"
              className="px-7 py-3.5 rounded-button border border-white/20 text-white font-semibold hover:bg-white/8 transition-all"
            >
              Explore Services
            </Link>
          </div>
        </div>
      </section>

      {/* ── Who We Work With ─────────────────────────────── */}
      <section className="py-24 bg-body">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv mb-10">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
              <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Who We Work With</span>
            </div>
            <h2 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
              Starting fresh or taking over
            </h2>
            <p className="text-sub leading-relaxed max-w-xl" style={{ fontSize: '1rem' }}>
              Not every client is starting from scratch. Some are buying their first commercial property. Others already own an asset that needs a real management structure in place.
            </p>
          </div>

          <div className="rv d1 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* New to CRE */}
            <div className="rounded-card bg-ink text-white p-9 flex flex-col" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="inline-flex self-start px-3 py-1 rounded-chip text-xs font-semibold uppercase tracking-wider mb-5" style={{ background: 'rgba(36,165,188,0.15)', border: '1px solid rgba(36,165,188,0.3)', color: '#24a5bc' }}>
                New to CRE
              </div>
              <h3 className="font-serif font-semibold text-white mb-3 leading-snug" style={{ fontSize: '1.2rem' }}>
                We'll walk you through every step of the process
              </h3>
              <p className="text-white/75 leading-[1.7] mb-6" style={{ fontSize: '0.9rem' }}>
                If you've never invested in commercial real estate, you're not behind. You just haven't had the right team in your corner. We act as your asset manager from day one, handling everything from deal sourcing to ongoing operations.
              </p>
              <div className="flex flex-col gap-2.5 mb-7 flex-1">
                {[
                  'Acquisition sourcing and underwriting on your behalf',
                  'CapEx business plan development and oversight',
                  'Property management supervision and accountability',
                  'Monthly reporting and investor communication',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-white/75" style={{ fontSize: '0.88rem' }}>
                    <span className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-none text-teal font-bold text-xs bg-teal/15 border border-teal/30">✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <Link
                to="/contact"
                className="self-start px-6 py-2.5 rounded-button bg-teal text-white text-sm font-semibold hover:brightness-110 transition-all"
              >
                Start a conversation
              </Link>
            </div>

            {/* Existing Asset */}
            <div className="rounded-card bg-card border border-border p-9 flex flex-col shadow-card">
              <div className="inline-flex self-start px-3 py-1 rounded-chip bg-purple/10 border border-purple/20 text-purple text-xs font-semibold uppercase tracking-wider mb-5">
                Existing Asset
              </div>
              <h3 className="font-serif font-semibold text-ink mb-3 leading-snug" style={{ fontSize: '1.2rem' }}>
                We take over underperforming and mismanaged properties
              </h3>
              <p className="text-sub leading-[1.7] mb-6" style={{ fontSize: '0.9rem' }}>
                If you already own an asset that is underperforming, poorly managed, or simply needs a defined strategy, AxisPoint can step in as your asset manager. We assess the current state, identify operational gaps, and implement a corrective business plan.
              </p>
              <div className="flex flex-col gap-2.5 mb-7 flex-1">
                {[
                  'Comprehensive current-state assessment',
                  'Corrective business plan and stabilization',
                  'Debt placement and lender coordination',
                  'Disposition and exit strategy execution',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sub" style={{ fontSize: '0.88rem' }}>
                    <span className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-none text-purple font-bold text-xs bg-purple/10 border border-purple/20">✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <Link
                to="/contact"
                className="self-start px-6 py-2.5 rounded-button bg-purple text-white text-sm font-semibold hover:brightness-110 transition-all"
              >
                Tell us about your asset
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── What We Do ───────────────────────────────────── */}
      <section className="py-24 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv mb-10">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
              <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>What We Do</span>
            </div>
            <h2 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
              Three ways we work with clients
            </h2>
            <p className="text-sub leading-relaxed max-w-xl" style={{ fontSize: '1rem' }}>
              Every engagement starts with a conversation. We take the time to understand what you're building, what you can afford to wait on, and what you cannot afford to lose.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Asset Management */}
            <div className="rv d1 rounded-card bg-body border border-border p-7 flex flex-col hover:-translate-y-1 hover:shadow-card-hover hover:border-border-dark transition-all cursor-default" style={{ position: 'relative' }}>
              <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18M9 9h6M9 13h6M9 17h4"/></svg>
              </div>
              <h3 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: '1.1rem' }}>Asset Management</h3>
              <p className="text-sub leading-[1.7] flex-1" style={{ fontSize: '0.875rem' }}>
                Day-to-day oversight of your commercial property with institutional-grade processes, reporting, and accountability. We implement a defined business plan from day one and hold every vendor to performance benchmarks.
              </p>
              <Link to="/services" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
                Learn more
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
            </div>

            {/* Advisory */}
            <div className="rv d2 rounded-card bg-body border border-border p-7 flex flex-col hover:-translate-y-1 hover:shadow-card-hover hover:border-border-dark transition-all cursor-default">
              <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: '1.1rem' }}>Advisory and Acquisitions</h3>
              <p className="text-sub leading-[1.7] flex-1" style={{ fontSize: '0.875rem' }}>
                Clear scenarios for buying, selling, and planning. We source and underwrite deals on your behalf, stress-test every assumption, and give you the information you need to make confident decisions before committing capital.
              </p>
              <Link to="/services" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-purple hover:underline">
                Learn more
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
            </div>

            {/* Referral */}
            <div className="rv d3 rounded-card bg-body border border-border p-7 flex flex-col hover:-translate-y-1 hover:shadow-card-hover hover:border-border-dark transition-all cursor-default">
              <div className="w-10 h-10 rounded-lg bg-magenta/10 flex items-center justify-center mb-5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: '1.1rem' }}>Referral Partner Program</h3>
              <p className="text-sub leading-[1.7] flex-1" style={{ fontSize: '0.875rem' }}>
                For CPAs, attorneys, and financial advisors who serve clients with real estate exposure or interest. We become the CRE specialist you refer to, deepening your client relationships without adding overhead to your practice.
              </p>
              <Link to="/services" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-magenta hover:underline">
                Learn more
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Team ─────────────────────────────────────── */}
      <section className="py-24 bg-body">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv mb-10">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
              <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>The Team</span>
            </div>
            <h2 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
              Two specialists. One firm.
            </h2>
            <p className="text-sub leading-relaxed max-w-xl" style={{ fontSize: '1rem' }}>
              When you work with AxisPoint, you deal with Zachary and Ethaniel directly, from the first call through every decision along the way.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zachary */}
            <div className="rv d1 rounded-card bg-card border border-border overflow-hidden shadow-card hover:-translate-y-0.5 hover:shadow-card-hover transition-all">
              <div className="h-1 bg-gradient-to-r from-teal to-[#1b8fa8]" />
              <div className="p-7">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-[12px] bg-teal/10 border border-teal/30 flex items-center justify-center flex-none">
                    <span className="font-serif font-semibold text-teal text-lg">ZR</span>
                  </div>
                  <div>
                    <div className="font-serif font-semibold text-ink" style={{ fontSize: '1.05rem' }}>Zachary Russell</div>
                    <div className="text-teal font-semibold uppercase tracking-widest" style={{ fontSize: '0.72rem' }}>Partner</div>
                  </div>
                </div>
                <div className="h-px bg-border mb-4" />
                <p className="text-sub leading-[1.7] mb-5" style={{ fontSize: '0.875rem' }}>
                  Zachary leads multifamily acquisitions and asset management at AxisPoint. With deep transactional experience across Houston and secondary Texas markets, he focuses on Class B and C workforce housing. These are value-add properties where a disciplined CapEx program and active management drives meaningful rent growth and long-term appreciation.
                </p>
                <Link to="/team" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
                  Full profile
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
              </div>
            </div>

            {/* Ethaniel */}
            <div className="rv d2 rounded-card bg-card border border-border overflow-hidden shadow-card hover:-translate-y-0.5 hover:shadow-card-hover transition-all">
              <div className="h-1 bg-gradient-to-r from-purple to-[#2c1f4a]" />
              <div className="p-7">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-[12px] bg-purple/10 border border-purple/30 flex items-center justify-center flex-none">
                    <span className="font-serif font-semibold text-purple text-lg">EV</span>
                  </div>
                  <div>
                    <div className="font-serif font-semibold text-ink" style={{ fontSize: '1.05rem' }}>Ethaniel Vu</div>
                    <div className="text-purple font-semibold uppercase tracking-widest" style={{ fontSize: '0.72rem' }}>Partner</div>
                  </div>
                </div>
                <div className="h-px bg-border mb-4" />
                <p className="text-sub leading-[1.7] mb-5" style={{ fontSize: '0.875rem' }}>
                  Ethaniel oversees commercial asset management and leasing at AxisPoint. As a TREC-licensed real estate professional, he brings direct operational experience across industrial, retail, office, and NNN assets throughout Texas. He focuses on properties where active management and strategic leasing unlock value that passive ownership misses.
                </p>
                <Link to="/team" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple hover:underline">
                  Full profile
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Insights from the field ──────────────────────── */}
      <section className="py-24 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          {/* Header row */}
          <div className="rv flex justify-between items-end flex-wrap gap-5 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-3.5">
                <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
                <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Learn and Read</span>
              </div>
              <h2 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
                Insights from the field
              </h2>
              <p className="text-sub leading-relaxed max-w-[520px]" style={{ fontSize: '1rem' }}>
                Articles, guides, and papers written by Zachary and Ethaniel on commercial real estate strategy, asset management, and the Texas market.
              </p>
            </div>
            <Link
              to="/learn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-button bg-body border border-border text-sub text-sm font-semibold hover:text-ink hover:border-border-dark transition-all"
            >
              View all
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Empty state */}
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-teal/10 border border-teal/20 flex items-center justify-center mx-auto mb-5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#24a5bc" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: '1.4rem' }}>Articles coming soon</h3>
            <p className="text-sub leading-[1.7] max-w-sm mx-auto" style={{ fontSize: '0.9rem' }}>
              We are writing guides and insights based on what we see in the field.
            </p>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────── */}
      <section className="relative py-24 bg-gradient-to-br from-[#2d1f50] to-ink overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-teal/8 blur-[80px]" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-purple/8 blur-[80px]" />
        </div>
        <div className="relative max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-[680px]">
            <h2 className="font-serif font-semibold text-white mb-4" style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', lineHeight: 1.15 }}>
              Ready to talk about your real estate?
            </h2>
            <p className="text-white/75 leading-[1.7] mb-8" style={{ fontSize: '1rem' }}>
              We are selective about the capital we work with and the assets we take on, because our name is on every deal we manage. If there's a fit, we'll know early.
            </p>
            <div className="flex flex-wrap gap-3 mb-5">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-teal/25"
              >
                Start a Conversation
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
              <Link
                to="/services"
                className="px-7 py-3.5 rounded-button border border-white/20 text-white font-semibold hover:bg-white/8 transition-all"
              >
                View Our Services
              </Link>
            </div>
            <p className="text-hint" style={{ fontSize: '0.82rem' }}>Introductory calls are 30 minutes. No obligation.</p>
          </div>
        </div>
      </section>

    </div>
  );
}

export default HomePage;
