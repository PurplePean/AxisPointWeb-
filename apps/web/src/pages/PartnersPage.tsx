import { useDocumentMeta } from '../lib/meta';
import { Eyebrow, GUTTER, MEASURE, SECTION, ClosingCta, ServiceHero } from '../components/PageParts';

/**
 * Partners, built from `AxisPoint System Studies.dc.html` with `page="partners"`
 * (design@2026-07-30).
 *
 * The approved treatment is two ruled rows and nothing else. Both people are titled
 * Partner only. There are no headshots, no LinkedIn or external profile links, no
 * credentials, no metrics, and no direct phone numbers, because the approved source
 * carries none of those. The longer V1 biographies in packages/brand `team.ts` are
 * deliberately not used here: they are V1 copy, not approved V2 copy, and this page
 * uses only what the authoritative source states.
 *
 * The approved page has no photograph.
 */

const PARTNERS: { name: string; body: string }[] = [
  {
    name: 'Zachary Russell',
    body: 'Works directly on operating performance: staffing decisions, transitions, capital programs, and the properties in the portfolio that need attention this month.',
  },
  {
    name: 'Ethaniel Vu',
    body: 'Works directly on financial controls and the owner-facing record: budgets, approval discipline, monthly close, and the reporting ownership uses to make decisions.',
  },
];

function PartnersPage() {
  useDocumentMeta({
    title: 'Partners | AxisPoint Partners',
    description:
      'AxisPoint is partner-led from Houston. Zachary Russell and Ethaniel Vu stay on the properties they take on, so ownership talks to the people making the decisions.',
    path: '/partners',
  });

  return (
    <>
      <ServiceHero
        eyebrow="Partners"
        eyebrowColor="#24A5BC"
        title="Two partners, directly accountable for the work"
        answer="AxisPoint is partner-led from Houston. The people who take the assignment are the people who stay on it."
      />

      {/* ── The two partners, as ruled rows ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={`${MEASURE} grid`}>
          {PARTNERS.map((p, i) => (
            <div
              key={p.name}
              className={`grid lg:grid-cols-[0.34fr_1fr] gap-2.5 lg:gap-20 py-[22px] lg:py-[30px] border-t border-[rgba(28,22,40,0.18)] ${
                i === PARTNERS.length - 1 ? 'border-b' : ''
              }`}
            >
              <div>
                <h2
                  className="m-0 font-semibold"
                  style={{ fontSize: 'clamp(22px,2.2vw,28px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
                >
                  {p.name}
                </h2>
                <div
                  className="font-bold uppercase text-v2-teal"
                  style={{ fontSize: 12, letterSpacing: '0.14em', marginTop: 10 }}
                >
                  Partner
                </div>
              </div>
              <p className="m-0 text-[rgba(28,22,40,0.68)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '56ch' }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How we work ── */}
      <section className={`${GUTTER} ${SECTION} bg-[#FFFCF6] border-y border-[rgba(28,22,40,0.1)]`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-6 lg:gap-20 items-start`}>
          <Eyebrow className="border-t-[3px] border-v2-purple pt-4" style={{ color: 'rgba(56,40,93,0.85)' }}>
            How we work
          </Eyebrow>
          <p
            className="m-0 font-serif text-[rgba(28,22,40,0.68)]"
            style={{ fontSize: 'clamp(23px,2.4vw,31px)', fontWeight: 500, lineHeight: 1.42, textWrap: 'pretty' }}
          >
            Both partners stay on the properties they take on. Ownership talks to the people making
            the decisions, not to a layer arranged in front of them.
          </p>
        </div>
      </section>

      <ClosingCta
        title="Talk to a partner about your property."
        body="Send the property and the situation. The partner who reads it is the one who would answer for it."
        ctaLabel="Request a Management Proposal"
        ctaTo="/contact?intent=property-management"
      />
    </>
  );
}

export default PartnersPage;
