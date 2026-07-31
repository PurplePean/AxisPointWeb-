import { useSearchParams } from 'react-router-dom';
import { useDocumentMeta } from '../lib/meta';
import { Eyebrow, GUTTER, MEASURE } from '../components/PageParts';
import Intake from '../intake/Intake';
import { isIntentToken, type IntentToken } from '../intake/model';

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

const PATHWAY_INTRO: Record<
  IntentToken,
  { label: string; meta: { title: string; description: string } }
> = {
  'property-management': {
    label: 'Property Management',
    meta: {
      title: 'Request a Management Proposal | AxisPoint Partners',
      description:
        'Send the property, the current management situation, and the change you are considering. A partner reads it and responds.',
    },
  },
  'asset-management': {
    label: 'Property Management and Asset Management',
    meta: {
      title: 'Request a Management Proposal with Asset Management | AxisPoint Partners',
      description:
        'Start the management proposal with asset management interest identified, so the operating work and the investment view are handled by the same team.',
    },
  },
  'investor-services': {
    label: 'Investor Services',
    meta: {
      title: 'Investor Services Inquiry | AxisPoint Partners',
      description:
        'Tell us where you are in the process. A partner responds with an operating read and what management would look like.',
    },
  },
  general: {
    label: 'General inquiry',
    meta: {
      title: 'Contact AxisPoint | AxisPoint Partners',
      description: 'Tell us who you are and what you need. We will route it to the right partner.',
    },
  },
};

const GENERIC_META = {
  title: 'Contact AxisPoint | AxisPoint Partners',
  description:
    'Reach AxisPoint directly from Houston, Texas, serving owners statewide. Choose the path that matches your situation, or write to info@axispoint.llc.',
};

function ContactPage() {
  const [params] = useSearchParams();
  const rawIntent = params.get('intent');
  const intent = isIntentToken(rawIntent) ? rawIntent : null;
  const pathway = intent ? PATHWAY_INTRO[intent] : null;

  useDocumentMeta({ ...(pathway ? pathway.meta : GENERIC_META), path: '/contact' });

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
            <Eyebrow className="text-v2-teal">Contact</Eyebrow>
            <span className="text-[rgba(28,22,40,0.55)]" style={{ fontSize: 14 }}>
              {pathway.label}
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
            Contact
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
              Contact AxisPoint
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
              Partner-led from Houston, serving owners across Texas. Tell us what you need and a
              partner reads it.
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
