import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGasV2Contract, parse } from './helpers/gasV2';
import {
  toEnvelopeDraft,
  toServiceInquiryPayload,
  wireIntentToken,
  wireServiceScope,
  UnmappedIntakeValue,
} from '../src/intake/toWire';
import { newSubmissionId } from '@axispoint/submission-client';

/*
 * Website intake to the real V2 contract.
 *
 * WHAT THESE TESTS ARE FOR. The intake draft stores DISPLAY STRINGS, because the approved
 * UI binds radios to visible labels. The backend rejects display strings as wire values
 * with their own error code, so every one of them has to be translated, and a single
 * missed table entry produces a submission the visitor cannot rescue: they filled the form
 * correctly and it was refused for a reason they cannot see or act on.
 *
 * Nothing here asserts against a hand-written expectation of what the backend accepts.
 * Every envelope is fed through the ACTUAL `parseEnvelope`, so if a token changes on
 * either side this file fails rather than a real submission failing in production.
 */

const contract = loadGasV2Contract();

/** Completes a draft into a full envelope the way the client will. */
function envelopeFrom(draft: ReturnType<typeof toEnvelopeDraft>) {
  return { schemaVersion: 1, submissionId: newSubmissionId(), ...draft };
}

const CONTEXT = { pageLocale: 'en' as const, sourceDetail: '/contact' };

function managementDraft(overrides: Record<string, unknown> = {}) {
  return {
    pathway: 'management-proposal',
    scope: 'pm',
    topic: '',
    property: {
      type: 'multifamily',
      scope: 'one_property',
      location: 'Houston, Texas',
      scale: '184 units',
      propertyCount: '',
      scaleUnknown: false,
    },
    situation: {
      current: 'replace_current_management',
      involvement: 'property_management',
      timing: 'within_30_days',
      notes: 'Current manager missed two reporting deadlines.',
    },
    contact: {
      fullName: 'Dana Whitfield',
      email: 'dana@whitfieldholdings.test',
      phone: '(713) 555-0198',
      organization: 'Whitfield Holdings',
      followUpLanguage: '',
    },
    booking: { day: null, time: '', mode: '' },
    referralCode: '',
    ...overrides,
  } as never;
}

function shortDraft(pathway: 'investor-services' | 'general-inquiry', topic: string) {
  return {
    pathway,
    scope: pathway,
    topic,
    property: { type: '', scope: '', location: '', scale: '', propertyCount: '', scaleUnknown: false },
    situation: { current: '', involvement: '', timing: '', notes: '' },
    contact: {
      fullName: 'Marcus Alvarez',
      email: 'marcus@alvarezcapital.test',
      phone: '',
      organization: 'Alvarez Capital',
      followUpLanguage: '',
    },
    booking: { day: null, time: '', mode: '' },
    referralCode: '',
  } as never;
}

/* ── All four pathways are accepted by the real contract ──────────────────── */

test('a Management Proposal maps to an accepted envelope', () => {
  const result = parse(contract, envelopeFrom(toEnvelopeDraft(managementDraft(), CONTEXT)));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
});

test('the PM plus AM variant maps to Management Proposal with the pm_plus_am scope', () => {
  // Asset Management is NOT a pathway. `?intent=asset-management` enters the Management
  // Proposal flow with PM plus AM preselected, and that is what reaches the wire.
  const draft = toEnvelopeDraft(
    managementDraft({ scope: 'pm-plus-am', situation: {
      current: 'replace_current_management',
      involvement: 'property_management_plus_asset_management',
      timing: 'within_30_days',
      notes: '',
    } }),
    { ...CONTEXT, intent: 'asset-management' },
  );

  assert.equal(draft.payload.pathway, 'management_proposal');
  assert.equal((draft.payload as { serviceScope: string }).serviceScope, 'pm_plus_am');
  assert.equal(draft.attribution.intentToken, 'asset_management');

  const result = parse(contract, envelopeFrom(draft));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
});

test('an undecided scope is accepted', () => {
  const draft = toEnvelopeDraft(
    managementDraft({ scope: 'undecided', situation: {
      current: 'exploring_management_options',
      involvement: 'not_sure',
      timing: 'still_exploring',
      notes: '',
    } }),
    CONTEXT,
  );
  const result = parse(contract, envelopeFrom(draft));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
});

