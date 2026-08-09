import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadGasV2Contract } from './helpers/gasV2';
import {
  GENERAL_TOPIC_CHOICES,
  INVESTOR_TOPIC_CHOICES,
  INVOLVEMENT_CHOICES,
  PROPERTY_SCOPE_CHOICES,
  PROPERTY_TYPE_CHOICES,
  SITUATION_CHOICES,
  TIMING_CHOICES,
  choiceLabel,
  choiceOptions,
  emptyDraft,
  followUpOptions,
  scaleCopyFor,
  scopeFromInvolvement,
  shortPathCopy,
  type Choice,
  type IntakeDraft,
} from '../src/intake/model';
import { EN, syntheticCatalog } from '../src/i18n/messages';
import { toEnvelopeDraft } from '../src/intake/toWire';

/*
 * Display text is separate from the stored value.
 *
 * THE DEFECT THIS GUARDS. Six intake controls used to store their English label, and
 * `toWire` looked that label up to find the wire token. Translating one radio would have
 * broken every Management Proposal: the lookup would miss, or worse, involvement would
 * silently resolve to the wrong service scope and store an answer the visitor never gave.
 *
 * These tests consume the SAME choice definitions the UI renders from, so they cannot pass
 * against a UI that has drifted back to labels.
 */

const gas = loadGasV2Contract();
const parse = (e: unknown) => gas.parseEnvelope(JSON.stringify(e));

const ALL_CHOICE_SETS: [string, Choice[]][] = [
  ['propertyType', PROPERTY_TYPE_CHOICES],
  ['propertyScope', PROPERTY_SCOPE_CHOICES],
  ['situation', SITUATION_CHOICES],
  ['involvement', INVOLVEMENT_CHOICES],
  ['timing', TIMING_CHOICES],
  ['investorTopic', INVESTOR_TOPIC_CHOICES],
  ['generalTopic', GENERAL_TOPIC_CHOICES],
];

/* ── Every stored value is a token, never display text ────────────────────── */

test('no choice value looks like a display label', () => {
  for (const [name, choices] of ALL_CHOICE_SETS) {
    for (const c of choices) {
      assert.match(c.value, /^[a-z0-9_]+$/, `${name} value "${c.value}" is not a token`);
    }
  }
});

test('every choice label comes from the catalog, and none is empty', () => {
  for (const [name, choices] of ALL_CHOICE_SETS) {
    for (const c of choices) {
      const label = EN[c.labelKey];
      assert.equal(typeof label, 'string', `${name}: ${String(c.labelKey)} missing from catalog`);
      assert.notEqual(label, '', `${name}: ${String(c.labelKey)} is empty`);
      // The value must not equal its own label, which is what the old design did.
      assert.notEqual(c.value, label, `${name}: value and label are the same string`);
    }
  }
});

test('every choice value is accepted by the real backend token list', () => {
  const backend: Record<string, string[]> = {
    propertyType: Array.from(gas.PROPERTY_TYPES as unknown as string[]),
    propertyScope: Array.from(gas.PROPERTY_SCOPES as unknown as string[]),
    situation: Array.from(gas.SITUATIONS as unknown as string[]),
    involvement: Array.from(gas.INVOLVEMENTS as unknown as string[]),
    timing: Array.from(gas.TIMINGS as unknown as string[]),
  };

  for (const [name, choices] of ALL_CHOICE_SETS) {
    const allowed = backend[name];
    if (!allowed) continue; // topics are validated per pathway by the parser
    for (const c of choices) {
      assert.equal(allowed.includes(c.value), true, `${name}: "${c.value}" unknown to the backend`);
    }
  }
});

/* ── A synthetic catalog changes every label and no value ─────────────────── */

function managementDraft(): IntakeDraft {
  const d = emptyDraft('management-proposal', 'pm');
  d.property = {
    type: 'multifamily',
    scope: 'one_property',
    location: 'Houston',
    scale: '184',
    propertyCount: '',
    scaleUnknown: false,
  };
  d.situation = {
    current: 'replace_current_management',
    involvement: 'property_management',
    timing: 'immediately',
    notes: '',
  };
  d.contact = {
    fullName: 'Robin Slate',
    email: 'robin@example.test',
    phone: '',
    organization: '',
    followUpLanguage: '',
  };
  return d;
}

