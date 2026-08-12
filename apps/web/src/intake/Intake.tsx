import { createContext, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  INVOLVEMENT_CHOICES,
  PROPERTY_SCOPE_CHOICES,
  PROPERTY_TYPE_CHOICES,
  scaleCopyFor,
  shortPathCopy,
  SITUATION_CHOICES,
  TIMING_CHOICES,
  INVESTOR_TOPIC_CHOICES,
  GENERAL_TOPIC_CHOICES,
  choiceOptions,
  choiceLabel,
  followUpOptions,
  isIntentToken,
  type Pathway,
  type ServiceScope,
} from './model';
import { BOOKING_MODES } from './booking/availability';
import { LOCALES } from '../i18n/locales';
import { useMessages } from '../i18n/LocaleProvider';
import { interpolate } from '../i18n/messages';
import {
  Alert,
  ChoiceGroup,
  FieldMessage,
  SelectField,
  SuccessKicker,
  TextArea,
  TextField,
  primaryButton,
  secondaryButton,
} from './ui';
import { useIntake, type Screen } from './useIntake';

/**
 * The approved V2 intake (design@2026-07-30), built from
 * `AxisPoint Form Design.dc.html` and `AxisPointFormFlow.dc.html`.
 *
 * Frontend only. This file makes no network call of any kind: `useIntake` submits through
 * `@axispoint/submission-client`, which is the one transport boundary in the repository.
 * In `pnpm dev` that client simulates and nothing leaves the browser; in a production
 * build with no endpoint it returns a truthful failure rather than a fake success.
 *
 * The post-submission booking offer is gated on the backend's `bookingEligible`, never on
 * a pathway check here. One booking policy, and it lives on the backend.
 *
 * Active pathways: Management Proposal (three steps), Investor Services, and
 * General Inquiry. Asset Management is a PM plus AM scope inside the Management
 * Proposal pathway, not a pathway of its own. Referral Partner and Submit a
 * Referral are deferred and are deliberately absent from the gateway.
 */

/*
 * Follow-up language options, built from the ONE canonical registry.
 *
 * The stored value is the locale CODE. It used to be the English display name, matched
 * later against a separate table that spelled two of them differently, which silently
 * discarded every Simplified and Traditional Chinese preference. A code cannot disagree
 * with itself.
 *
 * All nine are offered because this is a stated preference, not a promise to answer in
 * that language. Availability is a separate gate and English is still the only locale
 * anything is sent in.
 */
/** Display name for a stored code. Empty string means "same as this page". */
function languageLabel(code: string): string {
  return LOCALES.find((l) => l.code === code)?.englishName ?? '';
}

function StepFooterNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[rgba(28,22,40,0.5)]" style={{ fontSize: 13 }}>
      {children}
    </span>
  );
}

/* ── Heading levels ────────────────────────────────────────────────────────── */

/**
 * Intake screen titles are level-aware, so the page always carries exactly one h1.
 *
 * On generic `/contact` the page owns the h1 ("Contact AxisPoint") and intake screens
 * sit beneath it as h2. On a preselected-intent route there is no generic hero, so the
 * intake's own screen title becomes the page h1 and its sub-heading moves up with it.
 *
 * The level travels by context rather than by prop so that every screen and the
 * gateway pick it up without threading an argument through each one.
 */
export type HeadingLevel = 1 | 2;

const HeadingLevelContext = createContext<HeadingLevel>(2);

