import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGasV2Contract } from './helpers/gasV2';
import { toEnvelopeDraft, toContactExchangePayload, FIRM_SLUG } from '../src/exchange/toWire';
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

/**
 * Wraps a draft the way the shared client will: it owns id, version, and timestamp.
 *
 * There is no profile key to pass any more. The single-page collapse of 2026-08-17 left the
 * app with one card and therefore one slug, so `toEnvelopeDraft` takes no attribution input
 * from the caller and the tests below cannot construct a per-partner envelope even if they
 * wanted one. That is the point: the loss is structural, not a value somebody forgot to set.
 */
function envelopeFor(draft: ExchangeDraft) {
  const d = toEnvelopeDraft(draft);
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

test('every exchange now sends the firm slug, and it is the backend value verbatim', () => {
  // Read from the backend rather than restated, so a rename on either side fails here.
  assert.equal(FIRM_SLUG, gas.FIRM_SLUG);

  const envelope = envelopeFor(validDraft());
  assert.equal((envelope.attribution as { sourceDetail: string }).sourceDetail, FIRM_SLUG);
  assert.equal(parse(envelope).ok, true);
});

test('the firm slug is an acquisition source but never an assignable partner', () => {
  const parsed = parse(envelopeFor(validDraft()));
  assert.equal(parsed.ok, true);

  const buildContact = gas.buildContact as (e: unknown, c: unknown) => Record<string, unknown>;
  const contact = buildContact(parsed.value, {
    contactId: 'c-1', leadId: '', receivedAt: '2026-08-05T18:00:00.000Z', screening: {}, possibleMatches: [],
  });

  assert.equal(contact.acquisitionSource, 'firm');
  assert.equal(contact.scannedPartner, '');
  // A scan gives a partner a name, not a claim. Ownership starts unassigned for everyone.
  assert.equal(contact.ownerPartner, '');
});

/*
 * THE ACCEPTED COST OF THE SINGLE-PAGE COLLAPSE, PINNED AS A TEST.
 *
 * Owner-directed decision, 2026-08-17: per-partner attribution in the daily digest is
 * accepted as lost, because the frontend no longer has a partner-specific identifier to
 * send. This asserts the consequence deliberately rather than leaving it as an absence
 * somebody later reads as a bug. If a future pass restores per-partner cards, this test is
 * the one that should fail and be rewritten.
 */
test('a QR contact is no longer attributable to an individual partner', () => {
  const parsed = parse(envelopeFor(validDraft()));
  const buildContact = gas.buildContact as (e: unknown, c: unknown) => Record<string, unknown>;
  const contact = buildContact(parsed.value, {
    contactId: 'c-1', leadId: '', receivedAt: '2026-08-05T18:00:00.000Z', screening: {}, possibleMatches: [],
  });

  const partners = Array.from(gas.SLUG_TO_PARTNER ? Object.values(gas.SLUG_TO_PARTNER as object) : []);
  assert.equal(partners.includes(contact.acquisitionSource as string), false);
});

test('the backend still resolves per-partner slugs, so nothing there had to change', () => {
  /*
   * The collapse is a frontend change only. `SLUG_TO_PARTNER` keeps both partner slugs and
   * the shared-section routing path is the one that already existed and was already tested.
   * Asserting the backend map is intact proves this pass did not quietly narrow it.
   */
  const map = gas.SLUG_TO_PARTNER as unknown as Record<string, string>;
  assert.equal(map['zachary-russell'], 'zachary_russell');
  assert.equal(map['ethaniel-vu'], 'ethaniel_vu');
});

test('the firm source is the one the digest delivers to both partners', () => {
  /*
   * `scripts/gas-v2/src/scheduled/Digest.js` splits its shared section on
   * `acquisitionSource === 'firm' || === 'unknown'`. This pins the frontend to the 'firm'
   * half of that condition, which is the routing the owner accepted: contacts land in the
   * shared section both partners receive, not in either partner's own group.
   */
  const parsed = parse(envelopeFor(validDraft()));
  const buildContact = gas.buildContact as (e: unknown, c: unknown) => Record<string, unknown>;
  const contact = buildContact(parsed.value, {
    contactId: 'c-1', leadId: '', receivedAt: '2026-08-05T18:00:00.000Z', screening: {}, possibleMatches: [],
  });

  const shared = contact.acquisitionSource === 'firm' || contact.acquisitionSource === 'unknown';
  assert.equal(shared, true, 'a QR contact must reach the digest section both partners get');
  // 'firm' specifically, not 'unknown': an unresolved card is a different fact and would be
  // evidence of a broken printed card rather than of the intended shared routing.
  assert.equal(contact.acquisitionSource, 'firm');
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
