import { GUTTER, Eyebrow, TealButton, PageIntro } from '@/components/ui';

const SERVICES = [
  'Listing and marketing, including Crexi',
  'Tenant search and screening',
  'Lease negotiation and deal tracking',
];

function Bullets({ items }: { items: string[] }) {
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

export default function LandlordPage() {
  return (
    <>
      <section className={`bg-v2-surface pb-12 pt-16 ${GUTTER}`}>
        <div className="mx-auto max-w-v2">
          <PageIntro title="Landlord representation">
            <p className="m-0 max-w-[54ch] text-[17.5px] leading-relaxed text-v2-ink/[0.7]">
              We market your vacancy, qualify the prospects, negotiate the deal, and keep you
              informed until the lease is signed.
            </p>
          </PageIntro>
        </div>
      </section>

      <section className={`bg-v2-surface pb-[72px] ${GUTTER}`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-10">
          <div className="border-t border-v2-ink/20 pt-[18px]">
            <Eyebrow>For landlords</Eyebrow>
            <p className="mb-0 mt-4 max-w-[52ch] font-serif text-[26px] font-medium leading-[1.42] text-v2-ink/[0.68] [text-wrap:pretty]">
              Your vacancy filled. Your terms protected.
            </p>
          </div>
          <Bullets items={SERVICES} />
          <div>
            <TealButton to="/contact?role=landlord">Talk about your property</TealButton>
          </div>
        </div>
      </section>
    </>
  );
}
