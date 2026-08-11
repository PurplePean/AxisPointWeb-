import { Link } from 'react-router-dom';
import { Mark } from '@axispoint/brand';
import { useMessages } from '../i18n/LocaleProvider';
import type { Messages } from '../i18n/messages';

/**
 * Shared site footer, built from the approved source `AxisPointFooter.dc.html`
 * (design@2026-07-30).
 *
 * Structure and copy are the approved ones: identity with the positioning line,
 * a Services column, a Firm column, a Houston/contact column, and a legal row.
 * The field is #141020 with 62% white body text and white column headings, and
 * the lockup uses the lightened `onDark` purples the approved source specifies
 * for this field.
 *
 * Nothing here is invented. No street address, phone number, metric, testimonial,
 * certification, client relationship, or social link appears, because none appears
 * in the approved source.
 *
 * Two deliberate deviations, both recorded in the pull request:
 *  1. The approved board's bottom-right "Design concept" label is omitted. It marks
 *     the artefact as a concept board and would be false on a live site.
 *  2. The existing legal disclaimer is retained. The approved footer's legal row is
 *     only the copyright line, but removing real legal language is not a design
 *     decision this pass is authorised to make. Flagged for owner confirmation.
 */

/*
 * Catalog keys, not labels, and deliberately the SAME keys the header uses. The three
 * service names and Partners appear in both places and must always read identically; two
 * keys holding the same English is exactly how they stop matching once somebody translates
 * one of them.
 */
const SERVICES: [keyof Messages, string][] = [
  ['navPropertyManagement', '/property-management'],
  ['navAssetManagement', '/asset-management'],
  ['navInvestorServices', '/investor-services'],
];

const FIRM: [keyof Messages, string][] = [
  ['navPartners', '/partners'],
  ['navContact', '/contact'],
];

const linkClass =
  'text-[rgba(255,255,255,0.62)] hover:text-v2-teal transition-colors rounded-v2 inline-flex items-center';

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-bold uppercase text-white"
      style={{ fontSize: 11, letterSpacing: '0.14em', marginBottom: 14 }}
    >
      {children}
    </div>
  );
}

function Footer() {
  const t = useMessages();

  return (
    <footer
      id="site-footer"
      className="bg-v2-footer text-[rgba(255,255,255,0.62)] px-5 md:px-10 lg:px-[72px] py-[46px] lg:py-[70px]"
      style={{ fontSize: 14 }}
    >
      <div className="max-w-v2 grid grid-cols-2 lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr] gap-10">
        <div>
          <div style={{ marginBottom: 14 }}>
            <Mark variant="onDark" mode="lockup" height={23} />
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, maxWidth: '34ch' }}>{t.footerPositioning}</p>
        </div>

        <div>
          <ColumnHeading>{t.footerServices}</ColumnHeading>
          <div className="grid gap-2.5">
            {SERVICES.map(([labelKey, to]) => (
              <Link key={to} to={to} className={linkClass} style={{ minHeight: 44 }}>
                {t[labelKey]}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <ColumnHeading>{t.footerFirm}</ColumnHeading>
          <div className="grid gap-2.5">
            {FIRM.map(([labelKey, to]) => (
              <Link key={to} to={to} className={linkClass} style={{ minHeight: 44 }}>
                {t[labelKey]}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <ColumnHeading>{t.footerLocation}</ColumnHeading>
          <div className="grid gap-2.5">
            <a href="mailto:info@axispoint.llc" className={linkClass} style={{ minHeight: 44 }}>
              info@axispoint.llc
            </a>
            <span className="inline-flex items-center" style={{ minHeight: 44 }}>
              {t.footerStatewide}
            </span>
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap justify-between gap-3 border-t border-white/[0.12] text-[rgba(255,255,255,0.45)]"
        style={{ marginTop: 44, paddingTop: 18, fontSize: 12 }}
      >
        <p style={{ margin: 0, maxWidth: '80ch', lineHeight: 1.6 }}>{t.footerLegal}</p>
        <p style={{ margin: 0 }}>{t.footerCopyright}</p>
      </div>
    </footer>
  );
}

export default Footer;
