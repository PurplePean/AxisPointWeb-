import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGasV2Contract } from './helpers/gasV2';
import { toEnvelopeDraft, toContactExchangePayload, cardSlug, FIRM_SLUG } from '../src/exchange/toWire';
import { CONTACT_CATEGORIES, emptyDraft, validateDraft, MESSAGE, type ExchangeDraft } from '../src/exchange/model';

/*
 * QR Contact Exchange wire compatibility.
 *
 * THE POINT. A TypeScript type that says 'other' proves the frontend agrees with itself.
 * These tests run every envelope this app can produce through the REAL `parseEnvelope` from
 * `scripts/gas-v2`, so a drift between the two sides fails here rather than in production
 * against a backend nobody can debug from a phone in a parking lot.
 */

const gas = loadGasV2Contract();

/** Wraps a draft the way the shared client will: it owns id, version, and timestamp. */
function envelopeFor(draft: ExchangeDraft, profileKey: string | null = 'zachary-russell') {
  const d = toEnvelopeDraft(draft, { profileKey });
  return {
    schemaVersion: 1,
    submissionId: '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d',
    submittedAt: '2026-08-05T18:00:00.000Z',
    ...d,
  };
}

const parse = (envelope: unknown) => gas.parseEnvelope(JSON.stringify(envelope));

const validDraft = (over: Partial<ExchangeDraft> = {}): ExchangeDraft => ({
  ...emptyDraft(),
  fullName: 'Dana Whitfield',
  email: 'dana@whitfieldcre.com',
  category: 'broker_real_estate_advisor',
  ...over,
});

/* ── The backend accepts what this app produces ───────────────────────────── */

test('a minimal email-only exchange is accepted by the real parser', () => {
  const result = parse(envelopeFor(validDraft()));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
  assert.equal(result.value?.submissionKind, 'contact_exchange');
});

test('a phone-only exchange is accepted', () => {
  const result = parse(envelopeFor(validDraft({ email: '', phone: '(415) 555-0137' })));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
});

test('every approved category is accepted by the backend', () => {
  for (const category of CONTACT_CATEGORIES) {
    const result = parse(envelopeFor(validDraft({ category: category.value })));
    assert.equal(result.ok, true, `${category.value} rejected: ${result.code}`);
    const payload = result.value?.payload as { contactCategory: string };
    assert.equal(payload.contactCategory, category.value);
  }
});

test('the seven approved categories are exactly the backend tokens, in order', () => {
  // Reading the backend list rather than restating it: a token added on one side and not
  // the other must fail here.
  //
  // `Array.from` is load-bearing. The backend is evaluated in a VM context, so its arrays
  // come from a different realm and `deepStrictEqual` fails on the prototype alone, with a
  // diff showing two identical-looking lists. Copying into a host array compares values.
  const backend = Array.from(gas.CONTACT_CATEGORIES as unknown as string[]);
  assert.deepEqual(
    CONTACT_CATEGORIES.map((c) => c.value),
    backend,
  );
});

test('optional fields are omitted entirely when blank, not sent as empty strings', () => {
  const envelope = envelopeFor(validDraft());
  const payload = (envelope as { payload: Record<string, unknown> }).payload;
  assert.equal('company' in payload, false);
  assert.equal('roleOrTitle' in payload, false);
  assert.equal('phone' in payload, false);
  assert.equal(parse(envelope).ok, true);
});

test('optional fields are carried through when supplied', () => {
  const result = parse(
    envelopeFor(validDraft({ company: 'Whitfield CRE', roleOrTitle: 'Principal' })),
  );
  assert.equal(result.ok, true);
  const payload = result.value?.payload as { company: string; roleOrTitle: string };
  assert.equal(payload.company, 'Whitfield CRE');
  assert.equal(payload.roleOrTitle, 'Principal');
});

test('values are sent as typed, never reformatted', () => {
  const phone = '+52 (55) 1234.5678';
  const result = parse(envelopeFor(validDraft({ email: '', phone })));
  assert.equal(result.ok, true, `rejected: ${result.code}`);
  const payload = result.value?.payload as { phone: string };
  assert.equal(payload.phone, phone);
});

/* ── A QR submission is a Contact, never a Lead ───────────────────────────── */

test('the envelope carries no service-inquiry fields whatsoever', () => {
  const envelope = envelopeFor(validDraft()) as unknown as Record<string, unknown>;
  const payload = envelope.payload as Record<string, unknown>;
  // §x9: the QR app must not duplicate property or investment intake questions.
  for (const forbidden of ['pathway', 'property', 'situation', 'serviceScope', 'booking', 'topic']) {
    assert.equal(forbidden in payload, false, `payload must not carry ${forbidden}`);
  }
});

test('a QR exchange produces a Contact and no Lead in the real domain layer', () => {
  const parsed = parse(envelopeFor(validDraft()));
  assert.equal(parsed.ok, true);

  const buildContact = gas.buildContact as (e: unknown, c: unknown) => Record<string, unknown>;
  const buildLead = gas.buildLead as (e: unknown, c: unknown) => Record<string, unknown>;
  const ctx = { contactId: 'c-1', leadId: '', receivedAt: '2026-08-05T18:00:00.000Z', screening: {}, possibleMatches: [] };

  const contact = buildContact(parsed.value, ctx);
  assert.equal(contact.contactId, 'c-1');

  // The backend refuses to build a Lead from an exchange. Asserting the throw proves the
  // rule is enforced there, not merely avoided here.
  assert.throws(() => buildLead(parsed.value, ctx));
});

/* ── Attribution: gathered-through, kept apart from ownership ─────────────── */

