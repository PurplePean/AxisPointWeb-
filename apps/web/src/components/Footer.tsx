import { Link } from 'react-router-dom';
import Logo from './Logo';

/**
 * Shared site footer, used on Home, Services, Partners, and Contact.
 *
 * On the homepage the closing CTA sits directly above it on the same dark field
 * and resolves into #0D0A17, so the two read as a single closing block. The
 * hairline below the footer's top padding is the only divider between them,
 * and it reads as the page-to-footer boundary on every other route.
 *
 * Deliberately institutional and short: identity, location, navigation, service
 * anchors, the referral pathway, direct contact, legal. It is also the single
 * source of direct contact details on the site, which is why the homepage closing
 * CTA carries a button only. Not a sitemap, and Learn is not part of the launch
 * site and must not be reintroduced here.
 */

const SERVICES: [string, string][] = [
  ['Property Management', '/services#property-management'],
  ['Asset Management', '/services#asset-management'],
  ['Investor Services', '/services#investor-services'],
];

/* Submit a Referral points at the bare /contact picker on purpose: no public intent
   token resolves to the referral role, so the picker is the real entry point. */
const COMPANY: [string, string][] = [
  ['Services', '/services'],
  ['Partners', '/team'],
  ['Submit a Referral', '/contact'],
  ['Contact', '/contact'],
];

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="uppercase font-semibold text-hint mb-4" style={{ fontSize: '0.62rem', letterSpacing: '0.14em' }}>
      {children}
    </h5>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0D0A17] text-body">
      <div className="max-w-[1160px] mx-auto px-7">

        {/* Identity, services, navigation, contact. Two columns on mobile so the
            four blocks do not stack into a long ribbon; the 44px link tap targets
            from the global mobile stylesheet are preserved either way. */}
        <div className="border-t border-white/10 pt-14 max-md:pt-8 pb-12 max-md:pb-6 grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1.1fr] gap-x-12 max-md:gap-x-6 gap-y-10 max-md:gap-y-7">
          <div className="max-md:col-span-2">
            <Logo height={30} className="brightness-0 invert opacity-60" />
            <p className="text-sm text-hint leading-relaxed mt-5 max-md:mt-4 max-w-xs">
              Commercial property management for owners across Texas.
            </p>
            <p className="text-sm text-hint mt-4 max-md:mt-3">Houston, Texas</p>
          </div>

          <div>
            <ColumnHeading>Services</ColumnHeading>
            <div className="flex flex-col gap-2.5 max-md:gap-0">
              {SERVICES.map(([label, to]) => (
                <Link key={to} to={to} className="text-sm text-[#B9B4C4] hover:text-teal transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <ColumnHeading>Company</ColumnHeading>
            <div className="flex flex-col gap-2.5 max-md:gap-0">
              {COMPANY.map(([label, to]) => (
                <Link key={label} to={to} className="text-sm text-[#B9B4C4] hover:text-teal transition-colors">
                  {label}
                </Link>
              ))}
              <a
                href="https://qr.axispoint.llc"
                className="text-sm text-[#B9B4C4] hover:text-teal transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Digital Card
              </a>
            </div>
          </div>

          <div>
            <ColumnHeading>Contact</ColumnHeading>
            <div className="flex flex-col gap-2.5 max-md:gap-0">
              <a href="mailto:zach@axispoint.llc" className="text-sm text-[#B9B4C4] hover:text-teal transition-colors">
                zach@axispoint.llc
              </a>
              <a href="tel:+18325802815" className="text-sm text-[#B9B4C4] hover:text-teal transition-colors">
                (832) 580-2815
              </a>
              <Link to="/contact?intent=property-management" className="text-sm text-[#B9B4C4] hover:text-teal transition-colors">
                Start a conversation
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom: legal */}
        <div className="border-t border-white/10 py-8 max-md:!py-5 flex flex-col gap-3">
          <p className="text-xs text-hint leading-relaxed max-w-3xl">
            Brokerage and leasing activities are conducted through our licensed partner. AxisPoint
            Partners does not provide tax or legal advice. This website is intended for
            informational purposes only and does not constitute an offer to sell securities.
          </p>
          <p className="text-xs text-hint">© 2026 AxisPoint Partners LLC. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
