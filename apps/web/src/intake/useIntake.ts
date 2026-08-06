import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isSubmissionResponse,
  isSuccess,
  type BookingMode,
  type ClientResult,
} from '@axispoint/submission-client';
import { getSubmissionClient } from './submissionClient';
import { getBookingClient } from './booking/bookingClient';
import { BOOKING_RULES, candidateDays, candidateSlots } from './booking/availability';
import { toEnvelopeDraft } from './toWire';
import {
  emptyDraft,
  involvementFromScope,
  scopeFromInvolvement,
  validateDraft,
  type FieldErrors,
  type IntakeDraft,
  type IntentToken,
  type Pathway,
  type ServiceScope,
} from './model';

/**
 * Intake state machine for the approved V2 flow (design@2026-07-30).
 *
 * SUBMISSION GOES THROUGH THE SHARED CLIENT. This module contains no fetch, no XHR, no
 * form action, and no endpoint: it calls `@axispoint/submission-client`, which is the one
 * transport boundary in the repository and which decides between simulating and calling a
 * real endpoint based on the build. See `submissionClient.ts`.
 *
 * In `pnpm dev` nothing leaves the browser. In a production build with no endpoint the
 * client returns a truthful `not_configured` failure and the UI says so, because a
 * confirmation screen for something that was never sent is the worst outcome available
 * here.
 *
 * BOOKING IS A REAL COMMAND, SENT SEPARATELY (Pass 10C). It is never a block inside a
 * submission, which the backend rejects outright; it is its own request carrying the
 * `leadId` the submission returned. Whether it is offered comes from the backend's
 * `bookingEligible`, and no pathway policy is re-derived here.
 */

/**
 * `failed` is a retryable booking failure. `refused` is a final answer the visitor cannot
 * retry their way out of, which includes a slot that is genuinely taken: the fix is another
 * time, not another attempt. `unavailable` is the honest no-calendar-configured state.
 */
export type BookingState = 'idle' | 'sending' | 'failed' | 'refused' | 'unavailable';

export type Screen =
  | 'gateway'
  | 'proposal'
  | 'short'
  | 'confirmation'
  | 'schedule'
  | 'scheduled'
  | 'skipped';

/**
 * `failed` covers a retryable failure. `blocked` is a failure the visitor cannot retry
 * their way out of: a rejected payload, or a `SUBMISSION_ID_CONFLICT` that has exhausted
 * the attempt. `unavailable` is the honest production-without-an-endpoint state.
 */
export type SubmitState = 'idle' | 'sending' | 'failed' | 'blocked' | 'unavailable';

export interface IntakeInit {
  intent: IntentToken | null;
  referralCode: string;
  /** Dev-only starting state, ignored unless import.meta.env.DEV. */
  devState?: string | null;
}

function pathwayForIntent(intent: IntentToken | null): { pathway: Pathway; scope: ServiceScope } {
  switch (intent) {
    case 'property-management':
      return { pathway: 'management-proposal', scope: 'pm' };
    case 'asset-management':
      // Not a separate pathway. The Management Proposal flow with PM plus AM scope.
      return { pathway: 'management-proposal', scope: 'pm-plus-am' };
    case 'investor-services':
      return { pathway: 'investor-services', scope: 'investor-services' };
    case 'general':
      return { pathway: 'general-inquiry', scope: 'general-inquiry' };
    default:
      return { pathway: 'management-proposal', scope: 'undecided' };
  }
}

