import { Link } from 'react-router-dom';
import { team } from '@brand/team';
import { downloadVCard, shareVCard } from '@axispoint/brand';
import type { TeamMember } from '@brand/team';
import { useReveal } from '../hooks/useReveal';

function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="uppercase font-semibold" style={{ fontSize: '0.66rem', letterSpacing: '0.15em', color: light ? '#8FD4E0' : '#1A8799' }}>
      {children}
    </div>
  );
}

function Partner({ m, responsibilities, accent }: { m: TeamMember; responsibilities: string; accent: 'teal' | 'purple' }) {
  const accentColor = accent === 'teal' ? '#1A8799' : '#38285D';
  return (
    <div className="rv grid md:grid-cols-[300px_1fr] gap-x-14 gap-y-6 py-12 max-md:py-9 border-b border-border">
      <div>
        <div className="h-0.5 w-10 mb-5" style={{ background: accentColor }} />
        <h2 className="font-serif font-semibold text-ink" style={{ fontSize: '1.9rem', lineHeight: 1.05 }}>{m.fullName}</h2>
        <div className="uppercase font-semibold mt-1.5" style={{ fontSize: '0.68rem', letterSpacing: '0.14em', color: accentColor }}>{m.title}</div>
        <p className="text-sub mt-3 leading-[1.5]" style={{ fontSize: '0.9rem' }}>{responsibilities}</p>
        <div className="mt-5 flex flex-col gap-2">
          <a href={`mailto:${m.email}`} className="inline-flex items-center gap-2 text-sub hover:text-ink transition-colors" style={{ fontSize: '0.85rem' }}>
            <svg className="w-3.5 h-3.5 opacity-50 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            {m.email}
          </a>
          <a href={`tel:+1${m.phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-2 text-sub hover:text-ink transition-colors" style={{ fontSize: '0.85rem' }}>
            <svg className="w-3.5 h-3.5 opacity-50 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.18 1.5h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.56-1.56a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            {m.phone}
          </a>
        </div>
      </div>
      <div className="text-sub leading-[1.8] max-w-2xl" style={{ fontSize: '0.95rem' }}>
        {m.bio.map((para: string, i: number) => (
          <p key={i} className={i < m.bio.length - 1 ? 'mb-4' : ''}>{para}</p>
        ))}
      </div>
    </div>
  );
}

function TeamPage() {
  useReveal();
  const { zach, ethaniel } = team;

  return (
    <div className="min-h-screen">

      {/* ── Hero (flat, typography-led) ──────────────────── */}
      <section className="bg-ink pt-[calc(68px+72px)] max-md:pt-[calc(68px+40px)] pb-20 max-md:pb-14">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv">
            <Label light>Partners</Label>
            <h1 className="font-serif font-semibold text-white mt-5 mb-6 max-w-3xl" style={{ fontSize: 'clamp(2.6rem,5.2vw,4.4rem)', lineHeight: 0.98, letterSpacing: '-0.02em' }}>
              Two specialists. <span className="text-teal">One firm.</span>
            </h1>
            <p className="leading-[1.7] max-w-2xl" style={{ fontSize: '1.15rem', color: '#B9B4C2' }}>
              When you work with AxisPoint, you deal with Zachary and Ethaniel directly, from the first
              call through every decision along the way.
            </p>
          </div>
        </div>
      </section>

      {/* ── Partners ─────────────────────────────────────── */}
      <section className="bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="border-t border-border">
            <Partner
              m={zach}
              accent="teal"
              responsibilities="Leads multifamily property operations and performance oversight across Houston and secondary Texas markets, with a focus on Class B and C workforce housing."
            />
            <Partner
              m={ethaniel}
              accent="purple"
              responsibilities="Oversees commercial property management and leasing across industrial, retail, office, and NNN assets throughout Texas, with particular depth in leasing."
            />
          </div>

          {/* Save / share contact actions */}
          <div className="rv py-12 max-md:py-9 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={downloadVCard}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button bg-teal text-white text-sm font-semibold hover:brightness-110 transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              Save our contacts
            </button>
            <button
              type="button"
              onClick={shareVCard}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-button border border-border text-ink text-sm font-semibold bg-transparent hover:border-border-dark transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Share our contacts
            </button>
          </div>
        </div>
      </section>

      {/* ── PM-led CTA ───────────────────────────────────── */}
      <section className="py-24 max-md:py-16 bg-body border-t border-border">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="rv max-w-3xl">
            <h2 className="font-serif font-semibold text-ink mb-5" style={{ fontSize: 'clamp(2rem,3.6vw,3rem)', lineHeight: 1.03, letterSpacing: '-0.015em' }}>
              We are selective because our name is on every property we run.
            </h2>
            <p className="text-sub leading-[1.75] mb-8 max-w-xl" style={{ fontSize: '1.05rem' }}>
              We take the time to understand what you own and what you want before we take
              responsibility for it. Not every situation is a fit, but if there is one, the first call
              will make that clear.
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
          </div>
        </div>
      </section>

    </div>
  );
}

export default TeamPage;
