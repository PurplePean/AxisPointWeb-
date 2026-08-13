'use strict';

/*
 * Visitor-facing email localisation: the audit-candidate sets, and the gate that keeps them
 * out of production.
 *
 * WHAT THESE TESTS ARE ACTUALLY PROTECTING. An email is the one artifact in this system a
 * visitor keeps, cannot re-render, and may act on hours later. Three failures matter more
 * than a wrong word:
 *
 *   1. A localised booking email that names a different INSTANT than the English one. That is
 *      a missed meeting, and it would look like a translation change in review.
 *   2. An unreviewed locale reaching a real recipient because something defaulted forward
 *      instead of falling back.
 *   3. An internal or QR message drifting into a visitor's language, which changes who can
 *      read the firm's own operational mail.
 *
 * Every test below exists for one of those, or for the byte-identity of English.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { load } = require('./helpers/load.js');
const { fakeConfig, fixedOffsetResolver } = require('./helpers/fakes.js');
const { auditVisitorTemplateSets, PHRASES } = require('../audit/visitorTemplates.js');

const AUDIT_LOCALES = Object.keys(PHRASES);

/** Config with a resolvable zone, so `formatInstant` prints a real local time. */
function config() {
  return Object.assign({}, fakeConfig(), { offsetResolver: fixedOffsetResolver(-300) });
}

function lead(overrides = {}) {
  return Object.assign(
    {
      fullName: 'Dana Ruiz',
      email: 'dana@example.com',
      pathway: 'management_proposal',
      propertyLocation: 'Sharpstown, Houston',
      propertyType: 'single_family',
      propertyScope: 'single_property',
      propertyScale: '4 units',
      organization: 'Ruiz Holdings',
      serviceScope: 'full_management',
      situationTiming: 'within_30_days',
    },
    overrides,
  );
}

function booking(overrides = {}) {
  return Object.assign(
    {
      status: 'confirmed',
      slotStart: '2026-09-14T15:00:00Z',
      mode: 'phone',
      durationMinutes: 30,
    },
    overrides,
  );
}

function ctxWithAudit() {
  const ctx = load();
  return { ctx, sets: auditVisitorTemplateSets(ctx) };
}

/* ── English is untouched ─────────────────────────────────────────────────── */

test('injecting audit sets leaves English byte-identical in both visitor emails', () => {
  /*
   * The migration test. If adding eight locales changed one character of the English mail,
   * every previously reviewed message would silently become an unreviewed one.
   */
  const { ctx, sets } = ctxWithAudit();
  const plain = ctx.realTemplates();
  const withAudit = ctx.realTemplates(sets);

  const a1 = plain.renderAcknowledgement(lead(), config());
  const a2 = withAudit.renderAcknowledgement(lead(), config(), 'en');
  assert.deepEqual(a2, a1);

  const b1 = plain.renderBookingConfirmation(lead(), booking(), config());
  const b2 = withAudit.renderBookingConfirmation(lead(), booking(), config(), 'en');
  assert.deepEqual(b2, b1);
});

test('a caller that passes no locale at all still gets English', () => {
  // Every pre-existing call site does exactly this. It must not have become locale-sensitive.
  const { sets, ctx } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  assert.deepEqual(
    t.renderAcknowledgement(lead(), config()),
    ctx.realTemplates().renderAcknowledgement(lead(), config()),
  );
});

/* ── The audit candidates render, and render completely ───────────────────── */

test('every audit locale renders both visitor emails with no phrase left in English', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);

  for (const code of AUDIT_LOCALES) {
    const ack = t.renderAcknowledgement(lead(), config(), code);
    assert.equal(ack.ok, true, `${code} acknowledgement must render`);
    assert.deepEqual(ack.untranslatedPhrases, [], `${code} acknowledgement has English left in it`);

    const conf = t.renderBookingConfirmation(lead(), booking(), config(), code);
    assert.equal(conf.ok, true, `${code} booking confirmation must render`);
    assert.deepEqual(conf.untranslatedPhrases, [], `${code} confirmation has English left in it`);
  }
});

