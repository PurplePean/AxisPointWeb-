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
 * Structure: split hero, three property management outcomes, the management vs
 * asset management distinction, and a dark closing CTA that runs straight into the
 * shared footer. The full service specification lives on /services and is linked to
 * rather than repeated here.
 *
 * Attention is budgeted deliberately: management dominates, asset management is the
 * one upsell the page argues for, and investor services is confined to the hero rail
 * and the footer. Direct contact details live in the footer only, so the closing CTA
 * does not repeat them.
 *
 * The management CTA phrase is "Request a management proposal" and must stay identical
 * in the hero (SplitHero) and here. Two different labels on the same path read as two
 * different offers.
 */

/* Restrained tracked micro-label. Used sparingly, not on every block.
   Teal reads as operations, purple as strategy, light for the dark closing field. */
const LABEL_COLOR = { teal: '#1A8799', purple: '#38285D', light: '#8FD4E0' } as const;

function Label({ children, tone = 'teal' }: { children: React.ReactNode; tone?: keyof typeof LABEL_COLOR }) {
  return (
    <div className="uppercase font-semibold" style={{ fontSize: '0.66rem', letterSpacing: '0.15em', color: LABEL_COLOR[tone] }}>
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

      {/* ── 3. The one distinction the homepage needs to draw. Two jobs, side by
             side on hairlines. Not a feature inventory and not a card grid: the
             full comparison belongs on the dedicated pages when they exist. ── */}
      <section className="py-24 max-md:!py-10 bg-body">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-3xl mb-12 max-md:mb-8">
            <h2 className="font-serif font-semibold text-ink mb-5" style={{ fontSize: 'clamp(1.9rem,3.4vw,2.8rem)', lineHeight: 1.06, letterSpacing: '-0.015em' }}>
              Management runs the property.{' '}
              <span className="text-purple">Asset Management directs the investment.</span>
            </h2>
            <p className="text-sub leading-[1.75] max-w-xl" style={{ fontSize: '1rem' }}>
              Two different jobs. Nearly every engagement starts with management, and asset
              management is added when the property is part of a larger investment plan.
            </p>
          </div>

          <div className="rv d1 grid md:grid-cols-2 gap-x-16 gap-y-9 max-md:gap-y-8 items-start">
            <div className="border-t-2 border-teal pt-6">
              <Label>Property Management</Label>
              <p className="text-ink leading-[1.7] mt-3.5 mb-5 max-w-md" style={{ fontSize: '1rem' }}>
                Operations, tenants, vendors, accounting, and reporting. The work of running the
                property day to day.
              </p>
              <Link
                to="/services#property-management"
                className="inline-flex items-center gap-2 font-semibold text-teal-dark border-b border-teal/40 pb-0.5 hover:border-teal-dark transition-colors"
                style={{ fontSize: '0.92rem' }}
              >
                What management covers
                <Arrow />
              </Link>
            </div>

            <div className="border-t-2 border-purple pt-6">
              <Label tone="purple">Property Management + Asset Management</Label>
              <p className="text-ink leading-[1.7] mt-3.5 mb-5 max-w-md" style={{ fontSize: '1rem' }}>
                Business plan, capital planning, debt and refinancing, and hold or sell strategy.
                Direction for the investment the property sits inside.
              </p>
              <Link
                to="/services#asset-management"
                className="inline-flex items-center gap-2 font-semibold text-purple border-b border-purple/30 pb-0.5 hover:border-purple transition-colors"
                style={{ fontSize: '0.92rem' }}
              >
                How asset management layers on
                <Arrow />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Closing CTA. One headline, one paragraph, one button, all on the
             management path. Shares the footer's field so the two read as one
             closing block. Email and phone live in the footer only, so they are
             deliberately not repeated here. ── */}
      <section className="pt-24 pb-16 max-md:!pt-12 max-md:!pb-8" style={{ background: 'linear-gradient(180deg,#191424 0%,#0D0A17 100%)' }}>
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-2xl">
            <Label tone="light">Property Management</Label>
            <h2 className="font-serif font-semibold text-white mt-4 mb-5" style={{ fontSize: 'clamp(2.1rem,4vw,3.2rem)', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
              Hand off the day-to-day.
            </h2>
            <p className="leading-[1.75] mb-8 max-w-lg" style={{ fontSize: '1.05rem', color: '#B9B4C4' }}>
              Tell us about the property and what needs to change. We will come back with questions
              and an honest read on whether there is a fit. Introductory calls are 30 minutes.
            </p>
            <Link
              to="/contact?intent=property-management"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all max-md:w-full"
            >
              Request a management proposal
              <Arrow size={14} />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

export default HomePage;
