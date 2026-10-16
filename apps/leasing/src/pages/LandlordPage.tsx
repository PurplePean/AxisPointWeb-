import { useState } from 'react';
import { GUTTER, Eyebrow, TealButton } from '@/components/ui';
import {
  SHOW_RATES,
  SPEED_PROMISES,
  agreementPhaseLabels,
  agreementSummary,
  salesCycleFaqEntries,
} from '@/content/landlord';
import { calcVacancyCost } from '@/lib/vacancy';

const SECTION = `bg-v2-surface ${GUTTER}`;
const DIVIDER = 'border-t border-v2-ink/20 pt-[18px]';

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {items.map((t) => (
        <li key={t} className="grid grid-cols-[12px_1fr] items-start gap-3">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 bg-v2-teal" />
          <span className="text-base leading-normal text-v2-ink/[0.72]">{t}</span>
        </li>
      ))}
    </ul>
  );
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function VacancyCalculator() {
  const [sqft, setSqft] = useState('');
  const [rent, setRent] = useState('');

  let result: { monthly: string; ninety: string } | null = null;
  if (sqft && rent) {
    try {
      const { monthlyCost, ninetyDayCost } = calcVacancyCost(
        parseFloat(sqft),
        parseFloat(rent),
      );
      result = { monthly: fmt.format(monthlyCost), ninety: fmt.format(ninetyDayCost) };
    } catch {
      // invalid inputs: show nothing
    }
  }

  const INPUT =
    'min-h-[44px] w-full rounded-v2 border border-[#CFC6B6] bg-v2-field-warm px-3 text-base';
  const LABEL = 'flex flex-col gap-1.5 text-sm font-semibold';

  return (
    <div className="flex flex-col gap-6 rounded-v2 border border-v2-ink/[0.14] bg-v2-field-warm p-6 min-[821px]:p-9">
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
        {result && (
          <div className="grid grid-cols-2 gap-4">
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
      {/* Intro */}
      <section className={`${SECTION} pb-12 pt-16`}>
        <div className="mx-auto max-w-v2">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-x-14 gap-y-8">
            <h1 className="m-0 border-t-[3px] border-v2-purple pt-4 text-[clamp(34px,4vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em]">
              Leasing that moves fast, with no strings.
            </h1>
            <p className="m-0 font-serif text-[26px] font-medium leading-[1.42] text-v2-ink/[0.68] [text-wrap:pretty]">
              We answer in hours, not days, and we never trap you in a listing agreement you
              cannot leave.
            </p>
          </div>
        </div>
      </section>

      <section className={`${SECTION} pb-[72px]`}>
        <div className="mx-auto flex max-w-v2 flex-col gap-14">

          {/* Speed section */}
          <div className="flex flex-col gap-5">
            <div className={DIVIDER}>
              <Eyebrow>Why speed matters</Eyebrow>
              <p className="mb-0 mt-4 text-[19px] font-semibold leading-snug tracking-[-0.02em]">
                Every week a space sits empty is rent you do not collect.
              </p>
            </div>
            <Bullets items={SPEED_PROMISES} />
          </div>

          {/* Agreement section */}
          <div className="flex flex-col gap-5">
            <div className={DIVIDER}>
              <Eyebrow>No hostage listings</Eyebrow>
              <h2 className="mb-0 mt-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em]">
                We earn the listing every day, not once.
              </h2>
              <p className="mb-0 mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">
                {agreementSummary(SHOW_RATES)} If the listing is not producing, talk to us. A short
                agreement keeps us accountable.
              </p>
            </div>
            {/* Two-segment timeline: one row per phase */}
            <div className="flex flex-col gap-2">
              {agreementPhaseLabels(SHOW_RATES).map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-4 rounded-v2 border border-v2-ink/[0.14] bg-v2-field-warm px-6 py-4"
                >
                  <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-v2-purple" />
                  <span className="text-[17px] font-semibold tracking-[-0.02em] text-v2-ink">
                    {label}
                  </span>
                  {/* TODO: owner to supply commission basis wording (e.g., "of gross lease value") */}
                </div>
              ))}
            </div>
          </div>

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
            <dl>
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
                  Talk to us. We would rather make it right than lose a client.
                  {/* TODO: owner to supply specific exit terms here */}
                </p>
              </details>

              <details className={FAQ_ITEM}>
                <summary className={FAQ_SUMMARY}>
                  Who do I talk to?
                  <span aria-hidden="true" className="text-v2-purple text-xl font-light">+</span>
                </summary>
                <p className={FAQ_BODY}>
                  Use the contact form below. Tell us about your property and we will call
                  you back the same business day.
                </p>
              </details>
            </dl>
          </div>

          {/* Closing CTA */}
          <div className={DIVIDER}>
            <p className="mb-6 max-w-[44ch] text-[16.5px] leading-relaxed text-v2-ink/[0.68]">
              Ready to put the space to work? Send a few details and we will call you back.
            </p>
            <TealButton to="/contact?role=landlord">Talk about your property</TealButton>
          </div>

        </div>
      </section>
    </>
  );
}
