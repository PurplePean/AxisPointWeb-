/**
 * Shared multi-step contact form.
 * All state and logic extracted verbatim from
 * apps/web/src/pages/ContactPage.tsx so both apps share one codebase.
 */
import { useState, useEffect } from 'react';
import type { Role, Step, MeetType, BookChoice, ContactFields, ReferredFields, FormController, PropertyDetails, EAOContact } from './types';
import {
  STEP_ORDER_INVESTOR, STEP_ORDER_OTHER, STEP_ORDER_EAO,
  STEP_LABELS_INVESTOR, STEP_LABELS_OTHER, STEP_LABELS_EAO,
  MONTHS, buildCalendar, buildPayload, buildEAOPayload,
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
}

export function ContactForm({ source, page, className }: ContactFormProps) {
  const [step, setStep]       = useState<Step>('role');
  const [role, setRole]       = useState<Role | null>(null);
  const [bookChoice, setBookChoice] = useState<BookChoice>(null);
  const [meetType, setMeetType]     = useState<MeetType>(null);
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDay, setSelDay]     = useState<number | null>(null);
  const [selSlot, setSelSlot]   = useState<string | null>(null);

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

  const stepOrder: Step[] =
    role === 'investor' ? [...STEP_ORDER_INVESTOR] :
    role === 'existing_asset_owner' ? [...STEP_ORDER_EAO] :
    [...STEP_ORDER_OTHER];
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

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, val: string) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    setFn(next);
  }

  useEffect(() => { setSelDay(null); setSelSlot(null); }, [calMonth, calYear]);
  useEffect(() => { if (selDay !== null) setSelSlot(null); }, [selDay]);

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
    calMonth, calYear, selDay, setSelDay, selSlot, setSelSlot,
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

  return (
    <div className={className ?? 'rv bg-white border border-border rounded-[22px] p-9 max-md:p-6 shadow-card'}>
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
