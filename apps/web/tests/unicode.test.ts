import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGasV2Contract } from './helpers/gasV2';
import { emptyDraft, type IntakeDraft } from '../src/intake/model';
import { toEnvelopeDraft } from '../src/intake/toWire';

/*
 * Non-ASCII text must survive every layer unchanged.
 *
 * WHY THIS MATTERS NOW. Localization readiness is not only about the interface language: the
 * people filling this form already have names, companies, and things to say that are not
 * ASCII, in English today. A name that arrives mangled is worse than an untranslated page,
 * because the visitor sees their own name spelled wrong in a reply.
 *
 * The path checked here is the real one: client mapping, the actual `parseEnvelope`, the
 * storage row builders, and the notification and template surfaces that read those rows.
 * Nothing is normalised, transliterated, case-folded, or stripped anywhere along it.
 */

const gas = loadGasV2Contract();

/** Deliberately awkward, and all of it realistic. */
const SAMPLES = [
  { label: 'Spanish accents', name: 'José Peña Núñez', org: 'Constructora Peña S.A. de C.V.' },
  { label: 'Vietnamese tone marks', name: 'Nguyễn Thị Ánh Tuyết', org: 'Công ty Bất động sản Việt' },
  { label: 'Simplified Chinese', name: '王小明', org: '北京置业有限公司' },
  { label: 'Traditional Chinese', name: '陳大文', org: '台北資產管理股份有限公司' },
  { label: 'Hindi Devanagari', name: 'अनिल कुमार शर्मा', org: 'शर्मा प्रॉपर्टीज़' },
  { label: 'Urdu RTL', name: 'محمد عبد الله', org: 'الشركة العقارية المحدودة' },
  { label: 'Gujarati', name: 'પટેલ રમેશભાઈ', org: 'પટેલ ડેવલપર્સ' },
  { label: 'Punjabi Gurmukhi', name: 'ਹਰਪ੍ਰੀਤ ਸਿੰਘ', org: 'ਸਿੰਘ ਪ੍ਰਾਪਰਟੀਜ਼' },
  { label: 'combining marks', name: 'Zoë Márquez', org: 'Ångström Realty' },
  { label: 'emoji in free text', name: 'Robin Slate', org: 'Slate & Co.' },
];

/**
 * A free-text note as a visitor might actually type it.
 *
 * The em dash is intentional and must stay. The project's no-em-dash rule governs copy we
 * write, not characters a visitor types into a textarea, and the point of this fixture is
 * that such characters survive client, parser, storage, and templates unchanged. A blanket
 * em-dash sweep that "fixed" this line would quietly remove the coverage.
 */
const NOTE =
  'Kính gửi quý công ty, 我们需要管理服务。مرحبا، نحتاج إلى إدارة. ' +
  'Building "A" & annex <B> — 50% occupied, ¥1,000,000/mo. 🏢';

const LOCATION = 'Ciudad de México, Álvaro Obregón';

function draftWith(name: string, org: string, notes: string): IntakeDraft {
  const d = emptyDraft('management-proposal', 'pm');
  d.property = {
    type: 'multifamily',
    scope: 'one_property',
    location: LOCATION,
    scale: '184',
    propertyCount: '',
    scaleUnknown: false,
  };
  d.situation = {
    current: 'replace_current_management',
    involvement: 'property_management',
    timing: 'immediately',
    notes,
  };
  d.contact = {
    fullName: name,
    email: 'robin@example.test',
    phone: '',
    organization: org,
    followUpLanguage: '',
  };
  return d;
}

const CONTEXT = { pageLocale: 'en' as never, intent: null, sourceDetail: '/contact' };

function envelopeFor(draft: IntakeDraft) {
  return {
    schemaVersion: 1,
    submissionId: '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d',
    submittedAt: '2026-08-09T18:00:00.000Z',
    ...toEnvelopeDraft(draft, CONTEXT),
  };
}

/* ── Client mapping and the real parser ───────────────────────────────────── */

test('every sample survives the client mapper and the real parseEnvelope', () => {
  for (const s of SAMPLES) {
    const envelope = envelopeFor(draftWith(s.name, s.org, NOTE));
    const result = gas.parseEnvelope(JSON.stringify(envelope));

    assert.equal(result.ok, true, `${s.label} rejected: ${result.code} ${result.field ?? ''}`);

    const payload = result.value?.payload as {
      contact: { fullName: string; organization: string };
      property: { location: string };
      situation: { notes: string };
    };

    // Byte-for-byte, including combining marks: no NFC/NFD normalisation anywhere.
    assert.equal(payload.contact.fullName, s.name, `${s.label}: name changed`);
    assert.equal(payload.contact.organization, s.org, `${s.label}: organization changed`);
    assert.equal(payload.property.location, LOCATION, `${s.label}: location changed`);
    assert.equal(payload.situation.notes, NOTE, `${s.label}: notes changed`);
  }
});

