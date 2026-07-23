import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import SplitHero from '../components/SplitHero';

/* Restrained tracked micro-label. Used sparingly, not on every section. */
function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="uppercase font-semibold" style={{ fontSize: '0.66rem', letterSpacing: '0.15em', color: light ? '#8FD4E0' : '#1A8799' }}>
      {children}
    </div>
  );
}

/* The scope of property management, grouped as a spec sheet rather than a card grid. */
const SCOPE: { title: string; caption: string; items: [string, string][] }[] = [
  {
    title: 'Operations',
    caption: 'The physical property',
    items: [
      ['Leasing coordination', 'Renewals, new leases, and turnover managed to protect occupancy and rent roll.'],
      ['Maintenance and work orders', 'Requests triaged, tracked, and closed, with preventive work scheduled ahead of failures.'],
      ['Vendor management', 'Vendors selected, directed, and held to a standard, and replaced when they miss it.'],
    ],
  },
  {
    title: 'Financial',
    caption: 'The money',
    items: [
      ['Rent collection', 'Receivables pursued on a consistent process, with delinquencies handled before they become losses.'],
      ['Payables and accounting', 'Invoices handled and books kept current, so the numbers are always reconciled.'],
      ['Budget tracking', 'Spend measured against budget through the year, not discovered at the end of it.'],
    ],
  },
  {
    title: 'Reporting',
    caption: 'Your line of sight',
    items: [
      ['Monthly owner report', 'One clear document covering collections, occupancy, maintenance, and open decisions.'],
      ['Owner communication', 'One accountable point of contact for anything that needs an answer.'],
      ['Records and compliance', 'Leases, certificates, and documentation kept in order and accessible.'],
    ],
  },
];