test('Investor Services maps to an accepted envelope', () => {
  const draft = toEnvelopeDraft(shortDraft('investor-services', 'actively_searching'), CONTEXT);
  const result = parse(contract, envelopeFrom(draft));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
  assert.equal(draft.payload.pathway, 'investor_services');
});

test('General Inquiry maps to an accepted envelope', () => {
  const draft = toEnvelopeDraft(shortDraft('general-inquiry', 'press_or_media'), CONTEXT);
  const result = parse(contract, envelopeFrom(draft));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
  assert.equal(draft.payload.pathway, 'general_inquiry');
});

test('every approved option in every list is accepted', () => {
  // The exhaustive sweep. One unmapped label would otherwise reach production as a
  // rejection the visitor cannot act on.
  const propertyTypes = ['multifamily', 'retail', 'mixed_portfolio', 'another_property_type'];
  const propertyScopes = ['one_property', 'portfolio'];
  const situations = [
    'replace_current_management', 'move_away_from_self_management',
    'recently_acquired_or_under_contract', 'lease_up_or_turnaround',
    'operations_or_reporting_problems', 'exploring_management_options', 'something_else',
  ];
  const timings = ['immediately', 'within_30_days', 'days_30_to_60', 'days_60_to_90', 'still_exploring'];

  for (const type of propertyTypes) {
    for (const scope of propertyScopes) {
      for (const current of situations) {
        for (const timing of timings) {
          const draft = toEnvelopeDraft(
            managementDraft({
              property: { type, scope, location: 'Houston, Texas', scale: '', propertyCount: '', scaleUnknown: false },
              situation: { current, involvement: 'property_management', timing, notes: '' },
            }),
            CONTEXT,
          );
          const result = parse(contract, envelopeFrom(draft));
          assert.equal(result.ok, true, `${type}/${scope}/${current}/${timing}: ${result.code} ${result.field ?? ''}`);
        }
      }
    }
  }

  const investorTopics = [
    'exploring_first_acquisition', 'under_contract_now', 'actively_searching',
    'own_property_need_operating_team', 'something_else',
  ];
  for (const topic of investorTopics) {
    const result = parse(contract, envelopeFrom(toEnvelopeDraft(shortDraft('investor-services', topic), CONTEXT)));
    assert.equal(result.ok, true, `investor topic ${topic}: ${result.code}`);
  }

  const generalTopics = [
    'question_about_axispoint', 'vendor_or_service_provider', 'employment',
    'press_or_media', 'something_else',
  ];
  for (const topic of generalTopics) {
    const result = parse(contract, envelopeFrom(toEnvelopeDraft(shortDraft('general-inquiry', topic), CONTEXT)));
    assert.equal(result.ok, true, `general topic ${topic}: ${result.code}`);
  }
});

/* ── Display labels never reach the wire ──────────────────────────────────── */

test('no approved display string appears anywhere in an envelope', () => {
  const draft = toEnvelopeDraft(managementDraft(), CONTEXT);
  const serialized = JSON.stringify(envelopeFrom(draft));

  // The backend's own rejection list, read from the backend rather than restated here.
  const rejected = Array.from(contract.REJECTED_DISPLAY_STRINGS);
  assert.ok(rejected.length > 0, 'the backend must expose its rejection list');

  for (const label of rejected) {
    assert.equal(
      serialized.includes(`"${label}"`),
      false,
      `display string ${JSON.stringify(label)} reached the wire`,
    );
  }
});

test('the backend actively rejects a display string, proving the mapping matters', () => {
  // Confirms the guard above is testing a real rule, not an absent one.
  const draft = toEnvelopeDraft(managementDraft(), CONTEXT) as { payload: { property: { type: string } } };
  const tampered = envelopeFrom(draft as never) as { payload: { property: { type: string } } };
  // A DISPLAY string on purpose. The tokenizer that converted this file's fixtures also
  // rewrote this line to a valid token, which the backend then accepted and the test's
  // whole point evaporated. It must stay the human-readable label.
  tampered.payload.property.type = 'Multifamily';

  const result = parse(contract, tampered);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DISPLAY_STRING_NOT_ACCEPTED');
});