test('a partner card records that partner as the immutable acquisition source', () => {
  const parsed = parse(envelopeFor(validDraft(), 'zachary-russell'));
  assert.equal(parsed.ok, true);

  const buildContact = gas.buildContact as (e: unknown, c: unknown) => Record<string, unknown>;
  const contact = buildContact(parsed.value, {
    contactId: 'c-1', leadId: '', receivedAt: '2026-08-05T18:00:00.000Z', screening: {}, possibleMatches: [],
  });

  assert.equal(contact.acquisitionSource, 'zachary_russell');
  assert.equal(contact.scannedPartner, 'zachary_russell');
  // A scan gives a partner a name, not a claim. Ownership starts unassigned for everyone.
  assert.equal(contact.ownerPartner, '');
});

test('the firm card is an acquisition source but never an assignable partner', () => {
  const parsed = parse(envelopeFor(validDraft(), null));
  assert.equal(parsed.ok, true);
  assert.equal((parsed.value?.attribution as { sourceDetail: string }).sourceDetail, FIRM_SLUG);

  const buildContact = gas.buildContact as (e: unknown, c: unknown) => Record<string, unknown>;
  const contact = buildContact(parsed.value, {
    contactId: 'c-1', leadId: '', receivedAt: '2026-08-05T18:00:00.000Z', screening: {}, possibleMatches: [],
  });

  assert.equal(contact.acquisitionSource, 'firm');
  assert.equal(contact.scannedPartner, '');
});

test('an unrecognised card slug resolves to unknown and is not rewritten to the firm', () => {
  // A card that did not resolve is evidence a printed card is wrong. Hiding it inside
  // "firm" would destroy exactly the signal worth having.
  const parsed = parse(envelopeFor(validDraft(), 'demo-missing-email'));
  assert.equal(parsed.ok, true);

  const buildContact = gas.buildContact as (e: unknown, c: unknown) => Record<string, unknown>;
  const contact = buildContact(parsed.value, {
    contactId: 'c-1', leadId: '', receivedAt: '2026-08-05T18:00:00.000Z', screening: {}, possibleMatches: [],
  });

  assert.equal(contact.acquisitionSource, 'unknown');
  assert.equal(contact.scannedPartner, '');
});

test('both partner slugs match the backend map exactly', () => {
  const map = gas.SLUG_TO_PARTNER as unknown as Record<string, string>;
  assert.equal(cardSlug('zachary-russell') in map, true);
  assert.equal(cardSlug('ethaniel-vu') in map, true);
  assert.equal(cardSlug(null), gas.FIRM_SLUG);
});

test('the browser never sends an owner, and the backend would reject one if it did', () => {
  const envelope = envelopeFor(validDraft()) as unknown as Record<string, unknown>;
  assert.equal('partnerOwner' in envelope, false);
  assert.equal('ownerPartner' in envelope, false);

  const tampered = { ...envelope, payload: { ...(envelope.payload as object), ownerPartner: 'zachary_russell' } };
  const result = parse(tampered);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SERVER_OWNED_FIELD_SUPPLIED');
});

/* ── Browser validation matches what the server enforces ──────────────────── */

test('a draft the browser accepts is never rejected by the backend for shape', () => {
  const drafts: ExchangeDraft[] = [
    validDraft(),
    validDraft({ email: '', phone: '4155550137' }),
    validDraft({ phone: '+44 20 7946 0958' }),
    validDraft({ company: 'A'.repeat(200) }),
    validDraft({ fullName: 'Marguerite Okonkwo-Ashford' }),
  ];

  for (const draft of drafts) {
    assert.deepEqual(validateDraft(draft), {}, 'precondition: the browser accepts this draft');
    const result = parse(envelopeFor(draft));
    assert.equal(result.ok, true, `backend rejected a browser-valid draft: ${result.code} ${result.field ?? ''}`);
  }
});

test('the browser rejects what the backend would reject, so nobody sees a server error', () => {
  const cases: Array<[string, ExchangeDraft, string]> = [
    ['no contact method', validDraft({ email: '', phone: '' }), MESSAGE.reach],
    ['a malformed email', validDraft({ email: 'dana@' }), MESSAGE.email],
    ['a phone below the digit floor', validDraft({ email: '', phone: '12345' }), MESSAGE.phone],
    ['a phone above the digit ceiling', validDraft({ email: '', phone: '1'.repeat(21) }), MESSAGE.phone],
    ['a phone with letters', validDraft({ email: '', phone: '555-CALL-NOW' }), MESSAGE.phone],
  ];

  for (const [label, draft, expected] of cases) {
    const errors = validateDraft(draft);
    assert.equal(Object.keys(errors).length > 0, true, `browser should reject ${label}`);
    const message = errors.email ?? errors.phone;
    assert.equal(message, expected, label);
  }
});

test('a missing name and a missing category are caught', () => {
  const errors = validateDraft(validDraft({ fullName: '   ', category: '' }));
  assert.equal(errors.fullName, MESSAGE.name);
  assert.equal(errors.category, MESSAGE.category);
});

test('mapping refuses to build a payload with no category rather than sending one', () => {
  assert.throws(() => toContactExchangePayload(validDraft({ category: '' })));
});

/* ── Locale ───────────────────────────────────────────────────────────────── */

test('locale is English page with no invented follow-up preference', () => {
  const envelope = envelopeFor(validDraft()) as unknown as { locale: Record<string, unknown> };
  assert.equal(envelope.locale.page, 'en');
  // Nobody was asked how they want to be answered. Inventing it is worse than admitting it.
  assert.equal(envelope.locale.preferredFollowUp, null);
  assert.equal(parse(envelope).ok, true);
});