function HomePage() {
  useReveal();

  return (
    <div className="min-h-screen">

      {/* ── 1. PM-dominant split hero ────────────────────── */}
      <SplitHero />

      {/* ── 2. Property Management operating scope ─────────── */}
      <section className="py-24 max-md:py-16 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-2xl mb-14 max-md:mb-10">
            <Label>Property Management</Label>
            <h2 className="font-serif font-semibold text-ink mt-4 mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.04, letterSpacing: '-0.015em' }}>
              What we take responsibility for
            </h2>
            <p className="text-sub leading-[1.75]" style={{ fontSize: '1.05rem' }}>
              Property management is the whole job, not a piece of it. AxisPoint takes responsibility
              for the operation end to end, so the property runs on a system instead of on your
              attention.
            </p>
          </div>

          <div className="rv d1 border-t border-border">
            {SCOPE.map((group) => (
              <div key={group.title} className="grid md:grid-cols-[240px_1fr] gap-x-12 gap-y-6 py-9 border-b border-border">
                <div>
                  <h3 className="font-serif text-ink" style={{ fontSize: '1.5rem', lineHeight: 1.1 }}>{group.title}</h3>
                  <div className="text-hint mt-1.5" style={{ fontSize: '0.78rem' }}>{group.caption}</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-12 gap-y-6">
                  {group.items.map(([term, desc]) => (
                    <div key={term}>
                      <div className="font-semibold text-ink mb-1.5" style={{ fontSize: '0.92rem' }}>{term}</div>
                      <p className="text-sub leading-[1.6]" style={{ fontSize: '0.85rem' }}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Owner visibility and reporting ──────────────── */}
      <section className="py-24 max-md:py-16 bg-body">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-14 max-md:gap-10">
            <div className="rv">
              <Label>Owner visibility</Label>
              <h2 className="font-serif font-semibold text-ink mt-4 mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.04, letterSpacing: '-0.015em' }}>
                You see the same picture we do
              </h2>
              <p className="text-sub leading-[1.75] max-w-md" style={{ fontSize: '1.05rem' }}>
                Good management is being able to see the execution clearly and knowing who is
                responsible for it. You are never guessing about how the property is doing, and you are
                never chasing an update.
              </p>
            </div>
            <div className="rv d1 md:pt-2">
              <div className="border-t border-border">
                {[
                  ['Monthly owner reporting', 'One clear report each month, delivered on a fixed cadence.'],
                  ['Full operating visibility', 'Collections, occupancy, leasing, and maintenance, all in one place.'],
                  ['Decisions surfaced early', 'Anything that needs your call comes to you with the context to decide.'],
                  ['One accountable point of contact', 'Between reports, one team answers for the property.'],
                  ['Records kept accessible', 'Leases, financials, and documentation available whenever you need them.'],
                ].map(([term, desc]) => (
                  <div key={term} className="grid grid-cols-[0.85fr_1.15fr] max-md:grid-cols-1 gap-x-8 gap-y-1 py-5 border-b border-border">
                    <div className="text-ink font-semibold" style={{ fontSize: '0.92rem' }}>{term}</div>
                    <p className="text-sub leading-[1.6]" style={{ fontSize: '0.85rem' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Asset Management upgrade layer (dark band) ──── */}
      <section className="py-24 max-md:py-16" style={{ background: 'linear-gradient(180deg,#2A1E47 0%,#1C1628 100%)' }}>
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="grid md:grid-cols-[0.95fr_1.05fr] gap-14 max-md:gap-10">
            <div className="rv">
              <Label light>The upgrade layer</Label>
              <h2 className="font-serif font-semibold text-white mt-4 mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.04, letterSpacing: '-0.015em' }}>
                Add asset management when you want strategy
              </h2>
              <p className="leading-[1.75] mb-6 max-w-md" style={{ fontSize: '1.02rem', color: '#C3BFCA' }}>
                Property management runs the property. Asset management directs the investment. For
                owners who want AxisPoint responsible for the larger plan, it sits on top of the same
                operating foundation, never in place of it.
              </p>
              <Link to="/services#asset-management" className="inline-flex items-center gap-2 text-white font-semibold border-b border-white/40 pb-0.5 hover:border-white transition-colors" style={{ fontSize: '0.9rem' }}>
                Compare property management and asset management
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
            </div>
            <div className="rv d1 md:pt-2">
              <div className="border-t border-white/15">
                {[
                  ['Business plan and budgets', 'A defined plan with milestones, an operating budget, and performance benchmarks.'],
                  ['Capital planning', 'CapEx scoped, sequenced, and overseen from budget to completion.'],
                  ['Debt and refinancing', 'Lender relationships and refinancing decisions managed as the asset performs.'],
                  ['Hold, sell, or refinance strategy', 'An honest read on the next move, backed by the numbers.'],
                ].map(([term, desc]) => (
                  <div key={term} className="grid grid-cols-[0.9fr_1.1fr] max-md:grid-cols-1 gap-x-8 gap-y-1 py-5 border-b border-white/15">
                    <div className="text-white font-medium" style={{ fontSize: '0.95rem' }}>{term}</div>
                    <p className="leading-[1.6]" style={{ fontSize: '0.84rem', color: '#A79FB6' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Property Management-led final CTA ────────────── */}
      <section className="py-24 max-md:py-16 bg-card border-t border-border">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-3xl">
            <h2 className="font-serif font-semibold text-ink mb-5" style={{ fontSize: 'clamp(2.1rem,4vw,3.2rem)', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
              Hand off the day-to-day.
            </h2>
            <p className="text-sub leading-[1.75] mb-8 max-w-xl" style={{ fontSize: '1.05rem' }}>
              Tell us about your property and what needs to change. We will follow up with the right
              questions and an honest read on whether there is a fit.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 max-md:flex-col max-md:items-stretch">
              <Link
                to="/contact?intent=property-management"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all"
              >
                Manage my property
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
              <Link to="/contact" className="text-ink font-semibold border-b border-border pb-0.5 hover:border-ink transition-colors max-md:text-center" style={{ fontSize: '0.95rem' }}>
                Talk with our team
              </Link>
            </div>
            <p className="text-hint mt-6" style={{ fontSize: '0.82rem' }}>Introductory calls are 30 minutes. No obligation.</p>
          </div>
        </div>
      </section>

    </div>
  );
}

export default HomePage;
