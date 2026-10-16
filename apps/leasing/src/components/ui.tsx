import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const GUTTER = 'px-5 min-[821px]:px-[72px]';

export function Arrow() {
  return (
    <span aria-hidden="true" className="text-base">
      &#8594;
    </span>
  );
}

const BTN =
  'inline-flex min-h-[54px] items-center gap-2.5 rounded-v2 px-[26px] text-[15px] font-bold';

export function TealButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`${BTN} bg-v2-teal text-v2-action-label hover:brightness-110`}>
      {children}
      <Arrow />
    </Link>
  );
}

export function PurpleButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={`${BTN} border-2 border-v2-purple bg-v2-purple text-white hover:border-[#4A3A72] hover:bg-[#4A3A72]`}
    >
      {children}
      <Arrow />
    </Link>
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`text-[11.5px] font-bold uppercase tracking-[0.14em] text-v2-purple ${className}`}
    >
      {children}
    </span>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-[44px] items-center self-start border-b-[1.5px] border-v2-purple font-semibold text-v2-purple"
    >
      {children} <span aria-hidden="true">&nbsp;&#8594;</span>
    </Link>
  );
}

/** Pairs a heading with a short lede, under the 3px purple top rule from the approved draft. */
export function PageIntro({
  title,
  children,
  as: Tag = 'h1',
}: {
  title: string;
  children: ReactNode;
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-x-14 gap-y-8">
      <Tag className="m-0 border-t-[3px] border-v2-purple pt-4 text-[clamp(34px,4vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em] text-v2-ink">
        {title}
      </Tag>
      {children}
    </div>
  );
}

/* ── Design foundations: section rhythm, hero, ruled rows, closing band ── */

/** Approved section rhythm: about 100px desktop, 54px mobile. */
export const SECTION_Y = 'py-[54px] min-[821px]:py-[100px]';

/** Tinted full-width band used to alternate with plain sections. */
export const BAND = 'border-y border-v2-ink/10 bg-v2-field-warm';

/** Bold key phrase inside body copy. Use sparingly, one or two per paragraph. */
export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-v2-ink">{children}</strong>;
}

/** Hairline-underlined in-page anchor, matches the main site's quiet link. */
export function QuietAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-[44px] items-center gap-2 border-b border-v2-ink/[0.35] pb-[3px] text-[15px] font-semibold hover:text-v2-teal-support"
    >
      {children} <span aria-hidden="true">&#8595;</span>
    </a>
  );
}

/** Large page opener: teal eyebrow, big headline, lede, optional call to action row. */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`bg-v2-surface ${GUTTER} pb-10 pt-11 min-[821px]:pb-[72px] min-[821px]:pt-[84px]`}>
      <div className="mx-auto max-w-v2">
        <span className="mb-5 block text-[11.5px] font-bold uppercase tracking-[0.14em] text-v2-teal-support">
          {eyebrow}
        </span>
        <div className="grid items-end gap-[22px] min-[821px]:grid-cols-[1.1fr_0.9fr] min-[821px]:gap-20">
          <h1 className="m-0 text-[clamp(38px,4.6vw,62px)] font-semibold leading-none tracking-[-0.045em] [text-wrap:pretty]">
            {title}
          </h1>
          <p className="m-0 max-w-[42ch] text-[clamp(17px,1.3vw,19px)] leading-[1.5] text-v2-ink/[0.7] [text-wrap:pretty]">
            {lede}
          </p>
        </div>
        {children && (
          <div className="mt-8 flex flex-wrap items-center gap-x-[26px] gap-y-3.5 min-[821px]:mt-[52px]">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/** Section heading under the 3px purple rule, used beside or above ruled rows. */
export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="m-0 scroll-mt-4 border-t-[3px] border-v2-purple pt-4 text-[clamp(22px,2.2vw,30px)] font-semibold leading-[1.1] tracking-[-0.03em]"
    >
      {children}
    </h2>
  );
}

/** A large statement heading, no rule. */
export function BigHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 max-w-[20ch] text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.035em] [text-wrap:pretty]">
      {children}
    </h2>
  );
}

/** A list of ruled rows: label on the left, content on the right (stacked on mobile). */
export function RuledList({ children }: { children: ReactNode }) {
  return <div className="grid border-b border-v2-ink/[0.16]">{children}</div>;
}

export function RuledRow({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-v2-ink/[0.16] py-6 min-[821px]:grid-cols-[0.34fr_1fr] min-[821px]:gap-20 min-[821px]:py-8">
      <h3 className="m-0 text-[clamp(21px,2vw,26px)] font-semibold leading-[1.15] tracking-[-0.025em]">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

/** Large figure with a small label, for proof points. */
export function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="text-[clamp(44px,6vw,76px)] font-semibold leading-none tracking-[-0.04em] text-v2-ink">
        {value}
      </span>
      <span className="text-[15px] font-bold uppercase tracking-[0.12em] text-v2-purple">
        {label}
      </span>
    </p>
  );
}

/** Dark closing block with a large serif headline and one action. */
export function ClosingBand({
  title,
  body,
  ctaLabel,
  ctaTo,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <section className={`bg-v2-ink text-white ${GUTTER} ${SECTION_Y}`}>
      <div className="mx-auto grid max-w-v2 items-end gap-6 min-[821px]:grid-cols-[1fr_auto] min-[821px]:gap-20">
        <div>
          <h2 className="m-0 max-w-[17ch] font-serif text-[clamp(35px,4vw,58px)] font-medium leading-[1.04] [text-wrap:pretty]">
            {title}
          </h2>
          <p className="mb-0 mt-[22px] max-w-[50ch] text-[clamp(15.5px,1.2vw,16.5px)] leading-[1.65] text-white/[0.66]">
            {body}
          </p>
        </div>
        <Link
          to={ctaTo}
          className="inline-flex min-h-[56px] items-center justify-center gap-2.5 justify-self-start rounded-v2 bg-v2-teal px-[26px] text-[15px] font-bold text-v2-action-label transition-colors hover:bg-white"
        >
          {ctaLabel} <Arrow />
        </Link>
      </div>
    </section>
  );
}
