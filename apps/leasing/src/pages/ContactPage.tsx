import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { GUTTER } from '@/components/ui';
import { SITE } from '@/lib/site';
import { ROLE_LABELS, buildInquiryMailto, parseAttribution, parseRole, type Role } from '@/lib/contact';

const FIELD =
  'h-12 w-full rounded-v2 border border-[#CFC6B6] bg-v2-field-warm px-3 text-base';
const LABEL = 'flex min-w-0 flex-col gap-1.5 text-sm font-semibold';

export default function ContactPage() {
  const { search } = useLocation();
  const [role, setRole] = useState<Role>(() => parseRole(new URLSearchParams(search).get('role')));
  const [prepared, setPrepared] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const href = buildInquiryMailto(
      {
        role,
        name: String(f.get('name') ?? ''),
        email: String(f.get('email') ?? ''),
        phone: String(f.get('phone') ?? ''),
        place: String(f.get('place') ?? ''),
        wantsManagement: f.get('management') === 'on',
      },
      parseAttribution(search),
    );
    setPrepared(href);
    window.location.href = href;
  }

  return (
    <section className={`bg-v2-surface pb-[72px] pt-16 ${GUTTER}`}>
      <div className="mx-auto grid max-w-v2 grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start gap-x-[72px] gap-y-12">
        <div>
          <h1 className="m-0 border-t-[3px] border-v2-purple pt-4 text-[clamp(34px,4vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em]">
            Start a conversation
          </h1>
          <p className="mb-0 mt-6 max-w-[30ch] font-serif text-[26px] font-medium leading-[1.42] text-v2-ink/[0.68] [text-wrap:pretty]">
            Landlord or tenant, send a few details and we will call you back. The first
            conversation is free.
          </p>
          <a
            href={SITE.phoneHref}
            className="mt-7 inline-flex min-h-[44px] items-center text-[26px] font-semibold tracking-[-0.02em] text-v2-purple"
          >
            {SITE.phoneDisplay}
          </a>
          <div>
            <a
              href={`mailto:${SITE.email}`}
              className="inline-flex min-h-[44px] items-center border-b-[1.5px] border-v2-ink/30 text-base text-v2-ink/[0.72]"
            >
              {SITE.email}
            </a>
          </div>
          <p className="mb-0 mt-[18px] text-[15px] leading-normal text-v2-ink/[0.62]">
            {SITE.addressLines[0]}
            <br />
            {SITE.addressLines[1]}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-[18px] rounded-v2 border border-v2-ink/[0.14] bg-v2-field-warm p-6 min-[821px]:p-9"
        >
          <label className={LABEL}>
            I am a
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(parseRole(e.target.value))}
              className={FIELD}
            >
              <option value="landlord">{ROLE_LABELS.landlord}</option>
              <option value="tenant">{ROLE_LABELS.tenant}</option>
            </select>
          </label>
          <label className={LABEL}>
            Name
            <input name="name" type="text" autoComplete="name" required className={FIELD} />
          </label>
          <div className="flex flex-wrap gap-[18px]">
            <label className={`${LABEL} flex-[1_1_200px]`}>
              Email
              <input name="email" type="email" autoComplete="email" required className={FIELD} />
            </label>
            <label className={`${LABEL} flex-[1_1_200px]`}>
              Phone
              <input name="phone" type="tel" autoComplete="tel" className={FIELD} />
            </label>
          </div>
          <label className={LABEL}>
            {role === 'landlord' ? 'Property address or area' : 'Area or space needed'}
            <input name="place" type="text" className={FIELD} />
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[14.5px] font-medium">
            <input name="management" type="checkbox" className="h-5 w-5 flex-none accent-[#24A5BC]" />
            I would also like to talk about property management
          </label>
          <button
            type="submit"
            className="h-[54px] cursor-pointer rounded-v2 border-0 bg-v2-teal text-[15px] font-bold text-v2-action-label hover:brightness-110"
          >
            Prepare my email &#8594;
          </button>
          <p className="m-0 text-[13px] leading-normal text-v2-ink/[0.62]" role="status">
            {prepared ? (
              <>
                Your email app should open with your details filled in. Press send there to reach
                us. Nothing is sent until you do. If nothing opened,{' '}
                <a href={prepared} className="font-semibold text-v2-purple underline">
                  use this link
                </a>{' '}
                or call {SITE.phoneDisplay}.
              </>
            ) : (
              <>This opens a pre-filled email to {SITE.email}. Nothing is sent until you press send in your mail app.</>
            )}
          </p>
        </form>
      </div>
    </section>
  );
}