test('each audit locale actually differs from English rather than passing through', () => {
  // A set that silently returned English would satisfy every other test in this file.
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  const en = t.renderBookingConfirmation(lead(), booking(), config(), 'en');

  for (const code of AUDIT_LOCALES) {
    const got = t.renderBookingConfirmation(lead(), booking(), config(), code);
    assert.notEqual(got.subject, en.subject, `${code} subject is still English`);
    assert.notEqual(got.textBody, en.textBody, `${code} body is still English`);
  }
});

test('the marker English phrases are gone from every audit rendering', () => {
  /*
   * `untranslatedPhrases` reports what the table did not cover. This checks the result
   * directly, so a phrase that was replaced with itself would still be caught.
   */
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  const markers = ['You are on the calendar', 'Your call is confirmed', 'Call confirmed'];

  for (const code of AUDIT_LOCALES) {
    const got = t.renderBookingConfirmation(lead(), booking(), config(), code);
    for (const marker of markers) {
      assert.ok(!got.textBody.includes(marker), `${code} still contains "${marker}"`);
      assert.ok(!got.htmlBody.includes(marker), `${code} HTML still contains "${marker}"`);
    }
  }
});

/* ── The instant, which is the part that must never move ──────────────────── */

test('the booking instant is byte-identical in all nine locales', () => {
  /*
   * THE MOST IMPORTANT TEST IN THIS FILE. Localisation may change every word around the time.
   * It may not change the time. A translated email naming a different hour is a missed meeting
   * that nobody discovers until the call does not happen.
   */
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);

  const en = t.renderBookingConfirmation(lead(), booking(), config(), 'en');
  const instant = ctx.formatInstant(booking().slotStart, config());
  assert.ok(en.textBody.includes(instant), 'the English mail must contain the formatted instant');

  for (const code of AUDIT_LOCALES) {
    const got = t.renderBookingConfirmation(lead(), booking(), config(), code);
    assert.ok(
      got.textBody.includes(instant),
      `${code} must name the same instant as English: expected ${JSON.stringify(instant)}`,
    );
    assert.ok(got.htmlBody.includes(instant), `${code} HTML must name the same instant`);
  }
});

test('the duration and the recipient name are unchanged by locale', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  for (const code of ['en', ...AUDIT_LOCALES]) {
    const got = t.renderBookingConfirmation(lead(), booking(), config(), code);
    assert.ok(got.textBody.includes('30 minutes'), `${code} lost the duration`);
    assert.ok(got.textBody.includes('Dana'), `${code} lost the recipient's name`);
  }
});

/* ── Fallback: unknown, disabled, missing, incomplete ─────────────────────── */

test('an unknown locale falls back to English deterministically', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  const en = t.renderAcknowledgement(lead(), config(), 'en');

  for (const bogus of ['de', 'xx', 'es-419', '', null, undefined]) {
    assert.deepEqual(
      t.renderAcknowledgement(lead(), config(), bogus),
      en,
      `${String(bogus)} must fall back to English`,
    );
  }
});

test('a locale set missing one renderer falls back per renderer, not per locale', () => {
  /*
   * Half-built sets are the realistic in-progress state. The acknowledgement should use the
   * partial set and the confirmation should quietly use English, rather than the whole locale
   * being discarded or a missing renderer throwing.
   */
  const { ctx, sets } = ctxWithAudit();
  const partial = { es: { renderAcknowledgement: sets.es.renderAcknowledgement } };
  const t = ctx.realTemplates(partial);

  const ack = t.renderAcknowledgement(lead(), config(), 'es');
  assert.equal(ack.auditCandidate, true, 'the partial set should have been used');

  const conf = t.renderBookingConfirmation(lead(), booking(), config(), 'es');
  assert.deepEqual(
    conf,
    ctx.realTemplates().renderBookingConfirmation(lead(), booking(), config()),
    'the missing renderer must fall back to English exactly',
  );
});

