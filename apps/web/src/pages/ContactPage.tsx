import { useSearchParams } from 'react-router-dom';
import { ContactForm } from '@axispoint/brand';
import type { Role } from '@axispoint/brand';
import { useDocumentMeta } from '../lib/meta';
import { Eyebrow, GUTTER, MEASURE, SECTION } from '../components/PageParts';

/**
 * Contact, built from the approved shell in `AxisPoint System Studies.dc.html` with
 * `page="contact"` (design@2026-07-30).
 *
 * The shell is V2. The intake inside it is still V1 and is deliberately untouched:
 * `ContactForm`, its fields, role values, validation, booking, referral behaviour,
 * payloads, and styling are all unchanged, and the approved V2 intake replaces them
 * in Code Pass 5. The approved source says as much on its own contact panel:
 * "Intake structure is being mapped separately."
 *
 * The intent-to-role mapping below is carried over exactly as it was. It is the
 * existing safe routing, not new behaviour, and no backend role was added.
 */

/**
 * Public-facing intent tokens to internal wire roles. The token is what appears in
 * the URL and marketing links; the role value is never exposed publicly. Anything
 * not listed here (including a missing param) resolves to null, i.e. the normal
 * all-five-roles picker. `?ref=` is untouched: ContactForm reads it independently,
 * so referral attribution survives alongside any intent.
 *
 * Note for Code Pass 5: `property-management` currently carries both the
 * property-management and the PM plus AM proposal routes, because no distinct scope
 * value exists yet. Pass 5 adds explicit PM plus AM scope capture.
 */
const INTENT_TO_ROLE: Record<string, Role> = {
  'property-management': 'existing_asset_owner',
  'investor-services': 'investor',
};

function ContactPage() {
  const [searchParams] = useSearchParams();
  const initialRole = INTENT_TO_ROLE[searchParams.get('intent') ?? ''] ?? null;

  useDocumentMeta({
    title: 'Request a Management Proposal | AxisPoint Partners',
    description:
      'Reach AxisPoint directly. Proposals cover staffing, reporting, the transition plan, and who answers for the property. Houston, Texas, serving owners statewide.',
    path: '/contact',
  });

  return (
    <>
      {/* ── Hero. The approved contact page carries no photograph and no closing band. ── */}
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

      {/* ── What to send, and the intake ── */}
      <section className={`${GUTTER} ${SECTION}`}>
        <div className={`${MEASURE} grid lg:grid-cols-[0.9fr_1fr] gap-8 lg:gap-20 items-start`}>
          <div>
            <h2
              className="m-0 font-semibold border-t-[3px] border-v2-purple pt-4"
              style={{ fontSize: 'clamp(22px,2.2vw,28px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
            >
              What to send
            </h2>
            <p
              className="mt-[18px] mb-0 text-[rgba(28,22,40,0.66)]"
              style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)', lineHeight: 1.65, maxWidth: '40ch' }}
            >
              The property, the current management situation, and the change you are considering. A
              partner reads it and responds.
            </p>
            <div className="mt-[30px] grid gap-2.5" style={{ fontSize: 'clamp(15.5px,1.2vw,16.5px)' }}>
              <a
                href="mailto:info@axispoint.llc"
                className="font-semibold justify-self-start border-b border-[rgba(28,22,40,0.3)] rounded-v2 inline-flex items-center hover:text-v2-teal-support"
                style={{ paddingBottom: 3, minHeight: 44 }}
              >
                info@axispoint.llc
              </a>
              <span className="text-[rgba(28,22,40,0.6)]">Houston, Texas. Serving owners statewide.</span>
            </div>
          </div>

          {/* The approved panel. The V1 ContactForm is mounted inside it unchanged. */}
          <div className="border border-[rgba(28,22,40,0.2)] bg-[#FFFCF6] p-[26px_20px] lg:p-10">
            <Eyebrow className="text-v2-teal">Request a Management Proposal</Eyebrow>
            <div className="mt-6">
              {/*
                `className` is ContactForm's existing integration prop, the same one
                apps/qr already passes. Nothing inside the form is modified.

                It is supplied here for two reasons. Its default class string begins
                with `rv`, the V1 scroll-reveal class that sits at opacity 0 until the
                old useReveal observer added `.in`; that hook belonged to the V1 pages
                removed in this pass, so the default would leave the form permanently
                invisible. The default also draws its own white card with a 22px radius
                and a shadow, which would sit as a second box inside the approved panel.
              */}
              <ContactForm initialRole={initialRole} className="w-full" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default ContactPage;
