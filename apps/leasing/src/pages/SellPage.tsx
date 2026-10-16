import {
  BAND,
  BigHeading,
  ClosingBand,
  Eyebrow,
  GUTTER,
  PageHero,
  QuietAnchor,
  RuledList,
  RuledRow,
  SECTION_Y,
  Strong,
  TealButton,
  PurpleButton,
  TextLink,
} from '@/components/ui';
import { BOV_STEPS, BOV_TYPES, SALES_SERVICES, contactHref, visibleSections } from '@/content/sell';

export default function SellPage() {
  const sections = visibleSections();

  return (
    <>
      <PageHero
        eyebrow="Sell your retail property"
        title="Know what your property is worth."
        lede={
          <>
            Get a <Strong>broker opinion of value</Strong>, for the rent your space should command
            or for what the property could sell for.
          </>
        }
      >
        <TealButton to={contactHref('bov-rent')}>Request a rent BOV</TealButton>
        <PurpleButton to={contactHref('bov-sale')}>Request a sale BOV</PurpleButton>
        <QuietAnchor href="#how">How it works</QuietAnchor>
      </PageHero>

      {sections.includes('bov') && (
        <section className={`${BAND} ${GUTTER} ${SECTION_Y}`}>
          <div className="mx-auto max-w-v2">
            <Eyebrow>Two kinds of BOV</Eyebrow>
            <div className="mb-8 mt-4 min-[821px]:mb-[52px]">
              <BigHeading>Pick the question you are asking.</BigHeading>
            </div>
            <RuledList>
              {BOV_TYPES.map((b) => (
                <RuledRow key={b.key} title={b.title}>
                  <p className="m-0 text-[clamp(19px,1.7vw,23px)] font-semibold leading-[1.25] tracking-[-0.02em]">
                    {b.question}
                  </p>
                  <p className="mb-5 mt-3 max-w-[56ch] text-[clamp(16px,1.3vw,18px)] leading-[1.6] text-v2-ink/[0.7]">
                    {b.summary}
                  </p>
                  <TextLink to={contactHref(b.role)}>{b.cta}</TextLink>
                </RuledRow>
              ))}
            </RuledList>
          </div>
        </section>
      )}

      {sections.includes('steps') && (
        <section id="how" className={`${GUTTER} ${SECTION_Y} scroll-mt-4`}>
          <div className="mx-auto max-w-v2">
            <Eyebrow>How it works</Eyebrow>
            <div className="mb-8 mt-4 min-[821px]:mb-[52px]">
              <BigHeading>Three steps, no obligation.</BigHeading>
            </div>
            <ol className="m-0 grid list-none gap-[34px] p-0 min-[821px]:grid-cols-3 min-[821px]:gap-12">
              {BOV_STEPS.map((s, i) => (
                <li key={s} className="border-t-[3px] border-v2-purple pt-4">
                  <span className="text-[15px] font-bold tracking-[0.1em] text-v2-teal-support">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mb-0 mt-3 text-[clamp(19px,1.7vw,23px)] font-semibold leading-[1.25] tracking-[-0.02em]">
                    {s}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {sections.includes('sales') && (
        <section className={`${BAND} ${GUTTER} ${SECTION_Y}`}>
          <div className="mx-auto max-w-v2">
            <Eyebrow>Investment sales</Eyebrow>
            <div className="mb-8 mt-4 min-[821px]:mb-[52px]">
              <BigHeading>If the answer is to sell.</BigHeading>
            </div>
            <RuledList>
              <RuledRow title="Retail investment sales">
                <ul className="m-0 grid list-none gap-3 p-0">
                  {SALES_SERVICES.map((t) => (
                    <li key={t} className="grid grid-cols-[12px_1fr] items-start gap-3">
                      <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 bg-v2-teal" />
                      <span className="text-[clamp(16px,1.3vw,18px)] leading-[1.5] text-v2-ink/[0.78]">
                        {t}
                      </span>
                    </li>
                  ))}
                </ul>
              </RuledRow>
            </RuledList>
          </div>
        </section>
      )}

      <ClosingBand
        title="Not sure which one you need?"
        body="Tell us about the property and we will point you to the right one."
        ctaLabel="Tell us about your property"
        ctaTo="/contact?role=landlord"
      />
    </>
  );
}
