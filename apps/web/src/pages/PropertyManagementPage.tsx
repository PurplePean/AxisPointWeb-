import { LocaleLink } from '../components/LocaleLink';
import { useDocumentMeta } from '../lib/meta';
import {
  Eyebrow,
  GUTTER,
  MEASURE,
  SECTION,
  ClosingCta,
  PhotoBand,
} from '../components/PageParts';
import { useMessages } from '../i18n/LocaleProvider';
import type { Messages } from '../i18n/messages';

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

/*
 * These three structures hold catalog KEYS, not copy. The section order, the grouping, and
 * the number of bullets are layout decisions from the approved source and stay in code; only
 * the words come from the catalog.
 */
type K = keyof Messages;

const FUNCTIONS: { titleKey: K; ledeKey: K; itemKeys: K[] }[] = [
  {
    titleKey: 'pmFnOnsiteTitle',
    ledeKey: 'pmFnOnsiteLede',
    itemKeys: ['pmFnOnsiteItem1', 'pmFnOnsiteItem2', 'pmFnOnsiteItem3', 'pmFnOnsiteItem4', 'pmFnOnsiteItem5'],
  },
  {
    titleKey: 'pmFnFinancialTitle',
    ledeKey: 'pmFnFinancialLede',
    itemKeys: ['pmFnFinancialItem1', 'pmFnFinancialItem2', 'pmFnFinancialItem3', 'pmFnFinancialItem4', 'pmFnFinancialItem5'],
  },
  {
    titleKey: 'pmFnVendorTitle',
    ledeKey: 'pmFnVendorLede',
    itemKeys: ['pmFnVendorItem1', 'pmFnVendorItem2', 'pmFnVendorItem3', 'pmFnVendorItem4'],
  },
  {
    titleKey: 'pmFnReportingTitle',
    ledeKey: 'pmFnReportingLede',
    itemKeys: ['pmFnReportingItem1', 'pmFnReportingItem2', 'pmFnReportingItem3', 'pmFnReportingItem4'],
  },
];

const STRENGTHS: { titleKey: K; itemKeys: K[] }[] = [
  {
    titleKey: 'pmStrengthTypesTitle',
    itemKeys: ['pmStrengthTypesItem1', 'pmStrengthTypesItem2', 'pmStrengthTypesItem3', 'pmStrengthTypesItem4', 'pmStrengthTypesItem5'],
  },
  {
    titleKey: 'pmStrengthGeographyTitle',
    itemKeys: ['pmStrengthGeographyItem1', 'pmStrengthGeographyItem2', 'pmStrengthGeographyItem3', 'pmStrengthGeographyItem4', 'pmStrengthGeographyItem5'],
  },
  {
    titleKey: 'pmStrengthAssignmentsTitle',
    itemKeys: ['pmStrengthAssignmentsItem1', 'pmStrengthAssignmentsItem2', 'pmStrengthAssignmentsItem3', 'pmStrengthAssignmentsItem4', 'pmStrengthAssignmentsItem5'],
  },
];

const QUESTIONS: { qKey: K; aKey: K }[] = [
  { qKey: 'pmQ1', aKey: 'pmA1' },
  { qKey: 'pmQ2', aKey: 'pmA2' },
  { qKey: 'pmQ3', aKey: 'pmA3' },
  { qKey: 'pmQ4', aKey: 'pmA4' },
];

