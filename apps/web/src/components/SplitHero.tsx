import { Link } from 'react-router-dom';

/**
 * SplitHero — the two-path home hero for the Property Management repositioning.
 *
 * Desktop: a two-column split. Property Management (left, warmer neutral, teal
 * accents) is weighted slightly larger than the capital-ready investor route
 * (right, purple/dark, white-glove). Gradients are used sparingly as the seam
 * between operations and strategy, not as a full-screen wash.
 *
 * Mobile (~390px): the split does NOT carry over. Property Management renders
 * first as the full primary panel with its CTA visible early; the capital-ready
 * path collapses into a compact secondary panel (shorter, one CTA, proof hidden)
 * so visitors are not asked to scroll through two full desktop hero panels. The
 * three secondary paths stay discoverable via the strip beneath the split.
 *
 * All routing is presentation-only: the CTAs deep-link into the shared multi-step
 * ContactForm with a public intent token; the form resolves it to an existing role.
 * No copy exposes internal role values, and there are no headshots or personal links.
 */

/* Brand-token-aligned surfaces. Kept inline (not new global tokens) because they
   are hero-specific gradient compositions, not reusable color values. Hexes trace
   to the brand palette: teal #24A5BC, purple.dark #2A1E47, ink #1C1628. */
const OWNER_BG =
  'radial-gradient(circle at 8% 6%, rgba(36,165,188,0.10), transparent 44%), linear-gradient(150deg, #FBFAF7 0%, #F4F2EC 100%)';
const INVESTOR_BG =
  'radial-gradient(circle at 88% 12%, rgba(36,165,188,0.12), transparent 40%), radial-gradient(circle at 70% 90%, rgba(159,50,140,0.10), transparent 46%), linear-gradient(150deg, #2A1E47 0%, #1C1628 72%)';

function Eyebrow({ children, tone }: { children: React.ReactNode; tone: 'teal' | 'light' }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span
        className="h-px w-6 flex-none"
        style={{ background: tone === 'teal' ? '#1A8799' : 'rgba(114,206,219,0.8)' }}
      />
      <span
        className="font-sans font-semibold uppercase"
        style={{ fontSize: '0.68rem', letterSpacing: '0.13em', color: tone === 'teal' ? '#1A8799' : '#8FD4E0' }}
      >
        {children}
      </span>
    </div>
  );
}