test('combining marks are preserved rather than normalised', () => {
  // "Zoë" written as e + combining diaeresis must not silently become the precomposed form.
  const decomposed = 'Zoë';
  const envelope = envelopeFor(draftWith(decomposed, 'Org', 'note'));
  const result = gas.parseEnvelope(JSON.stringify(envelope));

  const name = (result.value?.payload as { contact: { fullName: string } }).contact.fullName;
  assert.equal(name, decomposed);
  assert.equal(name.length, decomposed.length, 'length changed, so a normalisation ran');
  assert.notEqual(name, 'Zoë', 'the value was normalised to the precomposed form');
});

/* ── Storage mapping ──────────────────────────────────────────────────────── */

test('non-ASCII reaches the stored Lead and Submission rows unchanged', () => {
  const sample = SAMPLES.find((s) => s.label === 'Vietnamese tone marks');
  assert.ok(sample);

  const parsed = gas.parseEnvelope(JSON.stringify(envelopeFor(draftWith(sample.name, sample.org, NOTE))));
  assert.equal(parsed.ok, true);

  const ctx = {
    leadId: 'l-1',
    contactId: '',
    receivedAt: '2026-08-09T18:00:00.000Z',
    slaDueAt: '2026-08-10T17:00:00.000Z',
    screening: {},
    possibleMatches: [],
  };

  const buildLead = gas.buildLead as (e: unknown, c: unknown) => Record<string, string>;
  const buildSubmission = gas.buildSubmission as (e: unknown, c: unknown) => Record<string, string>;

  const lead = buildLead(parsed.value, ctx);
  assert.equal(lead.fullName, sample.name);
  assert.equal(lead.organization, sample.org);
  assert.equal(lead.situationNotes, NOTE);
  assert.equal(lead.propertyLocation, LOCATION);

  const submission = buildSubmission(parsed.value, ctx);
  assert.equal(submission.fullName, sample.name);
  assert.equal(submission.organization, sample.org);
  assert.equal(submission.situationNotes, NOTE);
});

/* ── Template and notification surfaces ───────────────────────────────────── */

/**
 * A GAS template renderer, as seen from TypeScript.
 *
 * The renderers live in plain `.js` under `scripts/gas-v2` and take different argument
 * shapes, so this stays deliberately loose. Each call site casts the returned body to what
 * that renderer actually produces.
 */
type Renderer = (...args: unknown[]) => unknown;

test('non-ASCII renders into the visitor acknowledgement without corruption', () => {
  const sample = SAMPLES.find((s) => s.label === 'Simplified Chinese');
  assert.ok(sample);

  const templates = (gas.realTemplates as () => Record<string, Renderer>)();
  const rendered = templates.renderAcknowledgement(
    {
      leadId: 'l-1',
      email: 'robin@example.test',
      fullName: sample.name,
      organization: sample.org,
      pathway: 'management_proposal',
      preferredFollowUpLocale: '',
    },
    {},
    'en',
  ) as { ok: boolean; htmlBody: string; textBody: string };

  assert.equal(rendered.ok, true);
  // The first name is greeted; the characters must arrive intact in both bodies.
  assert.equal(rendered.htmlBody.includes(sample.name), true, 'name missing from the HTML body');
  assert.equal(rendered.textBody.includes(sample.name), true, 'name missing from the text body');
});

test('non-ASCII renders into the internal partner notification', () => {
  const sample = SAMPLES.find((s) => s.label === 'Urdu RTL');
  assert.ok(sample);

  const templates = (gas.realTemplates as () => Record<string, Renderer>)();
  const rendered = templates.renderPartnerNotification(
    {
      leadId: 'l-1',
      email: 'robin@example.test',
      fullName: sample.name,
      organization: sample.org,
      pathway: 'management_proposal',
      propertyLocation: LOCATION,
      situationNotes: NOTE,
      preferredFollowUpLocale: 'ur',
    },
    {},
  ) as { ok: boolean; htmlBody: string };

  assert.equal(rendered.ok, true);
  assert.equal(rendered.htmlBody.includes(sample.name), true, 'RTL name missing from the notification');
});

/* ── Redaction still behaves on non-ASCII ─────────────────────────────────── */

test('log redaction does not crash or leak on a non-ASCII address', () => {
  const redactEmail = gas.redactEmail as (v: string) => string;
  const redacted = redactEmail('joão@例え.jp');

  assert.equal(redacted.includes('joão'), false, 'the local part was not redacted');
  assert.match(redacted, /\*\*\*/);
});