export function useIntake({ intent, referralCode, devState }: IntakeInit) {
  const isDev = import.meta.env.DEV;
  const dev = isDev ? devState ?? null : null;

  const initial = useMemo(() => {
    const { pathway, scope } = pathwayForIntent(intent);
    const draft = emptyDraft(pathway, scope);
    draft.referralCode = referralCode;
    // An explicit asset-management intent preselects the PM plus AM involvement
    // answer, so the visitor sees their choice already reflected in step 2.
    if (scope === 'pm-plus-am') draft.situation.involvement = involvementFromScope('pm-plus-am');
    return draft;
  }, [intent, referralCode]);

  const [draft, setDraft] = useState<IntakeDraft>(initial);
  const [screen, setScreen] = useState<Screen>(() => {
    if (dev === 'success') return 'confirmation';
    if (dev === 'booking') return 'schedule';
    if (dev === 'scheduled') return 'scheduled';
    if (dev === 'skipped') return 'skipped';
    if (intent === null) return 'gateway';
    const { pathway } = pathwayForIntent(intent);
    return pathway === 'management-proposal' ? 'proposal' : 'short';
  });
  const [step, setStep] = useState<1 | 2 | 3>(dev === 'invalid' || dev === 'failed' || dev === 'loading' ? 3 : 1);
  const [showErrors, setShowErrors] = useState(dev === 'invalid');
  const [submitState, setSubmitState] = useState<SubmitState>(
    dev === 'loading' ? 'sending' : dev === 'failed' ? 'failed' : 'idle',
  );

  const alertRef = useRef<HTMLDivElement>(null);

  /**
   * Focus is moved to the summary alert AFTER the render that creates it.
   *
   * This was previously a `requestAnimationFrame` fired from the same callback that set the
   * state. That races React's commit: the frame can run while the alert is still unmounted,
   * `alertRef.current` is null, and the focus move is silently skipped. It was reproducible
   * in a production build on the fail-closed path, where the alert appeared ~50ms after the
   * click and never received focus. An effect keyed on a counter runs after commit, so the
   * ref is always populated by the time it reads it.
   *
   * The counter (rather than a boolean) is what makes a second failure re-announce: two
   * consecutive failures produce the same submit state, and only a changing value re-runs
   * the effect.
   */
  const [announce, setAnnounce] = useState(0);
  const requestAnnounce = useCallback(() => setAnnounce((n) => n + 1), []);

  useEffect(() => {
    if (announce === 0) return;
    alertRef.current?.focus();
  }, [announce]);
  /**
   * When this intake was opened, used only for the advisory `fillSeconds` signal.
   *
   * The backend treats client signals as evidence that can ADD to a spam determination and
   * never as evidence that clears one, because a bot controls what it sends.
   */
  const startedAt = useRef<number>(Date.now());

  const errors: FieldErrors = showErrors ? validateDraft(draft) : {};

  /* ── Draft updates ─────────────────────────────────────────────────────── */

  const patch = useCallback((fn: (d: IntakeDraft) => IntakeDraft) => {
    setDraft((d) => fn(structuredClone(d)));
  }, []);

  const setProperty = useCallback(
    <K extends keyof IntakeDraft['property']>(k: K, v: IntakeDraft['property'][K]) =>
      patch((d) => {
        d.property[k] = v;
        return d;
      }),
    [patch],
  );

  const setSituation = useCallback(
    <K extends keyof IntakeDraft['situation']>(k: K, v: IntakeDraft['situation'][K]) =>
      patch((d) => {
        d.situation[k] = v;
        // Involvement is what determines PM versus PM plus AM scope.
        if (k === 'involvement') d.scope = scopeFromInvolvement(v as string);
        return d;
      }),
    [patch],
  );

  const setContact = useCallback(
    <K extends keyof IntakeDraft['contact']>(k: K, v: IntakeDraft['contact'][K]) =>
      patch((d) => {
        d.contact[k] = v;
        return d;
      }),
    [patch],
  );

  const setBooking = useCallback(
    <K extends keyof IntakeDraft['booking']>(k: K, v: IntakeDraft['booking'][K]) =>
      patch((d) => {
        d.booking[k] = v;
        return d;
      }),
    [patch],
  );

  const setTopic = useCallback((v: string) => patch((d) => ({ ...d, topic: v })), [patch]);

  /* ── Navigation. Answers are always preserved across back and forward. ──── */

  const next = useCallback(() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s)), []);
  const back = useCallback(() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s)), []);

  const choosePathway = useCallback(
    (pathway: Pathway, scope: ServiceScope) => {
      setDraft((d) => {
        const nextDraft = structuredClone(d);
        nextDraft.pathway = pathway;
        nextDraft.scope = scope;
        if (scope === 'pm-plus-am') nextDraft.situation.involvement = involvementFromScope('pm-plus-am');
        return nextDraft;
      });
      setStep(1);
      setShowErrors(false);
      setSubmitState('idle');
      setScreen(pathway === 'management-proposal' ? 'proposal' : 'short');
    },
    [],
  );

  const backToGateway = useCallback(() => {
    setShowErrors(false);
    setSubmitState('idle');
    setScreen('gateway');
  }, []);

  /* ── Submission, through the shared client ─────────────────────────────── */

  /**
   * What the backend said about the accepted submission.
   *
   * `bookingEligible` comes FROM THE RESPONSE and is never derived here. The backend owns
   * one booking policy, and a second copy in the frontend would drift from it: the visible
   * symptom is a form offering a call the booking command then refuses.
   */
  const [receipt, setReceipt] = useState<{
    leadId: string | null;
    slaDueAt: string | null;
    bookingEligible: boolean;
  } | null>(null);

  const [failure, setFailure] = useState<{ code: string; field: string | null } | null>(null);

  /** Turns a client result into screen state. Success requires `ok`, never a mere reply. */
  const applyResult = useCallback((result: ClientResult | null) => {
    // `null` means the client refused the call: already in flight, or a dead attempt.
    // Leaving the state alone is correct; the visitor is already looking at it.
    if (!result) return;

    if (isSuccess(result)) {
      // The shared client carries booking responses too, which have none of these fields.
      // This handler only ever sees a submission; a booking reply would mean the transport
      // answered a different question than the one asked, so it is not silently accepted.
      if (!isSubmissionResponse(result.response)) return;

      setFailure(null);
      setReceipt({
        leadId: result.response.leadId,
        slaDueAt: result.response.slaDueAt,
        bookingEligible: result.response.bookingEligible === true,
      });
      setSubmitState('idle');
      setScreen('confirmation');
      return;
    }

    setFailure({ code: result.code, field: result.field });
    setSubmitState(
      result.outcome === 'retryable'
        ? 'failed'
        : result.outcome === 'not_configured'
          ? 'unavailable'
          : 'blocked',
    );
    // The approved behaviour: move focus to the summary alert so the state is announced.
    requestAnnounce();
  }, [requestAnnounce]);

  /**
   * Validates, then submits.
   *
   * The double-click guard lives in the client rather than in a disabled button, because a
   * disabled button is a rendering detail that a fast double-click or a keyboard repeat
   * can still race.
   */
  const submit = useCallback(async () => {
    const found = validateDraft(draft);
    if (Object.keys(found).length > 0) {
      setShowErrors(true);
      requestAnnounce();
      return;
    }
    setShowErrors(false);
    setSubmitState('sending');

    /*
     * Mapping can throw on a value with no wire token. Validation above should make that
     * unreachable, but an unhandled throw here would leave the form stuck on "sending"
     * forever with only a console error to show for it, so it is caught and reported as a
     * state the visitor can act on.
     */
    let envelopeDraft;
    try {
      envelopeDraft = toEnvelopeDraft(draft, {
        pageLocale: 'en',
        intent,
        sourceDetail: typeof window === 'undefined' ? '/contact' : window.location.pathname,
        landingPage: typeof window === 'undefined' ? undefined : window.location.href,
        clientSignals: { fillSeconds: Math.round((Date.now() - startedAt.current) / 1000) },
      });
    } catch (error) {
      setFailure({
        code: error instanceof Error ? error.name : 'MAPPING_FAILED',
        field: null,
      });
      setSubmitState('blocked');
      requestAnnounce();
      return;
    }

    applyResult(await getSubmissionClient().submit(envelopeDraft));
  }, [applyResult, draft, intent, requestAnnounce]);

  /**
   * Retries the SAME attempt: same submissionId, same envelope.
   *
   * A fresh id here would create a second Lead for one person, and both requests would
   * have succeeded, so nothing would ever surface it.
   */
  const retry = useCallback(async () => {
    setSubmitState('sending');
    applyResult(await getSubmissionClient().retry());
  }, [applyResult]);

  /* ── Booking, a real command against the backend ───────────────────────── */

  /*
   * Booking is a SEPARATE command issued after the submission, never a block inside one,
   * and it needs the `leadId` the backend returned. Whether it is offered at all comes from
   * `receipt.bookingEligible`, decided by the backend and never re-derived here.
   */
  const [bookingState, setBookingState] = useState<BookingState>('idle');
  const [bookingFailure, setBookingFailure] = useState<{ code: string; status?: string } | null>(null);

  const bookingReady = !!draft.booking.slotStart && !!draft.booking.mode;

  /**
   * Candidate days and slots, recomputed when the chosen day changes.
   *
   * `now` is captured once per render rather than per call so the day list and the slot
   * list agree with each other. A slot computed a second later than its day could fall out
   * of the lead-time window mid-render and disappear from under the visitor's cursor.
   */
  const bookingCandidates = useMemo(() => {
    const now = new Date();
    const days = candidateDays(now);
    const chosen = days.find((d) => d.key === draft.booking.dayKey);
    return { days, slots: chosen ? candidateSlots(chosen, now) : [] };
  }, [draft.booking.dayKey]);

  /*
   * Choosing a day, a slot, or a mode CLEARS the last booking failure.
   *
   * A stale "that time is no longer available" sitting above a newly chosen time reads as
   * a verdict on the new choice. Clearing it is also honest about the client's own rule:
   * changing the slot or the mode is a material edit that mints a new bookingRequestId, so
   * the previous request's outcome no longer describes what would be sent.
   */
  const chooseDay = useCallback((dayKey: string) => {
    setBookingFailure(null);
    setBookingState('idle');
    patch((d) => {
      d.booking.dayKey = dayKey;
      // The old slot belonged to the old day, so it cannot survive the change.
      d.booking.slotStart = '';
      d.booking.timeLabel = '';
      return d;
    });
  }, [patch]);

  const chooseSlot = useCallback((slotStart: string, timeLabel: string) => {
    setBookingFailure(null);
    setBookingState('idle');
    patch((d) => {
      d.booking.slotStart = slotStart;
      d.booking.timeLabel = timeLabel;
      return d;
    });
  }, [patch]);

  const chooseMode = useCallback((mode: string) => {
    setBookingFailure(null);
    setBookingState('idle');
    patch((d) => {
      d.booking.mode = mode;
      return d;
    });
  }, [patch]);

  const applyBooking = useCallback(
    (result: ClientResult | null) => {
      if (result === null) return;

      if (isSuccess(result)) {
        setBookingFailure(null);
        setBookingState('idle');
        setScreen('scheduled');
        return;
      }

      setBookingFailure({ code: result.code });
      setBookingState(
        result.outcome === 'retryable'
          ? 'failed'
          : result.outcome === 'not_configured'
            ? 'unavailable'
            : 'refused',
      );
    },
    [],
  );

  const confirmBooking = useCallback(async () => {
    if (!bookingReady || !receipt?.leadId) return;

    setBookingState('sending');
    applyBooking(
      await getBookingClient().request({
        leadId: receipt.leadId,
        slotStart: draft.booking.slotStart,
        durationMinutes: BOOKING_RULES.durationMinutes,
        mode: draft.booking.mode as BookingMode,
      }),
    );
  }, [applyBooking, bookingReady, draft.booking.mode, draft.booking.slotStart, receipt]);

  /**
   * Retries the SAME booking request: same bookingRequestId, same slot.
   *
   * Only offered for a retryable failure. A taken slot is not retryable, because the same
   * request would be refused again; the visitor has to choose another time, and choosing
   * one mints a new request in the client.
   */
  const retryBooking = useCallback(async () => {
    setBookingState('sending');
    applyBooking(await getBookingClient().retry());
  }, [applyBooking]);

  return {
    isDev,
    draft,
    screen,
    step,
    errors,
    showErrors,
    submitState,
    /** Backend receipt for the accepted submission. Null until one is accepted. */
    receipt,
    /** The last failure, for the accessible status message. */
    failure,
    alertRef,
    bookingReady,
    bookingState,
    bookingFailure,
    bookingCandidates,
    chooseDay,
    chooseSlot,
    chooseMode,
    retryBooking,
    setProperty,
    setSituation,
    setContact,
    setBooking,
    setTopic,
    next,
    back,
    choosePathway,
    backToGateway,
    submit,
    retry,
    confirmBooking,
    goSchedule: useCallback(() => setScreen('schedule'), []),
    goSkipped: useCallback(() => setScreen('skipped'), []),
  };
}
