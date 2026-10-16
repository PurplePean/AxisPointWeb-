import { useState } from 'react';
import {
  BAND,
  BigHeading,
  ClosingBand,
  Eyebrow,
  GUTTER,
  PageHero,
  QuietAnchor,
  SECTION_Y,
  Strong,
  TealButton,
} from '@/components/ui';
import {
  SHOW_RATES,
  SPEED_PROMISES,
  agreementPhases,
  agreementSummary,
  salesCycleFaqEntries,
  whoToTalkAnswer,
} from '@/content/landlord';
import { calcVacancyCost, parseNumericInput } from '@/lib/vacancy';

const DIVIDER = 'border-t border-v2-ink/20 pt-[18px]';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function VacancyCalculator() {
  const [sqft, setSqft] = useState('');
  const [rent, setRent] = useState('');

  let result: { monthly: string; ninety: string } | null = null;
  let invalid = false;
  if (sqft.trim() || rent.trim()) {
    const sqftNum = parseNumericInput(sqft);
    const rentNum = parseNumericInput(rent);
    if (sqft.trim() && rent.trim()) {
      if (sqftNum === null || rentNum === null) {
        invalid = true;
      } else {
        try {
          const { monthlyCost, ninetyDayCost } = calcVacancyCost(sqftNum, rentNum);
          result = { monthly: fmt.format(monthlyCost), ninety: fmt.format(ninetyDayCost) };
        } catch {
          invalid = true;
        }
      }
    } else if ((sqft.trim() && sqftNum === null) || (rent.trim() && rentNum === null)) {
      invalid = true;
    }
  }

  const INPUT =
    'min-h-[44px] w-full rounded-v2 border border-[#CFC6B6] bg-v2-field-warm px-3 text-base';
  const LABEL = 'flex flex-col gap-1.5 text-sm font-semibold';

  return (
    <div className="flex flex-col gap-6 rounded-v2 border border-v2-ink/[0.14] bg-v2-surface p-6 min-[821px]:p-9">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        <label className={LABEL}>
          Square feet
          <input
            type="text"
            inputMode="decimal"
            value={sqft}
            onChange={(e) => setSqft(e.target.value)}
            className={INPUT}
            placeholder="e.g. 2000"
          />
        </label>
        <label className={LABEL}>
          Annual base rent per sq ft ($)
          <input
            type="text"
            inputMode="decimal"
            value={rent}
            onChange={(e) => setRent(e.target.value)}
            className={INPUT}
            placeholder="e.g. 24"
          />
        </label>
      </div>
      <div aria-live="polite" className="min-h-[56px]">
        {invalid && (
          <p className="m-0 text-[14px] leading-normal text-v2-ink/[0.7]">
            Enter numbers only, like 2,000 and 24.50.
          </p>
        )}
        {result && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.1em] text-v2-ink/[0.5]">
                Monthly base rent
              </p>
              <p className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-v2-ink">
                {result.monthly}
              </p>
            </div>
            <div>
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.1em] text-v2-ink/[0.5]">
                90-day vacancy cost
              </p>
              <p className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-v2-purple">
                {result.ninety}
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="m-0 text-[13px] leading-normal text-v2-ink/[0.55]">
        Estimate of base rent only. Excludes NNN charges and other costs.
      </p>
    </div>
  );
}

const FAQ_ITEM = 'border-t border-v2-ink/20';
const FAQ_SUMMARY =
  'flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-semibold text-v2-ink [&::-webkit-details-marker]:hidden';
const FAQ_BODY = 'pb-4 text-[16px] leading-relaxed text-v2-ink/[0.68]';

