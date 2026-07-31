import { useCallback, useMemo, useRef, useState } from 'react';
import {
  emptyDraft,
  involvementFromScope,
  scopeFromInvolvement,
  validateContact,
  type FieldErrors,
  type IntakeDraft,
  type IntentToken,
  type Pathway,
  type ServiceScope,
} from './model';

/**
 * Intake state machine for the approved V2 flow (design@2026-07-30).
 *
 * SUBMISSION IS SIMULATED AND LOCAL. This module contains no fetch, no XHR, no
 * form action, and no endpoint of any kind. Nothing leaves the browser, including
 * the booking step. The V2 submission contract arrives with the backend pass.
 */

export type Screen =
  | 'gateway'
  | 'proposal'
  | 'short'
  | 'confirmation'
  | 'schedule'
  | 'scheduled'
  | 'skipped';

export type SubmitState = 'idle' | 'sending' | 'failed';

/** How long the simulated send takes, matching the approved 700ms demo timing. */
const SIMULATED_SEND_MS = 700;

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
  const timer = useRef<number | null>(null);

  const errors: FieldErrors = showErrors ? validateContact(draft.contact) : {};

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

  /* ── Simulated submission ──────────────────────────────────────────────── */

  /**
   * Validates, then simulates a send with a timer. There is deliberately no
   * network call here. In development a `?state=failed` start, or a draft whose
   * email local part is `fail`, produces the recoverable failure state so it can be
   * inspected without a backend.
   */
  const submit = useCallback(() => {
    const found = validateContact(draft.contact);
    if (Object.keys(found).length > 0) {
      setShowErrors(true);
      // Move focus to the summary alert, per the approved behaviour.
      window.requestAnimationFrame(() => alertRef.current?.focus());
      return;
    }
    setShowErrors(false);
    setSubmitState('sending');

    const shouldFail = isDev && /^fail@/i.test(draft.contact.email.trim());

    timer.current = window.setTimeout(() => {
      if (shouldFail) {
        setSubmitState('failed');
        window.requestAnimationFrame(() => alertRef.current?.focus());
        return;
      }
      setSubmitState('idle');
      setScreen('confirmation');
    }, SIMULATED_SEND_MS);
  }, [draft.contact, isDev]);

  const retry = useCallback(() => {
    setSubmitState('sending');
    timer.current = window.setTimeout(() => {
      setSubmitState('idle');
      setScreen('confirmation');
    }, SIMULATED_SEND_MS);
  }, []);

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
