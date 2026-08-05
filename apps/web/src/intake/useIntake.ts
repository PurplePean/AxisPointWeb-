import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSuccess, type ClientResult } from '@axispoint/submission-client';
import { getSubmissionClient } from './submissionClient';
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
 * BOOKING REMAINS LOCAL AND UNSENT. The booking command is a separate request that this
 * pass does not make, and the backend rejects a booking block inside a submission outright.
 */

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

  /* ── Booking, all local ────────────────────────────────────────────────── */

  const bookingReady = draft.booking.day !== null && !!draft.booking.time && !!draft.booking.mode;
  const confirmBooking = useCallback(() => {
    if (bookingReady) setScreen('scheduled');
  }, [bookingReady]);

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
