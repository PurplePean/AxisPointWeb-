import { useDocumentMeta } from '../lib/meta';
import { Eyebrow, GUTTER, MEASURE, SECTION, ClosingCta, ServiceHero } from '../components/PageParts';
import { useMessages } from '../i18n/LocaleProvider';
import type { Messages } from '../i18n/messages';

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

/*
 * The NAMES stay here, not in the catalog. A person's name is not copy: exposing it to
 * translation invites a well-meaning reviewer to transliterate somebody into a spelling they
 * do not use. Only the descriptions are catalogued.
 */
const PARTNERS: { name: string; bodyKey: keyof Messages }[] = [
  { name: 'Zachary Russell', bodyKey: 'partnerRussellBody' },
  { name: 'Ethaniel Vu', bodyKey: 'partnerVuBody' },
];

function PartnersPage() {
  const t = useMessages();

  useDocumentMeta({
    title: t.partnersMetaTitle,
    description: t.partnersMetaDescription,
    path: '/partners',
  });

  return (
    <>
      <ServiceHero
        eyebrow={t.navPartners}
        eyebrowColor="#24A5BC"
        title={t.partnersHeroTitle}
        answer={t.partnersHeroAnswer}
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
                  {t.partnersRoleLabel}
                </div>
              </div>
              <p className="m-0 text-[rgba(28,22,40,0.68)]" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '56ch' }}>
                {t[p.bodyKey]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How we work ── */}
      <section className={`${GUTTER} ${SECTION} bg-[#FFFCF6] border-y border-[rgba(28,22,40,0.1)]`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.34fr_1fr] gap-6 lg:gap-20 items-start`}>
          <Eyebrow className="border-t-[3px] border-v2-purple pt-4" style={{ color: 'rgba(56,40,93,0.85)' }}>
            {t.partnersHowEyebrow}
          </Eyebrow>
          <p
            className="m-0 font-serif text-[rgba(28,22,40,0.68)]"
            style={{ fontSize: 'clamp(23px,2.4vw,31px)', fontWeight: 500, lineHeight: 1.42, textWrap: 'pretty' }}
          >
            {t.partnersHowBody}
          </p>
        </div>
      </section>

      <ClosingCta
        title={t.partnersClosingTitle}
        body={t.partnersClosingBody}
        ctaLabel={t.navCta}
        ctaTo="/contact?intent=property-management"
      />
    </>
  );
}

export default PartnersPage;
