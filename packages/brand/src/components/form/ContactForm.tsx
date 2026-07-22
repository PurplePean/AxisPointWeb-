/**
 * Shared multi-step contact form.
 * All state and logic extracted verbatim from
 * apps/web/src/pages/ContactPage.tsx so both apps share one codebase.
 */
import { useState, useEffect } from 'react';
import type { Role, Step, MeetType, BookChoice, ContactFields, ReferredFields, FormController, PropertyDetails, EAOContact } from './types';
import {
  STEP_LABELS_INVESTOR, STEP_LABELS_OTHER, STEP_LABELS_EAO,
  MONTHS, buildCalendar, buildPayload, buildEAOPayload,
  stepOrderForRole, firstStepAfterRole, isValidRole,
} from './utils';
import { FormProgress } from './FormProgress';
import { FormSuccess } from './FormSuccess';
import { Step1Role } from './steps/Step1Role';
import { Step2Context } from './steps/Step2Context';
import { Step3AssetClass } from './steps/Step3AssetClass';
import { Step4Contact } from './steps/Step4Contact';
import { Step5Booking } from './steps/Step5Booking';
import { Step6Loop } from './steps/Step6Loop';
import { PropertyDetailsStep } from './steps/PropertyDetailsStep';
import { EAOPersonalStep } from './steps/EAOPersonalStep';
import { EAOSituationStep } from './steps/EAOSituationStep';
import { EAOIssueStep } from './steps/EAOIssueStep';
import { EAOScheduleStep } from './steps/EAOScheduleStep';

const FORM_ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT as string | undefined;

export interface ContactFormProps {
  /** App-level source identifier added to the payload (e.g. 'qr'). */
  source?: string;
  /** Page identifier the backend uses to route the submission. */
  page?: string;
  /** Optional className applied to the form card wrapper. */
  className?: string;
  /**
   * Optional wire role to preselect on mount, skipping the role-picker and opening
   * on the first relevant question. Presentation-only: it changes which step the
   * form starts on, never the payload, booking, referral, or routing behavior.
   * Invalid or omitted → the normal all-five-roles flow (QR passes nothing, so its
   * behavior is unchanged). Public-facing intent → role mapping lives in the app
   * that owns the URL; this component only receives an already-resolved role.
   */
  initialRole?: Role | null;
}

/** Public-facing label for a preselected path. Deliberately NOT the wire role value
 *  (req: internal role values must not surface in public copy). Only the two
 *  intent-routable paths need a label; anything else falls back to a neutral one. */
const PATH_LABEL: Partial<Record<Role, string>> = {
  existing_asset_owner: 'Property Management',
  investor: 'Investor Services',
};