export default function LandlordPage() {
  return (
    <>
      <PageHero
        eyebrow="Landlord representation"
        title="Leasing that moves fast, with no strings."
        lede={
          <>
            We answer in <Strong>hours, not days</Strong>, and we never trap you in a listing
            agreement you cannot leave.
          </>
        }
      >
        <TealButton to="/contact?role=landlord">Talk about your property</TealButton>
        <QuietAnchor href="#agreement">See how the agreement works</QuietAnchor>
      </PageHero>

      {/* Speed */}
      <section className={`${BAND} ${GUTTER} ${SECTION_Y}`}>
        <div className="mx-auto max-w-v2">
          <Eyebrow>Why speed matters</Eyebrow>
          <div className="mb-8 mt-4 min-[821px]:mb-[52px]">
            <BigHeading>Every week a space sits empty is rent you do not collect.</BigHeading>
          </div>
          <ol className="m-0 grid list-none gap-[34px] p-0 min-[821px]:grid-cols-3 min-[821px]:gap-12">
            {SPEED_PROMISES.map((p, i) => (
              <li key={p} className="border-t-[3px] border-v2-purple pt-4">
                <span className="text-[15px] font-bold tracking-[0.1em] text-v2-teal-support">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mb-0 mt-3 text-[clamp(19px,1.7vw,23px)] font-semibold leading-[1.25] tracking-[-0.02em]">
                  {p}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Agreement */}
      <section id="agreement" className={`${GUTTER} ${SECTION_Y} scroll-mt-4`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-10">
          <div>
            <Eyebrow>No hostage listings</Eyebrow>
            <div className="mt-4">
              <BigHeading>We earn the listing every day, not once.</BigHeading>
            </div>
            <p className="mb-0 mt-5 max-w-[56ch] text-[clamp(16px,1.3vw,18px)] leading-[1.6] text-v2-ink/[0.7]">
              <Strong>{agreementSummary(SHOW_RATES)}</Strong> If the listing is not producing, talk
              to us. A short agreement keeps us accountable.
            </p>
          </div>
          {/* Timeline: segment widths follow the number of days in each phase */}
          <div className="flex flex-col gap-3 min-[821px]:flex-row">
            {agreementPhases(SHOW_RATES).map((ph, i) => (
              <div
                key={ph.range}
                style={{ flexGrow: ph.days }}
                className={`flex flex-col gap-1 rounded-v2 p-6 min-[821px]:basis-0 ${
                  i === 0
                    ? 'bg-v2-purple text-white'
                    : 'border border-v2-ink/[0.14] bg-v2-field-warm text-v2-ink'
                }`}
              >
                {ph.rate && (
                  <span className="text-[clamp(40px,5vw,64px)] font-semibold leading-none tracking-[-0.04em]">
                    {ph.rate}
                  </span>
                )}
                <span className={`text-[15px] font-bold ${i === 0 ? 'text-white/[0.85]' : 'text-v2-purple'}`}>
                  {ph.range}
                </span>
                {/* TODO: owner to supply commission basis wording (e.g., "of gross lease value") */}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${BAND} ${GUTTER} ${SECTION_Y}`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-14">

          {/* Vacancy cost calculator */}
          <div className="flex flex-col gap-5">
            <div className={DIVIDER}>
              <Eyebrow>The cost of waiting</Eyebrow>
              <p className="mb-0 mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">
                Enter the space size and rent to see how vacancy adds up. No data leaves
                this page.
              </p>
            </div>
            <VacancyCalculator />
          </div>

          {/* FAQ */}
          <div className="flex flex-col">
            <div className={DIVIDER}>
              <Eyebrow>Common questions</Eyebrow>
            </div>
            <div>
              <details className={FAQ_ITEM}>
                <summary className={FAQ_SUMMARY}>
                  How long is the agreement?
                  <span aria-hidden="true" className="text-v2-purple text-xl font-light">+</span>
                </summary>
                <p className={FAQ_BODY}>
                  90 days.
                </p>
              </details>

              {salesCycleFaqEntries().map((entry) => (
                <details key={entry.question} className={FAQ_ITEM}>
                  <summary className={FAQ_SUMMARY}>
                    {entry.question}
                    <span aria-hidden="true" className="text-v2-purple text-xl font-light">+</span>
                  </summary>
                  <p className={FAQ_BODY}>{entry.answer}</p>
                </details>
              ))}

              {SHOW_RATES && (
                <details className={FAQ_ITEM}>
                  <summary className={FAQ_SUMMARY}>
                    How does the rate work?
                    <span aria-hidden="true" className="text-v2-purple text-xl font-light">+</span>
                  </summary>
                  <p className={FAQ_BODY}>
                    {agreementSummary(true)}
                  </p>
                </details>
              )}

              <details className={FAQ_ITEM}>
                <summary className={FAQ_SUMMARY}>
                  What if it is not working?
                  <span aria-hidden="true" className="text-v2-purple text-xl font-light">+</span>
                </summary>
                <p className={FAQ_BODY}>
                  Talk to us.
                  {/* TODO: owner to supply specific exit terms here */}
                </p>
              </details>

              <details className={FAQ_ITEM}>
                <summary className={FAQ_SUMMARY}>
                  Who do I talk to?
                  <span aria-hidden="true" className="text-v2-purple text-xl font-light">+</span>
                </summary>
                <p className={FAQ_BODY}>
                  {whoToTalkAnswer()}
                </p>
              </details>
            </div>
          </div>


        </div>
      </section>

      <ClosingBand
        title="Ready to put the space to work?"
        body="Send a few details and we will call you back."
        ctaLabel="Talk about your property"
        ctaTo="/contact?role=landlord"
      />
    </>
  );
}
