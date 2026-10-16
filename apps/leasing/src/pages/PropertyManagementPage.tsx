import { GUTTER, Eyebrow, TealButton } from '@/components/ui';
import { SERVICES, visibleSections } from '@/content/propertyManagement';
import ManagedStat from '@/components/ManagedStat';

const SECTION = `bg-v2-surface ${GUTTER}`;
const DIVIDER = 'border-t border-v2-ink/20 pt-[18px]';

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {items.map((t) => (
        <li key={t} className="grid grid-cols-[12px_1fr] items-start gap-3">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 bg-v2-teal" />
          <span className="text-base leading-normal text-v2-ink/[0.72]">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PropertyManagementPage() {
  const sections = visibleSections();

  return (
    <>
      {/* Intro */}
      <section className={`${SECTION} pb-12 pt-16`}>
        <div className="mx-auto max-w-v2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-x-14 gap-y-8">
            <h1 className="m-0 border-t-[3px] border-v2-purple pt-4 text-[clamp(34px,4vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em]">
              Retail property management.
            </h1>
            <p className="m-0 font-serif text-[26px] font-medium leading-[1.42] text-v2-ink/[0.68] [text-wrap:pretty]">
              Focused on retail and NNN properties. We handle the day-to-day so
              you collect rent without managing tenants.
            </p>
          </div>
          <ManagedStat className="mt-8" />
        </div>
      </section>

      <section className={`${SECTION} pb-[72px]`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-14">

          {/* Services */}
          {sections.includes('services') && (
            <div className="flex flex-col gap-5">
              <div className={DIVIDER}>
                <Eyebrow>What we handle</Eyebrow>
                <h2 className="mb-0 mt-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">
                  Management and NNN administration.
                </h2>
                <p className="mb-0 mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">
                  Retail leases come with obligations that go beyond collecting
                  rent. We track the numbers, coordinate the vendors, and keep
                  tenants accountable to the lease.
                </p>
              </div>
              <Bullets items={SERVICES} />
            </div>
          )}

          {/* Multifamily crosslink */}
          <div className={DIVIDER}>
            <p className="m-0 max-w-[52ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">
              Looking for multifamily property management?{' '}
              <a
                href="https://axispoint.llc/property-management"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-v2-teal-support"
              >
                Visit axispoint.llc &#8599;
              </a>
            </p>
          </div>

          {/* Closing CTA */}
          <div className={DIVIDER}>
            <p className="mb-6 max-w-[44ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">
              Ready to put your property under management? Send a few details
              and we will call you back.
            </p>
            <TealButton to="/contact?role=landlord">Talk about your property</TealButton>
          </div>

        </div>
      </section>
    </>
  );
}
