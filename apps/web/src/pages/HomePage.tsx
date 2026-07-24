import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';
import SplitHero from '../components/SplitHero';

/**
 * HomePage — Property Management focused.
 *
 * The page has one job: convince a commercial property owner that AxisPoint can
 * take responsibility for operating their property, then route them to the right
 * next step. The split hero is the only signature visual; everything below it is
 * deliberately quiet.
 *
 * Structure: split hero, three property management outcomes, an asymmetric
 * service-pathway section that makes the hierarchy visible, and a dark closing
 * CTA that runs straight into the shared footer. The full service specification
 * lives on /services and is linked to rather than repeated here.
 */

/* Restrained tracked micro-label. Used sparingly, not on every block. */
function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="uppercase font-semibold" style={{ fontSize: '0.66rem', letterSpacing: '0.15em', color: light ? '#8FD4E0' : '#1A8799' }}>
      {children}
    </div>
  );
}

function Arrow({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* The three things an owner actually gets. Not a feature inventory: the scope
   sheet lives on /services#property-management. */
const OUTCOMES: [string, string][] = [
  [
    'The property keeps moving',
    'Tenant requests, work orders, vendors, and renewals move on a defined process, not through you.',
  ],
  [
    'The financial side stays current',
    'Rent pursued, payables handled, books reconciled, and spend measured against budget.',
  ],
  [
    'You keep visibility without the workload',
    'One monthly owner report, one point of contact, and decisions brought to you with context.',
  ],
];

function HomePage() {
  useReveal();

  return (
    <div className="min-h-screen">

      {/* ── 1. PM-dominant split hero ────────────────────── */}
      <SplitHero />

      {/* ── 2. What property management actually delivers ─── */}
      <section className="py-24 max-md:!py-10 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-2xl mb-12 max-md:mb-7">
            <Label>Property Management</Label>
            <h2 className="font-serif font-semibold text-ink mt-4 mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.04, letterSpacing: '-0.015em' }}>
              What changes when we take it on
            </h2>
            <p className="text-sub leading-[1.75] max-w-xl" style={{ fontSize: '1.05rem' }}>
              AxisPoint takes responsibility for the whole operation, so the property runs on a
              process instead of on your attention.
            </p>
          </div>

          <div className="rv d1 border-t border-border">
            {OUTCOMES.map(([title, detail]) => (
              <div key={title} className="grid md:grid-cols-[300px_1fr] gap-x-12 gap-y-3 py-8 max-md:py-5 border-b border-border">
                <h3 className="font-serif text-ink" style={{ fontSize: '1.45rem', lineHeight: 1.14 }}>{title}</h3>
                <p className="text-sub leading-[1.7] max-w-2xl" style={{ fontSize: '0.95rem' }}>{detail}</p>
              </div>
            ))}
          </div>

          <div className="rv d1 mt-8 max-md:mt-6">
            <Link
              to="/services#property-management"
              className="inline-flex items-center gap-2 font-semibold text-ink border-b border-border-dark pb-0.5 hover:border-ink transition-colors"
              style={{ fontSize: '0.92rem' }}
            >
              See everything property management covers
              <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. Service hierarchy, asymmetric on purpose ────── */}
      <section className="py-24 max-md:!py-10 bg-body">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-xl mb-12 max-md:mb-7">
            <h2 className="font-serif font-semibold text-ink mb-4" style={{ fontSize: 'clamp(1.8rem,3.1vw,2.5rem)', lineHeight: 1.06, letterSpacing: '-0.015em' }}>
              Where AxisPoint fits
            </h2>
            <p className="text-sub leading-[1.7]" style={{ fontSize: '1rem' }}>
              Management is the engagement. Strategy and acquisitions are added when they apply.
            </p>
          </div>

          <div className="rv d1 grid md:grid-cols-[1.2fr_0.8fr] gap-x-16 gap-y-10 max-md:gap-y-8 items-start">
            {/* Primary path, given the weight */}
            <div className="border-t-2 border-teal pt-7 max-md:pt-6">
              <Label>Primary engagement</Label>
              <h3 className="font-serif font-semibold text-ink mt-3 mb-4" style={{ fontSize: 'clamp(1.7rem,2.6vw,2.15rem)', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
                Property Management
              </h3>
              <p className="text-sub leading-[1.75] mb-6 max-w-lg" style={{ fontSize: '1rem' }}>
                Leasing, maintenance, vendors, collections, accounting, and owner reporting, run by
                one accountable team. Where nearly every engagement begins.
              </p>
              <Link
                to="/services#property-management"
                className="inline-flex items-center gap-2 font-semibold text-teal-dark border-b border-teal/40 pb-0.5 hover:border-teal-dark transition-colors"
                style={{ fontSize: '0.92rem' }}
              >
                The operating foundation
                <Arrow />
              </Link>
            </div>

            {/* Supporting paths, quieter rows on hairlines */}
            <div>
              <div className="border-t border-border">
                <div className="pt-7 pb-6 max-md:pt-5 max-md:pb-5 border-b border-border">
                  <div className="uppercase font-semibold" style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: '#38285D' }}>
                    Strategic layer
                  </div>
                  <h4 className="font-serif text-ink mt-2.5 mb-2" style={{ fontSize: '1.3rem', lineHeight: 1.12 }}>
                    Asset Management
                  </h4>
                  <p className="text-sub leading-[1.65] mb-3.5" style={{ fontSize: '0.9rem' }}>
                    Business plan, budgets, capital planning, and hold or sell decisions, layered on
                    top of management. Never a replacement for it.
                  </p>
                  <Link
                    to="/services#asset-management"
                    className="inline-flex items-center gap-1.5 font-semibold text-purple hover:underline"
                    style={{ fontSize: '0.85rem' }}
                  >
                    How it layers on
                    <Arrow size={12} />
                  </Link>
                </div>

                <div className="py-6 max-md:py-5 border-b border-border">
                  <div className="uppercase font-semibold text-hint" style={{ fontSize: '0.62rem', letterSpacing: '0.14em' }}>
                    Selective pathway
                  </div>
                  <h4 className="font-serif text-ink mt-2.5 mb-2" style={{ fontSize: '1.3rem', lineHeight: 1.12 }}>
                    Investor Services
                  </h4>
                  <p className="text-sub leading-[1.65] mb-3.5" style={{ fontSize: '0.9rem' }}>
                    For capital-ready clients entering commercial real estate. We define criteria,
                    source and underwrite, then manage what you acquire.
                  </p>
                  <Link
                    to="/services#investor-services"
                    className="inline-flex items-center gap-1.5 font-semibold text-purple hover:underline"
                    style={{ fontSize: '0.85rem' }}
                  >
                    How entry works
                    <Arrow size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Closing CTA. Shares the footer's field so the two
             read as one closing block, not two stacked sections. ── */}
      <section className="pt-24 pb-16 max-md:!pt-12 max-md:!pb-8" style={{ background: 'linear-gradient(180deg,#191424 0%,#0D0A17 100%)' }}>
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv grid md:grid-cols-[1.15fr_0.85fr] gap-x-16 gap-y-9 max-md:gap-y-7 items-end">
            <div>
              <Label light>Property Management</Label>
              <h2 className="font-serif font-semibold text-white mt-4 mb-5" style={{ fontSize: 'clamp(2.1rem,4vw,3.2rem)', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
                Hand off the day-to-day.
              </h2>
              <p className="leading-[1.75] mb-8 max-w-lg" style={{ fontSize: '1.05rem', color: '#B9B4C4' }}>
                Tell us about the property and what needs to change. We will come back with questions
                and an honest read on whether there is a fit.
              </p>
              <Link
                to="/contact?intent=property-management"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all max-md:w-full"
              >
                Manage my property
                <Arrow size={14} />
              </Link>
            </div>

            <div className="md:border-l md:border-white/10 md:pl-14 max-md:border-t max-md:border-white/10 max-md:pt-6">
              <div className="uppercase font-semibold text-hint mb-4" style={{ fontSize: '0.62rem', letterSpacing: '0.14em' }}>
                Or reach us directly
              </div>
              <div className="flex flex-col gap-2.5 items-start">
                <a href="mailto:zach@axispoint.llc" className="text-white hover:text-teal transition-colors max-md:flex max-md:items-center max-md:min-h-[44px]" style={{ fontSize: '0.95rem' }}>
                  zach@axispoint.llc
                </a>
                <a href="tel:+18325802815" className="text-white hover:text-teal transition-colors max-md:flex max-md:items-center max-md:min-h-[44px]" style={{ fontSize: '0.95rem' }}>
                  (832) 580-2815
                </a>
              </div>
              <p className="text-hint mt-5" style={{ fontSize: '0.82rem' }}>
                Introductory calls are 30 minutes. No obligation.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

export default HomePage;
