import type { EnvelopeDraft, ContactExchangePayload } from '@axispoint/submission-client';
import type { ExchangeDraft } from './model';

/**
 * Maps the exchange draft onto the V2 wire contract.
 *
 * Built from `AxisPoint QR Contact Exchange.dc.html` §x11 (approved frontend contract) and
 * verified against `scripts/gas-v2/src/core/Contract.js` `validateContactExchange`, which is the
 * only authority. Nothing here is inferred from a UI label.
 *
 * ATTRIBUTION IS THE SUBTLE PART. The browser sends only where the scan came from:
 * `sourceCategory: 'qr'` and `sourceDetail`, the card slug. The backend derives the rest and
 * keeps two facts deliberately apart (`scripts/gas-v2/src/core/Attribution.js`):
 *
 *   acquisitionSource / scannedPartner   which card produced this person. IMMUTABLE.
 *   ownerPartner                         who is responsible now. Starts EMPTY for everyone.
 *
 * A scan gives a partner a name, not a claim, so this file must never send an owner and the
 * backend rejects `partnerOwner` and `ownerPartner` as server-owned fields if it tried. The
 * gathered-through record survives every later reassignment precisely because it is stored
 * separately from ownership.
 */

/**
 * Card slugs the backend resolves.
 *
 * These are the QR profile keys, which already match `SLUG_TO_PARTNER` in
 * `scripts/gas-v2/src/core/Tokens.js` exactly. The firm card has no profile key (it is the
 * `null` fallback), so it maps to the backend's `FIRM_SLUG`.
 *
 * An unrecognised slug is NOT corrected here. The backend resolves anything it does not
 * know to `unknown`, which is a real and useful fact: it is evidence that a printed card is
 * wrong. Quietly rewriting it to the firm would hide exactly the signal worth having.
 */
export const FIRM_SLUG = 'axispoint-partners';

export function cardSlug(profileKey: string | null): string {
  return profileKey ?? FIRM_SLUG;
}

/**
 * Trims, and returns the key/value pair only when there is something to send.
 *
 * Returning a spreadable object rather than `undefined` matters: `{ phone: undefined }`
 * still HAS a `phone` key. `JSON.stringify` happens to drop it, so the wire is unaffected,
 * but anything inspecting the object before serialisation sees a field that was never
 * filled in. Omitting it outright means "absent" means the same thing at every layer.
 */
function optional<K extends string>(key: K, value: string): Record<K, string> | Record<string, never> {
  const trimmed = value.trim();
  return trimmed === '' ? {} : ({ [key]: trimmed } as Record<K, string>);
}

export interface ExchangeContext {
  /** The resolved profile key, or null for the firm fallback. */
  profileKey: string | null;
  /** Page URL, advisory only. */
  landingPage?: string;
  /** Advisory anti-spam signals. Never treated by the backend as evidence of innocence. */
  clientSignals?: Record<string, unknown>;
}

export function toContactExchangePayload(draft: ExchangeDraft): ContactExchangePayload {
  if (!draft.category) {
    // Unreachable through the UI, which validates first. Throwing beats sending a payload
    // the backend will reject for a reason the visitor cannot see.
    throw new Error('contact category is required');
  }

  return {
    fullName: draft.fullName.trim(),
    ...optional('email', draft.email),
    ...optional('phone', draft.phone),
    ...optional('company', draft.company),
    contactCategory: draft.category,
    ...optional('roleOrTitle', draft.roleOrTitle),
  };
}

/**
 * Builds the envelope draft handed to the shared client.
 *
 * The client owns `submissionId`, `schemaVersion`, and retry identity. This function
 * describes WHAT was submitted, never how many times.
 *
 * `locale.page` is 'en' because this surface is English-only: the approved design puts the
 * language selector explicitly out of scope (§x13). `preferredFollowUp` is null rather than
 * copied from the page, because nobody was asked how they want to be answered, and
 * inventing that answer is worse than admitting it is unknown.
 */
export function toEnvelopeDraft(draft: ExchangeDraft, context: ExchangeContext): EnvelopeDraft {
  return {
    submissionKind: 'contact_exchange',
    locale: { page: 'en', preferredFollowUp: null },
    attribution: {
      sourceCategory: 'qr',
      sourceDetail: cardSlug(context.profileKey),
      landingPage: context.landingPage,
    },
    payload: toContactExchangePayload(draft),
    clientSignals: context.clientSignals,
  };
}
