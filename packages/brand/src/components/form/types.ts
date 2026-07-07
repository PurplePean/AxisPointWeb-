/**
 * Shared contact form types.
 * Extracted from apps/web/src/pages/ContactPage.tsx (logic unchanged).
 */
import type { Dispatch, SetStateAction } from 'react';

export type Role = 'investor' | 'referral' | 'pro' | 'existing_asset_owner' | 'submit_referral';
export type Step =
  | 'role' | 'context' | 'prefs' | 'contact' | 'comms' | 'booking' | 'success'
  /* Existing Asset Owner flow */
  | 'personal' | 'property' | 'situation' | 'issue' | 'schedule';
export type MeetType = 'meet' | 'phone' | null;
export type BookChoice = 'yes' | 'no' | null;

/**
 * Structured booking object shared by every flow's payload (Investor / RE
 * Professional via buildPayload, Existing Asset Owner via buildEAOPayload).
 * `phone` is the requested call-back number when meetType is 'phone', otherwise
 * an empty string. The real Google Meet URL is created server-side, never here.
 */
export interface Booking {
  date: string;
  slot: string;
  meetType: MeetType;
  phone: string;
}

export interface ContactFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
}

/** A market/location chip. `placeId` is undefined until Google Places is wired. */
export interface Market {
  label: string;
  placeId?: string;
}

/**
 * Assembled property answer emitted by PropertyDetailsStep on Continue.
 * Discriminated by `portfolio_type` / `portfolio_composition` — the shape
 * mirrors the backend submission schema exactly.
 *
 * `units` is a plain count (a number). `sqft` is a tier token (a string).
 * In the mixed breakdown, the commercial row collapses Retail/Office/Industrial
 * into one entry whose `property_type` is the array of the specific types the
 * owner checked; the Multifamily row (measured in units) stays separate.
 */
export type PropertyDetails =
  | {
      portfolio_type: 'single';
      property_type: string;
      units?: number;
      sqft?: string;
    }
  | {
      portfolio_type: 'portfolio';
      portfolio_composition: 'single_asset_class';
      property_type: string;
      units?: number;
      sqft?: string;
    }
  | {
      portfolio_type: 'portfolio';
      portfolio_composition: 'mixed_asset_classes';
      asset_breakdown: Array<{
        property_type: string | string[];
        asset_count: number;
        units?: number;
        sqft?: string;
      }>;
    };

/** Contact captured on the EAO "Contact & schedule" step. */
export interface EAOContact {
  name: string;
  email: string;
  phone: string;
}

export interface ReferredFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
}

type SetStr = Dispatch<SetStateAction<string | null>>;
type SetSet = Dispatch<SetStateAction<Set<string>>>;

/**
 * Controller object holding all form state, setters, handlers and derived
 * values. Built once in ContactForm and threaded into each step so the
 * extracted step components behave identically to the original page.
 */
export interface FormController {
  step: Step;
  setStep: Dispatch<SetStateAction<Step>>;
  role: Role | null;
  setRole: Dispatch<SetStateAction<Role | null>>;
  bookChoice: BookChoice;
  setBookChoice: Dispatch<SetStateAction<BookChoice>>;
  meetType: MeetType;
  setMeetType: Dispatch<SetStateAction<MeetType>>;
  calMonth: number;
  calYear: number;
  selDay: number | null;
  setSelDay: Dispatch<SetStateAction<number | null>>;
  selSlot: string | null;
  setSelSlot: Dispatch<SetStateAction<string | null>>;
  /** Per-slot availability for the selected day, keyed by slot label
   *  (true = free, false = booked). null = not loaded / check failed, in which
   *  case every slot is treated as available (see BookingCalendar). */
  slotAvail: Record<string, boolean> | null;
  /** True while the availability check for the selected day is in flight. */
  slotsLoading: boolean;

  expSel: Set<string>;
  setExpSel: SetSet;
  aumSel: string | null;
  setAumSel: SetStr;
  profSel: string | null;
  setProfSel: SetStr;
  clientsSel: Set<string>;
  setClientsSel: SetSet;
  refIntentSel: string | null;
  setRefIntentSel: SetStr;
  proRoleSel: string | null;
  setProRoleSel: SetStr;
  marketSel: Set<string>;
  setMarketSel: SetSet;
  proIntentSel: string | null;
  setProIntentSel: SetStr;
  relSel: string | null;
  setRelSel: SetStr;
  fitSel: Set<string>;
  setFitSel: SetSet;
  awareSel: string | null;
  setAwareSel: SetStr;
  assetSel: Set<string>;
  setAssetSel: SetSet;
  timelineSel: string | null;
  setTimelineSel: SetStr;
  sourceSel: string | null;
  setSourceSel: SetStr;
  prefsSel: Set<string>;
  setPrefsSel: SetSet;

  /* ── Existing Asset Owner flow ── */
  eaoContact: EAOContact;
  setEaoContact: Dispatch<SetStateAction<EAOContact>>;
  eaoProperty: PropertyDetails | null;
  setEaoProperty: Dispatch<SetStateAction<PropertyDetails | null>>;
  eaoSituation: string | null;
  setEaoSituation: SetStr;
  eaoIssue: string;
  setEaoIssue: Dispatch<SetStateAction<string>>;
  /** Assembles and POSTs the Existing Asset Owner payload to the form endpoint. */
  submitEAO: () => void;

  submitting: boolean;
  submitError: boolean;
  isReferred: boolean;
  setIsReferred: Dispatch<SetStateAction<boolean>>;
  urlRef: string | null;
  responseReferralCode: string | null;
  copied: boolean;
  shareLink: string | null;

  toggleSet: (set: Set<string>, setFn: (s: Set<string>) => void, val: string) => void;
  goNext: () => void;
  goBack: () => void;
  s2Next: () => void;
  captureContactAndAdvance: () => void;
  captureBookingAndAdvance: () => void;
  submitForm: () => void;
  copyLink: () => void;
  changeMonth: (dir: -1 | 1) => void;

  stepOrder: Step[];
  calCells: (number | null)[];
  isPast: (d: number) => boolean;
  isWknd: (d: number, idx: number) => boolean;
  canPrevMonth: boolean;
}
