import { Link } from 'react-router-dom';
import { GUTTER, Eyebrow, PageIntro } from '@/components/ui';
import { CREXI_BROKER_URL } from '@/lib/site';

const BTN =
  'inline-flex min-h-[54px] items-center gap-2.5 rounded-v2 px-[26px] text-[15px] font-bold bg-v2-teal text-v2-action-label hover:brightness-110';

export default function ListingsPage() {
  return (
    <>
      <section className={`bg-v2-surface pb-12 pt-16 ${GUTTER}`}>
        <div className="mx-auto max-w-v2">
          <PageIntro title="Available space">
            <p className="m-0 max-w-[54ch] text-[17.5px] leading-relaxed text-v2-ink/[0.7]">
              Our current retail listings are on Crexi, with photos, rates and property details.
            </p>
          </PageIntro>
        </div>
      </section>

      <section className={`bg-v2-surface pb-[72px] ${GUTTER}`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-7">
          <div className="flex flex-col gap-6 rounded-v2 border border-v2-ink/[0.14] p-8 min-[821px]:p-10" style={{ borderTopColor: '#38285D', borderTopWidth: '3px' }}>
            <Eyebrow>On Crexi</Eyebrow>
            <h2 className="m-0 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">
              Browse every available space
            </h2>
            <p className="m-0 max-w-[52ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">
              Ethaniel Vu&rsquo;s current retail listings, with photos, maps and rates. Opens in a
              new tab.
            </p>
            <div className="flex flex-col items-start gap-5">
              <a
                href={CREXI_BROKER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={BTN}
              >
                View listings on Crexi
                <span aria-hidden="true" className="text-base">&#8599;</span>
              </a>
              <Link
                to="/contact?role=tenant"
                className="inline-flex min-h-[44px] items-center self-start border-b-[1.5px] border-v2-purple font-semibold text-v2-purple"
              >
                Looking for something specific? Tell us what you need
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
