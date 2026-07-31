import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../lib/meta';
import {
  Eyebrow,
  GUTTER,
  MEASURE,
  SECTION,
  ClosingCta,
  PhotoBand,
} from '../components/PageParts';

/**
 * Property Management, built from the approved source
 * `AxisPoint Property Management.dc.html` (design@2026-07-30).
 *
 * Per docs/design-sources.md correction 2, this file is authoritative for
 * /property-management even though the exported Design Index files it as historical.
 *
 * The approved seven-section structure is preserved in order: hero, photograph band,
 * "What AxisPoint takes responsibility for", the four operating functions, "Where
 * AxisPoint is strongest", "Questions owners ask before they switch", the related
 * strip, and the closing proposal band.
 *
 * The authoritative page uses one photograph and no separate retail image. Its
 * render values carry unused retail-module variables, which is how the design records
 * that the module was considered and dropped. No retail photograph is added here.
 */

const FUNCTIONS: { title: string; lede: string; items: string[] }[] = [
  {
    title: 'Onsite operations',
    lede: 'The people at the property and the routines they hold to. Staffing decisions, leasing oversight, response standards, and turn schedules that keep the property on plan week to week.',
    items: ['Onsite staffing and supervision', 'Leasing oversight', 'Resident and tenant response', 'Turns and make-ready', 'Preventive maintenance'],
  },
  {
    title: 'Financial controls',
    lede: 'Budgets built with ownership, approval thresholds agreed in advance, and a monthly close where any number can be traced back to the decision behind it.',
    items: ['Annual and reforecast budgets', 'Approval thresholds', 'Collections and delinquency', 'Payables and month-end close', 'Variance explanation'],
  },
  {
    title: 'Vendor performance',
    lede: 'Scoped work, real bid discipline, and follow-through measured on the quality of the result rather than the closing of a ticket.',
    items: ['Scope and bid process', 'Contract and insurance compliance', 'Quality verification', 'Capital project coordination'],
  },
  {
    title: 'Owner reporting and communication',
    lede: 'One record of what happened at the property, what it cost, and what comes next, plus a partner who answers between reporting periods.',
    items: ['Monthly reporting package', 'Operating narrative', 'Capital and project tracking', 'Direct partner access'],
  },
];

const STRENGTHS: { title: string; items: string[] }[] = [
  {
    title: 'Property types',
    items: ['Multifamily as a primary focus', 'Retail as a primary focus', 'Properties that can support onsite staff', 'Coordinated portfolios under one owner', 'Scattered-site portfolios run as one program'],
  },
  {
    title: 'Geography',
    items: ['Houston and the surrounding MSA', 'Dallas and Fort Worth', 'San Antonio', 'Austin', 'Owners statewide across Texas'],
  },
  {
    title: 'Assignments',
    items: ['Management transitions', 'Lease-ups', 'Heavy capital programs', 'Deferred operational problems', 'Turnaround assignments'],
  },
];

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'How long does a management transition take?',
    a: 'It depends on the property and the outgoing manager, but the plan is written before the start date: staffing, systems, banking, vendor records, and resident or tenant communication each have an owner and a date.',
  },
  {
    q: 'Who will actually be answering for my property?',
    a: 'A partner. Zachary Russell and Ethaniel Vu stay close enough to the work to know the property by name, and ownership is not routed through an account layer to reach them.',
  },
  {
    q: 'What does reporting look like month to month?',
    a: 'A consistent package on a consistent schedule, with a written narrative that explains the variances rather than leaving ownership to interpret the numbers alone.',
  },
  {
    q: 'Can you take on a property with deferred problems?',
    a: 'Yes. Deferred maintenance, unresolved capital work, and staffing gaps are common reasons owners call. The proposal states what gets addressed first and in what order.',
  },
];