test('production dispatch never selects an audit locale', () => {
  /*
   * The launch gate itself. A visitor may ask for Urdu, and that request is RECORDED, but
   * `resolveOutboundLocale` only ever returns something in LAUNCH_READY_LOCALES, which is
   * `['en']` until a native reader signs a catalog off.
   */
  const ctx = load();
  /*
   * COMPARED AS A LOCAL ARRAY ON PURPOSE. `LAUNCH_READY_LOCALES` is built inside the VM
   * context, so its prototype is that realm's `Array.prototype`, and a prototype-sensitive
   * deep equality rejects it against a structurally identical literal. Copying it across the
   * boundary compares the values, which is what this test is about.
   */
  assert.deepEqual(Array.from(ctx.LAUNCH_READY_LOCALES), ['en']);

  for (const code of AUDIT_LOCALES) {
    const resolved = ctx.resolveOutboundLocale(
      { preferredFollowUpLocale: code },
      ctx.LAUNCH_READY_LOCALES,
    );
    assert.equal(resolved.locale, 'en', `${code} must be answered in English`);
    assert.equal(resolved.satisfied, false, `${code} must be recorded as an unmet request`);
  }
});

test('production template construction takes no audit set', () => {
  // `realTemplates()` with no argument is what production calls. It knows only English.
  const ctx = load();
  const t = ctx.realTemplates();
  const en = t.renderAcknowledgement(lead(), config(), 'en');
  for (const code of AUDIT_LOCALES) {
    assert.deepEqual(t.renderAcknowledgement(lead(), config(), code), en);
  }
});

/* ── No mutable global state ──────────────────────────────────────────────── */

test('injecting audit sets does not leak into a separately built template object', () => {
  /*
   * If injection mutated a shared registry, one test enabling Spanish would enable it for the
   * whole process, and in production one request could change the language of the next.
   */
  const { ctx, sets } = ctxWithAudit();
  const injected = ctx.realTemplates(sets);
  injected.renderAcknowledgement(lead(), config(), 'es');

  const plain = ctx.realTemplates();
  assert.deepEqual(
    plain.renderAcknowledgement(lead(), config(), 'es'),
    plain.renderAcknowledgement(lead(), config(), 'en'),
    'a later plain build must still know only English',
  );
});

/* ── Internal and QR mail stay English ────────────────────────────────────── */

test('the internal partner notification stays English whatever the visitor asked for', () => {
  /*
   * Partner mail is operational. It is read by the firm, not by the visitor, so it follows the
   * firm's language. `realTemplates` gives it no locale parameter at all, which is what makes
   * this structurally true rather than merely currently true.
   */
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  assert.equal(
    t.renderPartnerNotification.length,
    ctx.renderInternalNotification.length,
    'the internal renderer must be passed through unwrapped, with no locale parameter',
  );
  assert.equal(t.renderQrDigest, ctx.renderQrDigest, 'the QR digest must be passed through unwrapped');
});

test('QR acknowledgement is unaffected by the website audit sets', () => {
  // The audit sets define only the two website templates. QR must not change shape or copy.
  const { ctx, sets } = ctxWithAudit();
  const withAudit = ctx.realTemplates(sets);
  const plain = ctx.realTemplates();
  const contact = { fullName: 'Dana Ruiz', email: 'dana@example.com' };

  for (const code of ['en', ...AUDIT_LOCALES]) {
    assert.deepEqual(
      withAudit.renderQrAcknowledgement(contact, config(), code),
      plain.renderQrAcknowledgement(contact, config()),
      `QR mail changed for ${code}`,
    );
  }
});

/* ── Structural parity and safety ─────────────────────────────────────────── */

test('every audit rendering keeps plain-text and HTML parity', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);

  for (const code of AUDIT_LOCALES) {
    for (const got of [
      t.renderAcknowledgement(lead(), config(), code),
      t.renderBookingConfirmation(lead(), booking(), config(), code),
    ]) {
      assert.ok(got.textBody.length > 0, `${code} has no plain-text body`);
      assert.ok(got.htmlBody.includes('<html'), `${code} has no HTML body`);
      assert.ok(got.subject.length > 0, `${code} has no subject`);
      assert.ok(!/�/.test(got.htmlBody), `${code} HTML contains a replacement character`);
      assert.ok(!/�/.test(got.textBody), `${code} text contains a replacement character`);
    }
  }
});

test('escaping survives translation for a hostile name', () => {
  /*
   * The substitution works on already-escaped output. This proves it cannot reintroduce raw
   * markup: a name containing a tag must stay escaped in every locale.
   */
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  const hostile = lead({ fullName: '<script>alert(1)</script> Ruiz' });

  for (const code of ['en', ...AUDIT_LOCALES]) {
    const got = t.renderAcknowledgement(hostile, config(), code);
    assert.ok(!got.htmlBody.includes('<script>'), `${code} emitted a raw script tag`);
  }
});

