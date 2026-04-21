import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="bg-ink text-body py-16">
      <div className="max-w-[1160px] mx-auto px-7">
        {/* Top Section: Brand + Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand Column */}
          <div>
            <div className="text-2xl font-serif font-semibold mb-4">
              AxisPoint Partners
            </div>
            <p className="text-sm text-sub leading-relaxed">
              Institutional-grade commercial real estate asset management for owners and advisors
              across Texas.
            </p>
          </div>

          {/* Services Column */}
          <div>
            <h5 className="text-sm font-semibold uppercase tracking-wider mb-4">Services</h5>
            <div className="flex flex-col gap-2">
              <Link
                to="/services"
                className="text-sm text-sub hover:text-teal transition-colors"
              >
                Asset Management
              </Link>
              <Link
                to="/services"
                className="text-sm text-sub hover:text-teal transition-colors"
              >
                Advisory and Acquisitions
              </Link>
              <Link
                to="/services"
                className="text-sm text-sub hover:text-teal transition-colors"
              >
                Asset Takeover
              </Link>
              <Link
                to="/services"
                className="text-sm text-sub hover:text-teal transition-colors"
              >
                Referral Partners
              </Link>
            </div>
          </div>

          {/* Company Column */}
          <div>
            <h5 className="text-sm font-semibold uppercase tracking-wider mb-4">Company</h5>
            <div className="flex flex-col gap-2">
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
        </div>

        {/* Bottom Section: Legal + Copyright */}
        <div className="border-t border-border-dark pt-8">
          <p className="text-xs text-hint mb-4 leading-relaxed">
            Brokerage and leasing activities are conducted through our licensed partner. AxisPoint
            Partners does not provide tax or legal advice. This website is intended for
            informational purposes only and does not constitute an offer to sell securities.
          </p>
          <p className="text-xs text-hint">© 2025 AxisPoint Partners LLC</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