function Proof({ items, tone }: { items: [string, string][]; tone: 'dark' | 'light' }) {
  const labelColor = tone === 'light' ? '#5A5270' : '#9C96AC';
  const valueColor = tone === 'light' ? '#1C1628' : '#FFFFFF';
  return (
    <div
      className="mt-9 grid grid-cols-3 gap-4 border-t pt-6"
      style={{ borderColor: tone === 'light' ? '#E8E4F0' : 'rgba(255,255,255,0.14)' }}
    >
      {items.map(([value, label]) => (
        <div key={label}>
          <div className="font-serif" style={{ fontSize: '1.45rem', lineHeight: 1, color: valueColor }}>
            {value}
          </div>
          <div
            className="mt-2 font-sans uppercase"
            style={{ fontSize: '0.6rem', lineHeight: 1.4, letterSpacing: '0.07em', color: labelColor }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitHero() {
  return (
    <section className="relative">
      <div className="grid grid-cols-1 md:grid-cols-[1.12fr_0.88fr]">
        {/* ── Property Management (primary) ── */}
        <article
          className="relative flex flex-col justify-center px-7 pt-[calc(68px+40px)] pb-14 md:min-h-[86vh] md:px-14 md:pt-[calc(68px+56px)] md:pb-20"
          style={{ background: OWNER_BG }}
        >
          <div className="w-full max-w-[560px] md:ml-auto md:mr-0 md:pr-2">
            <Eyebrow tone="teal">For existing property owners</Eyebrow>
            <h1
              className="font-serif font-semibold text-ink"
              style={{ fontSize: 'clamp(2.4rem,4.6vw,4.2rem)', lineHeight: 0.98, letterSpacing: '-0.02em' }}
            >
              A better run property starts <em className="not-italic text-teal">here.</em>
            </h1>
            <p className="mt-5 text-sub leading-[1.65] max-w-[500px]" style={{ fontSize: '1.05rem' }}>
              AxisPoint takes responsibility for the daily work: tenant communication, vendors,
              maintenance, collections, accounting, and owner reporting. You get fewer surprises and
              one team accountable for execution.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 max-md:flex-col">
              <Link
                to="/contact?intent=property-management"
                className="inline-flex items-center justify-center gap-2 rounded-button bg-teal px-6 py-3.5 font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:-translate-y-0.5 hover:brightness-110 max-md:w-full"
              >
                Manage my property
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center justify-center rounded-button border border-border bg-white px-6 py-3.5 font-semibold text-ink transition-all hover:border-border-dark max-md:w-full"
              >
                See what management includes
              </Link>
            </div>
            <div className="hidden md:block">
              <Proof
                tone="light"
                items={[
                  ['One', 'Accountable operating team'],
                  ['Monthly', 'Owner reporting rhythm'],
                  ['Texas', 'Local market execution'],
                ]}
              />
            </div>
          </div>
        </article>

        {/* ── Capital-ready investor services (secondary) ── */}
        <article
          className="relative flex flex-col justify-center px-7 py-10 md:min-h-[86vh] md:px-14 md:py-20"
          style={{ background: INVESTOR_BG }}
        >
          <div className="w-full max-w-[520px] md:mr-auto md:ml-0 md:pl-2">
            <Eyebrow tone="light">For capital-ready investors</Eyebrow>
            <h2
              className="font-serif font-semibold text-white"
              style={{ fontSize: 'clamp(1.9rem,3.4vw,3.4rem)', lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              Bring the capital. We will build the <em className="not-italic text-teal">CRE team.</em>
            </h2>
            <p
              className="mt-4 leading-[1.6] max-w-[470px] max-md:line-clamp-3"
              style={{ fontSize: '0.98rem', color: '#C3BFCA' }}
            >
              For clients who want commercial real estate exposure without assembling the operating
              infrastructure themselves. We help define the criteria, source and underwrite
              opportunities, acquire the asset, and manage it after closing.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 max-md:flex-col">
              <Link
                to="/contact?intent=investor-services"
                className="inline-flex items-center justify-center gap-2 rounded-button bg-white px-6 py-3.5 font-semibold text-purple transition-all hover:-translate-y-0.5 hover:brightness-95 max-md:w-full"
              >
                Discuss my investment criteria
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Link>
              {/* Wrapper carries the hide: the global mobile stylesheet forces
                  a.rounded-button to display:inline-flex !important for 52px tap
                  targets, so the link itself cannot be hidden on mobile — the
                  non-button wrapper is hidden instead. */}
              <div className="hidden md:block">
                <Link
                  to="/services"
                  className="inline-flex items-center justify-center rounded-button border border-white/25 px-6 py-3.5 font-semibold text-white transition-all hover:bg-white/10"
                >
                  See the white-glove process
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <Proof
                tone="dark"
                items={[
                  ['Criteria', 'Built around your objectives'],
                  ['Underwriting', 'Stress-tested assumptions'],
                  ['Through exit', 'Acquisition to operations'],
                ]}
              />
            </div>
          </div>
        </article>
      </div>

      {/* ── Secondary paths: keeps the other three lead routes discoverable ── */}
      <div className="border-t border-border bg-card">
        <div className="max-w-[1160px] mx-auto px-7 py-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <span className="text-sub" style={{ fontSize: '0.85rem' }}>
            A real estate professional, a referral partner, or sending us a specific person?
          </span>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 font-semibold text-purple hover:underline"
            style={{ fontSize: '0.85rem' }}
          >
            Start here
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default SplitHero;
