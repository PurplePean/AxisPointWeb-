import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

type Tab = 'asset' | 'advisory' | 'referral';

const TABS: { id: Tab; label: string }[] = [
  { id: 'asset', label: 'Asset Management' },
  { id: 'advisory', label: 'Advisory and Acquisitions' },
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

function SidePanel({ btnColor, title, body, note, ctaText, ctaTo, sticky = true }: {
  color?: string; btnColor: string; title: string; body: string; note?: string; ctaText: string; ctaTo: string; sticky?: boolean;
}) {
  return (
    <div className={`rounded-[16px] text-white p-7 ${sticky ? 'sticky' : ''}`} style={{ background: '#2A1E47', border: '1px solid rgba(255,255,255,0.10)', ...(sticky ? { top: 'calc(68px + 56px + 24px)' } : {}) }}>
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

/* ── Mobile accordion (md:hidden) ───────────────────────────
   Same copy/data as the desktop tabs, stacked vertically so the
   three services never overflow horizontally on small screens.   */

function MHead({ eyebrow, heading, description }: { eyebrow: string; heading: string; description: string }) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-2.5 mb-3">
        <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
        <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>{eyebrow}</span>
      </div>
      <h3 className="font-serif font-semibold text-ink mb-3" style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>{heading}</h3>
      <p className="text-sub leading-[1.7] mb-5" style={{ fontSize: '0.9rem' }}>{description}</p>
    </div>
  );
}

function MobileAsset() {
  const teal = { color: 'bg-teal/10' };
  return (
    <>
      <MHead
        eyebrow="Asset Management"
        heading="Your asset. Our full attention."
        description="Whether you're acquiring your first commercial property or inheriting a management problem, the engagement starts the same way — an honest conversation and a real plan. Most property owners are reacting to their asset, not managing it. Vendors go unaccountable, CapEx gets deferred, reporting gaps leave you making decisions without accurate numbers. AxisPoint changes that from day one. We step in as your dedicated asset manager — whether you're starting clean or taking over a situation — and run your asset the way it should be run."
      />
      <div className="mb-6">
        <SvcItem {...teal}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          title="Current-state assessment"
          description="We start with an honest review of where the asset actually stands. Financials, operations, leasing, deferred maintenance. No assumptions."
        />
        <SvcItem {...teal}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
          title="Business plan and strategy"
          description="Based on the assessment we build a defined plan with clear milestones, a realistic CapEx program, and measurable performance targets."
        />
        <SvcItem {...teal}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          title="CapEx oversight and execution"
          description="We manage every capital project from scope to completion, holding contractors to schedule and budget."
        />
        <SvcItem {...teal}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          title="Third-party property management supervision"
          description="We supervise your property manager, hold them to benchmarks, and replace them if they aren't performing. You are not managing the manager. We are."
        />
        <SvcItem {...teal}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
          title="Monthly financial reporting"
          description="Clean, accurate monthly reports. No surprises. You always know exactly where your asset stands."
        />
        <SvcItem {...teal}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          title="Debt placement and lender coordination"
          description="We manage lender relationships, coordinate refinancing, and optimize your debt structure as the asset performs."
        />
        <SvcItem {...teal}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
          title="Disposition and exit strategy"
          description="When it's time to sell, we prepare the asset, position it for market, and manage the process through closing."
        />
      </div>
      <SidePanel
        sticky={false}
        btnColor="bg-teal"
        title="For property owners who want institutional-grade oversight without institutional minimums"
        body="Whether you own one asset or a growing portfolio across Texas, AxisPoint brings the same disciplined management structure to every engagement. You maintain full ownership. We do the work."
        ctaText="Talk to us about your property"
        ctaTo="/contact"
      />
      {/* Underwriting standard — cards kept at gap-6 on mobile */}
      <div className="mt-8">
        <MHead
          eyebrow="Our Underwriting Standard"
          heading="We underwrite to what we can defend"
          description="Our assumptions account for full market-rate property taxes, insurance at current replacement costs, realistic vacancy, and normalized operating expenses. Not seller-reported numbers. We stress-test every deal before committing capital."
        />
        <div className="grid grid-cols-1 gap-6">
          {[
            { num: '01', numColor: 'text-teal/40', title: 'Conservative by design', desc: "We do not underwrite to a best case. We underwrite to what we can defend under pressure. Our goal is to protect the downside first and let the value-add execution drive upside." },
            { num: '02', numColor: 'text-purple/40', title: 'Stress-tested assumptions', desc: 'Every deal is stress-tested before we recommend it. We run scenarios at higher vacancy, higher expenses, and lower rent growth to understand the floor before we commit.' },
            { num: '03', numColor: 'text-magenta/40', title: 'Operators first', desc: 'Our underwriting reflects what we know from managing assets on the ground, not just modeling them on a spreadsheet. We have lived the scenarios we underwrite to.' },
          ].map((card) => (
            <div key={card.num} className="rounded-card bg-body border border-border p-6">
              <div className={`font-serif font-semibold mb-3 ${card.numColor}`} style={{ fontSize: '2rem' }}>{card.num}</div>
              <h4 className="font-semibold text-ink mb-2" style={{ fontSize: '1rem' }}>{card.title}</h4>
              <p className="text-sub leading-[1.7]" style={{ fontSize: '0.875rem' }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MobileAdvisory() {
  const purple = { color: 'bg-purple/10' };
  return (
    <>
      <MHead
        eyebrow="Advisory and Acquisitions"
        heading="Clear scenarios before you commit capital."
        description="We source and underwrite deals on your behalf, model the scenarios you need to see, and give you the information required to make a confident decision. No cheerleading. No best-case projections. Just an honest read of what the asset can do and what it will take to get there."
      />
      <div className="mb-6">
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
          title="Acquisition sourcing across all asset classes"
          description="We source on-market and off-market opportunities across multifamily, industrial, retail, office, and commercial throughout Texas markets where our relationships run deep."
        />
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
          title="Underwriting and deal analysis"
          description="Conservative assumptions, stress-tested scenarios, and a clear picture of what the asset can deliver and what risk you are taking to get there."
        />
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
          title="Market comparables and valuation"
          description="We pull current market data, run comparables, and give you an independent read on value before you make an offer or accept one."
        />
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>}
          title="1031 exchange coordination"
          description="If you are in a 1031 exchange situation, we help identify replacement properties that fit your timeline, basis requirements, and investment objectives."
        />
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>}
          title="Portfolio planning and strategy"
          description="For clients building toward a larger portfolio, we help you think through sequencing, risk exposure, and how each acquisition fits the long-term picture."
        />
      </div>
      <SidePanel
        sticky={false}
        btnColor="bg-purple"
        title="Investors who want an honest read before committing"
        body="If you have a deal in front of you and want to know what it actually is, or if you want us to source and underwrite opportunities on your behalf, Advisory is where we start. Every asset management engagement begins here."
        note="Advisory services are also available for CPAs and attorneys with clients evaluating a real estate transaction. We provide the analysis. You stay in your lane."
        ctaText="Bring us a deal to look at"
        ctaTo="/contact"
      />
    </>
  );
}

function MobileReferral() {
  const purple = { color: 'bg-purple/10' };
  return (
    <>
      <MHead
        eyebrow="Referral Partners"
        heading="You know people who could use this. We make it easy to connect them."
        description="You don't have to be in real estate to be a referral partner. You just have to know people who are thinking about it. Doctors, engineers, attorneys, business owners — a lot of people in high-earning professions are sitting on capital they don't know how to put to work in real estate, or they already own property that isn't performing the way it should. If you're connected to people like that, you can be a resource for them. We become your CRE team. You make the introduction. We take it from there and make you look good."
      />
      <div className="mb-6">
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
          title="Your own referral link"
          description="Share it however you want. When someone reaches out through your link, we know it came from you."
        />
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
          title="We handle everything"
          description="The conversation, the underwriting, the management. You stay connected and informed, but we do the work."
        />
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          title="Your relationship stays yours"
          description="We work alongside your network, not around it. Your clients and contacts stay yours."
        />
        <SvcItem {...purple}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>}
          title="Referral partners are recognized and rewarded"
          description="Every relationship you bring to AxisPoint is acknowledged. Reach out and we'll walk you through how it works."
        />
      </div>
      <SidePanel
        sticky={false}
        btnColor="bg-purple"
        title="For anyone who is connected to people with capital, existing assets, or an interest in commercial real estate"
        body="No real estate background required. If you know the right people, we do the rest."
        ctaText="Become a referral partner"
        ctaTo="/contact"
      />
    </>
  );
}

function MobilePanel({ id }: { id: Tab }) {
  switch (id) {
    case 'asset': return <MobileAsset />;
    case 'advisory': return <MobileAdvisory />;
    case 'referral': return <MobileReferral />;
  }
}

function MobileServices() {
  const [open, setOpen] = useState<Tab | null>('asset');
  return (
    <section className="md:hidden bg-card border-t border-border">
      <div className="max-w-[1160px] mx-auto px-6">
        {TABS.map((tab) => {
          const isOpen = open === tab.id;
          return (
            <div key={tab.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : tab.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 min-h-[56px] py-4 text-left"
              >
                <span className={`font-serif font-semibold transition-colors ${isOpen ? 'text-teal' : 'text-ink'}`} style={{ fontSize: '1.05rem' }}>
                  {tab.label}
                </span>
                <span className={`flex-none flex items-center justify-center transition-colors ${isOpen ? 'text-teal' : 'text-hint'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    {!isOpen && <line x1="12" y1="5" x2="12" y2="19" />}
                  </svg>
                </span>
              </button>
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                <div className="overflow-hidden">
                  <div className="pb-8">
                    <MobilePanel id={tab.id} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
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

      {/* ── Desktop: tab bar + tab content (mobile uses the accordion below) ── */}
      <div className="hidden md:block">

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
                    Your asset. Our full attention.
                  </h2>
                  <p className="text-sub leading-[1.7] mb-6 max-w-2xl" style={{ fontSize: '0.95rem' }}>
                    Whether you're acquiring your first commercial property or inheriting a management problem, the engagement starts the same way — an honest conversation and a real plan. Most property owners are reacting to their asset, not managing it. Vendors go unaccountable, CapEx gets deferred, reporting gaps leave you making decisions without accurate numbers. AxisPoint changes that from day one. We step in as your dedicated asset manager — whether you're starting clean or taking over a situation — and run your asset the way it should be run.
                  </p>
                  <div>
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                      title="Current-state assessment"
                      description="We start with an honest review of where the asset actually stands. Financials, operations, leasing, deferred maintenance. No assumptions."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
                      title="Business plan and strategy"
                      description="Based on the assessment we build a defined plan with clear milestones, a realistic CapEx program, and measurable performance targets."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
                      title="CapEx oversight and execution"
                      description="We manage every capital project from scope to completion, holding contractors to schedule and budget."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                      title="Third-party property management supervision"
                      description="We supervise your property manager, hold them to benchmarks, and replace them if they aren't performing. You are not managing the manager. We are."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                      title="Monthly financial reporting"
                      description="Clean, accurate monthly reports. No surprises. You always know exactly where your asset stands."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                      title="Debt placement and lender coordination"
                      description="We manage lender relationships, coordinate refinancing, and optimize your debt structure as the asset performs."
                    />
                    <SvcItem
                      color="bg-teal/10"
                      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
                      title="Disposition and exit strategy"
                      description="When it's time to sell, we prepare the asset, position it for market, and manage the process through closing."
                    />
                  </div>
                </div>
                <div className="rv d2">
                  <SidePanel
                    color="text-teal"
                    btnColor="bg-teal"
                    title="For property owners who want institutional-grade oversight without institutional minimums"
                    body="Whether you own one asset or a growing portfolio across Texas, AxisPoint brings the same disciplined management structure to every engagement. You maintain full ownership. We do the work."
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

      {/* ── Referral Partners ────────────────────────────── */}
      {activeTab === 'referral' && (
        <section className="py-20 bg-card">
          <div className="max-w-[1160px] mx-auto px-7">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
              <div className="rv">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div style={{ width: 24, height: 1.5, background: 'linear-gradient(90deg, #24a5bc, #38285d)', borderRadius: 2, flexShrink: 0 }} />
                  <span className="text-sub font-semibold uppercase tracking-[0.12em]" style={{ fontSize: '0.63rem' }}>Referral Partners</span>
                </div>
                <h2 className="font-serif font-semibold text-ink mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
                  You know people who could use this. We make it easy to connect them.
                </h2>
                <p className="text-sub leading-[1.7] mb-6 max-w-2xl" style={{ fontSize: '0.95rem' }}>
                  You don't have to be in real estate to be a referral partner. You just have to know people who are thinking about it. Doctors, engineers, attorneys, business owners — a lot of people in high-earning professions are sitting on capital they don't know how to put to work in real estate, or they already own property that isn't performing the way it should. If you're connected to people like that, you can be a resource for them. We become your CRE team. You make the introduction. We take it from there and make you look good.
                </p>
                <div>
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
                    title="Your own referral link"
                    description="Share it however you want. When someone reaches out through your link, we know it came from you."
                  />
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                    title="We handle everything"
                    description="The conversation, the underwriting, the management. You stay connected and informed, but we do the work."
                  />
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                    title="Your relationship stays yours"
                    description="We work alongside your network, not around it. Your clients and contacts stay yours."
                  />
                  <SvcItem
                    color="bg-purple/10"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>}
                    title="Referral partners are recognized and rewarded"
                    description="Every relationship you bring to AxisPoint is acknowledged. Reach out and we'll walk you through how it works."
                  />
                </div>
              </div>
              <div className="rv d2">
                <SidePanel
                  color="text-purple"
                  btnColor="bg-purple"
                  title="For anyone who is connected to people with capital, existing assets, or an interest in commercial real estate"
                  body="No real estate background required. If you know the right people, we do the rest."
                  ctaText="Become a referral partner"
                  ctaTo="/contact"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      </div>{/* ── /Desktop tab bar + content ── */}

      {/* ── Mobile: services accordion (md:hidden) ────────── */}
      <MobileServices />

      {/* ── Closing CTA ──────────────────────────────────── */}
      <div className="relative py-14 md:py-20 bg-gradient-to-br from-[#2d1f50] to-ink overflow-hidden">
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
