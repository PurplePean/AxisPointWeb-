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
import { useMessages } from '../i18n/LocaleProvider';
import type { Messages } from '../i18n/messages';

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

const TIMELINE: { labelKey: keyof Messages; bodyKey: keyof Messages }[] = [
  { labelKey: 'isTimelineBeforeLabel', bodyKey: 'isTimelineBeforeBody' },
  { labelKey: 'isTimelineClosingLabel', bodyKey: 'isTimelineClosingBody' },
  { labelKey: 'isTimelineAfterLabel', bodyKey: 'isTimelineAfterBody' },
];

function InvestorServicesPage() {
  const t = useMessages();

  useDocumentMeta({
    title: t.isMetaTitle,
    description: t.isMetaDescription,
    path: '/investor-services',
  });

  return (
    <>
      <ServiceHero
        eyebrow={t.navInvestorServices}
        eyebrowColor="#9F328C"
        title={t.isHeroTitle}
        answer={t.isHeroAnswer}
      />

      <PhotoBand
        photo={{
          base: 'investor-services-interchange',
          alt: t.isPhotoAlt,
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
            {t.isWhoEyebrow}
          </Eyebrow>
          <div>
            <p
              className="m-0 font-serif text-[rgba(28,22,40,0.68)]"
              style={{ fontSize: 'clamp(23px,2.4vw,31px)', fontWeight: 500, lineHeight: 1.42, textWrap: 'pretty', maxWidth: '26ch' }}
            >
              {t.isWhoLead}
            </p>
            <p
              className="mt-[22px] mb-0 text-[rgba(28,22,40,0.68)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '54ch' }}
            >
              {t.isWhoBody}
            </p>
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section className={`${GUTTER} ${SECTION} bg-[#FFFCF6] border-y border-[rgba(28,22,40,0.1)]`}>
        <div className={`${MEASURE} grid`}>
          {TIMELINE.map((row, i) => (
            <div
              key={row.labelKey}
              className={`grid lg:grid-cols-[0.34fr_1fr] gap-2.5 lg:gap-20 py-[22px] lg:py-[30px] border-t border-[rgba(28,22,40,0.16)] ${
                i === TIMELINE.length - 1 ? 'border-b' : ''
              }`}
            >
              <h2
                className="m-0 font-semibold"
                style={{ fontSize: 'clamp(19px,1.8vw,23px)', letterSpacing: '-0.02em' }}
              >
                {t[row.labelKey]}
              </h2>
              <p className="m-0 text-[rgba(28,22,40,0.66)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.6 }}>
                {t[row.bodyKey]}
              </p>
            </div>
          ))}
          <div className="mt-[30px] lg:mt-12">
            <QuietLink to="/property-management">{t.navPropertyManagement}</QuietLink>
          </div>
        </div>
      </section>

      <ClosingCta
        title={t.isClosingTitle}
        body={t.isClosingBody}
        ctaLabel={t.isClosingCta}
        ctaTo="/contact?intent=investor-services"
      />
    </>
  );
}

export default InvestorServicesPage;
