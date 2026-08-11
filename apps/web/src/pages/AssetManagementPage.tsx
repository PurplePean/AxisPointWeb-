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
 * Asset Management, built from `AxisPoint System Studies.dc.html` with
 * `page="asset-management"` (design@2026-07-30).
 *
 * The page is deliberately framed as the optional layer above property management,
 * never as a competing primary service. Per docs/design-sources.md, asset management
 * is a PM plus AM scope within the Management Proposal pathway, not a separate role
 * or intake system, so its call to action enters that same pathway.
 */

const DECIDES: (keyof Messages)[] = [
  'amDecidesItem1',
  'amDecidesItem2',
  'amDecidesItem3',
  'amDecidesItem4',
];

const EXECUTES: (keyof Messages)[] = [
  'amExecutesItem1',
  'amExecutesItem2',
  'amExecutesItem3',
  'amExecutesItem4',
];

function AssetManagementPage() {
  const t = useMessages();

  useDocumentMeta({
    title: t.amMetaTitle,
    description: t.amMetaDescription,
    path: '/asset-management',
  });

  return (
    <>
      <ServiceHero
        eyebrow={t.navAssetManagement}
        eyebrowColor="#38285D"
        title={t.amHeroTitle}
        answer={t.amHeroAnswer}
      />

      <PhotoBand
        photo={{
          base: 'asset-management-houston-towers',
          alt: t.amPhotoAlt,
          width: 2560,
          height: 1280,
        }}
        heightClass="h-[260px] lg:h-[420px]"
        focal="50% 42%"
        focalMobile="58% 46%"
      />

      {/* ── The relationship ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-6 lg:gap-20 items-start`}>
          <Eyebrow className="border-t-[3px] border-v2-purple pt-4" style={{ color: 'rgba(56,40,93,0.85)' }}>
            {t.amRelationshipEyebrow}
          </Eyebrow>
          <div>
            <h2
              className="m-0 font-serif"
              style={{ fontSize: 'clamp(34px,3.8vw,54px)', fontWeight: 500, lineHeight: 1.06, textWrap: 'pretty', maxWidth: '20ch' }}
            >
              {t.pmRunsAmDirectsTitle}
            </h2>
            <p
              className="mt-[22px] mb-0 text-[rgba(28,22,40,0.68)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '54ch' }}
            >
              {t.amRelationshipBody}
            </p>
          </div>
        </div>
      </section>

      {/* ── Two layers, stated plainly ── */}
      <section className={`${GUTTER} ${SECTION} bg-[#FFFCF6] border-y border-[rgba(28,22,40,0.1)]`}>
        <div className={MEASURE}>
          <h2
            className="m-0 mb-[30px] lg:mb-12 font-semibold"
            style={{ fontSize: 'clamp(22px,2.2vw,28px)', letterSpacing: '-0.03em' }}
          >
            {t.amLayersTitle}
          </h2>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
            <div className="border-t-[3px] border-v2-purple pt-[18px]">
              <Eyebrow className="text-v2-purple" style={{ marginBottom: 14 }}>
                {t.amDecidesEyebrow}
              </Eyebrow>
              <ul className="grid gap-3 list-none p-0 m-0 text-[rgba(28,22,40,0.7)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.5 }}>
                {DECIDES.map((d) => (
                  <li key={d}>{t[d]}</li>
                ))}
              </ul>
            </div>
            <div className="border-t-[3px] border-v2-teal pt-[18px]">
              <Eyebrow className="text-v2-teal-support" style={{ marginBottom: 14 }}>
                {t.amExecutesEyebrow}
              </Eyebrow>
              <ul className="grid gap-3 list-none p-0 m-0 text-[rgba(28,22,40,0.7)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.5 }}>
                {EXECUTES.map((e) => (
                  <li key={e}>{t[e]}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-[30px] lg:mt-12">
            <QuietLink to="/property-management">{t.navPropertyManagement}</QuietLink>
          </div>
        </div>
      </section>

      <ClosingCta
        title={t.amClosingTitle}
        body={t.amClosingBody}
        ctaLabel={t.navCta}
        ctaTo="/contact?intent=asset-management"
      />
    </>
  );
}

export default AssetManagementPage;
