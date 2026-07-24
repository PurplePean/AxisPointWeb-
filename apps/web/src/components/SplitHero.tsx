import { Link } from 'react-router-dom';

/**
 * SplitHero — the two-path home hero for the Property Management repositioning.
 *
 * Property Management is the dominant primary path; Investor Services is an
 * intentionally compact, credible secondary route.
 *
 * Desktop: a two-column split weighted ~67% Property Management / ~33% Investor
 * Services. PM is warmer neutral with teal accents and keeps its proof-stat row
 * and two CTAs; the investor panel is deliberately spare (short copy, a single
 * white CTA, no proof row, no second CTA) so it reads premium but clearly
 * secondary. Gradients are used only as the seam between operations and strategy.
 *
 * Mobile (~390px): the split does not carry over. Property Management is the
 * complete primary first section with its CTA reachable near the first viewport;
 * Investor Services follows as a compact secondary panel. Same component, no
 * separate mobile page. The three secondary lead paths stay reachable via the
 * strip beneath the split.
 *
 * Routing is presentation-only: CTAs deep-link into the shared multi-step
 * ContactForm with a public intent token the form resolves to an existing role.
 * No copy exposes internal role values, and there are no headshots or personal links.
 */

/* Restrained flat color blocking, no decorative glows. A warm neutral for the
   operations side, a quiet deep field for the strategy side, split by a hairline.
   Hexes stay in the brand family: ink #1C1628, purple.dark #2A1E47, teal #24A5BC. */
const OWNER_BG = '#F7F5F0';
const INVESTOR_BG = 'linear-gradient(180deg, #241B39 0%, #191424 100%)';

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

function SplitHero() {
  return (
    <section className="relative">
      <div className="grid grid-cols-1 md:grid-cols-[1.35fr_0.65fr]">
        {/* ── Property Management (primary, ~67%) ── */}
        <article
          className="relative flex flex-col justify-center px-7 pt-[calc(68px+40px)] pb-14 md:min-h-[86vh] md:px-14 md:pt-[calc(68px+56px)] md:pb-20"
          style={{ background: OWNER_BG }}
        >
          <div className="w-full max-w-[620px] md:ml-auto md:mr-0 md:pr-4">
            <Eyebrow tone="teal">For existing property owners</Eyebrow>
            <h1
              className="font-serif font-semibold text-ink"
              style={{ fontSize: 'clamp(2.4rem,4.8vw,4.4rem)', lineHeight: 0.98, letterSpacing: '-0.02em' }}
            >
              A better run property starts <em className="not-italic text-teal">here.</em>
            </h1>
            <p className="mt-5 text-sub leading-[1.65] max-w-[520px]" style={{ fontSize: '1.05rem' }}>
              Property management is what we do. AxisPoint takes responsibility for the daily work:
              tenant communication, leasing, maintenance, vendors, collections, accounting, and owner
              reporting. One team accountable for how your property runs.
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
            {/* Proof stats: desktop only, kept off mobile so the CTA stays near the
                first viewport. Wrapper carries the hide (the global mobile stylesheet
                forces a.rounded-button visible, but these are plain divs). */}
            <div className="hidden md:grid mt-9 grid-cols-3 gap-4 border-t border-border pt-6">
              {([
                ['One', 'Accountable operating team'],
                ['Monthly', 'Owner reporting rhythm'],
                ['Texas', 'Local market execution'],
              ] as [string, string][]).map(([value, label]) => (
                <div key={label}>
                  <div className="font-serif text-ink" style={{ fontSize: '1.45rem', lineHeight: 1 }}>{value}</div>
                  <div className="mt-2 font-sans uppercase text-sub" style={{ fontSize: '0.6rem', lineHeight: 1.4, letterSpacing: '0.07em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* ── Investor Services (compact secondary, ~33%) ── */}
        <article
          className="relative flex flex-col justify-center px-7 py-10 md:min-h-[86vh] md:px-11 md:py-20 md:border-l md:border-[#2E2540]"
          style={{ background: INVESTOR_BG }}
        >
          <div className="w-full max-w-[420px] md:mr-auto md:ml-0">
            <Eyebrow tone="light">For capital-ready investors</Eyebrow>
            <h2
              className="font-serif font-semibold text-white"
              style={{ fontSize: 'clamp(1.6rem,2.3vw,2.2rem)', lineHeight: 1.06, letterSpacing: '-0.015em' }}
            >
              Commercial real estate, with the operating team <em className="not-italic text-teal">already in place.</em>
            </h2>
            <p className="mt-4 leading-[1.6] max-w-[380px]" style={{ fontSize: '0.95rem', color: '#C3BFCA' }}>
              Commercial real estate exposure without building the operating team yourself. We define
              the criteria, source and underwrite, coordinate the acquisition, and manage the asset
              after closing.
            </p>
            <div className="mt-6">
              <Link
                to="/contact?intent=investor-services"
                className="inline-flex items-center justify-center gap-2 rounded-button bg-white px-6 py-3.5 font-semibold text-purple transition-all hover:-translate-y-0.5 hover:brightness-95 max-md:w-full"
              >
                Discuss my investment criteria
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Link>
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