function ScreenTitle({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const Tag = useContext(HeadingLevelContext) === 1 ? 'h1' : 'h2';
  return (
    <Tag className={className} style={style}>
      {children}
    </Tag>
  );
}

function SubTitle({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const Tag = useContext(HeadingLevelContext) === 1 ? 'h2' : 'h3';
  return (
    <Tag className={className} style={style}>
      {children}
    </Tag>
  );
}

/* ── Gateway ───────────────────────────────────────────────────────────────── */

function Gateway({ onChoose }: { onChoose: (p: Pathway, s: ServiceScope) => void }) {
  /**
   * The approved gateway keeps Property Owner as the one filled action and the
   * other paths as quiet ruled rows, so the management pathway stays dominant.
   * Referral Partner and Submit a Referral are omitted this pass.
   */
  const t = useMessages();

  const alternates: { title: string; desc: string; pathway: Pathway; scope: ServiceScope }[] = [
    {
      title: t.gatewayAssetTitle,
      desc: t.gatewayAssetBody,
      pathway: 'management-proposal',
      scope: 'pm-plus-am',
    },
    {
      title: t.gatewayInvestorTitle,
      desc: t.gatewayInvestorBody,
      pathway: 'investor-services',
      scope: 'investor-services',
    },
    {
      title: t.gatewayGeneralTitle,
      desc: t.gatewayGeneralBody,
      pathway: 'general-inquiry',
      scope: 'general-inquiry',
    },
  ];

  return (
    <div style={{ maxWidth: 1080 }}>
      <ScreenTitle
        className="m-0 font-semibold"
        style={{
          fontSize: 'clamp(36px,4.4vw,56px)',
          letterSpacing: '-0.045em',
          lineHeight: 1.02,
          textWrap: 'pretty',
          maxWidth: '20ch',
        }}
      >
        {t.gatewayTitle}
      </ScreenTitle>
      <p
        className="text-[rgba(28,22,40,0.68)]"
        style={{
          margin: '20px 0 44px',
          fontSize: 'clamp(16.5px,1.4vw,18px)',
          lineHeight: 1.5,
          maxWidth: '46ch',
        }}
      >
        {t.gatewayLead}
      </p>

      <button
        type="button"
        onClick={() => onChoose('management-proposal', 'undecided')}
        className="block w-full text-left cursor-pointer hover:bg-white hover:border-v2-teal"
        style={{
          background: '#FFFCF6',
          border: '1px solid rgba(28,22,40,0.2)',
          borderTop: '3px solid #24A5BC',
          padding: '24px 20px',
        }}
      >
        <span className="grid lg:grid-cols-[1fr_auto] gap-6 lg:gap-10 items-start lg:items-center">
          <span className="block">
            <span
              className="block font-bold uppercase text-v2-teal-support"
              style={{ fontSize: 11.5, letterSpacing: '0.14em', marginBottom: 12 }}
            >
              {t.gatewayOwnerKicker}
            </span>
            <span
              className="block font-semibold"
              style={{
                fontSize: 'clamp(30px,3vw,38px)',
                letterSpacing: '-0.035em',
                lineHeight: 1.06,
              }}
            >
              {t.gatewayOwnerTitle}
            </span>
            <span
              className="block text-[rgba(28,22,40,0.68)]"
              style={{ marginTop: 12, fontSize: 16, lineHeight: 1.55, maxWidth: '42ch' }}
            >
              {t.gatewayOwnerBody}
            </span>
          </span>
          <span
            className="inline-flex items-center justify-center gap-2.5 rounded-v2 bg-v2-teal font-bold text-v2-action-label whitespace-nowrap"
            style={{ minHeight: 54, padding: '0 24px', fontSize: 15 }}
          >
            {t.gatewayOwnerAction}{' '}
            <span aria-hidden="true" style={{ fontSize: 16 }}>
              &#8594;
            </span>
          </span>
        </span>
      </button>

      <div className="grid" style={{ marginTop: 44 }}>
        {alternates.map((a) => (
          <button
            key={a.title}
            type="button"
            onClick={() => onChoose(a.pathway, a.scope)}
            className="block w-full text-left cursor-pointer bg-transparent hover:border-t-v2-purple"
            style={{
              boxSizing: 'border-box',
              border: 0,
              borderTop: '1px solid rgba(28,22,40,0.2)',
              padding: '20px 0',
            }}
          >
            <span className="flex items-baseline justify-between gap-4">
              <span
                className="block font-semibold"
                style={{ fontSize: 19, letterSpacing: '-0.025em' }}
              >
                {a.title}
              </span>
              <span
                aria-hidden="true"
                className="text-[rgba(28,22,40,0.45)]"
                style={{ fontSize: 16 }}
              >
                &#8594;
              </span>
            </span>
            <span
              className="block text-[rgba(28,22,40,0.62)]"
              style={{ marginTop: 6, fontSize: 16, lineHeight: 1.55, maxWidth: '52ch' }}
            >
              {a.desc}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[rgba(28,22,40,0.58)]" style={{ margin: '44px 0 0', fontSize: 14.5 }}>
        {t.gatewayEmailPrefix}{' '}
        <a
          href="mailto:info@axispoint.llc"
          className="font-semibold border-b border-[rgba(28,22,40,0.3)] rounded-v2"
          style={{ paddingBottom: 2 }}
        >
          info@axispoint.llc
        </a>
      </p>
    </div>
  );
}

/* ── Progress ledger ───────────────────────────────────────────────────────── */

function Ledger({
  step,
  draft,
  onChangePath,
}: {
  step: 1 | 2 | 3;
  draft: ReturnType<typeof useIntake>['draft'];
  onChangePath: () => void;
}) {
  const t = useMessages();
  const rows = [
    {
      num: '01',
      label: t.labelProperty,
      value: draft.property.type
        ? draft.property.type + (draft.property.location ? `, ${draft.property.location}` : '')
        : t.labelPropertyEmpty,
      done: step > 1,
    },
    {
      num: '02',
      label: t.labelSituation,
      value: draft.situation.current || t.labelSituationEmpty,
      done: step > 2,
    },
    {
      num: '03',
      label: t.labelContact,
      value: draft.contact.fullName || t.labelContactEmpty,
      done: false,
    },
  ];

  return (
    <div
      className="lg:sticky lg:top-8 border-t border-[rgba(28,22,40,0.16)]"
      style={{ paddingTop: 18 }}
    >
      <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 18 }}>
        <span
          className="font-bold uppercase text-[rgba(28,22,40,0.5)]"
          style={{ fontSize: 11.5, letterSpacing: '0.14em' }}
        >
          {t.navPropertyManagement}
        </span>
        <button
          type="button"
          onClick={onChangePath}
          className="bg-transparent border-0 p-0 font-semibold text-[rgba(28,22,40,0.55)] underline cursor-pointer hover:text-v2-teal-support rounded-v2"
          style={{ fontSize: 12.5, textUnderlineOffset: 3, minHeight: 44 }}
        >
          {t.ledgerChangePath}
        </button>
      </div>
      <ol className="grid grid-cols-3 lg:grid-cols-1 gap-2.5 lg:gap-0 list-none p-0 m-0">
        {rows.map((r, i) => {
          const current = step === i + 1;
          const active = current || r.done;
          return (
            <li
              key={r.num}
              className="block lg:pb-[18px]"
              aria-current={current ? 'step' : undefined}
            >
              <div
                style={{
                  height: 3,
                  marginBottom: 10,
                  background: r.done ? '#24A5BC' : current ? '#38285D' : 'rgba(28,22,40,0.18)',
                }}
              />
              <div className="flex items-baseline gap-2">
                <span
                  className="font-bold"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    color: active ? '#1B8DA2' : 'rgba(28,22,40,0.4)',
                  }}
                >
                  {r.num}
                </span>
                <span
                  className="font-semibold"
                  style={{
                    fontSize: 15,
                    letterSpacing: '-0.015em',
                    color: active ? '#1C1628' : 'rgba(28,22,40,0.5)',
                  }}
                >
                  {r.label}
                </span>
              </div>
              <div
                className="hidden lg:block"
                style={{
                  marginTop: 5,
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: active ? 'rgba(28,22,40,0.62)' : 'rgba(28,22,40,0.42)',
                }}
              >
                {r.value}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── The intake ────────────────────────────────────────────────────────────── */

/**
 * `headingLevel` is 2 on generic /contact, where the page hero owns the h1, and 1 on a
 * preselected-intent route, where the intake's own title is the page h1.
 */
export default function Intake({ headingLevel = 2 }: { headingLevel?: HeadingLevel }) {
  return (
    <HeadingLevelContext.Provider value={headingLevel}>
      <IntakeScreens />
    </HeadingLevelContext.Provider>
  );
}

function IntakeScreens() {
  const [params] = useSearchParams();
  const rawIntent = params.get('intent');
  const intent = isIntentToken(rawIntent) ? rawIntent : null;

  const m = useIntake({
    intent,
    referralCode: params.get('ref') ?? '',
    devState: params.get('state'),
  });

  const t = useMessages();
  const langOptions = followUpOptions(t);
  const { draft, screen, step, errors, submitState } = m;
  const sending = submitState === 'sending';
  /**
   * `failed` is the RETRYABLE state, and it is the only one that offers "try again".
   *
   * `blocked` is a rejection retrying cannot fix: a payload the backend refused, or a
   * `SUBMISSION_ID_CONFLICT` whose attempt is dead. `unavailable` is a build with no
   * endpoint. Both say so plainly instead of inviting a retry that will fail identically.
   */
  const failed = submitState === 'failed';
  const blocked = submitState === 'blocked';
  const unavailable = submitState === 'unavailable';
  const cannotSend = blocked || unavailable;
  const scale = scaleCopyFor(draft.property.type, t);
  const isPortfolio =
    draft.property.scope === 'portfolio' || draft.property.type === 'mixed_portfolio';
  const firstName = (draft.contact.fullName || 'there').trim().split(' ')[0];
  const emailShown = draft.contact.email || 'your email';

  /*
   * Booking candidates, and the state of the booking command.
   *
   * `days` and `slots` are CANDIDATES derived from the backend's rules, never availability:
   * V2 exposes no availability query, so the browser cannot know what is free. The backend
   * is the authority and may still refuse a candidate.
   */
  const { days, slots } = m.bookingCandidates;
  const selectedDayLabel = days.find((d) => d.key === draft.booking.dayKey)?.label ?? '';
  const selectedModeLabel =
    BOOKING_MODES.find((mode) => mode.value === draft.booking.mode)?.label ?? '';

  const bookingSending = m.bookingState === 'sending';
  const bookingRetryable = m.bookingState === 'failed';
  const bookingProblem =
    m.bookingState === 'failed'
      ? t.bookingFailed
      : m.bookingState === 'unavailable'
        ? t.bookingUnavailable
        : m.bookingState === 'refused'
          ? // A taken slot gets the approved neutral wording; any other refusal says plainly
            // that retrying will not help.
            m.bookingFailure?.code === 'SLOT_UNAVAILABLE'
            ? t.bookingSlotTaken
            : t.bookingRefused
          : null;

  {
    /*
     * Development preview banner. Absent from a production bundle: `isDev` compiles to
     * false and the whole block is dropped.
     *
     * `overflow-wrap` and `min-width: 0` matter here. The fixture list is a long unbroken
     * token, and without them it forced a 505px scroll width at a 390px viewport, which
     * would mask a genuine overflow in the next verification run.
     */
  }
  const devBanner = m.isDev ? (
    <p
      className="text-[rgba(28,22,40,0.55)]"
      style={{
        margin: '0 0 20px',
        fontSize: 13,
        lineHeight: 1.5,
        maxWidth: '60ch',
        minWidth: 0,
        overflowWrap: 'anywhere',
      }}
    >
      Development preview. Submissions are simulated and no request leaves the browser.
      Append <code style={{ overflowWrap: 'anywhere' }}>?state=</code> to start on a given
      screen, or <code style={{ overflowWrap: 'anywhere' }}>?submit=</code> with a fixture
      name to choose the simulated response. The fixture names are the{' '}
      <code style={{ overflowWrap: 'anywhere' }}>SimulatorFixture</code> union in the shared
      submission client. There is no magic email address.
    </p>
  ) : null;

  /* Screens after submission are shared by every pathway. */
  const closing: Partial<Record<Screen, React.ReactNode>> = {
    confirmation: (
      <div style={{ maxWidth: 900 }}>
        <SuccessKicker>
          {draft.pathway === 'management-proposal' ? t.confirmKickerProperty : t.confirmKickerInquiry}
        </SuccessKicker>
        <ScreenTitle
          className="m-0 font-serif"
          style={{
            fontSize: 'clamp(38px,4.4vw,58px)',
            fontWeight: 500,
            lineHeight: 1.06,
            textWrap: 'pretty',
            maxWidth: '20ch',
          }}
        >
          {interpolate(
            draft.pathway === 'management-proposal' ? t.confirmTitleProperty : t.confirmTitleInquiry,
            { name: firstName },
          )}
        </ScreenTitle>
        <p
          className="text-[rgba(28,22,40,0.68)]"
          style={{
            margin: '24px 0 44px',
            fontSize: 'clamp(16.5px,1.4vw,18px)',
            lineHeight: 1.55,
            maxWidth: '48ch',
          }}
        >
          {draft.pathway === 'management-proposal'
            ? t.confirmBodyProperty
            : interpolate(t.confirmBodyInquiry, { email: emailShown })}
        </p>

        <div
          className="border-y border-[rgba(28,22,40,0.2)]"
          style={{ padding: '22px 0', marginBottom: 44, maxWidth: 620 }}
        >
          <div
            className="font-bold uppercase text-[rgba(28,22,40,0.5)]"
            style={{ fontSize: 11.5, letterSpacing: '0.14em', marginBottom: 14 }}
          >
            {t.confirmWhatYouSent}
          </div>
          <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-3.5 m-0">
            {(draft.pathway === 'management-proposal'
              ? [
                  [
                    t.labelProperty,
                    (choiceLabel(PROPERTY_TYPE_CHOICES, draft.property.type, t) || t.notSpecified) +
                      (draft.property.location ? `, ${draft.property.location}` : ''),
                  ],
                  [t.labelSituation, choiceLabel(SITUATION_CHOICES, draft.situation.current, t) || t.notSpecified],
                  [t.labelInvolvement, choiceLabel(INVOLVEMENT_CHOICES, draft.situation.involvement, t) || t.notSpecified],
                ]
              : [
                  [
                    t.labelPathway,
                    draft.pathway === 'investor-services' ? t.investorKicker : t.generalKicker,
                  ],
                  [
                    t.labelTopic,
                    choiceLabel(
                      draft.pathway === 'investor-services'
                        ? INVESTOR_TOPIC_CHOICES
                        : GENERAL_TOPIC_CHOICES,
                      draft.topic,
                      t,
                    ) || t.notSpecified,
                  ],
                  [t.labelFollowUpLanguage, languageLabel(draft.contact.followUpLanguage) || 'English'],
                ]
            ).map(([k, v]) => (
              <div key={k}>
                <dt
                  className="text-[rgba(28,22,40,0.55)]"
                  style={{ fontSize: 12.5, marginBottom: 4 }}
                >
                  {k}
                </dt>
                <dd className="m-0 font-medium" style={{ fontSize: 16 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/*
          BOOKING IS OFFERED ONLY WHEN THE BACKEND SAYS SO.
          This used to key off `draft.pathway === 'management-proposal'`, which was a
          second copy of a policy the backend already owns. Two copies drift, and the
          visible symptom is a form offering a call the booking command then refuses.
          `bookingEligible` arrives on the success response; see backend-v2-contract §7.
        */}
        {m.receipt?.bookingEligible === true ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3.5">
            <button type="button" onClick={m.goSchedule} style={primaryButton()}>
              {t.confirmScheduleCta}{' '}
              <span aria-hidden="true" style={{ fontSize: 16 }}>
                &#8594;
              </span>
            </button>
            <button
              type="button"
              onClick={m.goSkipped}
              className="bg-transparent border-0 font-semibold border-b border-[rgba(28,22,40,0.35)] cursor-pointer hover:text-v2-teal-support rounded-v2"
              style={{ padding: '0 0 3px', fontSize: 15, minHeight: 44 }}
            >
              {t.confirmWait}
            </button>
          </div>
        ) : (
          <Link
            to="/"
            className="font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 inline-flex items-center"
            style={{ fontSize: 15, paddingBottom: 3, minHeight: 44 }}
          >
            {t.backToAxisPoint}
          </Link>
        )}
      </div>
    ),

    schedule: (
      <div style={{ maxWidth: 1000 }}>
        <div
          className="font-bold uppercase text-[rgba(28,22,40,0.5)]"
          style={{ fontSize: 11.5, letterSpacing: '0.14em', marginBottom: 16 }}
        >
          {t.scheduleKicker}
        </div>
        <ScreenTitle
          className="m-0 font-semibold"
          style={{
            fontSize: 'clamp(31px,3.6vw,46px)',
            letterSpacing: '-0.04em',
            lineHeight: 1.04,
            maxWidth: '22ch',
          }}
        >
          {t.scheduleTitle}
        </ScreenTitle>
        <p
          className="text-[rgba(28,22,40,0.68)]"
          style={{
            margin: '16px 0 44px',
            fontSize: 'clamp(16.5px,1.4vw,18px)',
            lineHeight: 1.5,
            maxWidth: '46ch',
          }}
        >
          {t.scheduleLead}
        </p>

        <div className="grid lg:grid-cols-[1fr_0.85fr] gap-8 lg:gap-[72px] items-start">
          <div>
            <div className="font-semibold" style={{ fontSize: 14, marginBottom: 12 }}>
              {t.scheduleSelectDate}
            </div>
            {/*
              Business days inside the backend's own horizon, computed from its rules. Not
              a month grid: a calendar implies the days it does not offer are unavailable,
              and the browser has no way to know that. A list of the days that CAN be
              requested claims exactly as much as is true.
            */}
            <div
              className="grid gap-1.5"
              role="group"
              aria-label={t.scheduleSelectDate}
              style={{ background: '#FFFCF6', border: '1px solid rgba(28,22,40,0.2)', padding: 14, maxHeight: 320, overflowY: 'auto' }}
            >
              {days.map((d) => {
                const on = draft.booking.dayKey === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => m.chooseDay(d.key)}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      fontSize: 14.5,
                      fontWeight: on ? 700 : 500,
                      borderRadius: 2,
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: on ? '#24A5BC' : 'transparent',
                      color: on ? '#0F1F27' : '#1C1628',
                      border: `1px solid ${on ? '#24A5BC' : 'rgba(28,22,40,0.18)'}`,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[rgba(28,22,40,0.55)]" style={{ margin: '12px 0 0', fontSize: 13 }}>
              {t.bookingCandidateNote}
            </p>
          </div>

          <div>
            <div className="font-semibold" style={{ fontSize: 14, marginBottom: 12 }}>
              {t.scheduleSelectTime}
            </div>
            {/*
              No slot is ever struck through. The browser cannot know which times are taken,
              and drawing one as unavailable would be a guess presented as a fact. If a slot
              has gone by the time it is requested, the backend says so and the visitor picks
              again.
            */}
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.scheduleSelectTime}>
              {slots.map((s) => {
                const on = draft.booking.slotStart === s.slotStart;
                return (
                  <button
                    key={s.slotStart}
                    type="button"
                    aria-pressed={on}
                    onClick={() => m.chooseSlot(s.slotStart, s.label)}
                    style={{
                      minHeight: 48,
                      padding: '0 10px',
                      fontSize: 14.5,
                      fontWeight: on ? 700 : 500,
                      borderRadius: 2,
                      cursor: 'pointer',
                      background: on ? '#24A5BC' : '#FFFCF6',
                      color: on ? '#0F1F27' : '#1C1628',
                      border: on ? '2px solid #24A5BC' : '1px solid rgba(28,22,40,0.22)',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
              {days.length > 0 && slots.length === 0 && (
                <p className="text-[rgba(28,22,40,0.6)]" style={{ margin: 0, fontSize: 14, gridColumn: '1 / -1' }}>
                  {t.scheduleChooseDateFirst}
                </p>
              )}
            </div>

            <div style={{ marginTop: 28 }}>
              {/* Labels are display strings; the value stored is the backend token. */}
              <ChoiceGroup
                legend={t.scheduleHowMeet}
                columns={1}
                options={[
                  { value: 'phone_call', label: t.bookingModePhone },
                  { value: 'video_meeting', label: t.bookingModeVideo },
                ]}
                value={draft.booking.mode}
                onChange={(value) => m.chooseMode(value)}
              />
            </div>

            <div
              className="border-t border-[rgba(28,22,40,0.2)]"
              style={{ marginTop: 28, paddingTop: 20 }}
            >
              <div
                className="text-[rgba(28,22,40,0.55)]"
                style={{ fontSize: 12.5, marginBottom: 6 }}
              >
                {t.scheduleSelectedLabel}
              </div>
              <div className="font-semibold" style={{ fontSize: 16 }}>
                {m.bookingReady
                  ? interpolate(t.scheduleSelectedSummary, {
                      day: selectedDayLabel,
                      time: draft.booking.timeLabel,
                      mode: selectedModeLabel,
                    })
                  : t.scheduleSelectedEmpty}
              </div>

              {/*
                A booking refusal is reported where the decision was made, not on a separate
                screen: the visitor is already looking at the picker they need to change.
                A taken slot is not a failure, so it never offers "try again": the fix is
                another time, and choosing one mints a new request in the client.
              */}
              {bookingProblem && (
                <div role="alert" style={{ marginTop: 16 }}>
                  <Alert innerRef={m.alertRef} assertive>
                    {bookingProblem}
                  </Alert>
                </div>
              )}

              <button
                type="button"
                onClick={bookingRetryable ? m.retryBooking : m.confirmBooking}
                disabled={!m.bookingReady || bookingSending}
                aria-busy={bookingSending || undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  marginTop: 18,
                  minHeight: 54,
                  padding: '0 24px',
                  border: 0,
                  borderRadius: 2,
                  fontSize: 15,
                  fontWeight: 700,
                  background: m.bookingReady ? (bookingSending ? '#1B8DA2' : '#24A5BC') : 'rgba(28,22,40,0.12)',
                  color: m.bookingReady ? (bookingSending ? '#FFFFFF' : '#0F1F27') : 'rgba(28,22,40,0.42)',
                  cursor: !m.bookingReady ? 'not-allowed' : bookingSending ? 'progress' : 'pointer',
                }}
              >
                {bookingSending ? t.scheduleBooking : bookingRetryable ? t.tryAgain : t.scheduleConfirm}
                {!bookingSending && (
                  <span aria-hidden="true" style={{ fontSize: 16 }}>
                    &#8594;
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    ),

    scheduled: (
      <div style={{ maxWidth: 820 }}>
        <SuccessKicker>{t.scheduledKicker}</SuccessKicker>
        <ScreenTitle
          className="m-0 font-serif"
          style={{
            fontSize: 'clamp(38px,4.4vw,58px)',
            fontWeight: 500,
            lineHeight: 1.06,
            maxWidth: '22ch',
          }}
        >
          {t.scheduledTitle}
        </ScreenTitle>
        <dl
          className="border-y border-[rgba(28,22,40,0.2)] grid gap-4 m-0"
          style={{ margin: '30px 0 44px', padding: '22px 0', maxWidth: 560 }}
        >
          {[
            // The time the visitor actually booked, not a fixture default. Confirmed only
            // reaches this screen after the backend created the calendar event.
            [
              t.labelWhen,
              interpolate(t.scheduledWhenValue, {
                day: selectedDayLabel,
                time: draft.booking.timeLabel,
              }),
            ],
            [t.labelFormat, selectedModeLabel],
            [t.labelLength, t.bookingDurationLabel],
            [t.labelWith, t.bookingWithLabel],
          ].map(([k, v]) => (
            <div key={k} className="grid lg:grid-cols-[120px_1fr] gap-y-2 gap-x-6">
              <dt className="text-[rgba(28,22,40,0.55)]" style={{ fontSize: 12.5 }}>
                {k}
              </dt>
              <dd className="m-0 font-medium" style={{ fontSize: 16 }}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <p
          className="text-[rgba(28,22,40,0.62)]"
          style={{ margin: '0 0 30px', fontSize: 14.5, lineHeight: 1.6, maxWidth: '50ch' }}
        >
          {interpolate(t.scheduledInviteNote, { email: emailShown })}
        </p>
        {m.isDev && (
          <p
            className="text-[rgba(28,22,40,0.55)]"
            style={{ margin: '0 0 30px', fontSize: 13, maxWidth: '50ch' }}
          >
            {t.scheduledDevNote}
          </p>
        )}
        <Link
          to="/"
          className="font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 inline-flex items-center"
          style={{ fontSize: 15, paddingBottom: 3, minHeight: 44 }}
        >
          Back to AxisPoint
        </Link>
      </div>
    ),

    skipped: (
      <div style={{ maxWidth: 720 }}>
        <SuccessKicker>{t.confirmKickerProperty}</SuccessKicker>
        <ScreenTitle
          className="m-0 font-serif"
          style={{
            fontSize: 'clamp(38px,4.4vw,58px)',
            fontWeight: 500,
            lineHeight: 1.06,
            maxWidth: '20ch',
          }}
        >
          {t.skippedTitle}
        </ScreenTitle>
        <p
          className="text-[rgba(28,22,40,0.68)]"
          style={{
            margin: '24px 0 44px',
            fontSize: 'clamp(16.5px,1.4vw,18px)',
            lineHeight: 1.55,
            maxWidth: '50ch',
          }}
        >
          {interpolate(t.skippedBody, { email: emailShown })}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3.5">
          <button type="button" onClick={m.goSchedule} style={secondaryButton}>
            {t.confirmScheduleCta}{' '}
            <span aria-hidden="true" style={{ fontSize: 16 }}>
              &#8594;
            </span>
          </button>
          <Link
            to="/"
            className="font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 inline-flex items-center"
            style={{ fontSize: 15, paddingBottom: 3, minHeight: 44 }}
          >
            {t.backToAxisPoint}
          </Link>
        </div>
      </div>
    ),
  };

  if (closing[screen])
    return (
      <>
        {devBanner}
        {closing[screen]}
      </>
    );

  /* ── Gateway ── */
  if (screen === 'gateway') {
    return (
      <>
        {devBanner}
        <Gateway onChoose={m.choosePathway} />
      </>
    );
  }

  /* ── Short pathways: Investor Services and General Inquiry ── */
  if (screen === 'short') {
    const copy = shortPathCopy(draft.pathway as 'investor-services' | 'general-inquiry', t);
    const count = Object.keys(errors).length;
    return (
      <>
        {devBanner}
        <div style={{ maxWidth: 640 }}>
          <div
            className="flex items-baseline justify-between gap-4 border-t-[3px] border-v2-purple"
            style={{ paddingTop: 14, marginBottom: 22 }}
          >
            <span
              className="font-bold uppercase text-[rgba(28,22,40,0.6)]"
              style={{ fontSize: 11.5, letterSpacing: '0.14em' }}
            >
              {copy.kicker}
            </span>
            <button
              type="button"
              onClick={m.backToGateway}
              className="bg-transparent border-0 p-0 font-semibold text-[rgba(28,22,40,0.55)] underline cursor-pointer hover:text-v2-teal-support rounded-v2"
              style={{ fontSize: 12.5, textUnderlineOffset: 3, minHeight: 44 }}
            >
              {t.ledgerChangePath}
            </button>
          </div>
          <ScreenTitle
            className="m-0 font-semibold"
            style={{
              fontSize: 'clamp(31px,3.6vw,46px)',
              letterSpacing: '-0.04em',
              lineHeight: 1.04,
              textWrap: 'pretty',
              maxWidth: '24ch',
            }}
          >
            {copy.title}
          </ScreenTitle>
          <p
            className="text-[rgba(28,22,40,0.68)]"
            style={{
              margin: '16px 0 44px',
              fontSize: 'clamp(16.5px,1.4vw,18px)',
              lineHeight: 1.5,
              maxWidth: '50ch',
            }}
          >
            {copy.lead}
          </p>

          {count > 0 && (
            <Alert innerRef={m.alertRef} assertive>
              <strong style={{ fontWeight: 700 }}>
                {count === 1
                  ? t.errorSummaryOne
                  : interpolate(t.errorSummaryMany, { count: String(count) })}
              </strong>{' '}
              {t.errorSummaryFixInquiry}
            </Alert>
          )}
          {failed && (
            <Alert innerRef={m.alertRef} assertive>
              <span className="block">
                <strong style={{ fontWeight: 700 }}>{t.failedTitleInquiry}</strong>{' '}
                {t.failedBody}
              </span>
              <span
                className="flex flex-wrap items-center gap-x-[18px] gap-y-2"
                style={{ marginTop: 12 }}
              >
                <button
                  type="button"
                  onClick={m.retry}
                  style={{ ...primaryButton(), minHeight: 44, padding: '0 16px', fontSize: 14.5 }}
                >
                  {t.tryAgain}{' '}
                  <span aria-hidden="true" style={{ fontSize: 15 }}>
                    &#8594;
                  </span>
                </button>
                <a
                  href="mailto:info@axispoint.llc"
                  className="font-semibold border-b border-[rgba(28,22,40,0.35)]"
                  style={{ fontSize: 14.5, paddingBottom: 2 }}
                >
                  info@axispoint.llc
                </a>
              </span>
            </Alert>
          )}
          {cannotSend && (
            <Alert innerRef={m.alertRef} assertive>
              <span className="block">
                <strong style={{ fontWeight: 700 }}>
                  {unavailable ? t.unavailableTitle : t.failedTitleInquiry}
                </strong>{' '}
                {unavailable ? t.unavailableBody : t.blockedBody}
              </span>
              <span
                className="flex flex-wrap items-center gap-x-[18px] gap-y-2"
                style={{ marginTop: 12 }}
              >
                <a
                  href="mailto:info@axispoint.llc"
                  className="font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 inline-flex items-center"
                  style={{ fontSize: 14.5, paddingBottom: 2, minHeight: 44 }}
                >
                  {t.emailAxisPoint}
                </a>
              </span>
            </Alert>
          )}

          <div className="grid gap-[26px] lg:gap-8">
            <SelectField
              label={copy.topicLabel}
              value={draft.topic}
              onChange={m.setTopic}
              error={errors.topic}
              options={[
                { value: '', text: t.selectOne },
                ...copy.topics.map((c) => ({ value: c.value, text: t[c.labelKey] })),
              ]}
            />
            <div className="grid sm:grid-cols-2 gap-[26px] lg:gap-x-5 lg:gap-y-8">
              <TextField
                label={t.fieldFullName}
                value={draft.contact.fullName}
                onChange={(v) => m.setContact('fullName', v)}
                autoComplete="name"
                error={errors.fullName}
                help={t.nameHelp}
              />
              <TextField
                label={t.fieldEmail}
                type="email"
                value={draft.contact.email}
                onChange={(v) => m.setContact('email', v)}
                autoComplete="email"
                error={errors.email}
                help={t.emailHelp}
              />
              <TextField
                label={t.fieldPhone}
                type="tel"
                optional
                value={draft.contact.phone}
                onChange={(v) => m.setContact('phone', v)}
                autoComplete="tel"
                placeholder={t.fieldPhonePlaceholder}
              />
              <TextField
                label={copy.organizationLabel}
                optional
                value={draft.contact.organization}
                onChange={(v) => m.setContact('organization', v)}
                autoComplete="organization"
              />
            </div>
            <TextArea
              label={copy.noteLabel}
              value={draft.situation.notes}
              onChange={(v) => m.setSituation('notes', v)}
              placeholder={copy.notePlaceholder}
            />
            <SelectField
              label={t.fieldLanguageFollowUp}
              optional
              maxWidth={300}
              value={draft.contact.followUpLanguage}
              onChange={(v) => m.setContact('followUpLanguage', v)}
              options={langOptions}
              helpTone={draft.contact.followUpLanguage ? 'good' : 'help'}
              help={
                draft.contact.followUpLanguage
                  ? interpolate(t.followUpHelpChosen, { language: languageLabel(draft.contact.followUpLanguage) })
                  : t.followUpHelpDefault
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5" style={{ marginTop: 44 }}>
            <button
              type="button"
              onClick={m.submit}
              disabled={sending}
              style={primaryButton(sending)}
            >
              {sending ? t.sending : copy.action}
            </button>
            <StepFooterNote>{t.noDocuments}</StepFooterNote>
          </div>
        </div>
      </>
    );
  }

  /* ── Management Proposal, three steps ── */
  return (
    <>
      {devBanner}
      <div
        className="grid lg:grid-cols-[0.34fr_1fr] gap-8 lg:gap-[72px] items-start"
        style={{ maxWidth: 1200 }}
      >
        <Ledger step={step} draft={draft} onChangePath={m.backToGateway} />

        <div>
          {step === 1 && (
            <div>
              <ScreenTitle
                className="m-0 font-semibold"
                style={{
                  fontSize: 'clamp(31px,3.6vw,46px)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.04,
                  textWrap: 'pretty',
                  maxWidth: '22ch',
                }}
              >
                {t.step1Title}
              </ScreenTitle>
              <p
                className="text-[rgba(28,22,40,0.68)]"
                style={{
                  margin: '18px 0 44px',
                  fontSize: 'clamp(16.5px,1.4vw,18px)',
                  lineHeight: 1.5,
                  maxWidth: '52ch',
                }}
              >
                {t.step1Lead}
              </p>
              <SubTitle
                className="m-0 font-semibold border-t-[3px] border-v2-purple"
                style={{
                  fontSize: 'clamp(20px,2vw,24px)',
                  letterSpacing: '-0.03em',
                  paddingTop: 16,
                  marginBottom: 22,
                }}
              >
                {t.step1SubTitle}
              </SubTitle>

              <div className="grid gap-[26px] lg:gap-8">
                <ChoiceGroup
                  legend={t.legendPropertyType}
                  options={PROPERTY_TYPE_CHOICES.map((c) => ({ value: c.value, label: t[c.labelKey] }))}
                  value={draft.property.type}
                  onChange={(v) => m.setProperty('type', v)}
                />
                <ChoiceGroup
                  legend={t.legendPropertyScope}
                  options={PROPERTY_SCOPE_CHOICES.map((c) => ({ value: c.value, label: t[c.labelKey] }))}
                  value={draft.property.scope}
                  onChange={(v) => m.setProperty('scope', v)}
                />

                <div style={{ maxWidth: 480 }}>
                  <TextField
                    label={t.fieldLocation}
                    value={draft.property.location}
                    onChange={(v) => m.setProperty('location', v)}
                    placeholder={t.fieldLocationPlaceholder}
                    autoComplete="address-level2"
                    help={t.fieldLocationHelp}
                  />
                </div>

                <div>
                  <div
                    className={`grid gap-4 ${isPortfolio ? 'lg:grid-cols-[1fr_0.7fr]' : ''}`}
                    style={{ maxWidth: 620 }}
                  >
                    <TextField
                      label={scale.label}
                      value={draft.property.scaleUnknown ? '' : draft.property.scale}
                      onChange={(v) => m.setProperty('scale', v)}
                      placeholder={draft.property.scaleUnknown ? t.notSure : scale.placeholder}
                      inputMode="numeric"
                      disabled={draft.property.scaleUnknown}
                    />
                    {isPortfolio && (
                      <TextField
                        label={t.fieldPropertyCount}
                        value={draft.property.propertyCount}
                        onChange={(v) => m.setProperty('propertyCount', v)}
                        placeholder={t.fieldPropertyCountPlaceholder}
                        inputMode="numeric"
                      />
                    )}
                  </div>
                  {/* "Not sure" sits beside the field and disables it rather than hiding it, so the layout does not jump. */}
                  <button
                    type="button"
                    onClick={() => m.setProperty('scaleUnknown', !draft.property.scaleUnknown)}
                    aria-pressed={draft.property.scaleUnknown}
                    className="inline-flex items-center gap-2.5 cursor-pointer bg-transparent rounded-v2"
                    style={{
                      marginTop: 14,
                      minHeight: 44,
                      padding: '0 14px 0 12px',
                      border: `1px solid ${draft.property.scaleUnknown ? '#24A5BC' : 'rgba(28,22,40,0.24)'}`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 13,
                        height: 13,
                        border: draft.property.scaleUnknown
                          ? '4px solid #24A5BC'
                          : '1.5px solid rgba(28,22,40,0.4)',
                        background: '#FFFFFF',
                      }}
                    />
                    <span className="font-medium" style={{ fontSize: 14.5 }}>
                      {t.notSure}
                    </span>
                  </button>
                  <FieldMessage>{scale.help}</FieldMessage>
                </div>
              </div>

              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-3.5"
                style={{ marginTop: 44 }}
              >
                <button type="button" onClick={m.next} style={primaryButton()}>
                  {t.continueLabel}{' '}
                  <span aria-hidden="true" style={{ fontSize: 16 }}>
                    &#8594;
                  </span>
                </button>
                <StepFooterNote>{t.step1Footer}</StepFooterNote>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <ScreenTitle
                className="m-0 font-semibold"
                style={{
                  fontSize: 'clamp(31px,3.6vw,46px)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.04,
                  marginBottom: 22,
                }}
              >
                {t.step2Title}
              </ScreenTitle>

              <div className="grid gap-[26px] lg:gap-8">
                <ChoiceGroup
                  legend={t.legendCurrentSituation}
                  options={SITUATION_CHOICES.map((c) => ({ value: c.value, label: t[c.labelKey] }))}
                  value={draft.situation.current}
                  onChange={(v) => m.setSituation('current', v)}
                />
                <ChoiceGroup
                  legend={t.legendInvolvement}
                  columns={1}
                  options={INVOLVEMENT_CHOICES.map((c) => ({ value: c.value, label: t[c.labelKey], hint: c.hintKey ? t[c.hintKey] : undefined }))}
                  value={draft.situation.involvement}
                  onChange={(v) => m.setSituation('involvement', v)}
                />
                <div style={{ maxWidth: 420 }}>
                  <SelectField
                    label={t.fieldTiming}
                    value={draft.situation.timing}
                    onChange={(v) => m.setSituation('timing', v)}
                    options={[
                      { value: '', text: t.fieldTimingPlaceholder },
                      ...choiceOptions(TIMING_CHOICES, t),
                    ]}
                  />
                </div>
                <div style={{ maxWidth: 620 }}>
                  <TextArea
                    label={t.fieldUnderstand}
                    value={draft.situation.notes}
                    onChange={(v) => m.setSituation('notes', v)}
                    placeholder={t.fieldUnderstandPlaceholder}
                  />
                </div>
              </div>

              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-3.5"
                style={{ marginTop: 44 }}
              >
                <button type="button" onClick={m.back} style={secondaryButton}>
                  <span aria-hidden="true" style={{ fontSize: 16 }}>
                    &#8592;
                  </span>{' '}
                  {t.backLabel}
                </button>
                <button type="button" onClick={m.next} style={primaryButton()}>
                  {t.continueLabel}{' '}
                  <span aria-hidden="true" style={{ fontSize: 16 }}>
                    &#8594;
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <ScreenTitle
                className="m-0 font-semibold"
                style={{
                  fontSize: 'clamp(31px,3.6vw,46px)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.04,
                  marginBottom: 22,
                }}
              >
                {t.step3Title}
              </ScreenTitle>

              {failed && (
                <Alert innerRef={m.alertRef} assertive>
                  <span className="block">
                    <strong style={{ fontWeight: 700 }}>
                      {t.failedTitleProperty}
                    </strong>{' '}
                    Your answers are still here. Try again or contact AxisPoint directly.
                  </span>
                  <span
                    className="flex flex-wrap items-center gap-x-[18px] gap-y-2"
                    style={{ marginTop: 12 }}
                  >
                    <button
                      type="button"
                      onClick={m.retry}
                      style={{
                        ...primaryButton(),
                        minHeight: 44,
                        padding: '0 16px',
                        fontSize: 14.5,
                      }}
                    >
                      Try again{' '}
                      <span aria-hidden="true" style={{ fontSize: 15 }}>
                        &#8594;
                      </span>
                    </button>
                    <a
                      href="mailto:info@axispoint.llc"
                      className="font-semibold border-b border-[rgba(28,22,40,0.35)]"
                      style={{ fontSize: 14.5, paddingBottom: 2 }}
                    >
                      info@axispoint.llc
                    </a>
                  </span>
                </Alert>
              )}
          {cannotSend && (
            <Alert innerRef={m.alertRef} assertive>
              <span className="block">
                <strong style={{ fontWeight: 700 }}>
                  {unavailable ? t.unavailableTitle : t.failedTitleInquiry}
                </strong>{' '}
                {unavailable ? t.unavailableBody : t.blockedBody}
              </span>
              <span
                className="flex flex-wrap items-center gap-x-[18px] gap-y-2"
                style={{ marginTop: 12 }}
              >
                <a
                  href="mailto:info@axispoint.llc"
                  className="font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 inline-flex items-center"
                  style={{ fontSize: 14.5, paddingBottom: 2, minHeight: 44 }}
                >
                  {t.emailAxisPoint}
                </a>
              </span>
            </Alert>
          )}
              {Object.keys(errors).length > 0 && (
                <Alert innerRef={failed ? undefined : m.alertRef} assertive>
                  <strong style={{ fontWeight: 700 }}>
                    {Object.keys(errors).length === 1
                      ? t.errorSummaryOne
                      : t.errorSummaryTwo}
                  </strong>{' '}
                  {t.errorSummaryFixProperty}
                </Alert>
              )}

              <div
                className="grid sm:grid-cols-2 gap-[26px] lg:gap-x-5 lg:gap-y-8"
                style={{ maxWidth: 620 }}
              >
                <TextField
                  label={t.fieldFullName}
                  value={draft.contact.fullName}
                  onChange={(v) => m.setContact('fullName', v)}
                  autoComplete="name"
                  error={errors.fullName}
                  help={t.nameHelp}
                />
                <TextField
                  label={t.fieldEmail}
                  type="email"
                  value={draft.contact.email}
                  onChange={(v) => m.setContact('email', v)}
                  autoComplete="email"
                  error={errors.email}
                  help={t.emailHelp}
                />
                <TextField
                  label={t.fieldPhone}
                  type="tel"
                  optional
                  value={draft.contact.phone}
                  onChange={(v) => m.setContact('phone', v)}
                  autoComplete="tel"
                  placeholder={t.fieldPhonePlaceholder}
                  help={t.fieldPhoneHelp}
                />
                <TextField
                  label={t.fieldCompanyOwnership}
                  optional
                  value={draft.contact.organization}
                  onChange={(v) => m.setContact('organization', v)}
                  autoComplete="organization"
                />
                <SelectField
                  label={t.fieldLanguageFollowUp}
                  optional
                  value={draft.contact.followUpLanguage}
                  onChange={(v) => m.setContact('followUpLanguage', v)}
                  options={langOptions}
                  helpTone={draft.contact.followUpLanguage ? 'good' : 'help'}
                  help={
                    draft.contact.followUpLanguage
                      ? interpolate(t.followUpHelpChosen, { language: languageLabel(draft.contact.followUpLanguage) })
                      : t.followUpHelpDefault
                  }
                />
              </div>

              <p
                className="text-[rgba(28,22,40,0.62)]"
                style={{ margin: '22px 0 44px', fontSize: 14.5, lineHeight: 1.6, maxWidth: '52ch' }}
              >
                {t.privacyNote}
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5">
                <button type="button" onClick={m.back} style={secondaryButton}>
                  <span aria-hidden="true" style={{ fontSize: 16 }}>
                    &#8592;
                  </span>{' '}
                  {t.backLabel}
                </button>
                <button
                  type="button"
                  onClick={m.submit}
                  disabled={sending}
                  style={primaryButton(sending)}
                >
                  {sending ? t.sending : t.sendPropertyDetails}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
