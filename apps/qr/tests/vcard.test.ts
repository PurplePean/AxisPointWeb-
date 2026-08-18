import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContactCard,
  buildPartnerRecord,
  contactFilename,
  saveActionLabel,
} from '../src/useSaveContact';
import { FIRM, PARTNERS, type PartnerProfile } from '../src/profiles';

/*
 * THE CONTACT FILES. THERE ARE TWO OF THEM, AND EACH HOLDS EXACTLY ONE RECORD.
 *
 * WHAT CHANGED, AND WHY THESE TESTS CHANGED WITH IT. Between 2026-08-17 and 2026-08-18 the
 * card had ONE Save action producing ONE file containing TWO records, and this file asserted
 * that shape. Real-device testing then established that the shape cannot work on this app's
 * delivery path: iOS Safari ignores the `download` attribute on a `blob:` URL, never
 * recognises the payload as a named `.vcf`, and so never offers the "Add All 2 Contacts"
 * import flow — it shows a single-item Quick Look preview instead. The bytes were never the
 * problem, which is exactly why the previous assertions all passed while the feature did not
 * work.
 *
 * The owner-directed answer is two separate save actions, one per partner, each delivering a
 * single-record file. Single-record delivery over this path is the proven case: it is what
 * this project shipped for its entire life before the collapse. The central assertion in this
 * file is therefore that **each generated file contains exactly one VCARD block** — not two,
 * and not one plus a stray terminator.
 *
 * WHAT THESE TESTS STILL CANNOT DO, STATED PLAINLY. They pin the BYTES of each file. They say
 * nothing about what a handset does with one. Real-device import is tracked in
 * `docs/STATUS.md`; no assertion here closes it.
 *
 * VERSION IS 3.0 DELIBERATELY. vCard 3.0 (RFC 2426) is what consumer contact apps import most
 * reliably; 4.0 (RFC 6350) support is uneven across exactly those apps. The grammar, escaping,
 * folding, CRLF terminators, and property ordering asserted below are common to both
 * specifications; only the version token differs.
 */

/** One file per partner, built exactly as the hook builds it. */
const files = PARTNERS.map((partner) => ({ partner, card: buildContactCard(partner) }));

/** Recovers folded values: RFC 2426 unfolding removes a CRLF followed by one space. */
const unfold = (text: string) => text.replace(/\r\n /g, '');

/* ── The point of the change: exactly one record per file ─────────────────── */

test('each generated file contains exactly one VCARD block', () => {
  /*
   * THE ASSERTION THIS WHOLE CHANGE EXISTS FOR. A second record in either file puts iOS
   * Safari back into the single-item preview that cannot import both people, and it would do
   * so silently. BEGIN and END are counted separately: a file with one BEGIN and two ENDs is
   * malformed in a way that counting only one of them would miss.
   */
  for (const { partner, card } of files) {
    assert.equal(card.split('BEGIN:VCARD').length - 1, 1, `${partner.displayName}: one BEGIN:VCARD`);
    assert.equal(card.split('END:VCARD').length - 1, 1, `${partner.displayName}: one END:VCARD`);
  }
});

test('there are exactly two files, one per partner, and no combined file', () => {
  assert.equal(files.length, 2);
  const names = files.map(({ card }) => /^FN:(.*)$/m.exec(card)?.[1]);
  assert.deepEqual(names, ['Zachary Russell', 'Ethaniel Vu']);
});

test('no file carries a combined or firm-level record', () => {
  /*
   * The explicit decision, unchanged by the split: a visitor's address book gets the people
   * they met, not an organization stub they did not ask for. Asserting on FN is what catches a
   * firm record being added back, since a firm entry would carry the org name as its FN.
   */
  for (const { partner, card } of files) {
    const fns = card.split('\r\n').filter((l) => l.startsWith('FN:'));
    assert.deepEqual(fns, [`FN:${partner.displayName}`]);
    assert.equal(fns.includes(`FN:${FIRM.name}`), false, 'a firm-level record must not be written');
  }
});

test('the files are built from the partner list rather than from a hardcoded pair', () => {
  // A third partner joining the firm must be a data change, not a code change: one more entry
  // in PARTNERS is one more file, with no edit here or in the builder.
  assert.equal(files.length, PARTNERS.length);
  const extra = buildContactCard({ ...PARTNERS[0], key: 'third', displayName: 'Dana Ruiz' });
  assert.equal(extra.split('END:VCARD').length - 1, 1);
  assert.ok(extra.includes('FN:Dana Ruiz'));
});

/* ── Structure each file must have ────────────────────────────────────────── */

test('every file opens and closes correctly, with VERSION immediately after BEGIN', () => {
  for (const { card } of files) {
    const lines = card.split('\r\n').filter((l) => l !== '');
    assert.equal(lines[0], 'BEGIN:VCARD');
    // Both specifications require VERSION to be the line straight after BEGIN.
    assert.equal(lines[1], 'VERSION:3.0');
    assert.equal(lines[lines.length - 1], 'END:VCARD');
  }
});