function PropertyManagementPage() {
  const t = useMessages();

  useDocumentMeta({
    title: t.pmMetaTitle,
    description: t.pmMetaDescription,
    path: '/property-management',
  });

  return (
    <>
      {/* ── Hero ── */}
      <section className={`${GUTTER} pt-11 lg:pt-[84px] pb-10 lg:pb-[72px]`}>
        <div className={MEASURE}>
          <Eyebrow className="text-v2-teal" style={{ marginBottom: 20 }}>
            {t.navPropertyManagement}
          </Eyebrow>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-[22px] lg:gap-20 items-end">
            <h1
              className="m-0 font-semibold"
              style={{ fontSize: 'clamp(38px,4.6vw,62px)', letterSpacing: '-0.045em', lineHeight: 1, textWrap: 'pretty' }}
            >
              {t.pmHeroTitle}
            </h1>
            <p
              className="m-0 text-[rgba(28,22,40,0.7)]"
              style={{ fontSize: 'clamp(17px,1.3vw,19px)', lineHeight: 1.5, maxWidth: '42ch', textWrap: 'pretty' }}
            >
              {t.pmHeroLead}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-[26px] gap-y-3.5 mt-8 lg:mt-[52px]">
            <LocaleLink
              to="/contact?intent=property-management"
              className="inline-flex items-center gap-2.5 rounded-v2 bg-v2-teal font-bold text-v2-action-label transition-colors hover:bg-v2-teal-support hover:text-white"
              style={{ minHeight: 54, padding: '0 26px', fontSize: 15 }}
            >
              {t.navCta} <span aria-hidden="true" style={{ fontSize: 16 }}>&#8594;</span>
            </LocaleLink>
            <a
              href="#scope"
              className="inline-flex items-center gap-2 font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 hover:text-v2-teal-support"
              style={{ fontSize: 15, paddingBottom: 3, minHeight: 44 }}
            >
              {t.pmSeeFunctions} <span aria-hidden="true">&#8595;</span>
            </a>
          </div>
        </div>
      </section>

      <PhotoBand
        photo={{
          base: 'property-management-aerial',
          alt: t.pmPhotoAlt,
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
            {t.pmResponsibilityTitle}
          </h2>
          <p
            className="m-0 font-serif text-[rgba(28,22,40,0.68)]"
            style={{ fontSize: 'clamp(23px,2.4vw,31px)', fontWeight: 500, lineHeight: 1.42, textWrap: 'pretty' }}
          >
            {t.pmResponsibilityBody}
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
            {t.pmFunctionsTitle}
          </h2>
          <div className="grid">
            {FUNCTIONS.map((fn) => (
              <div
                key={fn.titleKey}
                className="grid lg:grid-cols-[0.34fr_1fr] gap-3 lg:gap-20 py-6 lg:py-8 border-t border-[rgba(28,22,40,0.16)]"
              >
                <h3
                  className="m-0 font-semibold"
                  style={{ fontSize: 'clamp(21px,2vw,26px)', letterSpacing: '-0.025em', lineHeight: 1.15 }}
                >
                  {t[fn.titleKey]}
                </h3>
                <div>
                  <p
                    className="mt-0 mb-4 text-[rgba(28,22,40,0.68)]"
                    style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.6, maxWidth: '56ch' }}
                  >
                    {t[fn.ledeKey]}
                  </p>
                  <ul className="flex flex-wrap gap-x-7 gap-y-2 list-none p-0 m-0 text-[rgba(28,22,40,0.6)]" style={{ fontSize: 14.5 }}>
                    {fn.itemKeys.map((it) => (
                      <li key={it}>{t[it]}</li>
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
              {t.pmStrengthsTitle}
            </h2>
            <p
              className="m-0 text-[rgba(28,22,40,0.66)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '54ch' }}
            >
              {t.pmStrengthsBody}
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-[34px] lg:gap-12">
            {STRENGTHS.map((g) => (
              <div key={g.titleKey} className="border-t border-[rgba(28,22,40,0.2)] pt-[18px]">
                <Eyebrow className="text-v2-purple" style={{ marginBottom: 16 }}>
                  {t[g.titleKey]}
                </Eyebrow>
                <ul className="grid gap-3 list-none p-0 m-0">
                  {g.itemKeys.map((it) => (
                    <li key={it} className="grid grid-cols-[12px_1fr] gap-3 items-start">
                      <span aria-hidden="true" className="bg-v2-teal" style={{ width: 6, height: 6, marginTop: 8 }} />
                      <span className="text-[rgba(28,22,40,0.72)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.5 }}>
                        {t[it]}
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
            {t.pmQuestionsTitle}
          </h2>
          <div className="grid">
            {QUESTIONS.map((q) => (
              <div
                key={q.qKey}
                className="grid lg:grid-cols-[0.42fr_1fr] gap-3 lg:gap-20 py-6 lg:py-8 border-t border-[rgba(28,22,40,0.16)]"
              >
                <h3
                  className="m-0 font-semibold"
                  style={{ fontSize: 'clamp(17px,1.6vw,20px)', letterSpacing: '-0.02em', lineHeight: 1.25 }}
                >
                  {t[q.qKey]}
                </h3>
                <p className="m-0 text-[rgba(28,22,40,0.68)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.6 }}>
                  {t[q.aKey]}
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
          <Eyebrow style={{ color: 'rgba(56,40,93,0.85)' }}>{t.pmRelatedEyebrow}</Eyebrow>
          <div className="grid gap-3.5">
            <LocaleLink
              to="/asset-management"
              className="flex items-center justify-between gap-5 font-medium border-b border-[rgba(28,22,40,0.14)] pb-3.5 rounded-v2 hover:text-v2-teal-support"
              style={{ fontSize: 'clamp(17px,1.4vw,19px)', letterSpacing: '-0.02em', minHeight: 44 }}
            >
              <span>{t.pmRelatedAsset}</span>
              <span aria-hidden="true" className="flex-none" style={{ fontSize: 20 }}>&#8594;</span>
            </LocaleLink>
            <LocaleLink
              to="/investor-services"
              className="flex items-center justify-between gap-5 font-medium rounded-v2 hover:text-v2-teal-support"
              style={{ fontSize: 'clamp(17px,1.4vw,19px)', letterSpacing: '-0.02em', minHeight: 44 }}
            >
              <span>{t.pmRelatedInvestor}</span>
              <span aria-hidden="true" className="flex-none" style={{ fontSize: 20 }}>&#8594;</span>
            </LocaleLink>
          </div>
        </div>
      </section>

      <ClosingCta
        title={t.pmClosingTitle}
        body={t.pmClosingBody}
        signature={t.partnersSignature}
        ctaLabel={t.navCta}
        ctaTo="/contact?intent=property-management"
      />
    </>
  );
}

export default PropertyManagementPage;
