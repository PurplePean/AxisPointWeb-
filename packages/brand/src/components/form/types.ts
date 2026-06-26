/**
 * Shared contact form types.
 * Extracted from apps/web/src/pages/ContactPage.tsx (logic unchanged).
 */
import type { Dispatch, SetStateAction } from 'react';

export type Role = 'investor' | 'referral' | 'pro' | 'curious' | 'refer';
export type Step = 'role' | 'context' | 'prefs' | 'contact' | 'comms' | 'booking' | 'success';
export type MeetType = 'meet' | 'phone' | null;
export type BookChoice = 'yes' | 'no' | null;

export interface ContactFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
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
  curiousSel: Set<string>;
  setCuriousSel: SetSet;
  journeySel: string | null;
  setJourneySel: SetStr;
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