test('an unmapped label throws rather than being sent through', () => {
  assert.throws(
    () => toServiceInquiryPayload(managementDraft({
      property: { type: 'Industrial', scope: 'one_property', location: 'X', scale: '', propertyCount: '', scaleUnknown: false },
    })),
    UnmappedIntakeValue,
  );
});

/* ── Scope and involvement agree ──────────────────────────────────────────── */

test('serviceScope and situation.involvement always agree', () => {
  // The backend rejects a mismatch outright rather than guessing which field wins, so the
  // involvement is derived from the scope rather than mapped independently.
  const pairs: Array<[string, string]> = [
    ['pm', 'property_management'],
    ['pm-plus-am', 'property_management_plus_asset_management'],
    ['undecided', 'not_sure'],
  ];

  for (const [uiScope, involvement] of pairs) {
    const payload = toServiceInquiryPayload(managementDraft({ scope: uiScope })) as {
      serviceScope: string;
      situation: { involvement: string };
    };
    assert.equal(payload.situation.involvement, involvement);
    assert.equal(payload.serviceScope, wireServiceScope(uiScope as never));
  }
});

test('a contradictory involvement can never be produced by the mapper', () => {
  // Proven by construction: whatever the draft's involvement LABEL says, the wire value
  // comes from the scope.
  const payload = toServiceInquiryPayload(managementDraft({
    scope: 'pm',
    situation: {
      current: 'replace_current_management',
      involvement: 'property_management_plus_asset_management',
      timing: 'immediately',
      notes: '',
    },
  })) as { situation: { involvement: string } };

  assert.equal(payload.situation.involvement, 'property_management');
});

/* ── Booking is never embedded ────────────────────────────────────────────── */

test('a chosen booking slot never appears in the submission envelope', () => {
  const draft = toEnvelopeDraft(
    managementDraft({ booking: { day: 3, time: '10:30 AM', mode: 'Phone call' } }),
    CONTEXT,
  );
  const envelope = envelopeFrom(draft);
  const serialized = JSON.stringify(envelope);

  assert.equal('booking' in (envelope.payload as object), false);
  assert.equal(serialized.includes('10:30 AM'), false);
  assert.equal(serialized.includes('Phone call'), false);

  assert.equal(parse(contract, envelope).ok, true);
});

test('the backend rejects an embedded booking block, proving the omission matters', () => {
  const envelope = envelopeFrom(toEnvelopeDraft(managementDraft(), CONTEXT)) as {
    payload: Record<string, unknown>;
  };
  envelope.payload.booking = { mode: 'phone_call', slot: '10:30 AM' };

  const result = parse(contract, envelope);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BOOKING_NOT_ALLOWED_IN_SUBMISSION');
});

/* ── Locale and attribution ───────────────────────────────────────────────── */

test('page locale and preferred follow-up are two separate facts', () => {
  const draft = toEnvelopeDraft(
    managementDraft({
      contact: {
        fullName: 'Dana Whitfield', email: 'dana@example.test', phone: '',
        organization: '', followUpLanguage: 'es',
      },
    }),
    CONTEXT,
  );

  assert.equal(draft.locale.page, 'en');
  assert.equal(draft.locale.preferredFollowUp, 'es');
  assert.equal(parse(contract, envelopeFrom(draft)).ok, true);
});

test('no stated follow-up language sends null, not a guess', () => {
  const draft = toEnvelopeDraft(managementDraft(), CONTEXT);
  assert.equal(draft.locale.preferredFollowUp, null);
});

test('every approved follow-up language is accepted', () => {
  /*
   * These are locale CODES now, not English display names.
   *
   * This test used to list names, and it passed while production was broken: it fed the
   * mapper the mapper's own vocabulary ("Simplified Chinese") rather than the vocabulary
   * the select actually emitted ("Chinese (Simplified)"). Agreeing with itself is not the
   * same as agreeing with the UI. `locale.test.ts` now drives the real option values;
   * this one covers the codes reaching the wire.
   */
  const languages = ['en', 'es', 'zh-Hans', 'zh-Hant', 'vi', 'hi', 'ur', 'gu', 'pa'];

  for (const language of languages) {
    const draft = toEnvelopeDraft(
      managementDraft({
        contact: { fullName: 'D W', email: 'd@example.test', phone: '', organization: '', followUpLanguage: language },
      }),
      CONTEXT,
    );
    assert.equal(parse(contract, envelopeFrom(draft)).ok, true, `language ${language}`);
  }
});

