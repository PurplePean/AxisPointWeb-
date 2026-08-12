import { useSearchParams } from 'react-router-dom';
import { useDocumentMeta } from '../lib/meta';
import { Eyebrow, GUTTER, MEASURE } from '../components/PageParts';
import Intake from '../intake/Intake';
import { isIntentToken, type IntentToken } from '../intake/model';
import { useMessages } from '../i18n/LocaleProvider';
import type { Messages } from '../i18n/messages';

/**
 * Contact, built from the approved shell in `AxisPoint System Studies.dc.html` with
 * `page="contact"`, and the approved intake from `AxisPoint Form Design.dc.html`
 * (design@2026-07-30).
 *
 * The page has two framings.
 *
 * Generic `/contact` is the front door for every pathway, so it carries a neutral
 * heading and the approved gateway. It is deliberately not headed "Request a
 * management proposal": Investor Services and General Inquiry live here too, and
 * that heading would misdescribe them. "Request a Management Proposal" remains the
 * site's primary CTA and the property-management wording, unchanged.
 *
 * A preselected-intent route has already been framed by the link that produced it, so
 * repeating the full introduction only pushes the form down. Those routes get a
 * compact pathway line instead, and the intake's own title becomes the page h1, which
 * lifts the first real control substantially higher on both desktop and mobile.
 *
 * Submission stays simulated and local in both framings.
 */

/**
 * Catalog KEYS, not copy. The pathway label reuses the chrome's service-name keys where the
 * concept is the same one, and the meta pair is per pathway because each describes a
 * different page.
 */
const PATHWAY_INTRO: Record<
  IntentToken,
  { labelKey: keyof Messages; titleKey: keyof Messages; descKey: keyof Messages }
> = {
  'property-management': {
    labelKey: 'navPropertyManagement',
    titleKey: 'contactPmMetaTitle',
    descKey: 'contactPmMetaDescription',
  },
  'asset-management': {
    labelKey: 'contactPathwayPmAm',
    titleKey: 'contactAmMetaTitle',
    descKey: 'contactAmMetaDescription',
  },
  'investor-services': {
    labelKey: 'navInvestorServices',
    titleKey: 'contactIsMetaTitle',
    descKey: 'contactIsMetaDescription',
  },
  general: {
    labelKey: 'gatewayGeneralTitle',
    titleKey: 'contactGeneralMetaTitle',
    descKey: 'contactGeneralMetaDescription',
  },
};

function ContactPage() {
  const [params] = useSearchParams();
  const t = useMessages();
  const rawIntent = params.get('intent');
  const intent = isIntentToken(rawIntent) ? rawIntent : null;
  const pathway = intent ? PATHWAY_INTRO[intent] : null;

  useDocumentMeta({
    title: pathway ? t[pathway.titleKey] : t.contactMetaTitle,
    description: pathway ? t[pathway.descKey] : t.contactMetaDescription,
    path: '/contact',
  });

  if (pathway) {
    /* Compact framing. One line of context, then straight into the intake, whose
       title carries the h1. */
    return (
      <section className={`${GUTTER} pt-7 lg:pt-10 pb-[54px] lg:pb-[100px]`}>
        <div className={MEASURE}>
          <div
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
            style={{ marginBottom: 20 }}
          >
            <Eyebrow className="text-v2-teal">{t.contactEyebrow}</Eyebrow>
            <span className="text-[rgba(28,22,40,0.55)]" style={{ fontSize: 14 }}>
              {t[pathway.labelKey]}
            </span>
          </div>
          <Intake headingLevel={1} />
        </div>
      </section>
    );
  }

  /* Generic framing: neutral heading suitable for every pathway, then the gateway. */
  return (
    <>
      <section
        className={`${GUTTER} pt-11 lg:pt-[84px] pb-10 lg:pb-16 border-b border-[rgba(28,22,40,0.12)]`}
      >
        <div className={MEASURE}>
          <Eyebrow className="text-v2-teal" style={{ marginBottom: 18 }}>
            {t.contactEyebrow}
          </Eyebrow>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-20 items-end">
            <h1
              className="m-0 font-semibold"
              style={{
                fontSize: 'clamp(36px,4.2vw,58px)',
                letterSpacing: '-0.045em',
                lineHeight: 1,
                textWrap: 'pretty',
              }}
            >
              {t.contactHeroTitle}
            </h1>
            <p
              className="m-0 text-[rgba(28,22,40,0.7)]"
              style={{
                fontSize: 'clamp(17px,1.3vw,19px)',
                lineHeight: 1.5,
                maxWidth: '42ch',
                textWrap: 'pretty',
              }}
            >
              {t.contactHeroLead}
            </p>
          </div>
        </div>
      </section>

      <section className={`${GUTTER} py-[54px] lg:py-[100px]`}>
        <div className={MEASURE}>
          <Intake headingLevel={2} />
        </div>
      </section>
    </>
  );
}

export default ContactPage;
