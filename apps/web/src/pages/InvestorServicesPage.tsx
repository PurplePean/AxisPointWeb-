import { useDocumentMeta } from '../lib/meta';
import {
  Eyebrow,
  GUTTER,
  MEASURE,
  SECTION,
  ClosingCta,
  PhotoBand,
  ServiceHero,
  QuietLink,
} from '../components/PageParts';

/**
 * Investor Services, built from `AxisPoint System Studies.dc.html` with
 * `page="investor-services"` (design@2026-07-30).
 *
 * The approved positioning is that this is the smaller of the three paths and stays
 * that way on purpose, so the page is short and its closing action carries the
 * investor-specific label rather than the management-proposal wording.
 *
 * The photograph is the cleared Juan Nino Unsplash asset, the only one of the four
 * launch images that never needed an Adobe licence confirmation.
 */

const TIMELINE: { label: string; body: string }[] = [
  {
    label: 'Before the purchase',
    body: 'An operating read on what the property will take to run, so the assumptions behind the offer are the ones a manager would use.',
  },
  {
    label: 'At closing',
    body: 'A management team in place on day one, with staffing, systems, and vendor relationships ready rather than pending.',
  },
  {
    label: 'After the first property',
    body: 'The relationship moves into Property Management, with Asset Management added if the ownership view calls for it.',
  },
];

function InvestorServicesPage() {
  useDocumentMeta({
    title: 'Investor Services for Texas Commercial Real Estate | AxisPoint Partners',
    description:
      'For capital-ready clients acquiring multifamily or retail in Texas who want the operating side accounted for before the purchase, not after it.',
    path: '/investor-services',
  });

  return (
    <>
      <ServiceHero
        eyebrow="Investor Services"
        eyebrowColor="#9F328C"
        title="A way into Texas commercial real estate with an operating team behind you"
        answer="For capital-ready clients acquiring multifamily or retail in Texas who want the operating side accounted for before the purchase, not after it."
      />

      <PhotoBand
        photo={{
          base: 'investor-services-interchange',
          alt: 'Aerial view of a highway interchange in Houston',
          width: 2560,
          height: 1280,
        }}
        heightClass="h-[230px] lg:h-[340px]"
        focal="46% 58%"
        focalMobile="62% 62%"
      />

      {/* ── Who this is for ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-6 lg:gap-20 items-start`}>
          <Eyebrow className="text-v2-magenta border-t-[3px] border-v2-magenta pt-4">
            Who this is for
          </Eyebrow>
          <div>
            <p
              className="m-0 font-serif text-[rgba(28,22,40,0.68)]"
              style={{ fontSize: 'clamp(23px,2.4vw,31px)', fontWeight: 500, lineHeight: 1.42, textWrap: 'pretty', maxWidth: '26ch' }}
            >
              Capital-ready clients who need an operating team before they can act.
            </p>
            <p
              className="mt-[22px] mb-0 text-[rgba(28,22,40,0.68)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '54ch' }}
            >
              Investor Services is the smaller of the three paths and stays that way on purpose. It
              exists for owners entering commercial real estate, or entering Texas, who want the
              operating side handled from the first property rather than assembled after closing.
            </p>
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section className={`${GUTTER} ${SECTION} bg-[#FFFCF6] border-y border-[rgba(28,22,40,0.1)]`}>
        <div className={`${MEASURE} grid`}>
          {TIMELINE.map((row, i) => (
            <div
              key={row.label}
              className={`grid lg:grid-cols-[0.34fr_1fr] gap-2.5 lg:gap-20 py-[22px] lg:py-[30px] border-t border-[rgba(28,22,40,0.16)] ${
                i === TIMELINE.length - 1 ? 'border-b' : ''
              }`}
            >
              <h2
                className="m-0 font-semibold"
                style={{ fontSize: 'clamp(19px,1.8vw,23px)', letterSpacing: '-0.02em' }}
              >
                {row.label}
              </h2>
              <p className="m-0 text-[rgba(28,22,40,0.66)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.6 }}>
                {row.body}
              </p>
            </div>
          ))}
          <div className="mt-[30px] lg:mt-12">
            <QuietLink to="/property-management">Property Management</QuietLink>
          </div>
        </div>
      </section>

      <ClosingCta
        title="Tell us what you are looking to acquire."
        body="Send the property type, the market, and the timeline. A partner responds with an operating read and what management would look like."
        ctaLabel="Discuss an acquisition"
        ctaTo="/contact?intent=investor-services"
      />
    </>
  );
}

export default InvestorServicesPage;