test('attribution carries the website source and the intent token', () => {
  const draft = toEnvelopeDraft(managementDraft(), {
    ...CONTEXT,
    intent: 'property-management',
    landingPage: 'https://example.test/property-management',
    utm: { source: 'newsletter', medium: 'email' },
  });

  assert.equal(draft.attribution.sourceCategory, 'website');
  assert.equal(draft.attribution.sourceDetail, '/contact');
  assert.equal(draft.attribution.intentToken, 'property_management');
  assert.equal(draft.attribution.utm?.source, 'newsletter');
  assert.equal(parse(contract, envelopeFrom(draft)).ok, true);
});

test('every intent token maps, and an unknown one becomes null rather than a bad token', () => {
  assert.equal(wireIntentToken('property-management'), 'property_management');
  assert.equal(wireIntentToken('asset-management'), 'asset_management');
  assert.equal(wireIntentToken('investor-services'), 'investor_services');
  assert.equal(wireIntentToken('general'), 'general');
  assert.equal(wireIntentToken('something-invented'), null);
  assert.equal(wireIntentToken(null), null);
});

test('a referral code is carried verbatim and inert', () => {
  const draft = toEnvelopeDraft(managementDraft({ referralCode: 'PARTNER-77' }), CONTEXT);

  assert.equal(draft.attribution.refToken, 'PARTNER-77');
  assert.equal(parse(contract, envelopeFrom(draft)).ok, true);

  // Inert: nothing else in the envelope changes because it is present.
  const without = toEnvelopeDraft(managementDraft(), CONTEXT);
  assert.deepEqual(draft.payload, without.payload);
});

test('an absent referral code is omitted rather than sent empty', () => {
  const draft = toEnvelopeDraft(managementDraft(), CONTEXT);
  assert.equal(draft.attribution.refToken, undefined);
});

/* ── Optional fields ──────────────────────────────────────────────────────── */

test('empty optional values are omitted, not sent as empty strings', () => {
  const draft = toEnvelopeDraft(
    managementDraft({
      property: { type: 'retail', scope: 'portfolio', location: 'Houston, Texas', scale: '', propertyCount: '', scaleUnknown: false },
      situation: { current: 'something_else', involvement: 'property_management', timing: 'immediately', notes: '' },
      contact: { fullName: 'Dana Whitfield', email: 'dana@example.test', phone: '', organization: '', followUpLanguage: '' },
    }),
    CONTEXT,
  );

  const payload = draft.payload as { property: Record<string, unknown>; contact: Record<string, unknown>; situation: Record<string, unknown> };
  assert.equal(payload.property.scale, undefined);
  assert.equal(payload.contact.phone, undefined);
  assert.equal(payload.contact.organization, undefined);
  assert.equal(payload.situation.notes, undefined);
  assert.equal(parse(contract, envelopeFrom(draft)).ok, true);
});

test('an unknown scale sends the flag and omits the value', () => {
  const draft = toEnvelopeDraft(
    managementDraft({
      property: { type: 'multifamily', scope: 'one_property', location: 'Houston', scale: 'ignored', propertyCount: '', scaleUnknown: true },
    }),
    CONTEXT,
  );

  const property = (draft.payload as { property: Record<string, unknown> }).property;
  assert.equal(property.scaleUnknown, true);
  assert.equal(property.scale, undefined);
  assert.equal(parse(contract, envelopeFrom(draft)).ok, true);
});

/* ── Server-owned fields are never sent ───────────────────────────────────── */

test('the envelope contains no server-owned field', () => {
  // The backend refuses these outright rather than stripping them, so sending one would
  // reject an otherwise valid submission.
  const serialized = JSON.stringify(envelopeFrom(toEnvelopeDraft(managementDraft(), CONTEXT)));

  for (const field of ['leadId', 'contactId', 'slaDueAt', 'spamSuspected', 'bookingEligible', 'ownerPartner']) {
    assert.equal(serialized.includes(`"${field}"`), false, `${field} was sent`);
  }
});
