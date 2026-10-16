import { Link } from 'react-router-dom';
import { Mark } from '@axispoint/brand';
import { SITE } from '@/lib/site';
import { GUTTER } from './ui';

const linkClass = 'inline-flex min-h-[44px] items-center hover:text-white';
const heading = 'mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white';

export default function Footer() {
  return (
    <footer className={`bg-v2-footer pb-9 pt-16 text-[14px] text-white/[0.62] ${GUTTER}`}>
      <div className="mx-auto grid max-w-v2 grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10">
        <div className="flex flex-col gap-3.5">
          <Mark variant="onDark" mode="lockup" height={38} />
          <p className="m-0 max-w-[34ch] leading-relaxed">
            Retail leasing, landlord representation and tenant representation in Houston.
          </p>
        </div>
        <div className="flex flex-col">
          <span className={heading}>Services</span>
          <Link className={linkClass} to="/landlord">Landlord Rep</Link>
          <Link className={linkClass} to="/tenant">Tenant Rep</Link>
          <Link className={linkClass} to="/listings">Listings</Link>
          <Link className={linkClass} to="/property-management">Property Mgmt</Link>
        </div>
        <div className="flex flex-col">
          <span className={heading}>Firm</span>
          <Link className={linkClass} to="/">AxisPoint Partners</Link>
          <Link className={linkClass} to="/contact">Contact</Link>
          <a
            className={linkClass}
            href="https://axispoint.llc"
            target="_blank"
            rel="noopener noreferrer"
          >
            axispoint.llc &#8599;
          </a>
        </div>
        <div className="flex flex-col">
          <span className={heading}>Contact</span>
          <a className={linkClass} href={SITE.phoneHref}>{SITE.phoneDisplay}</a>
          <a className={linkClass} href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <span className="pt-1.5 leading-normal">
            {SITE.addressLines[0]}
            <br />
            {SITE.addressLines[1]}
          </span>
        </div>
      </div>
      <div className="mx-auto mt-11 flex max-w-v2 flex-wrap justify-between gap-x-8 gap-y-3 border-t border-white/[0.12] pt-[18px] text-xs text-white/[0.55]">
        <p className="m-0 max-w-[80ch] leading-relaxed">
          {SITE.license} Brokerage and leasing activities are conducted through our licensed
          partner. AxisPoint Partners does not provide tax or legal advice. This website is
          intended for informational purposes only.
        </p>
        <p className="m-0">&copy; 2026 AxisPoint Partners</p>
      </div>
    </footer>
  );
}
