import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="uppercase font-semibold" style={{ fontSize: '0.66rem', letterSpacing: '0.15em', color: light ? '#8FD4E0' : '#1A8799' }}>
      {children}
    </div>
  );
}

/* Property management scope, grouped as a spec sheet (no icons, no cards). */
const SCOPE: { title: string; items: [string, string][] }[] = [
  {
    title: 'Operations',
    items: [
      ['Leasing coordination', 'Renewals, new leases, and turnover handled to protect occupancy and rent roll.'],
      ['Maintenance and work orders', 'Requests triaged, tracked, and closed, with preventive work scheduled ahead of failures.'],
      ['Vendor management', 'Vendors selected, directed, and held to a standard, and replaced when they miss it.'],
    ],
  },
  {
    title: 'Financial',
    items: [
      ['Rent collection', 'Receivables pursued on a consistent process, with delinquencies handled early.'],
      ['Payables and accounting', 'Invoices handled and books kept current, so the numbers are always reconciled.'],
      ['Budget tracking', 'Spend measured against budget through the year, not discovered at the end of it.'],
    ],
  },
  {
    title: 'Reporting',
    items: [
      ['Monthly owner report', 'One document covering collections, occupancy, maintenance, and open decisions.'],
      ['Owner communication', 'One accountable point of contact for anything that needs an answer.'],
      ['Records and compliance', 'Leases, certificates, and documentation kept in order and accessible.'],
    ],
  },
];

/* PM vs PM + AM comparison. `true` = included, `false` = not in that level. */
const COMPARE: { row: string; pm: boolean; am: boolean }[] = [
  { row: 'Day-to-day operations', pm: true, am: true },
  { row: 'Financial administration', pm: true, am: true },
  { row: 'Monthly owner reporting', pm: true, am: true },
  { row: 'Business plan and budgets', pm: false, am: true },
  { row: 'Capital planning', pm: false, am: true },
  { row: 'Debt and refinancing', pm: false, am: true },
  { row: 'Hold, sell, or refinance strategy', pm: false, am: true },
];

function Cell({ on }: { on: boolean }) {
  return on ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A8799" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><polyline points="20 6 9 17 4 12" /></svg>
  ) : (
    <span className="block text-center text-hint" aria-label="not included">–</span>
  );
}

