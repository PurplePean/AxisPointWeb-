import { useDocumentMeta } from '../lib/meta';
import { Eyebrow, GUTTER, MEASURE, SECTION } from '../components/PageParts';
import Intake from '../intake/Intake';

/**
 * Contact, built from the approved shell in `AxisPoint System Studies.dc.html` with
 * `page="contact"`, and the approved intake from `AxisPoint Form Design.dc.html`
 * (design@2026-07-30).
 *
 * The V1 `ContactForm` from packages/brand is no longer mounted here. The intake is
 * now the V2 implementation in `src/intake`. Submission is simulated and local:
 * nothing on this page reaches GAS, Sheets, Calendar, Contacts, or email.
 *
 * The V1 intent-to-role mapping is gone with it. Intent tokens now select a V2
 * pathway and service scope directly, with no backend role involved.
 */
function ContactPage() {
  useDocumentMeta({
    title: 'Request a Management Proposal | AxisPoint Partners',
    description:
      'Reach AxisPoint directly. Proposals cover staffing, reporting, the transition plan, and who answers for the property. Houston, Texas, serving owners statewide.',
    path: '/contact',
  });

  return (
    <>
      {/* Hero. The approved contact page carries no photograph and no closing band. */}
      <section className={`${GUTTER} pt-11 lg:pt-[84px] pb-10 lg:pb-16 border-b border-[rgba(28,22,40,0.12)]`}>
        <div className={MEASURE}>
          <Eyebrow className="text-v2-teal" style={{ marginBottom: 18 }}>
            Contact
          </Eyebrow>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-20 items-end">
            <h1
              className="m-0 font-semibold"
              style={{ fontSize: 'clamp(36px,4.2vw,58px)', letterSpacing: '-0.045em', lineHeight: 1, textWrap: 'pretty' }}
            >
              Request a management proposal
            </h1>
            <p
              className="m-0 text-[rgba(28,22,40,0.7)]"
              style={{ fontSize: 'clamp(17px,1.3vw,19px)', lineHeight: 1.5, maxWidth: '42ch', textWrap: 'pretty' }}
            >
              Reach AxisPoint directly. Proposals cover staffing, reporting, the transition plan,
              and who answers for the property.
            </p>
          </div>
        </div>
      </section>

      {/* The intake carries the page from here. It renders the approved gateway, the
          three-step Management Proposal flow, the short pathways, and every closing
          state, so it is given the full measure rather than a side panel. */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={MEASURE}>
          <Intake />
        </div>
      </section>
    </>
  );
}

export default ContactPage;
