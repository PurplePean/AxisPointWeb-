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
 * `sourceCategory: 'qr'` and `sourceDetail`, the card slug, which since the 2026-08-17
 * single-page collapse is always the firm slug. The backend derives the rest and keeps two
 * facts deliberately apart (`scripts/gas-v2/src/core/Attribution.js`):
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
 * The one card slug this app can now send.
 *
 * WHAT THE COLLAPSE COST, DELIBERATELY. This used to be `cardSlug(profileKey)`: a scan of
 * Zachary's card sent `zachary-russell`, Ethaniel's sent `ethaniel-vu`, and only the
 * unresolved firm fallback sent this value. Those per-partner keys matched `SLUG_TO_PARTNER`
 * in `scripts/gas-v2/src/core/Tokens.js` exactly, and the backend turned them into an
 * immutable per-partner acquisition source.
 *
 * There is one page now, so the browser has no partner-specific identifier to send and does
 * not invent one. Every exchange carries the firm slug, the backend resolves it to
 * `acquisitionSource: 'firm'` with `scannedPartner` empty, and the daily digest delivers
 * those Contacts in its shared section to BOTH partners
 * (`scripts/gas-v2/src/scheduled/Digest.js`). **Owner-directed decision, 2026-08-17: the
 * per-partner attribution loss is accepted.**
 *
 * NOTHING CHANGED ON THE BACKEND, AND NOTHING NEEDED TO. `SLUG_TO_PARTNER` still resolves
 * both partner slugs, the shared-section routing path already existed and is already tested,
 * and an unrecognised slug still resolves to `unknown` rather than being quietly rewritten to
 * the firm. This is purely a change in what the frontend sends.
 */
export const FIRM_SLUG = 'axispoint-partners';

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
export function toEnvelopeDraft(draft: ExchangeDraft, context: ExchangeContext = {}): EnvelopeDraft {
  return {
    submissionKind: 'contact_exchange',
    locale: { page: 'en', preferredFollowUp: null },
    attribution: {
      sourceCategory: 'qr',
      sourceDetail: FIRM_SLUG,
      landingPage: context.landingPage,
    },
    payload: toContactExchangePayload(draft),
    clientSignals: context.clientSignals,
  };
}