function ServicesPage() {
  useReveal();

  return (
    <div className="min-h-screen">

      {/* ── 1. Typography-led hero ───────────────────────── */}
      <section className="bg-ink pt-[calc(68px+72px)] max-md:pt-[calc(68px+40px)] pb-20 max-md:pb-14">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv">
            <Label light>Services</Label>
            <h1 className="font-serif font-semibold text-white mt-5 mb-6 max-w-4xl" style={{ fontSize: 'clamp(2.6rem,5.2vw,4.4rem)', lineHeight: 0.98, letterSpacing: '-0.02em' }}>
              Property management first. <span className="text-teal">Strategy when the asset calls for it.</span>
            </h1>
            <p className="leading-[1.7] max-w-2xl" style={{ fontSize: '1.15rem', color: '#B9B4C2' }}>
              AxisPoint runs commercial property for owners across Texas. Start with the operating
              foundation, add ownership-level strategy when it creates value, and use investor services
              if you are entering commercial real estate for the first time.
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. Property Management operating scope ─────────── */}
      <section id="property-management" className="py-24 max-md:py-16 bg-card scroll-mt-[76px]">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-2xl mb-14 max-md:mb-10">
            <Label>Property Management</Label>
            <h2 className="font-serif font-semibold text-ink mt-4 mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.04, letterSpacing: '-0.015em' }}>
              The operating foundation
            </h2>
            <p className="text-sub leading-[1.75]" style={{ fontSize: '1.05rem' }}>
              This is where most engagements begin. Whether you are handing off self-management or
              replacing a manager who stopped performing, the operating layer is the same: AxisPoint
              takes responsibility for the property end to end.
            </p>
          </div>

          <div className="rv d1 border-t border-border">
            {SCOPE.map((group) => (
              <div key={group.title} className="grid md:grid-cols-[240px_1fr] gap-x-12 gap-y-6 py-9 border-b border-border">
                <h3 className="font-serif text-ink" style={{ fontSize: '1.5rem', lineHeight: 1.1 }}>{group.title}</h3>
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

          <div className="rv mt-10">
            <Link to="/contact?intent=property-management" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all">
              Manage my property
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. Owner reporting and accountability ──────────── */}
      <section className="py-24 max-md:py-16 bg-body">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-14 max-md:gap-10">
            <div className="rv">
              <Label>Reporting and accountability</Label>
              <h2 className="font-serif font-semibold text-ink mt-4 mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.04, letterSpacing: '-0.015em' }}>
                One report. One accountable team.
              </h2>
              <p className="text-sub leading-[1.75] max-w-md" style={{ fontSize: '1.05rem' }}>
                Good management is being able to see the execution clearly and knowing who is
                responsible for it. Every month you get one report, and between reports one team
                answers for the property.
              </p>
            </div>
            <div className="rv d1 md:pt-2">
              <div className="border-t border-border">
                {[
                  ['Every monthly report covers', 'Collections, occupancy and leasing, maintenance status, and the decisions that need your attention.'],
                  ['Delivered on a fixed cadence', 'The same report, the same rhythm, every month. No chasing for an update.'],
                  ['Vendors held to a standard', 'Performance benchmarks that vendors and any third party are measured against.'],
                  ['One point of contact', 'When something needs a decision, it comes to you with the context to make it.'],
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

      {/* ── 4. Asset Management add-on band (dark) ─────────── */}
      <section id="asset-management" className="py-24 max-md:py-16 scroll-mt-[76px]" style={{ background: 'linear-gradient(180deg,#2A1E47 0%,#1C1628 100%)' }}>
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="grid md:grid-cols-[0.95fr_1.05fr] gap-14 max-md:gap-10">
            <div className="rv">
              <Label light>The upgrade layer</Label>
              <h2 className="font-serif font-semibold text-white mt-4 mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.04, letterSpacing: '-0.015em' }}>
                Asset management, added on top
              </h2>
              <p className="leading-[1.75] max-w-md" style={{ fontSize: '1.02rem', color: '#C3BFCA' }}>
                Property management runs the property. Asset management directs the investment. It is an
                addition to the operating foundation for owners who want AxisPoint responsible for the
                larger plan, never a replacement for it.
              </p>
            </div>
            <div className="rv d1 md:pt-2">
              <div className="border-t border-white/15">
                {[
                  ['Business plan development', 'A defined plan with milestones and measurable performance targets.'],
                  ['Budgets and benchmarks', 'Operating budgets and benchmarks the property is measured against, month over month.'],
                  ['Capital planning', 'CapEx scoped, sequenced, and overseen from budget to completion.'],
                  ['Debt and refinancing', 'Lender coordination and refinancing decisions as the asset performs.'],
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

      {/* ── 5. PM versus PM + AM comparison ────────────────── */}
      <section className="py-24 max-md:py-16 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-2xl mb-10">
            <Label>How owners choose</Label>
            <h2 className="font-serif font-semibold text-ink mt-4 mb-4" style={{ fontSize: 'clamp(1.9rem,3.4vw,2.7rem)', lineHeight: 1.06, letterSpacing: '-0.015em' }}>
              Property management, or property management plus asset management
            </h2>
            <p className="text-sub leading-[1.7]" style={{ fontSize: '1rem' }}>
              Most owners start with the operating foundation. Asset management is there when you want a
              partner on the investment itself, on top of the same foundation.
            </p>
          </div>

          <div className="rv d1">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_130px_130px] max-md:grid-cols-[1fr_88px_88px] border-t-2 border-ink">
              <div className="py-4" />
              <div className="py-4 text-center">
                <div className="font-serif text-ink" style={{ fontSize: '1.05rem' }}>Property<br className="max-md:hidden" /> Management</div>
              </div>
              <div className="py-4 text-center border-l border-border">
                <div className="font-serif text-purple" style={{ fontSize: '1.05rem' }}>PM plus Asset<br className="max-md:hidden" /> Management</div>
              </div>
            </div>
            {COMPARE.map((r) => (
              <div key={r.row} className="grid grid-cols-[1fr_130px_130px] max-md:grid-cols-[1fr_88px_88px] border-t border-border items-center">
                <div className="py-4 text-ink pr-4" style={{ fontSize: '0.9rem' }}>{r.row}</div>
                <div className="py-4"><Cell on={r.pm} /></div>
                <div className="py-4 border-l border-border"><Cell on={r.am} /></div>
              </div>
            ))}
            <div className="border-t-2 border-ink" />
          </div>

          <div className="rv mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link to="/contact?intent=property-management" className="inline-flex items-center gap-2 px-6 py-3 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all">
              Start with property management
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <Link to="/contact" className="text-ink font-semibold border-b border-border pb-0.5 hover:border-ink transition-colors" style={{ fontSize: '0.92rem' }}>
              Ask about adding asset management
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. Compact Investor Services pathway ───────────── */}
      <section id="investor-services" className="py-20 max-md:py-14 bg-body border-t border-border scroll-mt-[76px]">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="grid md:grid-cols-[0.85fr_1.15fr] gap-12 max-md:gap-8 items-start">
            <div className="rv">
              <Label>Investor Services</Label>
              <h2 className="font-serif font-semibold text-ink mt-4 mb-4" style={{ fontSize: 'clamp(1.7rem,2.8vw,2.3rem)', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
                Entering commercial real estate
              </h2>
              <p className="text-sub leading-[1.7] mb-6 max-w-sm" style={{ fontSize: '0.98rem' }}>
                A selective, higher-touch path for capital-ready clients who do not yet have an
                operating team or a defined thesis. We help you enter, then manage what you acquire.
              </p>
              <Link to="/contact?intent=investor-services" className="inline-flex items-center gap-2 text-purple font-semibold border-b border-purple/40 pb-0.5 hover:border-purple transition-colors" style={{ fontSize: '0.92rem' }}>
                Discuss my investment criteria
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
            </div>
            <div className="rv d1">
              <ol className="border-t border-border">
                {[
                  'Define investment criteria',
                  'Source and underwrite opportunities',
                  'Due diligence and acquisition coordination',
                  'Property management after closing',
                  'Asset management when appropriate',
                ].map((step, i) => (
                  <li key={step} className="flex items-baseline gap-5 py-3.5 border-b border-border">
                    <span className="font-serif text-hint tabular-nums flex-none" style={{ fontSize: '0.95rem', width: '1.6rem' }}>{i + 1}</span>
                    <span className="text-ink" style={{ fontSize: '0.95rem' }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Property Management-led CTA ─────────────────── */}
      <section className="py-24 max-md:py-16 bg-card border-t border-border">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-3xl">
            <h2 className="font-serif font-semibold text-ink mb-5" style={{ fontSize: 'clamp(2.1rem,4vw,3.2rem)', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
              Not sure which level fits?
            </h2>
            <p className="text-sub leading-[1.75] mb-8 max-w-xl" style={{ fontSize: '1.05rem' }}>
              That is what the first call is for. Tell us about your property and we will tell you
              honestly what the right level looks like.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 max-md:flex-col max-md:items-stretch">
              <Link to="/contact?intent=property-management" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all">
                Manage my property
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
              <Link to="/contact" className="text-ink font-semibold border-b border-border pb-0.5 hover:border-ink transition-colors max-md:text-center" style={{ fontSize: '0.95rem' }}>
                Talk with our team
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

export default ServicesPage;