function PropertyManagementPage() {
  useDocumentMeta({
    title: 'Property Management in Houston and Across Texas | AxisPoint Partners',
    description:
      'AxisPoint takes operating responsibility for multifamily and retail properties in Texas: onsite operations, financial controls, vendor performance, and owner reporting.',
    path: '/property-management',
  });

  return (
    <>
      {/* ── Hero ── */}
      <section className={`${GUTTER} pt-11 lg:pt-[84px] pb-10 lg:pb-[72px]`}>
        <div className={MEASURE}>
          <Eyebrow className="text-v2-teal" style={{ marginBottom: 20 }}>
            Property Management
          </Eyebrow>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-[22px] lg:gap-20 items-end">
            <h1
              className="m-0 font-semibold"
              style={{ fontSize: 'clamp(38px,4.6vw,62px)', letterSpacing: '-0.045em', lineHeight: 1, textWrap: 'pretty' }}
            >
              Commercial property management in Houston and across Texas
            </h1>
            <p
              className="m-0 text-[rgba(28,22,40,0.7)]"
              style={{ fontSize: 'clamp(17px,1.3vw,19px)', lineHeight: 1.5, maxWidth: '42ch', textWrap: 'pretty' }}
            >
              AxisPoint takes operating responsibility for multifamily and retail properties: the
              onsite team, the money, the vendors, and the reporting ownership uses to make
              decisions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-[26px] gap-y-3.5 mt-8 lg:mt-[52px]">
            <Link
              to="/contact?intent=property-management"
              className="inline-flex items-center gap-2.5 rounded-v2 bg-v2-teal font-bold text-v2-action-label transition-colors hover:bg-v2-teal-support hover:text-white"
              style={{ minHeight: 54, padding: '0 26px', fontSize: 15 }}
            >
              Request a Management Proposal <span aria-hidden="true" style={{ fontSize: 16 }}>&#8594;</span>
            </Link>
            <a
              href="#scope"
              className="inline-flex items-center gap-2 font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 hover:text-v2-teal-support"
              style={{ fontSize: 15, paddingBottom: 3, minHeight: 44 }}
            >
              See the four operating functions <span aria-hidden="true">&#8595;</span>
            </a>
          </div>
        </div>
      </section>

      <PhotoBand
        photo={{
          base: 'property-management-aerial',
          alt: 'Aerial view of a Texas multifamily community and adjacent retail center',
          width: 2560,
          height: 1280,
        }}
        heightClass="h-[240px] lg:h-[400px]"
        focal="50% 70%"
        focalMobile="38% 72%"
      />

      {/* ── What AxisPoint takes responsibility for ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-[22px] lg:gap-20 items-start`}>
          <h2
            className="m-0 font-semibold border-t-[3px] border-v2-purple pt-4"
            style={{ fontSize: 'clamp(22px,2.2vw,30px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            What AxisPoint takes responsibility for
          </h2>
          <p
            className="m-0 font-serif text-[rgba(28,22,40,0.68)]"
            style={{ fontSize: 'clamp(23px,2.4vw,31px)', fontWeight: 500, lineHeight: 1.42, textWrap: 'pretty' }}
          >
            Everything that determines how the property runs day to day, and one owner-facing
            record of it. When something goes wrong at the property, ownership does not have to
            find out who to call.
          </p>
        </div>
      </section>

      {/* ── Four operating functions ── */}
      <section
        id="scope"
        className={`${GUTTER} ${SECTION} bg-[#FFFCF6] border-y border-[rgba(28,22,40,0.1)] scroll-mt-4`}
      >
        <div className={MEASURE}>
          <h2
            className="m-0 mb-8 lg:mb-[52px] font-semibold"
            style={{ fontSize: 'clamp(28px,3.4vw,44px)', letterSpacing: '-0.035em', lineHeight: 1.05, maxWidth: '18ch', textWrap: 'pretty' }}
          >
            Four operating functions, one accountable team
          </h2>
          <div className="grid">
            {FUNCTIONS.map((fn) => (
              <div
                key={fn.title}
                className="grid lg:grid-cols-[0.34fr_1fr] gap-3 lg:gap-20 py-6 lg:py-8 border-t border-[rgba(28,22,40,0.16)]"
              >
                <h3
                  className="m-0 font-semibold"
                  style={{ fontSize: 'clamp(21px,2vw,26px)', letterSpacing: '-0.025em', lineHeight: 1.15 }}
                >
                  {fn.title}
                </h3>
                <div>
                  <p
                    className="mt-0 mb-4 text-[rgba(28,22,40,0.68)]"
                    style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.6, maxWidth: '56ch' }}
                  >
                    {fn.lede}
                  </p>
                  <ul className="flex flex-wrap gap-x-7 gap-y-2 list-none p-0 m-0 text-[rgba(28,22,40,0.6)]" style={{ fontSize: 14.5 }}>
                    {fn.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
            <div className="border-t border-[rgba(28,22,40,0.16)]" />
          </div>
        </div>
      </section>

      {/* ── Where AxisPoint is strongest ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={MEASURE}>
          <div className="grid lg:grid-cols-[0.34fr_1fr] gap-[22px] lg:gap-20 items-start mb-8 lg:mb-[52px]">
            <h2
              className="m-0 font-semibold border-t-[3px] border-v2-purple pt-4"
              style={{ fontSize: 'clamp(22px,2.2vw,30px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
            >
              Where AxisPoint is strongest
            </h2>
            <p
              className="m-0 text-[rgba(28,22,40,0.66)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '54ch' }}
            >
              These are the situations the team is built around. They are areas of strength rather
              than requirements, and a property outside them is still worth a conversation.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-[34px] lg:gap-12">
            {STRENGTHS.map((g) => (
              <div key={g.title} className="border-t border-[rgba(28,22,40,0.2)] pt-[18px]">
                <Eyebrow className="text-v2-purple" style={{ marginBottom: 16 }}>
                  {g.title}
                </Eyebrow>
                <ul className="grid gap-3 list-none p-0 m-0">
                  {g.items.map((it) => (
                    <li key={it} className="grid grid-cols-[12px_1fr] gap-3 items-start">
                      <span aria-hidden="true" className="bg-v2-teal" style={{ width: 6, height: 6, marginTop: 8 }} />
                      <span className="text-[rgba(28,22,40,0.72)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.5 }}>
                        {it}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Questions owners ask before they switch ── */}
      <section className={`${GUTTER} ${SECTION} bg-[#FFFCF6] border-y border-[rgba(28,22,40,0.1)]`}>
        <div className={MEASURE}>
          <h2
            className="m-0 mb-8 lg:mb-[52px] font-semibold"
            style={{ fontSize: 'clamp(22px,2.2vw,30px)', letterSpacing: '-0.03em' }}
          >
            Questions owners ask before they switch
          </h2>
          <div className="grid">
            {QUESTIONS.map((q) => (
              <div
                key={q.q}
                className="grid lg:grid-cols-[0.42fr_1fr] gap-3 lg:gap-20 py-6 lg:py-8 border-t border-[rgba(28,22,40,0.16)]"
              >
                <h3
                  className="m-0 font-semibold"
                  style={{ fontSize: 'clamp(17px,1.6vw,20px)', letterSpacing: '-0.02em', lineHeight: 1.25 }}
                >
                  {q.q}
                </h3>
                <p className="m-0 text-[rgba(28,22,40,0.68)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.6 }}>
                  {q.a}
                </p>
              </div>
            ))}
            <div className="border-t border-[rgba(28,22,40,0.16)]" />
          </div>
        </div>
      </section>

      {/* ── Related ── */}
      <section className={`${GUTTER} py-9 lg:py-14 border-b border-[rgba(28,22,40,0.14)]`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-[18px] lg:gap-20 items-center`}>
          <Eyebrow style={{ color: 'rgba(56,40,93,0.85)' }}>Related</Eyebrow>
          <div className="grid gap-3.5">
            <Link
              to="/asset-management"
              className="flex items-center justify-between gap-5 font-medium border-b border-[rgba(28,22,40,0.14)] pb-3.5 rounded-v2 hover:text-v2-teal-support"
              style={{ fontSize: 'clamp(17px,1.4vw,19px)', letterSpacing: '-0.02em', minHeight: 44 }}
            >
              <span>Asset Management sits above the operating work, for owners who want the investment view</span>
              <span aria-hidden="true" className="flex-none" style={{ fontSize: 20 }}>&#8594;</span>
            </Link>
            <Link
              to="/investor-services"
              className="flex items-center justify-between gap-5 font-medium rounded-v2 hover:text-v2-teal-support"
              style={{ fontSize: 'clamp(17px,1.4vw,19px)', letterSpacing: '-0.02em', minHeight: 44 }}
            >
              <span>Investor Services is the entry path for capital-ready clients without an operating team</span>
              <span aria-hidden="true" className="flex-none" style={{ fontSize: 20 }}>&#8594;</span>
            </Link>
          </div>
        </div>
      </section>

      <ClosingCta
        title="Send us the property and the situation."
        body="A management proposal covers staffing, the reporting package, the transition plan, and who at AxisPoint answers for the property."
        signature="Zachary Russell and Ethaniel Vu, Partners."
        ctaLabel="Request a Management Proposal"
        ctaTo="/contact?intent=property-management"
      />
    </>
  );
}

export default PropertyManagementPage;