test('a missing recipient address is refused identically in every locale', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  for (const code of ['en', ...AUDIT_LOCALES]) {
    const got = t.renderAcknowledgement({ fullName: 'Dana Ruiz' }, config(), code);
    assert.equal(got.ok, false, `${code} must refuse a lead with no address`);
    assert.equal(got.reason, 'no_recipient_address');
  }
});

test('an unconfirmed booking is refused identically in every locale', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  for (const code of ['en', ...AUDIT_LOCALES]) {
    const got = t.renderBookingConfirmation(lead(), booking({ status: 'pending' }), config(), code);
    assert.equal(got.ok, false, `${code} must refuse an unconfirmed booking`);
    assert.equal(got.reason, 'booking_not_confirmed');
  }
});

test('the general-inquiry pathway localises too, not only the proposal pathway', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  const inquiry = lead({ pathway: 'general_inquiry', topic: 'other' });

  for (const code of AUDIT_LOCALES) {
    const got = t.renderAcknowledgement(inquiry, config(), code);
    assert.equal(got.ok, true);
    assert.deepEqual(got.untranslatedPhrases, [], `${code} left English in the inquiry mail`);
    assert.ok(!got.textBody.includes('We have your message'), `${code} kept the English subject`);
  }
});

test('a lead with no name localises the unnamed greeting', () => {
  // Both templates branch on the presence of a first name. The unnamed branch is easy to miss.
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  const anon = lead({ fullName: '' });

  for (const code of AUDIT_LOCALES) {
    const ack = t.renderAcknowledgement(anon, config(), code);
    assert.deepEqual(ack.untranslatedPhrases, [], `${code} left English in the unnamed greeting`);
    assert.ok(!ack.textBody.includes('Thank you.'), `${code} kept the English greeting`);

    const conf = t.renderBookingConfirmation(anon, booking(), config(), code);
    assert.deepEqual(conf.untranslatedPhrases, [], `${code} left English in the unnamed headline`);
  }
});

/* ── The audit sets are what they claim to be ─────────────────────────────── */

test('the audit sets cover exactly the eight unreviewed locales', () => {
  assert.deepEqual(AUDIT_LOCALES.sort(), ['es', 'gu', 'hi', 'pa', 'ur', 'vi', 'zh-Hans', 'zh-Hant'].sort());
  assert.ok(!AUDIT_LOCALES.includes('en'), 'English is not an audit candidate');
});

test('every audit rendering is labelled as an audit candidate', () => {
  // So nothing downstream can mistake one for reviewed output.
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);
  for (const code of AUDIT_LOCALES) {
    assert.equal(t.renderAcknowledgement(lead(), config(), code).auditCandidate, true);
    assert.equal(t.renderBookingConfirmation(lead(), booking(), config(), code).auditCandidate, true);
  }
  assert.equal(t.renderAcknowledgement(lead(), config(), 'en').auditCandidate, undefined);
});

test('no unresolved placeholder survives into any rendered message', () => {
  /*
   * The named-greeting phrases carry a `{name}` slot. A table that used the placeholder in a
   * phrase reached by the unnamed branch would print the literal "{name}" to a reader.
   */
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);

  for (const who of [lead(), lead({ fullName: '' }), lead({ fullName: 'Dana Ruiz' })]) {
    for (const code of AUDIT_LOCALES) {
      for (const got of [
        t.renderAcknowledgement(who, config(), code),
        t.renderBookingConfirmation(who, booking(), config(), code),
      ]) {
        for (const field of ['subject', 'htmlBody', 'textBody']) {
          assert.ok(!got[field].includes('{name}'), `${code} left a placeholder in ${field}`);
        }
      }
    }
  }
});

