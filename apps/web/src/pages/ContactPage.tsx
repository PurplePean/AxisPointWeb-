import { ContactForm } from '@axispoint/brand';
import { useReveal } from '../hooks/useReveal';

/* ══════════════════════════════════════════════════════ */
function ContactPage() {
  useReveal();

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative pt-[calc(68px+56px)] pb-14 overflow-hidden text-center" style={{ background: 'linear-gradient(135deg,#2A1E47 0%,#1C1628 100%)' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-100px] right-[-80px] w-[400px] h-[400px] rounded-full" style={{ background: 'rgba(36,165,188,0.10)', filter: 'blur(70px)' }} />
          <div className="absolute bottom-[-60px] left-[5%] w-[280px] h-[280px] rounded-full" style={{ background: 'rgba(159,50,140,0.08)', filter: 'blur(70px)' }} />
        </div>
        <div className="relative max-w-[640px] mx-auto px-7">
          <div className="rv inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/15 border border-teal/25 text-teal text-[0.68rem] font-semibold tracking-[0.1em] uppercase mb-5">
            <span className="w-[5px] h-[5px] rounded-full bg-teal" />
            Get in Touch
          </div>
          <h1 className="rv d1 font-serif font-semibold text-white leading-[1.1] mb-3.5" style={{ fontSize: 'clamp(2.2rem,4vw,3.2rem)' }}>
            Tell us who you are.<br />
            <em className="not-italic text-teal">We will take it from there.</em>
          </h1>
          <p className="rv d2 text-white/60 leading-[1.7]" style={{ fontSize: '1rem' }}>
            A few quick questions so we can reach out with the right context and connect you with the right person.
          </p>
        </div>
      </section>

      {/* Main layout */}
      <div className="max-w-[1100px] mx-auto px-7 py-16 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">

        {/* Shared form */}
        <ContactForm />

        {/* Sidebar */}
        <div className="rv d1 flex flex-col gap-4">
          <div className="bg-white border border-border rounded-[18px] p-6 shadow-card">
            <div className="font-serif font-semibold text-ink mb-4" style={{ fontSize: '1.1rem' }}>Talk to us directly</div>

            <a href="mailto:zach@axispoint.llc" className="flex items-start gap-2.5 mb-3.5 no-underline text-inherit transition-opacity hover:opacity-75">
              <div className="w-[34px] h-[34px] rounded-[9px] flex-shrink-0 flex items-center justify-center" style={{ background: '#E8F7FA', border: '1px solid #B8E6EF' }}>
                <div className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center font-serif font-semibold text-[0.9rem]" style={{ background: '#E8F7FA', color: '#24A5BC' }}>ZR</div>
              </div>
              <div>
                <div className="text-[0.84rem] font-semibold text-ink mb-0.5">Zachary Russell</div>
                <div className="text-[0.7rem] text-hint mb-0.5">Partner — Multifamily</div>
                <div className="text-[0.76rem] text-teal">zach@axispoint.llc</div>
              </div>
            </a>

            <div className="h-px bg-border my-4" />

            <a href="mailto:ethaniel@axispoint.llc" className="flex items-start gap-2.5 no-underline text-inherit transition-opacity hover:opacity-75">
              <div className="w-[34px] h-[34px] rounded-[9px] flex-shrink-0 flex items-center justify-center" style={{ background: '#EEEAF5', border: '1px solid #C4B8DC' }}>
                <div className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center font-serif font-semibold text-[0.9rem]" style={{ background: '#EEEAF5', color: '#38285D' }}>EV</div>
              </div>
              <div>
                <div className="text-[0.84rem] font-semibold text-ink mb-0.5">Ethaniel Vu</div>
                <div className="text-[0.7rem] text-hint mb-0.5">Partner — Commercial</div>
                <div className="text-[0.76rem] text-teal">ethaniel@axispoint.llc</div>
              </div>
            </a>

            <div className="h-px bg-border my-4" />
            <p className="text-[0.76rem] text-sub leading-relaxed">
              <strong className="text-ink font-semibold">Response time:</strong> We respond to every inquiry personally, typically within one business day.
            </p>
          </div>

          <div className="rounded-[18px] p-6" style={{ background: 'linear-gradient(135deg,#2A1E47,#1C1628)' }}>
            <div className="text-[0.62rem] font-semibold tracking-[0.1em] uppercase mb-2.5" style={{ color: 'rgba(255,255,255,0.35)' }}>How we work</div>
            <blockquote className="font-serif italic leading-relaxed m-0" style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.85)' }}>
              We take the time to understand your goals before we ever look at an asset on your behalf.
            </blockquote>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ContactPage;
