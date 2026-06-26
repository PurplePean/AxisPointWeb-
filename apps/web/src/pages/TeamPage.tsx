import { Link } from 'react-router-dom';
import { team } from '@brand/team';
import { downloadVCard } from '@axispoint/brand';
import { useReveal } from '../hooks/useReveal';

function TeamPage() {
  useReveal();

  const { zach, ethaniel } = team;

  return (
    <div className="min-h-screen">

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-[#2d1f50] to-ink pt-[calc(68px+64px)] pb-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full bg-teal/10 blur-[80px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-purple/10 blur-[80px]" />
        </div>
        <div className="relative max-w-[1160px] mx-auto px-7 text-center" style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="rv inline-flex items-center gap-2 px-4 py-1.5 rounded-chip bg-teal/10 border border-teal/30 text-teal text-eyebrow font-semibold mb-5 tracking-wider">
            The People Behind the Work
          </div>
          <h1 className="rv d1 font-serif font-semibold text-white leading-[1.1] mb-3.5" style={{ fontSize: 'clamp(2.4rem,4.5vw,3.6rem)' }}>
            Two specialists.<br />
            <em className="not-italic text-teal">One firm.</em>
          </h1>
          <p className="rv d2 text-white/60 leading-[1.7]" style={{ fontSize: '1.05rem' }}>
            When you work with AxisPoint, you deal with Zachary and Ethaniel directly, from the first call through every decision along the way.
          </p>
        </div>
      </section>

      {/* ── Person Cards ─────────────────────────────────── */}
      <section className="py-16 bg-card">
        <div className="max-w-[1160px] mx-auto px-7 flex flex-col gap-8">

          {/* Zachary */}
          <div className="rv rounded-[24px] bg-card border border-border shadow-card overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-teal to-[#1b8fa8]" />
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">
              {/* Left */}
              <div className="p-10 border-b lg:border-b-0 lg:border-r border-border">
                <div className="w-24 h-24 rounded-[18px] bg-teal/10 border-2 border-teal/30 flex items-center justify-center mb-5">
                  <span className="font-serif font-semibold text-teal" style={{ fontSize: '2.2rem' }}>{zach.initials}</span>
                </div>
                <div className="font-serif font-semibold text-ink mb-1" style={{ fontSize: '1.6rem' }}>{zach.fullName}</div>
                <div className="text-teal font-semibold uppercase tracking-widest mb-5" style={{ fontSize: '0.72rem', letterSpacing: '0.1em' }}>{zach.title}</div>
                <div className="h-px bg-border mb-5" />
                <div className="flex flex-col gap-2.5">
                  <a href={`mailto:${zach.email}`} className="flex items-center gap-2 text-sub hover:text-ink transition-colors" style={{ fontSize: '0.82rem' }}>
                    <svg className="w-3.5 h-3.5 opacity-50 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    {zach.email}
                  </a>
                  <a href={`tel:+1${zach.phone.replace(/\D/g, '')}`} className="flex items-center gap-2 text-sub hover:text-ink transition-colors" style={{ fontSize: '0.82rem' }}>
                    <svg className="w-3.5 h-3.5 opacity-50 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.18 1.5h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.56-1.56a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {zach.phone}
                  </a>
                </div>
              </div>
              {/* Right */}
              <div className="p-10">
                <div className="text-hint font-semibold uppercase tracking-widest mb-4" style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}>Background</div>
                <div className="text-sub leading-[1.8] mb-7" style={{ fontSize: '0.95rem' }}>
                  {zach.bio.map((para: string, i: number) => (
                    <p key={i} className={i < zach.bio.length - 1 ? 'mb-3.5' : ''}>{para}</p>
                  ))}
                </div>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-button bg-teal text-white text-sm font-semibold hover:brightness-110 transition-all"
                >
                  Let's Talk
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Ethaniel */}
          <div className="rv d1 rounded-[24px] bg-card border border-border shadow-card overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple to-[#2c1f4a]" />
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr]">
              {/* Left */}
              <div className="p-10 border-b lg:border-b-0 lg:border-r border-border">
                <div className="w-24 h-24 rounded-[18px] bg-purple/10 border-2 border-purple/30 flex items-center justify-center mb-5">
                  <span className="font-serif font-semibold text-purple" style={{ fontSize: '2.2rem' }}>{ethaniel.initials}</span>
                </div>
                <div className="font-serif font-semibold text-ink mb-1" style={{ fontSize: '1.6rem' }}>{ethaniel.fullName}</div>
                <div className="text-purple font-semibold uppercase tracking-widest mb-5" style={{ fontSize: '0.72rem', letterSpacing: '0.1em' }}>{ethaniel.title}</div>
                <div className="h-px bg-border mb-5" />
                <div className="flex flex-col gap-2.5">
                  <a href={`mailto:${ethaniel.email}`} className="flex items-center gap-2 text-sub hover:text-ink transition-colors" style={{ fontSize: '0.82rem' }}>
                    <svg className="w-3.5 h-3.5 opacity-50 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    {ethaniel.email}
                  </a>
                  <a href={`tel:+1${ethaniel.phone.replace(/\D/g, '')}`} className="flex items-center gap-2 text-sub hover:text-ink transition-colors" style={{ fontSize: '0.82rem' }}>
                    <svg className="w-3.5 h-3.5 opacity-50 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.18 1.5h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.56-1.56a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {ethaniel.phone}
                  </a>
                </div>
              </div>
              {/* Right */}
              <div className="p-10">
                <div className="text-hint font-semibold uppercase tracking-widest mb-4" style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}>Background</div>
                <div className="text-sub leading-[1.8] mb-7" style={{ fontSize: '0.95rem' }}>
                  {ethaniel.bio.map((para: string, i: number) => (
                    <p key={i} className={i < ethaniel.bio.length - 1 ? 'mb-3.5' : ''}>{para}</p>
                  ))}
                </div>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-button bg-purple text-white text-sm font-semibold hover:brightness-110 transition-all"
                >
                  Let's Talk
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Save Our Contacts ──────────────────────────── */}
          <div className="rv d2 flex justify-center">
            <button
              type="button"
              onClick={downloadVCard}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-button border-2 border-teal text-teal text-sm font-semibold bg-transparent hover:bg-teal/10 transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Our Contacts
            </button>
          </div>

        </div>
      </section>

      {/* ── Boutique ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#2d1f50] to-ink py-24">
        <div className="rv max-w-[800px] mx-auto px-7 text-center text-white">
          <h2 className="font-serif font-semibold text-white mb-4" style={{ fontSize: 'clamp(1.9rem,3.5vw,2.8rem)', lineHeight: 1.15 }}>
            We are selective because our name is on every deal we manage.
          </h2>
          <p className="mb-7 leading-[1.75]" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.58)' }}>
            AxisPoint Partners is available for introductory conversations with prospective investor clients. Not every situation is a fit. But if there is a fit, the first call will make that clear. We take the time to understand your goals before we ever look at an asset on your behalf.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-button bg-teal text-white font-semibold hover:brightness-110 transition-all"
          >
            Start a conversation
          </Link>
        </div>
      </div>

    </div>
  );
}

export default TeamPage;