export function ContactForm({ source, page, className, initialRole }: ContactFormProps) {
  /* A valid initialRole preselects the role and opens on its first real question;
     lazy initializers avoid a role-step flash before an effect could correct it. */
  const presetRole = isValidRole(initialRole) ? initialRole : null;
  const [role, setRole]       = useState<Role | null>(presetRole);
  const [step, setStep]       = useState<Step>(presetRole ? firstStepAfterRole(presetRole) : 'role');
  /* True only while the visitor is on a path they arrived at via preselection and
     has not yet expanded/changed it — drives the compact "selected path" banner. */
  const [intentLocked, setIntentLocked] = useState<boolean>(presetRole !== null);
  const [bookChoice, setBookChoice] = useState<BookChoice>(null);
  const [meetType, setMeetType]     = useState<MeetType>(null);
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDay, setSelDay]     = useState<number | null>(null);
  const [selSlot, setSelSlot]   = useState<string | null>(null);
  const [slotAvail, setSlotAvail]     = useState<Record<string, boolean> | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  /* multi-select state */
  const [expSel,       setExpSel]       = useState<Set<string>>(new Set());
  const [aumSel,       setAumSel]       = useState<string | null>(null);
  const [profSel,      setProfSel]      = useState<string | null>(null);
  const [clientsSel,   setClientsSel]   = useState<Set<string>>(new Set());
  const [refIntentSel, setRefIntentSel] = useState<string | null>(null);
  const [proRoleSel,   setProRoleSel]   = useState<string | null>(null);
  const [marketSel,    setMarketSel]    = useState<Set<string>>(new Set());
  const [proIntentSel, setProIntentSel] = useState<string | null>(null);
  const [relSel,       setRelSel]       = useState<string | null>(null);
  const [fitSel,       setFitSel]       = useState<Set<string>>(new Set());
  const [awareSel,     setAwareSel]     = useState<string | null>(null);
  const [assetSel,     setAssetSel]     = useState<Set<string>>(new Set());
  const [timelineSel,  setTimelineSel]  = useState<string | null>(null);
  const [sourceSel,    setSourceSel]    = useState<string | null>(null);
  const [prefsSel,     setPrefsSel]     = useState<Set<string>>(new Set());

  /* Existing Asset Owner flow answers */
  const [eaoContact,   setEaoContact]   = useState<EAOContact>({ name: '', email: '', phone: '' });
  const [eaoProperty,  setEaoProperty]  = useState<PropertyDetails | null>(null);
  const [eaoSituation, setEaoSituation] = useState<string | null>(null);
  const [eaoIssue,     setEaoIssue]     = useState('');

  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState(false);

  /* captured when user leaves the contact step */
  const [contactFields, setContactFields] = useState<ContactFields>({ firstName: '', lastName: '', email: '', phone: '', company: '' });
  const [msgField, setMsgField]           = useState('');
  const [referredFields, setReferredFields] = useState<ReferredFields>({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
  const [bookingPhone, setBookingPhone]   = useState('');

  /* referral capture */
  const [urlRef,        setUrlRef]        = useState<string | null>(null);
  const [isReferred,    setIsReferred]    = useState(false);
  const [referralInput, setReferralInput] = useState('');

  /* API response */
  const [responseReferralCode, setResponseReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* Read ?ref= URL param on mount */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setUrlRef(ref.trim().toUpperCase());
  }, []);

  const stepOrder: Step[] = [...stepOrderForRole(role)];
  const stepLabels: string[] =
    role === 'investor' ? STEP_LABELS_INVESTOR :
    role === 'existing_asset_owner' ? STEP_LABELS_EAO :
    STEP_LABELS_OTHER;

  function goNext() {
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
    else setStep('success');
  }

  function goBack() {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  }

  /* "Change path" from the preselected-intent banner: reopen the full role picker
     (all five roles) with the current choice still highlighted, and drop the locked
     state so the banner disappears and the normal flow resumes. */
  function changePath() {
    setIntentLocked(false);
    setStep('role');
  }

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, val: string) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setFn(next);
  }

  useEffect(() => { setSelDay(null); setSelSlot(null); }, [calMonth, calYear]);
  useEffect(() => { if (selDay !== null) setSelSlot(null); }, [selDay]);

  /* When a day is selected, ask the backend which slots are already booked on the
     shared calendar before rendering them. Identical for all three lead types that
     share BookingCalendar — no role branching. On ANY failure (or when no endpoint
     is configured, e.g. local dev) slotAvail stays null and every slot renders as
     available: a failed check silently reverts to the pre-availability behavior. */
  useEffect(() => {
    if (bookChoice !== 'yes' || selDay === null || !FORM_ENDPOINT) {
      setSlotAvail(null);
      setSlotsLoading(false);
      return;
    }
    const dateStr = `${MONTHS[calMonth]} ${selDay}, ${calYear}`;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotAvail(null);
    fetch(`${FORM_ENDPOINT}?action=availability&date=${encodeURIComponent(dateStr)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setSlotAvail(data && data.success && data.slots ? data.slots : null);
      })
      .catch(() => { if (!cancelled) setSlotAvail(null); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [bookChoice, selDay, calMonth, calYear]);

  const today    = new Date();
  const calCells = buildCalendar(calYear, calMonth);
  const isPast   = (d: number) => new Date(calYear, calMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isWknd   = (_d: number, idx: number) => { const col = idx % 7; return col === 0 || col === 6; };

  function s2Next() {
    if (role === 'investor') setStep('prefs');
    else setStep('contact');
  }

  function captureContactAndAdvance() {
    setContactFields({
      firstName: (document.getElementById('c-fn') as HTMLInputElement | null)?.value.trim() ?? '',
      lastName:  (document.getElementById('c-ln') as HTMLInputElement | null)?.value.trim() ?? '',
      email:     (document.getElementById('c-em') as HTMLInputElement | null)?.value.trim() ?? '',
      phone:     (document.getElementById('c-ph') as HTMLInputElement | null)?.value.trim() ?? '',
      company:   (document.getElementById('c-co') as HTMLInputElement | null)?.value.trim() ?? '',
    });
    setMsgField((document.getElementById('c-msg') as HTMLTextAreaElement | null)?.value.trim() ?? '');

    if (role === 'submit_referral') {
      setReferredFields({
        firstName: (document.getElementById('r-fn') as HTMLInputElement | null)?.value.trim() ?? '',
        lastName:  (document.getElementById('r-ln') as HTMLInputElement | null)?.value.trim() ?? '',
        email:     (document.getElementById('r-em') as HTMLInputElement | null)?.value.trim() ?? '',
        phone:     (document.getElementById('r-ph') as HTMLInputElement | null)?.value.trim() ?? '',
        notes:     (document.getElementById('r-notes') as HTMLTextAreaElement | null)?.value.trim() ?? '',
      });
    } else {
      setReferralInput(
        (document.getElementById('r-ref') as HTMLInputElement | null)?.value.trim() ?? ''
      );
    }
    goNext();
  }

  function captureBookingAndAdvance() {
    if (meetType === 'phone') {
      setBookingPhone((document.getElementById('cal-phone') as HTMLInputElement | null)?.value.trim() ?? '');
    }
    goNext();
  }

  /**
   * Existing Asset Owner submit. Assembles the EAO payload and POSTs it to the
   * same VITE_FORM_ENDPOINT the Investor / RE Professional flow uses. The backend
   * normalizes the flat EAO shape into the generic lead payload, so booking,
   * confirmation email and CRM routing all run through the shared code path.
   */
  async function submitEAO() {
    if (!eaoProperty) return;
    setSubmitting(true);
    setSubmitError(false);

    const contact: EAOContact = {
      name: eaoContact.name.trim(),
      email: eaoContact.email.trim(),
      phone: eaoContact.phone.trim(),
    };

    /* Same structured booking object the Investor / RE Professional payload uses
       (see buildPayload) — pulled straight from calendar state, not formatted into
       a sentence. The schedule step is the final step here, so the meet-type phone
       number is read from the shared BookingCalendar's input at submit time (the
       Investor flow captures it earlier via captureBookingAndAdvance). The real
       Google Meet URL is set server-side once the backend books the event. */
    const bookingPhoneVal = meetType === 'phone'
      ? ((document.getElementById('cal-phone') as HTMLInputElement | null)?.value.trim() ?? '')
      : '';
    const booking = bookChoice === 'yes' && selDay !== null && selSlot ? {
      date: `${MONTHS[calMonth]} ${selDay}, ${calYear}`,
      slot: selSlot,
      meetType,
      phone: bookingPhoneVal,
    } : null;

    const payload = buildEAOPayload({
      property: eaoProperty,
      situation: eaoSituation,
      issue: eaoIssue,
      contact,
      booking,
    });

    try {
      if (FORM_ENDPOINT) {
        const res  = await fetch(FORM_ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
          setResponseReferralCode(data.referralCode || null);
          setStep('success');
        } else {
          setSubmitError(true);
        }
      } else {
        /* dev mode — no endpoint configured */
        setStep('success');
      }
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitForm() {
    setSubmitting(true);
    setSubmitError(false);

    const payload = buildPayload(
      {
        role, expSel, aumSel, profSel, clientsSel, refIntentSel, proRoleSel, marketSel,
        proIntentSel, relSel, fitSel, assetSel, timelineSel,
        awareSel, sourceSel, contactFields, prefsSel, msgField, referredFields,
        bookChoice, selDay, selSlot, calMonth, calYear, meetType, bookingPhone,
        urlRef, isReferred, referralInput,
      },
      { source, page },
    );

    try {
      if (FORM_ENDPOINT) {
        const res  = await fetch(FORM_ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
          setResponseReferralCode(data.referralCode || null);
          setStep('success');
        } else {
          setSubmitError(true);
        }
      } else {
        /* dev mode — no endpoint configured */
        setStep('success');
      }
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!responseReferralCode) return;
    const link = `https://axispoint.llc/contact?ref=${responseReferralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }

  const canPrevMonth = !(calYear === today.getFullYear() && calMonth === today.getMonth());
  function changeMonth(dir: -1 | 1) {
    let m = calMonth + dir, y = calYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setCalMonth(m); setCalYear(y);
  }

  const isSuccess  = step === 'success';
  const showProgress = !isSuccess;
  const shareLink  = responseReferralCode ? `https://axispoint.llc/contact?ref=${responseReferralCode}` : null;

  const c: FormController = {
    step, setStep, role, setRole, bookChoice, setBookChoice, meetType, setMeetType,
    calMonth, calYear, selDay, setSelDay, selSlot, setSelSlot, slotAvail, slotsLoading,
    expSel, setExpSel, aumSel, setAumSel, profSel, setProfSel, clientsSel, setClientsSel,
    refIntentSel, setRefIntentSel, proRoleSel, setProRoleSel, marketSel, setMarketSel,
    proIntentSel, setProIntentSel,
    relSel, setRelSel, fitSel, setFitSel, awareSel, setAwareSel, assetSel, setAssetSel,
    timelineSel, setTimelineSel, sourceSel, setSourceSel, prefsSel, setPrefsSel,
    eaoContact, setEaoContact, eaoProperty, setEaoProperty, eaoSituation, setEaoSituation, eaoIssue, setEaoIssue, submitEAO,
    submitting, submitError, isReferred, setIsReferred, urlRef, responseReferralCode, copied, shareLink,
    toggleSet, goNext, goBack, s2Next, captureContactAndAdvance, captureBookingAndAdvance,
    submitForm, copyLink, changeMonth,
    stepOrder, calCells, isPast, isWknd, canPrevMonth,
  };

  const showPathBanner = intentLocked && role !== null && step !== 'role' && !isSuccess;

  return (
    <div className={className ?? 'rv bg-white border border-border rounded-[22px] p-9 max-md:p-6 shadow-card'}>
      {showPathBanner && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-[12px] border border-teal/30 bg-teal-light px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-6 h-6 rounded-full bg-teal/15 flex items-center justify-center flex-none">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A8799" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <span className="text-[0.8rem] text-ink leading-snug truncate">
              <span className="text-sub">Your path: </span>
              <span className="font-semibold">{(role && PATH_LABEL[role]) ?? 'Selected'}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={changePath}
            className="flex-none text-[0.75rem] font-semibold text-teal-dark underline underline-offset-2 hover:text-ink transition-colors"
          >
            Change path
          </button>
        </div>
      )}
      {showProgress && <FormProgress stepOrder={stepOrder} currentStep={step} labels={stepLabels} />}
      {step === 'role'    && <Step1Role c={c} />}
      {step === 'context' && <Step2Context c={c} />}
      {step === 'prefs'   && <Step3AssetClass c={c} />}
      {step === 'contact' && <Step4Contact c={c} />}
      {step === 'booking' && <Step5Booking c={c} />}
      {step === 'comms'   && <Step6Loop c={c} />}
      {/* Existing Asset Owner flow */}
      {step === 'personal'  && <EAOPersonalStep c={c} />}
      {step === 'property'  && (
        <PropertyDetailsStep
          initial={eaoProperty}
          onBack={goBack}
          onContinue={(details) => { setEaoProperty(details); goNext(); }}
        />
      )}
      {step === 'situation' && <EAOSituationStep c={c} />}
      {step === 'issue'     && <EAOIssueStep c={c} />}
      {step === 'schedule'  && <EAOScheduleStep c={c} />}
      {step === 'success' && <FormSuccess c={c} />}
    </div>
  );
}
