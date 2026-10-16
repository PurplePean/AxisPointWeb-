import { BAND, Eyebrow, GUTTER } from '@/components/ui';
import { Link } from 'react-router-dom';
import { BOV_TYPES, contactHref } from '@/content/sell';

/** A tinted call-out offering a rent BOV and a sale BOV, each tagged by its own link. */
export default function BovStrip({ heading = 'What is your property worth?' }: { heading?: string }) {
  return (
    <section className={`${BAND} ${GUTTER} py-9 min-[821px]:py-14`}>
      <div className="mx-auto grid max-w-v2 items-center gap-6 min-[821px]:grid-cols-[0.34fr_1fr] min-[821px]:gap-20">
        <div>
          <Eyebrow className="!text-v2-purple/[0.85]">Broker opinion of value</Eyebrow>
          <p className="mb-0 mt-3 text-[clamp(22px,2.2vw,30px)] font-semibold leading-[1.1] tracking-[-0.03em]">
            {heading}
          </p>
        </div>
        <div className="grid gap-4 min-[600px]:grid-cols-2">
          {BOV_TYPES.map((b) => (
            <Link
              key={b.key}
              to={contactHref(b.role)}
              className="flex min-h-[44px] flex-col gap-1 rounded-v2 border border-v2-ink/[0.14] bg-v2-surface p-5 hover:border-v2-purple"
            >
              <span className="text-[19px] font-semibold tracking-[-0.02em]">{b.title}</span>
              <span className="text-[15px] leading-normal text-v2-ink/[0.7]">{b.question}</span>
              <span className="mt-2 text-[15px] font-bold text-v2-purple">
                {b.cta} <span aria-hidden="true">&#8594;</span>
              </span>
            </Link>
          ))}
          <div className="min-[600px]:col-span-2">
            <QuietLinkToSell />
          </div>
        </div>
      </div>
    </section>
  );
}

function QuietLinkToSell() {
  return (
    <Link
      to="/sell"
      className="inline-flex min-h-[44px] items-center border-b-[1.5px] border-v2-purple font-semibold text-v2-purple"
    >
      How a BOV works <span aria-hidden="true">&nbsp;&#8594;</span>
    </Link>
  );
}
