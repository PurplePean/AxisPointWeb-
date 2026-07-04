import { ContactForm } from '@axispoint/brand';
import { useReveal } from '../hooks/useReveal';

/* ══════════════════════════════════════════════════════ */
function ContactPage() {
  useReveal();

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative pt-[calc(68px+24px)] md:pt-[calc(68px+56px)] pb-14 overflow-hidden text-center" style={{ background: 'linear-gradient(135deg,#2A1E47 0%,#1C1628 100%)' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-100px] right-[-80px] w-[400px] h-[400px] rounded-full" style={{ background: 'rgba(36,165,188,0.10)', filter: 'blur(70px)' }} />
          <div className="absolute bottom-[-60px] left-[5%] w-[280px] h-[280px] rounded-full" style={{ background: 'rgba(159,50,140,0.08)', filter: 'blur(70px)' }} />
        </div>
        <div className="relative max-w-[640px] mx-auto px-7">
          <div className="rv inline-flex items-center px-3 py-1 rounded-full bg-teal text-white text-xs font-medium mb-5">
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

      {/* Main layout — single column, centered */}
      <div className="max-w-[640px] mx-auto px-7 py-16">
        {/* Shared form */}
        <ContactForm />
      </div>
    </div>
  );
}

export default ContactPage;
