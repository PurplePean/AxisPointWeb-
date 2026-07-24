import { useSearchParams } from 'react-router-dom';
import { ContactForm } from '@axispoint/brand';
import type { Role } from '@axispoint/brand';
import { useReveal } from '../hooks/useReveal';

/**
 * Public-facing intent tokens to internal wire roles. The token is what appears in
 * the URL and marketing links; the role value is never exposed publicly. Anything
 * not listed here (including a missing param) resolves to null, i.e. the normal
 * all-five-roles picker. `?ref=` is untouched: ContactForm reads it independently,
 * so referral attribution survives alongside any intent.
 */
const INTENT_TO_ROLE: Record<string, Role> = {
  'property-management': 'existing_asset_owner',
  'investor-services': 'investor',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="uppercase font-semibold" style={{ fontSize: '0.66rem', letterSpacing: '0.15em', color: '#1A8799' }}>
      {children}
    </div>
  );
}

const STEPS = [
  'Tell us about the property or relationship',
  'Choose a call time when applicable',
  'Speak directly with the AxisPoint team',
];

/* A real three-step sequence, shown as an ordered list on hairlines. */
function WhatHappensNext({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <div className="uppercase font-semibold text-sub mb-2" style={{ fontSize: '0.62rem', letterSpacing: '0.13em' }}>What happens next</div>
      <ol className="border-t border-border">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-baseline gap-4 py-3 border-b border-border">
            <span className="font-serif text-hint tabular-nums flex-none" style={{ fontSize: '0.9rem', width: '1.4rem' }}>{i + 1}</span>
            <span className="text-ink" style={{ fontSize: '0.9rem' }}>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex items-center gap-2 text-sub" style={{ fontSize: '0.85rem' }}>
        <svg className="w-3.5 h-3.5 opacity-50 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span>Houston, Texas</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
function ContactPage() {
  useReveal();
  const [searchParams] = useSearchParams();
  const initialRole = INTENT_TO_ROLE[searchParams.get('intent') ?? ''] ?? null;

  return (
    <div className="min-h-screen bg-body">
      <section className="pt-[calc(68px+52px)] max-md:pt-[calc(68px+32px)] pb-24 max-md:pb-16">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="grid md:grid-cols-[0.82fr_1.18fr] gap-14 max-md:gap-9 items-start">

            {/* Left information rail (heading + explanation always first; the
                sequence sits here on desktop and moves below the form on mobile). */}
            <div className="rv md:order-1">
              <Label>Contact</Label>
              <h1 className="font-serif font-semibold text-ink mt-4 mb-4" style={{ fontSize: 'clamp(2.1rem,3.6vw,3rem)', lineHeight: 1.03, letterSpacing: '-0.02em' }}>
                Tell us who you are. We take it from there.
              </h1>
              <p className="text-sub leading-[1.7] max-w-md" style={{ fontSize: '1.05rem' }}>
                A few quick questions so we can follow up with the right context and connect you with
                the right person.
              </p>
              <WhatHappensNext className="hidden md:block mt-10" />
            </div>

            {/* Form (right column on desktop, second on mobile) */}
            <div className="rv d1 md:order-2">
              <ContactForm initialRole={initialRole} />
            </div>

            {/* Mobile-only sequence, placed after the form so mobile stays heading, form, then this. */}
            <WhatHappensNext className="md:hidden" />
          </div>
        </div>
      </section>
    </div>
  );
}

export default ContactPage;
