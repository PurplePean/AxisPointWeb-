import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildContactCard, buildPartnerRecord, CONTACT_FILENAME } from '../src/useSaveContact';
import { FIRM, PARTNERS, type PartnerProfile } from '../src/profiles';

/*
 * THE CONTACT FILE, WHICH HAD NO TESTS AT ALL UNTIL NOW.
 *
 * `buildContactCard` writes the only artifact this app hands to a visitor's operating
 * system, and it was completely uncovered while it produced one record. The owner-directed
 * single-page collapse of 2026-08-17 made it produce TWO, which is exactly the change worth
 * having assertions under: a multi-record file is where a record silently goes missing.
 *
 * WHAT THESE TESTS CANNOT DO, STATED PLAINLY SO NOBODY READS THEM AS MORE THAN THEY ARE.
 * They pin the BYTES of the file. They say nothing about whether a real iPhone or a real
 * Android handset imports it, or imports both records rather than only the first. That
 * delivery path, a synthetic anchor click on a `blob:` URL, has never been exercised on a
 * real device even for the single-record case. It is an outstanding manual verification,
 * recorded in `docs/STATUS.md`, and no amount of assertion in this file closes it.
 *
 * VERSION IS 3.0 DELIBERATELY. vCard 3.0 (RFC 2426) is what consumer contact apps import
 * most reliably; 4.0 (RFC 6350) support is uneven across exactly those apps, and real-device
 * import is already the open risk here. The grammar, escaping, CRLF terminators, and
 * property ordering asserted below are common to both specifications; only the version token
 * differs. Changing it is a one-line change if the owner decides otherwise.
 */

const card = buildContactCard();
const records = card.split('BEGIN:VCARD').slice(1).map((r) => 'BEGIN:VCARD' + r);

/* ── Exactly two records, one per partner, and no third ───────────────────── */

test('the file contains exactly two records, one per partner', () => {
  assert.equal(records.length, 2);
  assert.equal(card.split('END:VCARD').length - 1, 2);
  // The device prompt the owner is expecting ("Add 2 Contacts") is driven by this count.
  assert.equal(PARTNERS.length, 2);
});

test('there is no third combined or firm-level record', () => {
  /*
   * The explicit decision: a visitor's address book gets the two people they met, not two
   * people plus an organization stub they did not ask for. Asserting on FN is what catches a
   * firm record being added back, since a firm entry would carry the org name as its FN.
   */
  const names = records.map((r) => /^FN:(.*)$/m.exec(r)?.[1]);
  assert.deepEqual(names, ['Zachary Russell', 'Ethaniel Vu']);
  assert.equal(names.includes(FIRM.name), false, 'a firm-level record must not be written');
});

test('records appear in the same order the page lists the partners', () => {
  const names = records.map((r) => /^FN:(.*)$/m.exec(r)?.[1]);
  assert.deepEqual(names, PARTNERS.map((p) => p.displayName));
});

/* ── Structure each record must have ──────────────────────────────────────── */

test('every record opens and closes correctly, with VERSION immediately after BEGIN', () => {
  for (const record of records) {
    const lines = record.split('\r\n').filter((l) => l !== '');
    assert.equal(lines[0], 'BEGIN:VCARD');
    // Both specifications require VERSION to be the line straight after BEGIN.
    assert.equal(lines[1], 'VERSION:3.0');
    assert.equal(lines[lines.length - 1], 'END:VCARD');
  }
});

test('every record carries the required FN property exactly once', () => {
  for (const record of records) {
    const fn = record.split('\r\n').filter((l) => l.startsWith('FN:'));
    assert.equal(fn.length, 1, 'FN is the one property both specifications require');
    assert.notEqual(fn[0], 'FN:', 'FN must not be empty');
  }
});

test('lines are CRLF terminated and the file ends with one', () => {
  // A lone LF is a common way to produce a file that some parsers accept and others reject.
  assert.equal(/[^\r]\n/.test(card), false, 'every LF must be preceded by CR');
  // Some parsers drop a final record whose END:VCARD is not newline-terminated.
  assert.equal(card.endsWith('END:VCARD\r\n'), true);
});

test('no line exceeds the 75-octet limit, so no folding is required', () => {
  /*
   * Both specifications fold longer lines. This builder deliberately does not implement
   * folding, which is only safe while every line it can emit stays under the limit. If a
   * future value pushes past it, this test fails and folding has to be written rather than
   * a too-long line shipping silently.
   */
  for (const line of card.split('\r\n')) {
    assert.ok(
      Buffer.byteLength(line, 'utf8') <= 75,
      `line exceeds the 75-octet limit and would need folding: ${line}`,
    );
  }
});

/* ── The values, which must be the owner-confirmed ones and nothing else ──── */

test("each record carries its own partner's confirmed direct email and phone", () => {
  for (const [i, partner] of PARTNERS.entries()) {
    const record = records[i];
    assert.ok(record.includes(`EMAIL;TYPE=WORK:${partner.email}`), `${partner.displayName} email`);
    assert.ok(record.includes(`TEL;TYPE=WORK,VOICE:${partner.phone?.display}`), `${partner.displayName} phone`);
  }
});

test("one partner's details never leak into the other's record", () => {
  // The failure a two-record builder actually has: both records built from one profile.
  assert.equal(records[0].includes('ethaniel@axispoint.llc'), false);
  assert.equal(records[1].includes('zach@axispoint.llc'), false);
});

test('N splits the display name into family and given components', () => {
  assert.ok(records[0].includes('N:Russell;Zachary;;;'));
  assert.ok(records[1].includes('N:Vu;Ethaniel;;;'));
});

test('both partners are titled Partner and carry the firm as ORG', () => {
  for (const record of records) {
    assert.ok(record.includes('TITLE:Partner'));
    assert.ok(record.includes(`ORG:${FIRM.name}`));
  }
});

test('the URL falls back to the firm site while the profile URL is unresolved', () => {
  // Never a placeholder: an unresolved value writes the firm address, not a broken link.
  for (const record of records) assert.ok(record.includes(`URL:${FIRM.websiteUrl}`));
});

test('only the locality is written, never a street address', () => {
  for (const record of records) assert.ok(record.includes('ADR;TYPE=WORK:;;;Houston;TX;;USA'));
});

test("the unapproved organization note is not written into anybody's contacts", () => {
  assert.equal(FIRM.organizationNote, null, 'precondition: the note is still unapproved');
  assert.equal(card.includes('NOTE:'), false);
});

test('the download filename names the firm, not either partner', () => {
  assert.equal(CONTACT_FILENAME, 'AxisPoint-Partners.vcf');
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

/* ── Escaping, so a real value can never break the file ───────────────────── */

test('commas, semicolons, and backslashes in a value are escaped, not left structural', () => {
  /*
   * Not a hypothetical: a name like "Smith, Jr." or an approved organization note with a
   * comma in it would otherwise split one property value into two, and a device would import
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
   * The worst case: an unescaped newline would end the property and let the rest of the
   * value be read as its own line, here a second END:VCARD that truncates the record.
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

/* ── The builder is honest about its input ────────────────────────────────── */

test('building from a custom list produces one record per entry', () => {
  // Pins the count to the list rather than to a hardcoded two, so a third partner joining
  // the firm is a data change and not a code change.
  assert.equal(buildContactCard([PARTNERS[0]]).split('END:VCARD').length - 1, 1);
  assert.equal(buildContactCard([...PARTNERS, PARTNERS[0]]).split('END:VCARD').length - 1, 3);
});
