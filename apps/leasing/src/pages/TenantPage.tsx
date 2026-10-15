import { GUTTER, Eyebrow, TealButton, PageIntro } from '@/components/ui';

const SERVICES = [
  'Site search by area, size and budget',
  'Tours and side-by-side comparison',
  'Lease review and negotiation',
  'Move-in coordination',
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

export default function TenantPage() {
  return (
    <>
      <section className={`bg-v2-surface pb-12 pt-16 ${GUTTER}`}>
        <div className="mx-auto max-w-v2">
          <PageIntro title="Tenant representation">
            <p className="m-0 max-w-[54ch] text-[17.5px] leading-relaxed text-v2-ink/[0.7]">
              Tell us what you need. We find the spaces, tour them with you, and negotiate the
              lease on your side of the table.
            </p>
          </PageIntro>
        </div>
      </section>

      <section className={`bg-v2-surface pb-[72px] ${GUTTER}`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-10">
          <div className="border-t border-v2-ink/20 pt-[18px]">
            <Eyebrow>For tenants</Eyebrow>
            <p className="mb-0 mt-4 max-w-[52ch] font-serif text-[26px] font-medium leading-[1.42] text-v2-ink/[0.68] [text-wrap:pretty]">
              Space that fits your operation, terms you can build on.
            </p>
          </div>
          <Bullets items={SERVICES} />
          <div>
            <TealButton to="/contact?role=tenant">Tell us what you need</TealButton>
          </div>
        </div>
      </section>
    </>
  );
}
