import BovStrip from '@/components/BovStrip';
import {
  BAND,
  BigHeading,
  ClosingBand,
  Eyebrow,
  GUTTER,
  PageHero,
  QuietAnchor,
  RuledList,
  RuledRow,
  SECTION_Y,
  Strong,
  TealButton,
} from '@/components/ui';
import ManagedStat from '@/components/ManagedStat';
import { SERVICE_GROUPS, visibleSections } from '@/content/propertyManagement';

function Items({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {items.map((t) => (
        <li key={t} className="grid grid-cols-[12px_1fr] items-start gap-3">
          <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 bg-v2-teal" />
          <span className="text-[clamp(16px,1.3vw,18px)] leading-[1.5] text-v2-ink/[0.78]">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PropertyManagementPage() {
  const sections = visibleSections();

  return (
    <>
      <PageHero
        eyebrow="Property management"
        title="Retail property management."
        lede={
          <>
            Focused on <Strong>retail and NNN properties</Strong>. We handle the day-to-day so you
            collect rent without managing tenants.
          </>
        }
      >
        <TealButton to="/contact?role=landlord">Talk about your property</TealButton>
        <QuietAnchor href="#scope">See what we handle</QuietAnchor>
      </PageHero>

      <ManagedStat large className={`${BAND} ${GUTTER} py-9 min-[821px]:py-12`} />

      {sections.includes('services') && (
        <section id="scope" className={`${GUTTER} ${SECTION_Y} scroll-mt-4`}>
          <div className="mx-auto max-w-v2">
            <div className="mb-8 min-[821px]:mb-[52px]">
              <Eyebrow>What we handle</Eyebrow>
              <div className="mt-4">
                <BigHeading>Management and NNN administration.</BigHeading>
              </div>
              <p className="mb-0 mt-5 max-w-[56ch] text-[clamp(16px,1.3vw,18px)] leading-[1.6] text-v2-ink/[0.7]">
                Retail leases come with obligations beyond collecting rent.{' '}
                <Strong>We track the numbers, coordinate the vendors, and keep tenants accountable
                to the lease.</Strong>
              </p>
            </div>
            <RuledList>
              {SERVICE_GROUPS.map((g) => (
                <RuledRow key={g.title} title={g.title}>
                  <Items items={g.items} />
                </RuledRow>
              ))}
            </RuledList>
          </div>
        </section>
      )}

      <section className={`${BAND} ${GUTTER} py-9 min-[821px]:py-14`}>
        <div className="mx-auto grid max-w-v2 items-center gap-[18px] min-[821px]:grid-cols-[0.34fr_1fr] min-[821px]:gap-20">
          <Eyebrow className="!text-v2-purple/[0.85]">Also from AxisPoint</Eyebrow>
          <a
            href="https://axispoint.llc/property-management"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-between gap-5 text-[clamp(17px,1.4vw,19px)] font-medium tracking-[-0.02em] hover:text-v2-teal-support"
          >
            <span>Looking for multifamily property management?</span>
            <span aria-hidden="true" className="flex-none text-xl">&#8599;</span>
          </a>
        </div>
      </section>

      <BovStrip heading="Is your rent at market?" />

      <ClosingBand
        title="Put your property under management."
        body="Send a few details and we will call you back."
        ctaLabel="Talk about your property"
        ctaTo="/contact?role=landlord"
      />
    </>
  );
}
