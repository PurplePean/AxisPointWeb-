import type { ContactCategory } from '@axispoint/submission-client';

import { FIRM } from '../profiles';

/**
 * Contact Exchange model, built from `AxisPoint QR Contact Exchange.dc.html`
 * (design@2026-08-01): §x7 validation rules, §x9 contact-versus-lead rules, and the §x10
 * visible copy inventory.
 *
 * THE RULE THAT SHAPES EVERYTHING HERE (§x9): a QR submission is a person met in the world,
 * recorded as a Contact. It never becomes a Lead, the category never routes anything, and
 * no property or investment question belongs on this surface. Three required answers is
 * what a handshake supports.
 */

/**
 * The seven approved categories, in approved order.
 *
 * The tokens are the backend's `CONTACT_CATEGORIES` verbatim (`scripts/gas-v2/src/core/Tokens.js`),
 * not values inferred from these labels. The labels are the approved visible strings.
 */
export const CONTACT_CATEGORIES: ReadonlyArray<{ value: ContactCategory; label: string }> = [
  { value: 'property_owner_operator', label: 'Property owner or operator' },
  { value: 'broker_real_estate_advisor', label: 'Broker or real estate advisor' },
  { value: 'investor_capital_partner', label: 'Investor or capital partner' },
  { value: 'lender_financial_professional', label: 'Lender or financial professional' },
  { value: 'property_management_operations', label: 'Property management or operations professional' },
  { value: 'service_provider_vendor', label: 'Service provider or vendor' },
  { value: 'other', label: 'Other' },
];

export function categoryLabel(value: string): string {
  return CONTACT_CATEGORIES.find((c) => c.value === value)?.label ?? '';
}

export interface ExchangeDraft {
  fullName: string;
  email: string;
  phone: string;
  category: ContactCategory | '';
  company: string;
  roleOrTitle: string;
}

export const emptyDraft = (): ExchangeDraft => ({
  fullName: '',
  email: '',
  phone: '',
  category: '',
  company: '',
  roleOrTitle: '',
});

export type ExchangeField = 'fullName' | 'email' | 'phone' | 'category';
export type ExchangeErrors = Partial<Record<ExchangeField, string>>;

/** Approved messages, §x7. Never blames the visitor, always says what to do. */
export const MESSAGE = {
  name: 'Enter your full name.',
  reach: 'Enter an email address or a phone number.',
  email: 'Check this email address. It looks incomplete.',
  phone: 'Enter a phone number we can reach you on.',
  category: 'Choose the option that best describes you.',
} as const;

/*
 * Mirrors of the backend's own rules, deliberately.
 *
 * These are a COURTESY, never the boundary: the server re-validates everything and is the
 * only authority. They are matched to `scripts/gas-v2` so the browser catches what the
 * server would reject, rather than sending something it already knows is invalid:
 *
 *   email  EMAIL_RE in core/Contract.js
 *   phone  validatePhone in shared/Util.js, 7 to 20 digits and approved punctuation only
 *
 * The design records the seven-digit floor as provisional frontend guidance and defers the
 * final contract to the backend, which is what these follow. The 20-digit ceiling is the
 * backend's and is enforced here for the same reason.
 */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const PHONE_ALLOWED = /^[0-9+()\-.\s]*$/;
const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 20;

const digits = (v: string) => v.replace(/\D/g, '');

/**
 * Validates the whole draft.
 *
 * Email and phone are jointly required and separately formatted: one is enough, neither is
 * not. When both are empty the message lands on BOTH fields, because the visitor has not
 * chosen which one to give yet and pointing at only one of them would be arbitrary.
 */
export function validateDraft(draft: ExchangeDraft): ExchangeErrors {
  const errors: ExchangeErrors = {};

  if (!draft.fullName.trim()) errors.fullName = MESSAGE.name;

  const email = draft.email.trim();
  const phone = draft.phone.trim();

  if (!email && !phone) {
    errors.email = MESSAGE.reach;
    errors.phone = MESSAGE.reach;
  } else {
    if (email && !EMAIL_RE.test(email)) errors.email = MESSAGE.email;
    if (phone) {
      const d = digits(phone);
      const badShape = !PHONE_ALLOWED.test(phone);
      const badLength = d.length < PHONE_MIN_DIGITS || d.length > PHONE_MAX_DIGITS;
      if (badShape || badLength) errors.phone = MESSAGE.phone;
    }
  }

  if (!draft.category) errors.category = MESSAGE.category;

  return errors;
}

/** Approved field order, so the error summary lists problems in the order they appear. */
export const FIELD_ORDER: ReadonlyArray<ExchangeField> = ['fullName', 'email', 'phone', 'category'];

export const FIELD_LABEL: Record<ExchangeField, string> = {
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  category: 'Which best describes you?',
};

/** Summary heading, §x7. Counts the problems so the visitor knows the size of the fix. */
export function summaryTitle(count: number): string {
  return count > 1 ? `Check ${count} things before sending` : 'Check one thing before sending';
}

/**
 * The visible copy (§x4, §x10).
 *
 * ONE SUBJECT NOW, SO NO VARIANTS. These used to be functions of an `ExchangeSubject`,
 * because a scan resolved to Zachary, Ethaniel, or the firm, and each needed its own name in
 * the supporting and success lines. The owner-directed single-page collapse of 2026-08-17
 * removed that choice: every scan lands on the same combined page, so every exchange is
 * addressed to the firm and the strings are constants again.
 *
 * `FIRM.name` is read rather than restated, so the firm is named in exactly one place.
 */
export const COPY = {
  heading: 'Share your contact',
  supporting: `Send your contact information directly to ${FIRM.name}.`,
  submit: 'Share my contact',
  submitSending: 'Sending',
  submitRetry: 'Try again',
  foot: 'Your details are shared directly with AxisPoint for follow-up.',
  failureHeading: 'Your details were not sent.',
  failureBody:
    'Nothing was lost. Everything you entered is still here. Try again, or use the Email action on the card.',
  successHeading: `Your details were shared with ${FIRM.name}.`,
  /* Merges the two approved variants: the firm line's "so you have us too" and the partner
     line's "both sides of the exchange", now that one action saves both partners. */
  successBody: `${FIRM.name} has your contact information. Save our contacts so you have both sides of the exchange.`,
  successFoot: 'Nothing else was sent and you were not added to any mailing list.',
  close: 'Close',
  open: 'Share your details',
} as const;
