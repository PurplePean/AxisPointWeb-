import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../lib/meta';
import { Eyebrow, GUTTER, MEASURE, SECTION, ClosingCta, QuietLink } from '../components/PageParts';
import { useMessages } from '../i18n/LocaleProvider';

/**
 * Homepage, built from the approved source `AxisPointPage.dc.html` (design@2026-07-30).
 *
 * Section order is the approved one: hero, the property-management-first strip,
 * "Why owners call AxisPoint", the strategic layer, the investor path, and the dark
 * closing band. Attention hierarchy is the point of the page. Property management
 * carries the hero and the only filled action; asset management is a quieter block
 * that reads as a layer above the operating work; investor services is a single
 * ruled strip, deliberately the smallest of the three.
 *
 * The hero photograph is the LCP image, so it loads eagerly and is never lazy.
 */

const HERO_WIDTHS = [640, 1280, 1920, 2560];
const heroSrcSet = (ext: string) =>
  HERO_WIDTHS.map((w) => `/images/photos/home-hero-multifamily-lawn-${w}.${ext} ${w}w`).join(', ');

function HomePage() {
  const t = useMessages();

  useDocumentMeta({
    title: t.homeMetaTitle,
    description: t.homeMetaDescription,
    path: '/',
  });

  return (
    <>
      {/* ── Hero ──
          One DOM tree serves both approved compositions, so the page has exactly one
          h1 and one photograph element.

          Desktop: the photograph is an absolutely positioned right-hand panel from 38%
          across, with the approved cream gradient resolving it into the field, and the
          action sits beside the quiet link.

          Mobile: copy, action, a 300px band, then the quiet link. The band is moved
          between them with flex `order` rather than by duplicating markup. `.hero-actions`
          is `display: contents` on mobile so the action and the quiet link become
          section-level flex items and can be ordered around the band individually. Only
          the non-interactive image moves, so reading and tab order still match what is
          seen. */}
      <section className="hero relative flex flex-col lg:block lg:min-h-[680px]">
        <style>{`
          .hero-copy     { order: 1; }
          .hero-actions  { display: contents; }
          .hero-cta      { order: 2; }
          .hero-figure   { order: 3; }
          .hero-quiet    { order: 4; }
          .hero-sig      { order: 5; }
          @media (min-width: 1024px) {
            .hero          { display: grid; align-content: center; }
            /* Reset the mobile ordering. Without this the actions keep order 0 and
               render above the headline. */
            .hero-figure   { position: absolute; inset: 0 0 0 38%; order: 0; }
            .hero-copy     { order: 1; }
            .hero-actions  { order: 2; display: flex; flex-wrap: wrap; align-items: center;
                             gap: 14px 26px; position: relative; z-index: 2; }
            .hero-sig      { order: 3; }
          }
        `}</style>

        <div className="hero-figure relative h-[300px] lg:h-auto overflow-hidden">
          <picture>
            <source type="image/avif" srcSet={heroSrcSet('avif')} sizes="(min-width: 1024px) 62vw, 100vw" />
            <source type="image/webp" srcSet={heroSrcSet('webp')} sizes="(min-width: 1024px) 62vw, 100vw" />
            <img
              src="/images/photos/home-hero-multifamily-lawn-1920.jpg"
              srcSet={heroSrcSet('jpg')}
              sizes="(min-width: 1024px) 62vw, 100vw"
              alt={t.homeHeroAlt}
              width={2560}
              height={1013}
              className="hero-img block w-full h-full object-cover"
              loading="eager"
              decoding="sync"
              fetchPriority="high"
            />
          </picture>
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden lg:block"
            style={{
              background:
                'linear-gradient(90deg, #F6F2EA 0%, rgba(246,242,234,0.9) 12%, rgba(246,242,234,0.46) 24%, rgba(246,242,234,0.1) 38%, rgba(246,242,234,0) 50%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden lg:block"
            style={{
              background:
                'linear-gradient(180deg, rgba(246,242,234,0.5) 0%, rgba(246,242,234,0) 22%, rgba(246,242,234,0) 72%, rgba(246,242,234,0.58) 100%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 lg:hidden"
            style={{
              background:
                'linear-gradient(180deg, #F6F2EA 0%, rgba(246,242,234,0.4) 20%, rgba(246,242,234,0) 46%, rgba(246,242,234,0.32) 84%, #F6F2EA 100%)',
            }}
          />
        </div>

        <div className="hero-copy relative z-[2] px-5 md:px-10 lg:px-[72px] pt-10 lg:pt-[104px] lg:max-w-[940px]">
          <h1
            className="m-0 font-semibold"
            style={{ fontSize: 'clamp(34px, 5.2vw, 76px)', letterSpacing: '-0.045em', lineHeight: 0.98, textWrap: 'pretty', maxWidth: '14ch' }}
          >
            {t.homeHeroTitle}
          </h1>
          <p
            className="mt-5 lg:mt-[30px] mb-6 lg:mb-10 text-[rgba(28,22,40,0.7)]"
            style={{ fontSize: 'clamp(16.5px,1.4vw,19px)', lineHeight: 1.5, maxWidth: '40ch', textWrap: 'pretty' }}
          >
            {t.homeHeroLead}
          </p>
        </div>

        <div className="hero-actions px-5 md:px-10 lg:px-[72px] lg:max-w-[940px]">
          <Link
            to="/contact?intent=property-management"
            /* `.hero-actions` is `display: contents` on mobile, so its own padding is
               dropped and the action needs the page gutter itself. */
            className="hero-cta mx-5 md:mx-10 lg:mx-0 inline-flex items-center justify-center lg:justify-start gap-2.5 rounded-v2 bg-v2-teal font-bold text-v2-action-label transition-colors hover:bg-v2-teal-support hover:text-white"
            style={{ minHeight: 54, padding: '0 26px', fontSize: 15 }}
          >
            {t.navCta} <span aria-hidden="true" style={{ fontSize: 16 }}>&#8594;</span>
          </Link>
          <div className="hero-quiet px-5 md:px-10 lg:px-0 pt-[22px] lg:pt-0">
            <QuietLink to="/property-management">{t.homeHeroQuietLink}</QuietLink>
          </div>
        </div>

        <p className="hero-sig relative z-[2] px-5 md:px-10 lg:px-[72px] mt-2 lg:mt-9 mb-11 lg:mb-0 lg:pb-[104px] font-semibold text-[rgba(28,22,40,0.52)]" style={{ fontSize: 13 }}>
          {t.homeHeroSignature}
        </p>
      </section>

      {/* ── Property management first ── */}
      <div
        className={`${GUTTER} flex flex-wrap items-baseline gap-x-10 gap-y-2 py-[22px] border-y border-[rgba(28,22,40,0.12)]`}
      >
        <Eyebrow className="text-v2-teal">{t.homeStripEyebrow}</Eyebrow>
        <span className="text-[rgba(28,22,40,0.72)]" style={{ fontSize: 'clamp(15.5px,1.2vw,17px)' }}>
          {t.homeStripBody}
        </span>
      </div>

      {/* ── Why owners call AxisPoint ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-[22px] lg:gap-20 items-start`}>
          <h2
            className="m-0 font-semibold border-t-[3px] border-v2-purple pt-4"
            style={{ fontSize: 'clamp(22px,2.2vw,30px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            {t.homeWhyTitle}
          </h2>
          <div>
            <p
              className="m-0 font-serif text-[rgba(28,22,40,0.66)]"
              style={{ fontSize: 'clamp(23px,2.4vw,31px)', fontWeight: 500, lineHeight: 1.42, textWrap: 'pretty' }}
            >
              {t.homeWhyLead}{' '}
              <strong className="text-v2-ink" style={{ fontWeight: 600 }}>
                {t.homeWhySituationManager}
              </strong>{' '}
              <strong className="text-v2-ink" style={{ fontWeight: 600 }}>
                {t.homeWhySituationSelf}
              </strong>{' '}
              <strong className="text-v2-ink" style={{ fontWeight: 600 }}>
                {t.homeWhySituationAcquired}
              </strong>{' '}
              {t.homeWhyOr}{' '}
              <strong className="text-v2-ink" style={{ fontWeight: 600 }}>
                {t.homeWhySituationReports}
              </strong>
            </p>
            <p
              className="mt-[22px] mb-0 text-[rgba(28,22,40,0.66)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,17px)', lineHeight: 1.65, maxWidth: '52ch' }}
            >
              {t.homeWhyBody}
            </p>
            <div className="mt-7">
              <QuietLink to="/property-management">{t.homeWhyLink}</QuietLink>
            </div>
          </div>
        </div>
      </section>

      {/* ── Strategic layer. Quieter than property management, by design. ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-[22px] lg:gap-20 items-start`}>
          <Eyebrow className="border-t-[3px] border-v2-purple pt-4" style={{ color: 'rgba(56,40,93,0.85)' }}>
            {t.homeStrategicEyebrow}
          </Eyebrow>
          <div>
            <h2
              className="m-0 font-serif"
              style={{ fontSize: 'clamp(35px,4vw,58px)', fontWeight: 500, lineHeight: 1.06, textWrap: 'pretty', maxWidth: '20ch' }}
            >
              {t.pmRunsAmDirectsTitle}
            </h2>
            <p
              className="mt-[22px] mb-0 text-[rgba(28,22,40,0.68)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,17px)', lineHeight: 1.65, maxWidth: '52ch' }}
            >
              {t.homeStrategicBody}
            </p>
            <div className="mt-6">
              <Link
                to="/asset-management"
                className="inline-flex items-center gap-2 font-semibold text-v2-purple border-b border-[rgba(56,40,93,0.4)] rounded-v2 hover:text-v2-teal-support"
                style={{ fontSize: 15, paddingBottom: 3, minHeight: 44 }}
              >
                {t.navAssetManagement} <span aria-hidden="true">&#8594;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── A separate path. One strip, the smallest of the three. ── */}
      <section className={`${GUTTER} py-[26px] lg:py-[38px] border-y border-[rgba(28,22,40,0.14)]`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-3.5 lg:gap-20 items-center`}>
          <Eyebrow className="text-v2-magenta">{t.homeInvestorEyebrow}</Eyebrow>
          <Link
            to="/investor-services"
            className="flex items-center justify-between gap-5 font-medium rounded-v2 hover:text-v2-teal-support"
            style={{ fontSize: 'clamp(17px,1.4vw,19px)', letterSpacing: '-0.02em', minHeight: 44 }}
          >
            <span>{t.homeInvestorBody}</span>
            <span aria-hidden="true" className="flex-none" style={{ fontSize: 20 }}>&#8594;</span>
          </Link>
        </div>
      </section>

      <ClosingCta
        title={t.homeClosingTitle}
        body={t.homeClosingBody}
        signature={t.partnersSignature}
        ctaLabel={t.navCta}
        ctaTo="/contact?intent=property-management"
      />
    </>
  );
}

export default HomePage;