const CONTEXT = { pageLocale: 'en' as never, intent: null, sourceDetail: '/contact' };

function envelopeFor(draft: IntakeDraft) {
  return {
    schemaVersion: 1,
    submissionId: '3f7d1b2a-4c5e-4a6b-9c8d-0e1f2a3b4c5d',
    submittedAt: '2026-08-08T18:00:00.000Z',
    ...toEnvelopeDraft(draft, CONTEXT),
  };
}

test('a synthetic catalog changes EVERY visible label', () => {
  const qa = syntheticCatalog();

  for (const [name, choices] of ALL_CHOICE_SETS) {
    const english = choiceOptions(choices, EN).map((o) => o.text);
    const synthetic = choiceOptions(choices, qa).map((o) => o.text);

    assert.notDeepEqual(english, synthetic, `${name}: labels did not change`);
    synthetic.forEach((text) => assert.match(text, /^\[qa\] /, `${name}: "${text}" not synthetic`));
    // The values are untouched.
    assert.deepEqual(
      choiceOptions(choices, EN).map((o) => o.value),
      choiceOptions(choices, qa).map((o) => o.value),
    );
  }
});

test('a synthetic catalog does NOT change the submitted envelope', () => {
  // The whole point: translation is a display concern and cannot reach the wire.
  const draft = managementDraft();
  const before = JSON.stringify(envelopeFor(draft));

  // Rendering the same draft under a synthetic catalog changes labels everywhere.
  const qa = syntheticCatalog();
  assert.notEqual(choiceLabel(PROPERTY_TYPE_CHOICES, 'multifamily', qa), EN.propertyTypeMultifamily);
  assert.match(scaleCopyFor('multifamily', qa).label, /^\[qa\] /);
  assert.match(shortPathCopy('general-inquiry', qa).topicLabel, /^\[qa\] /);
  assert.match(followUpOptions(qa)[0].text, /^\[qa\] /);

  const after = JSON.stringify(envelopeFor(draft));
  assert.equal(after, before, 'the envelope changed when only the catalog changed');

  const result = parse(envelopeFor(draft));
  assert.equal(result.ok, true, `rejected: ${result.code} ${result.field ?? ''}`);
});

test('scope derives from the involvement TOKEN, not its label', () => {
  assert.equal(scopeFromInvolvement('property_management'), 'pm');
  assert.equal(scopeFromInvolvement('property_management_plus_asset_management'), 'pm-plus-am');
  assert.equal(scopeFromInvolvement('not_sure'), 'undecided');

  // The old English labels must no longer resolve to anything but the safe default.
  assert.equal(scopeFromInvolvement('Property Management'), 'undecided');
  assert.equal(scopeFromInvolvement('Property Management + Asset Management'), 'undecided');
});

test('scale copy is keyed by token, so a translated type still asks the right question', () => {
  assert.equal(scaleCopyFor('multifamily', EN).label, EN.scaleUnitsLabel);
  assert.equal(scaleCopyFor('retail', EN).label, EN.scaleSqftLabel);
  // An English label is no longer a key, so it correctly falls through to the generic copy.
  assert.equal(scaleCopyFor('Multifamily', EN).label, EN.scaleFallbackLabel);
});

test('every choice set survives a round trip through the real parser', () => {
  for (const type of PROPERTY_TYPE_CHOICES) {
    for (const scope of PROPERTY_SCOPE_CHOICES) {
      const d = managementDraft();
      d.property.type = type.value;
      d.property.scope = scope.value;
      const result = parse(envelopeFor(d));
      assert.equal(result.ok, true, `${type.value}/${scope.value}: ${result.code}`);
    }
  }

  for (const situation of SITUATION_CHOICES) {
    for (const timing of TIMING_CHOICES) {
      const d = managementDraft();
      d.situation.current = situation.value;
      d.situation.timing = timing.value;
      const result = parse(envelopeFor(d));
      assert.equal(result.ok, true, `${situation.value}/${timing.value}: ${result.code}`);
    }
  }
});
