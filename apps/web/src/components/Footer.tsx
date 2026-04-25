import { Link } from 'react-router-dom';
import Logo from './Logo';

function Footer() {
  return (
    <footer className="bg-[#0D0A17] text-body py-16">
      <div className="max-w-[1160px] mx-auto px-7">
        {/* Top Section */}
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12 mb-12">
          {/* Brand Column */}
          <div>
            <div className="mb-5">
              <Logo height={32} className="brightness-0 invert opacity-60" />
            </div>
            <p className="text-sm text-hint leading-relaxed">
              Institutional-grade commercial real estate asset management for owners and advisors
              across Texas.
            </p>
          </div>

          {/* Services Column */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-hint mb-4">Services</h5>
            <div className="flex flex-col gap-2.5">
              <Link to="/services" className="text-sm text-sub hover:text-teal transition-colors">
                Asset Management
              </Link>
              <Link to="/services" className="text-sm text-sub hover:text-teal transition-colors">
                Advisory and Acquisitions
              </Link>
              <Link to="/services" className="text-sm text-sub hover:text-teal transition-colors">
                Asset Takeover
              </Link>
              <Link to="/services" className="text-sm text-sub hover:text-teal transition-colors">
                Referral Partners
              </Link>
            </div>
          </div>

          {/* Company Column */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-hint mb-4">Company</h5>
            <div className="flex flex-col gap-2.5">
              <Link to="/team" className="text-sm text-sub hover:text-teal transition-colors">
                Team
              </Link>
              <Link to="/learn" className="text-sm text-sub hover:text-teal transition-colors">
                Learn
              </Link>
              <Link to="/contact" className="text-sm text-sub hover:text-teal transition-colors">
                Contact
              </Link>
              <a
                href="https://qr.axispoint.llc"
                className="text-sm text-sub hover:text-teal transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Digital Card
              </a>
            </div>
          </div>

          {/* Contact Column */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-hint mb-4">Contact</h5>
            <div className="flex flex-col gap-2.5">
              <a
                href="mailto:info@axispoint.llc"
                className="text-sm text-sub hover:text-teal transition-colors"
              >
                info@axispoint.llc
              </a>
              <a
                href="tel:+18323516501"
                className="text-sm text-sub hover:text-teal transition-colors"
              >
                (832) 351-6501
              </a>
              <span className="text-sm text-hint">Houston, TX</span>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-white/10 pt-8">
          <p className="text-xs text-hint mb-3 leading-relaxed max-w-3xl">
            Brokerage and leasing activities are conducted through our licensed partner. AxisPoint
            Partners does not provide tax or legal advice. This website is intended for
            informational purposes only and does not constitute an offer to sell securities.
          </p>
          <p className="text-xs text-hint">© 2025 AxisPoint Partners LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
