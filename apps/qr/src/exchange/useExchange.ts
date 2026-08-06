import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSubmissionResponse, isSuccess, type ClientResult } from '@axispoint/submission-client';

import { getSubmissionClient } from './submissionClient';
import { toEnvelopeDraft } from './toWire';
import {
  emptyDraft,
  validateDraft,
  FIELD_ORDER,
  FIELD_LABEL,
  type ExchangeDraft,
  type ExchangeErrors,
  type ExchangeField,
} from './model';

/**
 * Contact Exchange state machine, built from `AxisPoint QR Contact Exchange.dc.html`
 * §x3 (form states), §x5 (failure and recovery), §x7 (when validation runs), and §x8
 * (focus behaviour).
 *
 * SUBMISSION GOES THROUGH THE SHARED CLIENT. There is no fetch, no XHR, and no endpoint in
 * this module or anywhere else in this app.
 */

export type ExchangeScreen = 'form' | 'success';
export type SendState = 'idle' | 'sending' | 'failed' | 'blocked' | 'unavailable';

export interface ExchangeReceipt {
  contactId: string | null;
}

export function useExchange(context: { profileKey: string | null }) {
  const [draft, setDraft] = useState<ExchangeDraft>(emptyDraft);
  const [screen, setScreen] = useState<ExchangeScreen>('form');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [receipt, setReceipt] = useState<ExchangeReceipt | null>(null);

  /**
   * Which fields may currently show an error.
   *
   * §x7: nothing is validated on first entry. A field is checked only after it has been
   * left once, or after the first submit attempt, and after a failed submit each field
   * revalidates as it is corrected so errors clear while the visitor types.
   */
  const [touched, setTouched] = useState<Partial<Record<ExchangeField, true>>>({});
  const [submitted, setSubmitted] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const fieldRefs = useRef<Partial<Record<ExchangeField, HTMLElement | null>>>({});
  const startedAt = useRef<number>(Date.now());

  /*
   * Focus is moved AFTER the render that creates the target, never from a
   * requestAnimationFrame scheduled alongside the state change. That races React's commit:
   * the frame can run while the element is still unmounted and the move is silently
   * skipped. This was a real defect in apps/web (Pass 10A), fixed the same way. The counter
   * rather than a boolean is what makes two consecutive failures re-announce.
   */
  const [announce, setAnnounce] = useState(0);
  const announceTarget = useRef<'summary' | 'success' | 'heading' | null>(null);
  const requestAnnounce = useCallback((target: 'summary' | 'success' | 'heading') => {
    announceTarget.current = target;
    setAnnounce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (announce === 0) return;
    const target = announceTarget.current;
    if (target === 'summary') summaryRef.current?.focus();
    else if (target === 'success') successRef.current?.focus();
    else if (target === 'heading') headingRef.current?.focus();
  }, [announce]);

  // §x8: opening the exchange moves focus to its heading.
  useEffect(() => {
    requestAnnounce('heading');
  }, [requestAnnounce]);

  const allErrors = validateDraft(draft);

  /** Only the errors the visitor is allowed to see yet. */
  const errors: ExchangeErrors = useMemo(() => {
    const visible: ExchangeErrors = {};
    for (const field of FIELD_ORDER) {
      if ((submitted || touched[field]) && allErrors[field]) visible[field] = allErrors[field];
    }
    return visible;
    // `allErrors` is recomputed every render from `draft`, so `draft` is the real dependency.
  }, [draft, submitted, touched]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(
    () =>
      FIELD_ORDER.filter((f) => errors[f]).map((f) => ({
        field: f,
        label: FIELD_LABEL[f],
        message: errors[f] as string,
      })),
    [errors],
  );

  const set = useCallback(<K extends keyof ExchangeDraft>(key: K, value: ExchangeDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const blur = useCallback((field: ExchangeField) => {
    setTouched((t) => ({ ...t, [field]: true }));
  }, []);

  const registerField = useCallback((field: ExchangeField, el: HTMLElement | null) => {
    fieldRefs.current[field] = el;
  }, []);

  /** Summary lines are jumps to their field (§x7). */
  const focusField = useCallback((field: ExchangeField) => {
    fieldRefs.current[field]?.focus();
  }, []);

  /** Maps a client result onto a screen state. `null` means the client refused the call. */
  const applyResult = useCallback(
    (result: ClientResult | null) => {
      if (result === null) return;

      if (isSuccess(result)) {
        // The shared client now carries booking responses too, which have no `contactId`.
        // This surface only ever sends a contact exchange, so a booking reply here would
        // mean the transport answered a different question than the one asked.
        setReceipt({
          contactId: isSubmissionResponse(result.response) ? result.response.contactId : null,
        });
        setSendState('idle');
        setScreen('success');
        requestAnnounce('success');
        return;
      }

      setSendState(
        result.outcome === 'retryable'
          ? 'failed'
          : result.outcome === 'not_configured'
            ? 'unavailable'
            : 'blocked',
      );
      requestAnnounce('summary');
    },
    [requestAnnounce],
  );

  const submit = useCallback(async () => {
    const found = validateDraft(draft);
    setSubmitted(true);

    if (Object.keys(found).length > 0) {
      const first = FIELD_ORDER.find((f) => found[f]);
      const only = FIELD_ORDER.filter((f) => found[f]).length === 1;
      // §x7: with a single problem, focus goes straight to the field; the summary still
      // renders so a screen reader announces it.
      if (only && first) {
        window.requestAnimationFrame(() => fieldRefs.current[first]?.focus());
      } else {
        requestAnnounce('summary');
      }
      return;
    }

    setSendState('sending');

    let envelopeDraft;
    try {
      envelopeDraft = toEnvelopeDraft(draft, {
        profileKey: context.profileKey,
        landingPage: typeof window === 'undefined' ? undefined : window.location.href,
        clientSignals: { fillSeconds: Math.round((Date.now() - startedAt.current) / 1000) },
      });
    } catch {
      // Unreachable through the UI. An unhandled throw would leave the button stuck on
      // "Sending" forever with only a console error to show for it.
      setSendState('blocked');
      requestAnnounce('summary');
      return;
    }

    applyResult(await getSubmissionClient().submit(envelopeDraft));
  }, [applyResult, context.profileKey, draft, requestAnnounce]);

  /** §x5 and contract §12: the same attempt, same id, same envelope. Never a fresh one. */
  const retry = useCallback(async () => {
    setSendState('sending');
    applyResult(await getSubmissionClient().retry());
  }, [applyResult]);

  return {
    draft,
    set,
    blur,
    errors,
    summary,
    screen,
    sendState,
    receipt,
    submitted,
    submit,
    retry,
    registerField,
    focusField,
    summaryRef,
    headingRef,
    successRef,
  };
}