test('each field keeps the content that belongs in it, and only that', () => {
  /*
   * The per-field presence check was replaced by a per-message one, so this pins what the
   * per-field version was accidentally asserting: the subject is the subject line and nothing
   * else, and both bodies carry the headline and the panel that the subject does not.
   */
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);

  for (const code of AUDIT_LOCALES) {
    const p = PHRASES[code];

    const conf = t.renderBookingConfirmation(lead(), booking(), config(), code);
    assert.ok(conf.subject.includes(p.bookSubject), `${code} subject is not the booking subject`);
    /*
     * The headline is the thing that must never reach the subject line. The panel title is not
     * usable for this check: in several locales it is a legitimate substring of the subject
     * ("Su llamada" inside "Su llamada está confirmada"), so asserting its absence would fail
     * on correct output.
     */
    assert.ok(
      !conf.subject.includes(p.bookHeadline),
      `${code} leaked the headline into the subject line`,
    );
    for (const body of [conf.htmlBody, conf.textBody]) {
      /*
       * Panel titles are compared case-insensitively because `textRule` uppercases a heading in
       * the plain-text body, so the panel reads "SU LLAMADA" there and "Su llamada" in the HTML.
       * That difference is the whole reason the substitution has to know about case at all.
       */
      const upper = body.toUpperCase();
      assert.ok(
        body.includes(p.bookHeadlineNamed.replace('{name}', 'Dana')),
        `${code} body lost the headline`,
      );
      assert.ok(upper.includes(p.bookPanel.toUpperCase()), `${code} body lost the panel title`);
      assert.ok(upper.includes(p.rowWhen.toUpperCase()), `${code} body lost the "when" row label`);
    }

    const ack = t.renderAcknowledgement(lead(), config(), code);
    assert.ok(ack.subject.includes(p.ackSubjectProperty), `${code} proposal subject is wrong`);
    assert.ok(
      !ack.subject.includes(p.ackSubjectMessage),
      `${code} used the inquiry subject on a proposal`,
    );
  }
});

/**
 * Whole-word absence.
 *
 * A plain `includes` is wrong for short labels: the Spanish for "Format" is "Formato", which
 * contains "Format", so a substring check reports a correct translation as an untranslated
 * one. Only a whole-word match means the English label actually survived.
 */
function lacksWord(text, word) {
  return !new RegExp(`\\b${word}\\b`).test(text);
}

test('the booking row labels are translated, not left in English', () => {
  // These were defined in the phrase tables but not wired into the plan in the first version.
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);

  for (const code of AUDIT_LOCALES) {
    const got = t.renderBookingConfirmation(lead(), booking(), config(), code);
    const p = PHRASES[code];
    for (const english of ['When', 'Format', 'Length']) {
      assert.ok(lacksWord(got.textBody, english), `${code} kept the English row label "${english}"`);
    }
    for (const translated of [p.rowWhen, p.rowFormat, p.rowLength]) {
      assert.ok(got.textBody.includes(translated), `${code} is missing the label "${translated}"`);
    }
  }
});

test('the acknowledgement row labels are translated too', () => {
  const { ctx, sets } = ctxWithAudit();
  const t = ctx.realTemplates(sets);

  for (const code of AUDIT_LOCALES) {
    const got = t.renderAcknowledgement(lead(), config(), code);
    const p = PHRASES[code];
    for (const english of ['Property or portfolio', 'Ownership group', 'Service interest', 'Timing']) {
      assert.ok(lacksWord(got.textBody, english), `${code} kept the English row label "${english}"`);
    }
    for (const translated of [p.rowPropertyOrPortfolio, p.rowOwnershipGroup, p.rowTiming]) {
      assert.ok(got.textBody.includes(translated), `${code} is missing the label "${translated}"`);
    }
  }
});

test('a stale phrase table fails loudly instead of half-translating', () => {
  /*
   * The regression this file most needs to survive. If someone edits an English phrase in
   * Templates.js and a locale table still names the old wording, an unchecked replace would
   * quietly send a message that is English in one place and translated everywhere else. This
   * proves it throws instead.
   */
  const ctx = load();
  const broken = auditVisitorTemplateSets({
    renderWebsiteAcknowledgement: () => ({
      ok: true,
      subject: 'Some other subject',
      htmlBody: '<html>nothing familiar</html>',
      textBody: 'nothing familiar',
    }),
    renderBookingConfirmation: ctx.renderBookingConfirmation,
  });

  assert.throws(
    () => broken.es.renderAcknowledgement(lead(), config()),
    /expected phrase not found/,
    'a phrase that no longer exists must throw, not pass through',
  );
});
