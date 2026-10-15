import { Link } from 'react-router-dom';
import { Eyebrow, GUTTER, PurpleButton, TealButton, TextLink } from '@/components/ui';
import { HOME_STRIP_PROMISES } from '@/content/landlord';

const LANDLORD = [
  'Listing and marketing, including Crexi',
  'Tenant search and screening',
  'Lease negotiation and deal tracking',
];
const TENANT = [
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

function Lane(props: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
  to: string;
  cta: string;
}) {
  return (
    <div id={props.id} className="flex scroll-mt-4 flex-col gap-4 border-t border-v2-ink/20 pt-[18px]">
      <Eyebrow>{props.eyebrow}</Eyebrow>
      <h3 className="m-0 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">{props.title}</h3>
      <p className="m-0 max-w-[52ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">{props.body}</p>
      <Bullets items={props.items} />
      <TextLink to={props.to}>{props.cta}</TextLink>
    </div>
  );
}

const STRIP =
  'flex min-h-[44px] items-center justify-between gap-5 text-[19px] font-medium tracking-[-0.02em]';

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-v2-surface min-[1181px]:flex min-[1181px]:min-h-[540px] min-[1181px]:items-center">
        <div className="aspect-[1366/920] overflow-hidden min-[600px]:aspect-[21/9] min-[1181px]:absolute min-[1181px]:right-[72px] min-[1181px]:top-1/2 min-[1181px]:w-[52%] min-[1181px]:-translate-y-1/2 min-[1181px]:rounded-v2 min-[1181px]:[aspect-ratio:1366/920]">
          <img
            src="/hero.jpg"
            alt="Retail storefront with an AxisPoint For Lease banner"
            width={1366}
            height={920}
            className="block h-full w-full object-cover"
          />
        </div>
        <div className="relative z-10 px-5 pb-12 pt-9 min-[821px]:px-10 min-[821px]:pb-14 min-[821px]:pt-11 min-[1181px]:max-w-[600px] min-[1181px]:px-[72px] min-[1181px]:py-[72px]">
          <h1 className="m-0 max-w-[18ch] text-[clamp(32px,4.2vw,56px)] font-semibold leading-[1.02] tracking-[-0.04em] [text-wrap:pretty] min-[1181px]:max-w-[15ch]">
            Fill the space. Or find the one that fits.
          </h1>
          <p className="mb-8 mt-6 max-w-[38ch] text-[17.5px] leading-normal text-v2-ink/[0.7] [text-wrap:pretty]">
            Retail leasing for landlords who need tenants and tenants who need space. One direct
            line to the person doing the deal.
          </p>
          <div className="flex flex-wrap items-center gap-x-[26px] gap-y-3.5">
            <TealButton to="/contact?role=landlord">I own a property</TealButton>
            <PurpleButton to="/contact?role=tenant">I need space</PurpleButton>
          </div>
        </div>
      </section>

      <section className={`border-y border-v2-ink/10 bg-v2-field-warm py-9 ${GUTTER}`}>
        <div className="mx-auto max-w-v2">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
              <Eyebrow className="!text-v2-purple/[0.85]">For landlords</Eyebrow>
              {HOME_STRIP_PROMISES.map((p) => (
                <span key={p} className="flex items-center gap-2 text-[15px] font-medium text-v2-ink/[0.72]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 flex-none bg-v2-teal" />
                  {p}
                </span>
              ))}
            </div>
            <Link to="/landlord" className={STRIP}>
              <span>How we work with landlords</span>
              <span aria-hidden="true" className="flex-none text-xl">&#8594;</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="lanes" className={`bg-v2-surface py-[72px] ${GUTTER}`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-14">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-x-14 gap-y-10">
            <h2 className="m-0 border-t-[3px] border-v2-purple pt-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">
              Two ways we work
            </h2>
            <p className="m-0 font-serif text-[26px] font-medium leading-[1.42] text-v2-ink/[0.68] [text-wrap:pretty]">
              Whether you own the space or need it, you deal with the same people from the first
              call to the signed lease.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-x-14 gap-y-12">
            <Lane
              id="landlord"
              eyebrow="For landlords"
              title="Landlord representation"
              body="We market your vacancy, qualify the prospects, negotiate the deal, and keep you informed until the lease is signed."
              items={LANDLORD}
              to="/landlord"
              cta="Talk about your property"
            />
            <Lane
              id="tenant"
              eyebrow="For tenants"
              title="Tenant representation"
              body="Tell us what you need. We find the spaces, tour them with you, and negotiate the lease on your side of the table."
              items={TENANT}
              to="/tenant"
              cta="Tell us what you need"
            />
          </div>
        </div>
      </section>

      <section className={`border-y border-v2-ink/10 bg-v2-field-warm py-11 ${GUTTER}`}>
        <div className="mx-auto grid max-w-v2 grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] items-center gap-x-14 gap-y-5">
          <Eyebrow className="!text-v2-purple/[0.85]">Available space</Eyebrow>
          <Link to="/listings" className={STRIP}>
            <span>See current retail listings</span>
            <span aria-hidden="true" className="flex-none text-xl">&#8594;</span>
          </Link>
        </div>
      </section>

      <section className={`border-b border-v2-ink/[0.14] bg-v2-surface py-11 ${GUTTER}`}>
        <div className="mx-auto grid max-w-v2 grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] items-center gap-x-14 gap-y-5">
          <Eyebrow className="!text-v2-purple/[0.85]">Also from AxisPoint</Eyebrow>
          <a
            href="https://axispoint.llc"
            target="_blank"
            rel="noopener noreferrer"
            className={STRIP}
          >
            <span>Property management for multifamily and retail owners across Texas</span>
            <span aria-hidden="true" className="flex-none text-xl">&#8599;</span>
          </a>
        </div>
      </section>
    </>
  );
}