test('every file carries the required FN property exactly once', () => {
  for (const { card } of files) {
    const fn = card.split('\r\n').filter((l) => l.startsWith('FN:'));
    assert.equal(fn.length, 1, 'FN is the one property both specifications require');
    assert.notEqual(fn[0], 'FN:', 'FN must not be empty');
  }
});

test('lines are CRLF terminated and each file ends with one', () => {
  for (const { card } of files) {
    // A lone LF is a common way to produce a file that some parsers accept and others reject.
    assert.equal(/[^\r]\n/.test(card), false, 'every LF must be preceded by CR');
    // Some parsers drop a final record whose END:VCARD is not newline-terminated.
    assert.equal(card.endsWith('END:VCARD\r\n'), true);
  }
});

/* ── Folding, which the approved organization note made necessary ─────────── */

test('no physical line exceeds the 75-octet limit', () => {
  for (const { card } of files) {
    for (const line of card.split('\r\n')) {
      assert.ok(
        Buffer.byteLength(line, 'utf8') <= 75,
        `line exceeds the 75-octet limit and was not folded: ${line}`,
      );
    }
  }
});

test('the organization note is folded, and unfolding recovers it exactly', () => {
  /*
   * `NOTE:` plus the approved sentence is 91 octets escaped, so it MUST fold. This asserts
   * both halves of that: the file really is folded (a continuation line exists), and an
   * unfolding parser gets the owner's sentence back character for character rather than a
   * sentence with a space injected into it.
   */
  assert.ok(FIRM.organizationNote, 'precondition: the note is approved and set');
  const escaped = FIRM.organizationNote.replace(/,/g, '\\,');

  for (const { card } of files) {
    assert.ok(/\r\n [^ ]/.test(card), 'a folded continuation line must be present');
    assert.equal(card.includes(`NOTE:${escaped}`), false, 'the long NOTE line must not be emitted whole');
    assert.ok(unfold(card).includes(`NOTE:${escaped}`), 'unfolding must recover the exact note');
  }
});

test('every continuation line begins with exactly one space', () => {
  // The unfolding rule is CRLF + one space. Two spaces would silently add one to the value.
  for (const { card } of files) {
    for (const line of card.split('\r\n')) {
      if (line.startsWith(' ')) assert.equal(line.startsWith('  '), false, `double-space fold: ${line}`);
    }
  }
});

test('a short value is left alone rather than folded', () => {
  // Folding is for lines that need it. An unconditional fold would break parsers that unfold
  // strictly, and would make every record larger for no reason.
  for (const { card } of files) assert.ok(card.includes('\r\nVERSION:3.0\r\n'));
});

/* ── The values, which must be the owner-confirmed ones and nothing else ──── */

test("each file carries its own partner's confirmed direct email and phone", () => {
  for (const { partner, card } of files) {
    assert.ok(card.includes(`EMAIL;TYPE=WORK:${partner.email}`), `${partner.displayName} email`);
    assert.ok(card.includes(`TEL;TYPE=WORK,VOICE:${partner.phone?.display}`), `${partner.displayName} phone`);
  }
});

test("one partner's details never appear in the other's file", () => {
  /*
   * Cross-contamination is the failure a per-partner builder actually has: both files built
   * from one profile, or a file that kept the other record. Names, addresses, and numbers are
   * all checked, because a leak of any one of them puts the wrong person in an address book.
   */
  const [zach, ethaniel] = files;

  assert.equal(zach.card.includes('Ethaniel'), false);
  assert.equal(zach.card.includes('ethaniel@axispoint.llc'), false);
  assert.equal(zach.card.includes(PARTNERS[1].phone!.display), false);

  assert.equal(ethaniel.card.includes('Zachary'), false);
  assert.equal(ethaniel.card.includes('zach@axispoint.llc'), false);
  assert.equal(ethaniel.card.includes(PARTNERS[0].phone!.display), false);
});

test('N splits the display name into family and given components', () => {
  assert.ok(files[0].card.includes('N:Russell;Zachary;;;'));
  assert.ok(files[1].card.includes('N:Vu;Ethaniel;;;'));
});

test('both partners are titled Partner and carry the firm as ORG', () => {
  for (const { card } of files) {
    assert.ok(card.includes('TITLE:Partner'));
    assert.ok(card.includes(`ORG:${FIRM.name}`));
  }
});

test('the URL falls back to the firm site while the profile URL is unresolved', () => {
  // Never a placeholder: an unresolved value writes the firm address, not a broken link.
  for (const { card } of files) assert.ok(card.includes(`URL:${FIRM.websiteUrl}`));
});

test('only the locality is written, never a street address', () => {
  for (const { card } of files) assert.ok(card.includes('ADR;TYPE=WORK:;;;Houston;TX;;USA'));
});

