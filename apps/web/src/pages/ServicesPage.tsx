import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

type Tab = 'asset' | 'advisory' | 'takeover' | 'referral';

const TABS: { id: Tab; label: string }[] = [
  { id: 'asset', label: 'Asset Management' },
  { id: 'advisory', label: 'Advisory and Acquisitions' },
  { id: 'takeover', label: 'Asset Takeover' },
  { id: 'referral', label: 'Referral Partners' },
];

function SvcItem({ color, icon, title, description }: { color: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 py-5 border-b border-border last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none mt-0.5 ${color}`}>
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-ink mb-1.5" style={{ fontSize: '0.95rem' }}>{title}</h4>
        <p className="text-sub leading-[1.7]" style={{ fontSize: '0.875rem' }}>{description}</p>
      </div>
    </div>
  );
}

function SidePanel({ btnColor, title, body, note, ctaText, ctaTo }: {
  color?: string; btnColor: string; title: string; body: string; note?: string; ctaText: string; ctaTo: string;
}) {
  return (
    <div className="rounded-[16px] text-white p-7 sticky" style={{ background: '#2A1E47', border: '1px solid rgba(255,255,255,0.10)', top: 'calc(68px + 56px + 24px)' }}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-4 text-white/60" style={{ letterSpacing: '0.1em' }}>Who this is for</div>
      <div className="font-serif font-semibold text-white mb-3 leading-snug" style={{ fontSize: '1.1rem' }}>{title}</div>
      <p className="text-white leading-[1.7] mb-4" style={{ fontSize: '0.875rem' }}>{body}</p>
      {note && (
        <>
          <div className="h-px bg-white/10 mb-4" />
          <p className="text-white/70 leading-[1.6] mb-5" style={{ fontSize: '0.8rem' }}>{note}</p>
        </>
      )}
      <Link
        to={ctaTo}
        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-button text-white text-sm font-semibold hover:brightness-110 transition-all ${btnColor}`}
      >
        {ctaText}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </Link>
      <div className="text-center text-hint mt-2" style={{ fontSize: '0.72rem' }}>30 minute intro call, no obligation</div>
    </div>
  );
}

function ServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('asset');
  useReveal();

  return (
    <div className="min-h-screen">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-[#2d1f50] to-ink pt-[calc(68px+28px)] md:pt-[calc(68px+64px)] pb-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full bg-teal/8 blur-[80px]" />
          <div className="absolute bottom-0 right-1/3 w-80 h-80 rounded-full bg-purple/8 blur-[80px]" />
        </div>
        <div className="relative max-w-[1160px] mx-auto px-7">
          <div className="rv inline-flex items-center gap-2 px-4 py-1.5 rounded-chip bg-teal/10 border border-teal/30 text-teal text-eyebrow font-semibold mb-5 tracking-wider">
            What We Offer
          </div>
          <h1 className="rv d1 font-serif font-semibold text-white leading-[1.1] mb-3.5" style={{ fontSize: 'clamp(2.4rem,4.5vw,3.6rem)' }}>
            Services built around <em className="not-italic text-teal">your</em> situation
          </h1>
          <p className="rv d2 text-white/60 leading-[1.7] max-w-[520px]" style={{ fontSize: '1.05rem' }}>
            Every engagement starts with a conversation. Before we look at a single asset on your behalf, we take the time to understand what you are building, what you can afford to wait on, and what you cannot afford to lose.
          </p>
        </div>
      </section>

      {/* ── Tab Bar ──────────────────────────────────────── */}
      <div className="sticky z-40 bg-card border-b border-border" style={{ top: 68 }}>
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="flex gap-0 overflow-x-auto tab-scroll">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-none px-5 py-4 text-sm border-b-2 border-transparent transition-colors whitespace-nowrap -mb-px ${
                    active
                      ? 'md:border-purple text-purple font-semibold'
                      : 'text-hint hover:text-sub font-medium'
                  }`}
                >
                  {/* On mobile the active indicator hugs the text width via an
                      inner span; desktop keeps the original full-width underline. */}
                  <span className={active ? 'max-md:inline-block max-md:border-b-2 max-md:border-purple max-md:pb-1' : undefined}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Asset Management ─────────────────────────────── */}
      {activeTab === 'asset' && (
        <>
          <section className="py-20 bg-card">
            <div className="max-w-[1160px] mx-auto px-7">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
                <div className="rv">
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
                    <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Asset Management</span>
                  </div>
                  <h2 className="font-serif font-semibold text-ink mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
                    Day-to-day oversight. Defined outcomes.
                  </h2>
                  <p className="text-sub leading-[1.7] mb-6 max-w-2xl" style={{ fontSize: '0.95rem' }}>
                    Most investors who own real estate directly are not actually managing their asset. They are reacting to it. Without a dedicated asset manager, CapEx projects stall, property managers operate without accountability, and reporting gaps leave investors making decisions without accurate information. AxisPoint changes that dynamic from day one.
                  </p>
                  <div>
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
                      title="CapEx business plan development and oversight"
                      description="We develop a defined capital improvement program and manage execution from start to finish, holding contractors to schedule and budget."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                      title="Third-party property management supervision"
                      description="We supervise your property manager, hold them to performance benchmarks, and replace them if they are not performing. You are not managing the manager. We are."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                      title="Monthly financial reporting and investor communication"
                      description="You receive clean, accurate monthly reports. No surprises. No gaps. You always know exactly where your asset stands."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                      title="Debt placement and lender coordination"
                      description="We manage lender relationships, coordinate refinancing, and optimize your debt structure as the asset performs and market conditions evolve."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
                      title="Disposition and exit strategy execution"
                      description="When it is time to sell, we prepare the asset, position it for market, and manage the disposition process through closing."
                    />
                  </div>
                </div>
                <div className="rv d2">
                  <SidePanel
                    color="text-teal"
                    btnColor="bg-teal"
                    title="Property owners who want institutional-grade oversight without institutional minimums"
                    body="Whether you own a single multifamily property or a growing portfolio across Texas markets, AxisPoint brings the same disciplined management structure to your asset. You maintain full ownership. We do the work."
                    note="Our specialty is Class B and C workforce housing in primary and secondary Texas markets, and commercial assets across all classes including industrial, retail, office, and NNN."
                    ctaText="Talk to us about your property"
                    ctaTo="/contact"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Underwriting section */}
          <section className="py-20 bg-body">
            <div className="max-w-[1160px] mx-auto px-7 rv">
              <div className="flex items-center gap-2.5 mb-3.5">
                <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
                <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Our Underwriting Standard</span>
              </div>
              <h2 className="font-serif font-semibold text-ink mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
                We underwrite to what we can defend
              </h2>
              <p className="text-sub leading-[1.7] mb-10 max-w-2xl" style={{ fontSize: '0.95rem' }}>
                Our assumptions account for full market-rate property taxes, insurance at current replacement costs, realistic vacancy, and normalized operating expenses. Not seller-reported numbers. We stress-test every deal before committing capital.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { num: '01', numColor: 'text-teal/40', title: 'Conservative by design', desc: "We do not underwrite to a best case. We underwrite to what we can defend under pressure. Our goal is to protect the downside first and let the value-add execution drive upside." },
                  { num: '02', numColor: 'text-purple/40', title: 'Stress-tested assumptions', desc: 'Every deal is stress-tested before we recommend it. We run scenarios at higher vacancy, higher expenses, and lower rent growth to understand the floor before we commit.' },
                  { num: '03', numColor: 'text-magenta/40', title: 'Operators first', desc: 'Our underwriting reflects what we know from managing assets on the ground, not just modeling them on a spreadsheet. We have lived the scenarios we underwrite to.' },
                ].map((card) => (
                  <div key={card.num} className="rounded-card bg-card border border-border p-7">
                    <div className={`font-serif font-semibold mb-4 ${card.numColor}`} style={{ fontSize: '2.5rem' }}>{card.num}</div>
                    <h4 className="font-semibold text-ink mb-2" style={{ fontSize: '1rem' }}>{card.title}</h4>
                    <p className="text-sub leading-[1.7]" style={{ fontSize: '0.875rem' }}>{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Advisory and Acquisitions ────────────────────── */}
      {activeTab === 'advisory' && (
        <section className="py-20 bg-card">
          <div className="max-w-[1160px] mx-auto px-7">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
              <div className="rv">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
                  <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Advisory and Acquisitions</span>
                </div>
                <h2 className="font-serif font-semibold text-ink mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
                  Clear scenarios before you commit capital.
                </h2>
                <p className="text-sub leading-[1.7] mb-6 max-w-2xl" style={{ fontSize: '0.95rem' }}>
                  We source and underwrite deals on your behalf, model the scenarios you need to see, and give you the information required to make a confident decision. No cheerleading. No best-case projections. Just an honest read of what the asset can do and what it will take to get there.
                </p>
                <div>
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                    title="Acquisition sourcing across all asset classes"
                    description="We source on-market and off-market opportunities across multifamily, industrial, retail, office, and commercial throughout Texas markets where our relationships run deep."
                  />
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
                    title="Underwriting and deal analysis"
                    description="Conservative assumptions, stress-tested scenarios, and a clear picture of what the asset can deliver and what risk you are taking to get there."
                  />
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
                    title="Market comparables and valuation"
                    description="We pull current market data, run comparables, and give you an independent read on value before you make an offer or accept one."
                  />
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>}
                    title="1031 exchange coordination"
                    description="If you are in a 1031 exchange situation, we help identify replacement properties that fit your timeline, basis requirements, and investment objectives."
                  />
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>}
                    title="Portfolio planning and strategy"
                    description="For clients building toward a larger portfolio, we help you think through sequencing, risk exposure, and how each acquisition fits the long-term picture."
                  />
                </div>
              </div>
              <div className="rv d2">
                <SidePanel
                  color="text-purple"
                  btnColor="bg-purple"
                  title="Investors who want an honest read before committing"
                  body="If you have a deal in front of you and want to know what it actually is, or if you want us to source and underwrite opportunities on your behalf, Advisory is where we start. Every asset management engagement begins here."
                  note="Advisory services are also available for CPAs and attorneys with clients evaluating a real estate transaction. We provide the analysis. You stay in your lane."
                  ctaText="Bring us a deal to look at"
                  ctaTo="/contact"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Asset Takeover ───────────────────────────────── */}
      {activeTab === 'takeover' && (
        <section className="py-20 bg-card">
          <div className="max-w-[1160px] mx-auto px-7">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
              <div className="rv">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
                  <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Asset Takeover</span>
                </div>
                <h2 className="font-serif font-semibold text-ink mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
                  It is never too late to put a real structure in place.
                </h2>
                <p className="text-sub leading-[1.7] mb-6 max-w-2xl" style={{ fontSize: '0.95rem' }}>
                  Not every client is starting from scratch. If you already own an asset that is underperforming, poorly managed, or simply running without a defined strategy, AxisPoint can step in as your asset manager. We assess the current state of the asset, identify operational gaps, implement a corrective business plan, and take over day-to-day oversight on your behalf.
                </p>
                <div>
                  <SvcItem
                    color="bg-magenta/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                    title="Current-state assessment"
                    description="We begin with a thorough assessment of the asset, the existing management, the leasing situation, the financials, and any deferred maintenance or CapEx that has been ignored."
                  />
                  <SvcItem
                    color="bg-magenta/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
                    title="Corrective business plan"
                    description="Based on the assessment, we build a corrective business plan with defined milestones, a realistic CapEx budget, and measurable performance targets."
                  />
                  <SvcItem
                    color="bg-magenta/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                    title="Management transition and stabilization"
                    description="We handle the transition from your existing management structure, implement new vendor relationships where needed, and stabilize operations as quickly as possible."
                  />
                  <SvcItem
                    color="bg-magenta/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
                    title="Ongoing asset management"
                    description="Once stabilized, we continue as your asset manager with the same reporting, accountability, and oversight we bring to every engagement."
                  />
                </div>
              </div>
              <div className="rv d2">
                <SidePanel
                  color="text-magenta"
                  btnColor="bg-magenta"
                  title="Owners with an asset that is not performing the way it should"
                  body="Whether you acquired the asset recently or have owned it for years, the situation is the same. You own a property that needs a real management structure. We can provide it."
                  note="Takeover engagements can happen quickly. If you have a situation that needs attention, the first call is the right place to start."
                  ctaText="Tell us about your situation"
                  ctaTo="/contact"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Referral Partners ────────────────────────────── */}
      {activeTab === 'referral' && (
        <section className="py-20 bg-card">
          <div className="max-w-[1160px] mx-auto px-7">
            <div className="rv mb-10">
              <div className="flex items-center gap-2.5 mb-3.5">
                <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
                <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Referral Partner Program</span>
              </div>
              <h2 className="font-serif font-semibold text-ink mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
                Your clients have real estate. We help them manage it well.
              </h2>
              <p className="text-sub leading-[1.7] max-w-2xl" style={{ fontSize: '0.95rem' }}>
                CPAs, attorneys, and financial advisors are often the first call when a client has a real estate question. AxisPoint becomes the CRE specialist in your network, deepening your client relationships without adding overhead to your practice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {[
                {
                  color: 'teal', bar: 'bg-teal', badge: 'bg-teal/10 text-teal border-teal/20',
                  title: 'For CPAs and Tax Advisors',
                  body: 'Your clients with real estate holdings need someone who understands the asset side as well as you understand the tax side. We provide deal analysis, asset oversight, and acquisition support. You stay in your lane. We stay in ours. Together you give your client a complete picture.',
                },
                {
                  color: 'purple', bar: 'bg-purple', badge: 'bg-purple/10 text-purple border-purple/20',
                  title: 'For Attorneys',
                  body: 'When your clients are buying, selling, or inheriting commercial real estate, they need operational guidance that goes beyond the transaction itself. We provide pre-acquisition underwriting and ongoing asset management that protects their position after closing.',
                },
                {
                  color: 'magenta', bar: 'bg-magenta', badge: 'bg-magenta/10 text-magenta border-magenta/20',
                  title: 'For Financial Advisors',
                  body: 'Clients looking to diversify into commercial real estate often come to you first. We handle the CRE piece, provide institutional-grade reporting, and keep you informed so you can continue to serve the whole client relationship.',
                },
              ].map((card, i) => (
                <div key={card.title} className={`rv d${i + 1} rounded-card bg-body border border-border overflow-hidden flex flex-col`}>
                  <div className={`h-1 ${card.bar}`} />
                  <div className="p-7 flex flex-col flex-1">
                    <h3 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: '1.1rem' }}>{card.title}</h3>
                    <p className="text-sub leading-[1.7] flex-1" style={{ fontSize: '0.875rem' }}>{card.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA row */}
            <div className="rv d2 rounded-card text-white p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" style={{ background: '#2A1E47', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div>
                <h3 className="font-serif font-semibold text-white mb-2" style={{ fontSize: '1.2rem' }}>How to refer a client</h3>
                <p className="text-white leading-[1.7] max-w-lg" style={{ fontSize: '0.875rem' }}>
                  Send us an introduction and we take it from there. We handle the client conversation, provide a clear summary of what we discussed, and loop you back in so you are never out of the picture. Your client relationship stays yours.
                </p>
              </div>
              <Link
                to="/contact"
                className="flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button bg-purple text-white font-semibold text-sm hover:brightness-110 transition-all whitespace-nowrap max-md:w-full"
              >
                Become a referral partner
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Closing CTA ──────────────────────────────────── */}
      <div className="relative py-20 bg-gradient-to-br from-[#2d1f50] to-ink overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 w-80 h-80 rounded-full bg-teal/6 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-80 h-80 rounded-full bg-purple/5 blur-[80px]" />
        <div className="relative max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-[600px] mx-auto text-center">
            <h2 className="font-serif font-semibold text-white mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
              Not sure which service fits?
            </h2>
            <p className="text-white/75 leading-[1.7] mb-8" style={{ fontSize: '1rem' }}>
              That is what the first call is for. Tell us about your situation and we will tell you honestly whether there is a fit and what it looks like.
            </p>
            <div className="flex flex-wrap gap-3 justify-center max-md:flex-col">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-teal/20 max-md:w-full"
              >
                Book a 30-minute call
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
              <Link
                to="/team"
                className="px-7 py-3.5 rounded-button border border-white/20 text-white font-semibold hover:bg-white/8 transition-all text-center max-md:w-full"
              >
                Meet the team first
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default ServicesPage;
