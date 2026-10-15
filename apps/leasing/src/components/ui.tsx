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