test('the approved organization note is written into both records', () => {
  // Owner-approved wording, 2026-08-18. Both records carry the same firm-level sentence.
  assert.equal(
    FIRM.organizationNote,
    'Property management for multifamily and retail owners across Texas, based in Houston.',
  );
  for (const { card } of files) assert.ok(unfold(card).includes('NOTE:Property management for multifamily'));
});

/* ── The two files are two files, all the way down to their names ─────────── */

test('each partner is offered a filename naming that partner', () => {
  assert.equal(contactFilename(PARTNERS[0]), 'AxisPoint-Zachary-Russell.vcf');
  assert.equal(contactFilename(PARTNERS[1]), 'AxisPoint-Ethaniel-Vu.vcf');
});

test('the two filenames differ, so one download cannot overwrite the other', () => {
  const names = new Set(PARTNERS.map(contactFilename));
  assert.equal(names.size, PARTNERS.length);
  // The combined name belonged to the two-record file and must not come back with it.
  assert.equal(names.has('AxisPoint-Partners.vcf'), false);
});

test('a filename carries no spaces, which some browsers mangle in a download attribute', () => {
  for (const partner of PARTNERS) assert.equal(/\s/.test(contactFilename(partner)), false);
});

test('each save action names its partner, and the two labels differ', () => {
  assert.equal(saveActionLabel(PARTNERS[0]), "Save Zachary's contact");
  assert.equal(saveActionLabel(PARTNERS[1]), "Save Ethaniel's contact");
  assert.notEqual(saveActionLabel(PARTNERS[0]), saveActionLabel(PARTNERS[1]));
});

/* ── Missing-data rules, still enforced though currently unreachable ──────── */

test('a null phone omits the TEL line entirely rather than writing a placeholder', () => {
  const noPhone: PartnerProfile = { ...PARTNERS[0], phone: null };
  const record = buildPartnerRecord(noPhone);
  assert.equal(record.includes('TEL'), false);
  // The rest of the record is unaffected: an omission, not a degraded card.
  assert.ok(record.includes('FN:Zachary Russell'));
  assert.ok(record.includes(`EMAIL;TYPE=WORK:${PARTNERS[0].email}`));
});

test('a null email falls back to the one approved firm inbox', () => {
  const noEmail: PartnerProfile = { ...PARTNERS[0], email: null };
  const record = buildPartnerRecord(noEmail);
  assert.ok(record.includes(`EMAIL;TYPE=WORK:${FIRM.email}`));
});

/* ── Escaping, so a real value can never break a file ─────────────────────── */

test('commas, semicolons, and backslashes in a value are escaped, not left structural', () => {
  /*
   * Not a hypothetical: a name like "Smith, Jr." or the approved organization note, which has
   * a comma in it, would otherwise split one property value into two and a device would import
   * a mangled contact. The backslash case checks the escapes are not themselves re-escaped.
   */
  const awkward: PartnerProfile = {
    ...PARTNERS[0],
    displayName: 'Ada Lovelace, Jr.',
    email: 'ada@example.com',
  };
  const record = buildPartnerRecord(awkward);
  assert.ok(record.includes('FN:Ada Lovelace\\, Jr.'));
  assert.equal(record.includes('FN:Ada Lovelace, Jr.'), false);

  const semi = buildPartnerRecord({ ...PARTNERS[0], displayName: 'Ann; Drop' });
  assert.ok(semi.includes('FN:Ann\\; Drop'));

  const slash = buildPartnerRecord({ ...PARTNERS[0], displayName: 'A\\B' });
  assert.ok(slash.includes('FN:A\\\\B'));
});

test('a value containing a newline cannot terminate a line early', () => {
  /*
   * The worst case: an unescaped newline would end the property and let the rest of the value
   * be read as its own line, here a second END:VCARD that truncates the record.
   *
   * The assertion counts LINES that are exactly the terminator, not occurrences of the
   * substring. The escaped text still contains the characters "END:VCARD" inside FN and N,
   * which is harmless precisely because they are no longer at the start of a line.
   */
  const record = buildPartnerRecord({ ...PARTNERS[0], displayName: 'Ann\nEND:VCARD' });
  const terminators = record.split('\r\n').filter((l) => l === 'END:VCARD');
  assert.equal(terminators.length, 1, 'only the real terminator may occupy a line');
  assert.ok(record.includes('FN:Ann\\nEND:VCARD'));
});

test('a very long value folds without losing or inventing a character', () => {
  // The folding path applied to a value long enough to need several continuation lines, so a
  // budget-arithmetic error shows up as a changed value rather than only as a long line.
  const long = 'Wilhelmina Featheringstonehaugh-Montmorency of the Greater Houston Metropolitan Area';
  const record = buildPartnerRecord({ ...PARTNERS[0], displayName: long });
  for (const line of record.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `unfolded long line: ${line}`);
  }
  assert.ok(unfold(record).includes(`FN:${long}`));
});
