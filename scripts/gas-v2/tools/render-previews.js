'use strict';

/*
 * Renders every approved specimen to disk for visual review.
 *
 * WHY THIS EXISTS. A template test proves a rule ("the phone row is omitted"). It cannot
 * prove the email looks right at 320px with images off. This tool produces the real
 * production output, from the real renderer, with fake configuration and fake records, so
 * a human can look at it.
 *
 * WHAT IT DOES NOT DO. It sends nothing, reads nothing from Google, and touches no
 * repository file. Output goes to a directory you name, which should be outside the repo.
 *
 * WHAT IT CANNOT TELL YOU. A browser is not an email client. Gmail strips the head,
 * Outlook renders through Word, iOS Mail applies its own dark transform, and none of that
 * is reproduced here. These previews verify structure, content, escaping, and reflow. They
 * are NOT evidence that any real client renders correctly, and this pass makes no such
 * claim. See docs/backend-v2-contract.md.
 *
 *   node scripts/gas-v2/tools/render-previews.js <outdir>
 */

const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../tests/helpers/load.js');

const ctx = load();

const OUT = process.argv[2];
if (!OUT) {
  process.stderr.write('usage: node scripts/gas-v2/tools/render-previews.js <outdir>\n');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

/* ── Fake configuration. Every value is obviously not real. ───────────────── */

function config(overrides = {}) {
  return {
    replyTo: 'reply@example.test',
    fromName: 'AxisPoint Partners',
    partnerDirectEmail: {
      zachary_russell: 'zachary@example.test',
      ethaniel_vu: 'ethaniel@example.test',
    },
    partnerDirectPhone: {
      zachary_russell: '(555) 010-0001',
      ethaniel_vu: '(555) 010-0002',
    },
    firmEmail: 'info@example.test',
    firmPhone: '',
    websiteUrl: 'example.test',
    logoUrl: '',
    partnerEmailMap: { zachary_russell: 'zachary@example.test', ethaniel_vu: 'ethaniel@example.test' },
    partnerNotifyTo: ['firm@example.test'],
    offsetResolver: () => -300,
    ...overrides,
  };
}

/* ── Fake records ─────────────────────────────────────────────────────────── */

function qrLead(o = {}) {
  return {
    leadId: 'preview-lead',
    submissionKind: 'contact_exchange',
    fullName: 'Dana Whitfield',
    email: 'dana@example.test',
    phone: '(555) 010-0198',
    organization: 'Whitfield Holdings',
    roleOrTitle: 'Managing Director',
    contactCategory: 'property_owner_operator',
    acquisitionSource: 'zachary_russell',
    preferredFollowUpLocale: 'en',
    receivedAt: '2026-08-01T21:12:00.000Z',
    ...o,
  };
}

function inquiryLead(o = {}) {
  return {
    leadId: 'preview-inquiry',
    submissionKind: 'service_inquiry',
    pathway: 'management_proposal',
    serviceScope: 'pm',
    propertyType: 'multifamily',
    propertyScope: 'one_property',
    propertyLocation: 'Houston, Texas',
    propertyScale: '184 units',
    propertyScaleUnknown: false,
    situationCurrent: 'replace_current_management',
    situationTiming: 'within_30_days',
    situationNotes: 'Current manager has missed two monthly reporting deadlines.',
    fullName: 'Dana Whitfield',
    email: 'dana@example.test',
    phone: '(555) 010-0198',
    organization: 'Whitfield Holdings',
    preferredFollowUpLocale: 'es',
    sourceCategory: 'website',
    landingPage: 'https://example.test/property-management',
    slaDueAt: '2026-08-04T22:00:00.000Z',
    ownerPartner: '',
    possibleMatches: '',
    ...o,
  };
}

function digestRecord(i, o = {}) {
  return {
    submissionId: `s-${i}`,
    name: o.name || `Person ${i}`,
    org: o.org || 'Example Holdings · Principal',
    category: o.category || 'Property Owner or Operator',
    email: o.email === undefined ? `person${i}@example.test` : o.email,
    phone: o.phone === undefined ? '(555) 010-01' + String(i).padStart(2, '0') : o.phone,
    // Built through the production formatter rather than by hand, so a specimen can
    // never show a time the real renderer would not produce.
    collected: ctx.formatCollected(
      new Date(Date.UTC(2026, 7, 1, 14 + (i % 8), (i * 7) % 60)).toISOString(),
      { offsetResolver: () => -300 },
    ),
    gatheredThrough: o.gatheredThrough || 'Zachary Russell',
    currentOwner: o.currentOwner || 'Unassigned',
    followUp: 'Not contacted',
    matchNote: o.matchNote || '',
  };
}

function digestModel(groups, o = {}) {
  const records = groups.flatMap((g) => g.records);
  const counts = [];
  const seen = {};
  records.forEach((r) => {
    if (seen[r.category] === undefined) { seen[r.category] = counts.length; counts.push({ label: r.category, count: 0 }); }
    counts[seen[r.category]].count += 1;
  });
  return {
    groups,
    counts,
    windowLine: 'Collected Aug 1, 8:00 AM through Aug 2, 8:00 AM Central.',
    totalCount: records.length,
    partIndex: o.partIndex || 1,
    partCount: o.partCount || 1,
  };
}

const zGroup = (records) => ({
  key: 'zachary_russell',
  title: 'Gathered through Zachary Russell',
  sub: 'Acquisition attribution only. Ownership is unchanged.',
  records,
});
const firmGroup = (records) => ({
  key: 'firm',
  title: 'Gathered through AxisPoint Partners',
  sub: 'Shared section. This section is delivered to both partners.',
  records,
});
const unknownGroup = (records) => ({
  key: 'unknown',
  title: 'Gathered through Unknown',
  sub: 'The card did not resolve to a profile. Delivered to both partners.',
  records,
});

/* ── Specimens ────────────────────────────────────────────────────────────── */

const specimens = [];
const add = (name, note, rendered) => specimens.push({ name, note, rendered });

add('qr-ack-partner', 'QR acknowledgement, resolved partner card',
  ctx.renderQrAcknowledgement(qrLead(), config()));

add('qr-ack-firm-fallback', 'QR acknowledgement, card did not resolve',
  ctx.renderQrAcknowledgement(qrLead({ acquisitionSource: 'unknown' }), config()));

add('qr-ack-no-partner-phone', 'QR acknowledgement, unverified partner phone: row omitted',
  ctx.renderQrAcknowledgement(qrLead(), config({ partnerDirectPhone: {} })));

add('qr-ack-long-name', 'QR acknowledgement, long submitted display name',
  ctx.renderQrAcknowledgement(
    qrLead({ fullName: 'Dr. Margarethe Van Der Bergh-Whitfield' }), config()));

add('qr-ack-hostile-input', 'QR acknowledgement, hostile submitted name (escaping proof)',
  ctx.renderQrAcknowledgement(
    qrLead({ fullName: '<script>alert(1)</script>" onload="x' }), config()));

add('qr-ack-with-logo', 'QR acknowledgement, configured logo asset',
  ctx.renderQrAcknowledgement(qrLead(), config({ logoUrl: 'https://cdn.example.test/mark.png' })));

add('website-ack', 'Website inquiry acknowledgement, management proposal',
  ctx.renderWebsiteAcknowledgement(inquiryLead(), config()));

add('website-ack-minimal', 'Website inquiry acknowledgement, minimal information',
  ctx.renderWebsiteAcknowledgement(
    inquiryLead({ propertyScale: '', organization: '', situationTiming: '' }), config()));

add('internal-notification', 'Immediate internal website inquiry notification',
  ctx.renderInternalNotification(inquiryLead(), config()));

add('internal-notification-missing', 'Internal notification, missing optional information',
  ctx.renderInternalNotification(
    inquiryLead({ phone: '', organization: '', propertyScale: '', situationNotes: '' }), config()));

add('booking-confirmation', 'Booking confirmation, sent only after the calendar confirmed',
  ctx.renderBookingConfirmation(inquiryLead(), {
    status: 'confirmed',
    slotStart: '2026-08-12T15:30:00.000Z',
    durationMinutes: 30,
    mode: 'phone_call',
  }, config()));

add('digest-one-contact', 'Daily digest, one contact',
  ctx.renderQrDigest(digestModel([zGroup([digestRecord(1, { name: 'Dana Whitfield' })])]), config()));

add('digest-mixed', 'Daily digest, mixed contacts with an exact match and a phone-only record',
  ctx.renderQrDigest(digestModel([zGroup([
    digestRecord(1, { name: 'Dana Whitfield', org: 'Whitfield Holdings · Managing Director' }),
    digestRecord(2, { name: 'Marcus Bell', org: 'Bell Capital · Role not provided', phone: '', category: 'Investor or Capital Partner' }),
    digestRecord(3, { name: 'Priya Raman', org: 'Organization not provided', email: '', category: 'Broker or Real Estate Advisor' }),
    digestRecord(4, {
      name: 'Dana Whitfield',
      org: 'Whitfield Holdings · Managing Director',
      matchNote: 'An existing contact shares this email address. Nothing was merged, changed, or overwritten.',
    }),
  ])]), config()));

add('digest-shared-sections', 'Daily digest, firm fallback and unknown source shared sections',
  ctx.renderQrDigest(digestModel([
    firmGroup([digestRecord(5, { name: 'Alonzo Reyes', org: 'Reyes Mechanical Services · Owner', gatheredThrough: 'AxisPoint Partners', category: 'Service Provider or Vendor' })]),
    unknownGroup([digestRecord(6, { name: 'Tomas Iversen', org: 'Organization not provided', gatheredThrough: 'Unknown', phone: '', category: 'Other' })]),
  ]), config()));

add('digest-assigned-owner', 'Daily digest, a contact that has since been assigned',
  ctx.renderQrDigest(digestModel([zGroup([
    digestRecord(7, { name: 'Renata Cardoza', currentOwner: 'Ethaniel Vu' }),
  ])]), config()));

add('digest-long-values', 'Daily digest, long name, organization, and email address',
  ctx.renderQrDigest(digestModel([zGroup([
    digestRecord(8, {
      name: 'Dr. Margarethe Van Der Bergh-Whitfield',
      org: 'Van Der Bergh Family Holdings and Real Estate Partners, LLC · Managing Director of Portfolio Operations',
      email: 'margarethe.vanderbergh@vdbfamilyholdings-realestate.example',
      category: 'Property Management or Operations',
    }),
  ])]), config()));

const thirty = [];
for (let i = 1; i <= 30; i += 1) {
  thirty.push(digestRecord(i, {
    category: ['Property Owner or Operator', 'Investor or Capital Partner', 'Broker or Real Estate Advisor',
      'Service Provider or Vendor', 'Lender or Financial Professional', 'Property Management or Operations',
      'Other'][i % 7],
    email: i % 6 === 4 ? '' : undefined,
    phone: i % 4 === 1 ? '' : undefined,
  }));
}
// Packed and rendered by the PRODUCTION path, including its measure-and-repack loop, so
// a specimen can never show a part shape the real digest would not send. Splitting by
// hand here would have hidden the over-ceiling part this tool actually caught.
const thirtyRendered = ctx.packPartsWithinCeiling(
  digestModel([zGroup(thirty)]),
  { config: config() },
  { templates: ctx.realTemplates(), log: { append() {} } },
);
if (!thirtyRendered.ok) throw new Error('the thirty-contact digest could not be packed');

Array.from(thirtyRendered.parts).forEach((rendered, i) => {
  add(
    `digest-thirty-part-${i + 1}`,
    `Daily digest, thirty contacts from one event, part ${i + 1} of ${thirtyRendered.parts.length}`,
    rendered,
  );
});

/* ── Write files ──────────────────────────────────────────────────────────── */

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const rows = [];
specimens.forEach((s) => {
  if (!s.rendered || !s.rendered.ok) {
    throw new Error(`specimen ${s.name} failed to render: ${(s.rendered || {}).reason}`);
  }
  fs.writeFileSync(path.join(OUT, `${s.name}.html`), s.rendered.htmlBody);
  fs.writeFileSync(path.join(OUT, `${s.name}.txt`), s.rendered.textBody);
  rows.push({
    name: s.name,
    note: s.note,
    subject: s.rendered.subject,
    bytes: ctx.byteLength(s.rendered.htmlBody),
    textBytes: ctx.byteLength(s.rendered.textBody),
    html: s.rendered.htmlBody,
  });
});

/**
 * Contact sheet.
 *
 * Every specimen at 600, 390, and 320, plus an images-off column and a dark-mode
 * approximation. Each frame uses srcdoc, so the whole review is one self-contained file
 * with no external request of any kind.
 */
const WIDTHS = [600, 390, 320];

let index = `<!doctype html><html><head><meta charset="utf-8"><title>AxisPoint V2 email specimens</title>
<style>
 body{margin:0;background:#f2f0f6;font:14px/1.5 system-ui,sans-serif;color:#1C1628}
 header{padding:24px 28px;background:#fff;border-bottom:1px solid #ddd}
 h1{margin:0 0 6px;font-size:20px} .warn{color:#8a3b00;max-width:70ch}
 section{padding:24px 28px;border-bottom:1px solid #ddd}
 h2{font-size:16px;margin:0 0 2px} .meta{color:#666;font-size:12px;margin-bottom:14px}
 .row{display:flex;gap:20px;align-items:flex-start;overflow-x:auto;padding-bottom:8px}
 .cell{flex:0 0 auto} .cap{font-size:11px;color:#666;margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em}
 iframe{border:1px solid #ccc;background:#fff;height:760px}
 .noimg iframe{filter:grayscale(1)}
 .dark iframe{filter:invert(1) hue-rotate(180deg)}
 pre{white-space:pre-wrap;background:#fff;border:1px solid #ccc;padding:12px;font-size:12px;max-height:280px;overflow:auto}
</style></head><body>
<header>
 <h1>AxisPoint V2 email specimens</h1>
 <p class="meta">Rendered from the production renderer with fake configuration and fake records. No email was sent.</p>
 <p class="warn"><strong>Limits of this review.</strong> A browser is not an email client.
 Gmail strips the document head, Outlook renders through the Word engine, and iOS Mail and
 Android apply their own dark transforms. The dark column below is a CSS filter
 approximation, not a client dark mode. These frames verify structure, content, escaping,
 and reflow only. No real client has been tested.</p>
</header>`;

rows.forEach((r) => {
  index += `<section>
 <h2>${escAttr(r.note)}</h2>
 <div class="meta">${escAttr(r.name)} &middot; subject: ${escAttr(r.subject)} &middot; ${r.bytes} bytes HTML, ${r.textBytes} bytes text</div>
 <div class="row">`;
  WIDTHS.forEach((w) => {
    index += `<div class="cell"><div class="cap">${w}px</div>` +
      `<iframe width="${w}" srcdoc="${escAttr(r.html)}"></iframe></div>`;
  });
  index += `<div class="cell dark"><div class="cap">dark approximation, 600px</div>` +
    `<iframe width="600" srcdoc="${escAttr(r.html)}"></iframe></div>`;
  index += `</div></section>`;
});

fs.writeFileSync(path.join(OUT, 'index.html'), index + '</body></html>');

process.stdout.write(`wrote ${rows.length} specimens to ${OUT}\n`);
rows.forEach((r) => {
  process.stdout.write(`  ${r.name.padEnd(28)} ${String(r.bytes).padStart(6)} bytes html  ${String(r.textBytes).padStart(5)} bytes text\n`);
});
