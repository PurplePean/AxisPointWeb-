import {
  BAND,
  BigHeading,
  ClosingBand,
  Eyebrow,
  GUTTER,
  PageHero,
  SECTION_Y,
  Strong,
  TealButton,
} from '@/components/ui';

const SERVICES = [
  'Site search by area, size and budget',
  'Tours and side-by-side comparison',
  'Lease review and negotiation',
  'Move-in coordination',
];

export default function TenantPage() {
  return (
    <>
      <PageHero
        eyebrow="Tenant representation"
        title="Space that fits your operation."
        lede={
          <>
            Tell us what you need. We find the spaces, tour them with you, and{' '}
            <Strong>negotiate the lease on your side of the table</Strong>.
          </>
        }
      >
        <TealButton to="/contact?role=tenant">Tell us what you need</TealButton>
      </PageHero>

      <section className={`${BAND} ${GUTTER} ${SECTION_Y}`}>
        <div className="mx-auto max-w-v2">
          <Eyebrow>For tenants</Eyebrow>
          <div className="mb-8 mt-4 min-[821px]:mb-[52px]">
            <BigHeading>Terms you can build on.</BigHeading>
          </div>
          <ol className="m-0 grid list-none border-b border-v2-ink/[0.16] p-0">
            {SERVICES.map((s, i) => (
              <li
                key={s}
                className="grid grid-cols-[44px_1fr] items-baseline gap-3 border-t border-v2-ink/[0.16] py-5 min-[821px]:grid-cols-[0.34fr_1fr] min-[821px]:gap-20 min-[821px]:py-7"
              >
                <span className="text-[15px] font-bold tracking-[0.1em] text-v2-teal-support">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[clamp(20px,2vw,26px)] font-semibold leading-[1.2] tracking-[-0.025em]">
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ClosingBand
        title="Tell us what you need."
        body="Send a few details and we will start the search."
        ctaLabel="Tell us what you need"
        ctaTo="/contact?role=tenant"
      />
    </>
  );
}
