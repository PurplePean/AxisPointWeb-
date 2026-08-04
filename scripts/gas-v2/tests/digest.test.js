'use strict';

/*
 * The daily internal QR Contact digest.
 *
 * WHAT THESE TESTS ARE FOR. Four failures here are silent and expensive.
 *
 *  - An empty digest that sends anyway. Partners learn to ignore the 8am email, and the
 *    day that mattered goes with the rest.
 *  - A Contact marked delivered when the email never arrived. It never appears in any
 *    later digest, and nobody ever finds out it existed.
 *  - Routing that reads as an assignment. A scan gave a partner a name, not a claim.
 *  - A digest that clips in Gmail. The clipped part is the part nobody reads.
 *
 * The last one is why splitting is tested at record granularity rather than by rendering
 * and eyeballing a size.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps, fakeMailService } = require('./helpers/fakes.js');

const ctx = load();

const Z = 'zachary-russell';
const E = 'ethaniel-vu';
const FIRM = 'axispoint-partners';

function seed(deps, n, slug, patch) {
  const parsed = ctx.parseEnvelope(JSON.stringify(fx.qrSubmission(n, slug, patch)));
  assert.equal(parsed.ok, true, `fixture should be valid: ${parsed.code || ''}`);
  return ctx.processSubmission(parsed.value, deps);
}

function run(deps) {
  return ctx.runDailyQrDigest(deps);
}

/* ── Nothing to send ──────────────────────────────────────────────────────── */

test('zero eligible contacts sends nothing at all', () => {
  const deps = buildDeps();
  const summary = run(deps);

  assert.equal(summary.skipped, 'no_eligible_contacts');
  assert.equal(deps.mail.sent.length, 0);
  assert.equal(deps.templates.digests.length, 0, 'nothing should even be rendered');
});

test('a website inquiry never enters the digest', () => {
  const deps = buildDeps();
  const parsed = ctx.parseEnvelope(JSON.stringify(fx.managementProposal()));
  ctx.processSubmission(parsed.value, deps);

  assert.equal(run(deps).skipped, 'no_eligible_contacts');
});

test('a suspected-spam contact is stored and excluded from the digest', () => {
  const deps = buildDeps();
  const result = seed(deps, 1, Z, { clientSignals: { honeypot: 'bot' } });

  assert.equal(deps.submissions.store.rows.length, 1, 'still stored');
  assert.equal(deps.contacts.store.rows.length, 1, 'contact still stored');
  assert.equal(deps.leads.store.rows.length, 0, 'a handshake is not a Lead');
  assert.equal(deps.deliveries.findBySubmissionId(result.submissionId).digestStatus, 'excluded_spam');
  assert.equal(run(deps).skipped, 'no_eligible_contacts');
});

/* ── Routing by acquisition attribution ───────────────────────────────────── */

test("a partner's own contacts go only to that partner", () => {
  const deps = buildDeps();
  seed(deps, 1, Z);
  seed(deps, 2, E);
  run(deps);

  const to = deps.mail.sent.map((m) => m.to).sort();
  assert.deepEqual(to, ['ev@example.test', 'zr@example.test']);

  const zachary = deps.mail.sent.find((m) => m.to === 'zr@example.test');
  const ethaniel = deps.mail.sent.find((m) => m.to === 'ev@example.test');
  assert.ok(zachary && ethaniel);

  const models = deps.templates.digests;
  assert.equal(models.length, 2);
  models.forEach((m) => assert.equal(m.total, 1, 'neither partner sees the other contact'));
});

test('a firm-card contact goes to both partners as a shared section', () => {
  const deps = buildDeps();
  seed(deps, 1, FIRM);
  run(deps);

  assert.equal(deps.mail.sent.length, 2);
  deps.templates.digests.forEach((m) => {
    assert.deepEqual(m.groups, ['firm']);
  });
});

test('an unresolved card slug goes to both partners in its own section', () => {
  // A card that did not resolve is evidence a printed card is wrong, and it must not be
  // hidden inside the firm section.
  const deps = buildDeps();
  seed(deps, 1, 'retired-partner');
  run(deps);

  assert.equal(deps.mail.sent.length, 2);
  deps.templates.digests.forEach((m) => {
    assert.deepEqual(m.groups, ['unknown']);
  });
});

test('a partner with own and shared contacts sees both, grouped separately', () => {
  const deps = buildDeps();
  seed(deps, 1, Z);
  seed(deps, 2, FIRM);
  seed(deps, 3, 'nope');
  run(deps);

  const zachary = deps.templates.digests.find((m) => m.total === 3);
  assert.ok(zachary);
  assert.deepEqual(zachary.groups, ['zachary_russell', 'firm', 'unknown']);
});

test('a partner with nothing attributed and nothing shared receives nothing', () => {
  const deps = buildDeps();
  seed(deps, 1, Z);
  run(deps);

  assert.equal(deps.mail.sent.length, 1);
  assert.equal(deps.mail.sent[0].to, 'zr@example.test');
});

/* ── Current owner is read live ───────────────────────────────────────────── */

test('current owner reads Unassigned at launch, for a partner-scanned contact too', () => {
  const deps = buildDeps();
  seed(deps, 1, Z);
  run(deps);

  assert.deepEqual(deps.templates.digests[0].owners, ['Unassigned']);
});

test('current owner is NOT hardcoded: an assigned contact prints its owner', () => {
  const deps = buildDeps();
  const result = seed(deps, 1, Z);

  // Somebody took ownership after intake. Attribution must not move.
  deps.contacts.updateContact({ contactId: result.contactId, ownerPartner: 'ethaniel_vu' });
  run(deps);

  assert.deepEqual(deps.templates.digests[0].owners, ['Ethaniel Vu']);
  assert.equal(deps.submissions.findBySubmissionId(result.submissionId).acquisitionSource, 'zachary_russell');
});

/* ── Delivery-bound state ─────────────────────────────────────────────────── */

test('contacts advance to delivered only after a successful send', () => {
  const deps = buildDeps();
  const result = seed(deps, 1, Z);
  run(deps);

  const row = deps.deliveries.findBySubmissionId(result.submissionId);
  assert.equal(row.digestStatus, 'delivered');
  assert.ok(row.digestDeliveredAt);
});

test('a failed send leaves the contact pending for the next run', () => {
  const deps = buildDeps({ mail: fakeMailService({ failTimes: 1 }) });
  const result = seed(deps, 1, Z);
  const summary = run(deps);

  assert.equal(summary.sent, 0);
  assert.equal(deps.deliveries.findBySubmissionId(result.submissionId).digestStatus, 'pending_digest');
});

test('a retry contains exactly the same contacts, not a second copy of a read day', () => {
  const mail = fakeMailService({ failTimes: 1 });
  const deps = buildDeps({ mail });
  const first = seed(deps, 1, Z);
  const second = seed(deps, 2, Z);

  run(deps);
  assert.equal(deps.deliveries.findBySubmissionId(first.submissionId).digestStatus, 'pending_digest');

  const retry = run(deps);
  assert.equal(retry.sent, 1);
  assert.equal(deps.templates.digests[deps.templates.digests.length - 1].total, 2);
  assert.equal(deps.deliveries.findBySubmissionId(first.submissionId).digestStatus, 'delivered');
  assert.equal(deps.deliveries.findBySubmissionId(second.submissionId).digestStatus, 'delivered');
});

test('a shared contact advances only when BOTH partners received it', () => {
  // Marking it delivered because one partner got it would hide it from the other forever.
  const deps = buildDeps();
  const shared = seed(deps, 1, FIRM);

  let sends = 0;
  const realSend = deps.mail.send.bind(deps.mail);
  deps.mail.send = (m) => {
    sends += 1;
    return sends === 2 ? { ok: false, reason: 'transient' } : realSend(m);
  };

  run(deps);
  assert.equal(deps.deliveries.findBySubmissionId(shared.submissionId).digestStatus, 'pending_digest');
});

test('one partner failing does not hold back the other partner own contacts', () => {
  const deps = buildDeps();
  const zc = seed(deps, 1, Z);
  const ec = seed(deps, 2, E);

  const realSend = deps.mail.send.bind(deps.mail);
  deps.mail.send = (m) => (m.to === 'ev@example.test' ? { ok: false, reason: 'transient' } : realSend(m));

  run(deps);
  assert.equal(deps.deliveries.findBySubmissionId(zc.submissionId).digestStatus, 'delivered');
  assert.equal(deps.deliveries.findBySubmissionId(ec.submissionId).digestStatus, 'pending_digest');
});

test('an unconfigured digest sends nothing and advances nothing', () => {
  const deps = buildDeps({ config: { partnerEmailMap: {} } });
  const result = seed(deps, 1, Z);
  const summary = run(deps);

  assert.equal(summary.skipped, 'not_configured');
  assert.equal(deps.mail.sent.length, 0);
  assert.equal(deps.deliveries.findBySubmissionId(result.submissionId).digestStatus, 'pending_digest');
});

/* ── Deterministic identity ───────────────────────────────────────────────── */

test('the same eligible set produces the same digest identity on a retry', () => {
  const deps = buildDeps({ mail: fakeMailService({ failTimes: 2 }) });
  seed(deps, 1, Z);

  const keys = [];
  const realSend = deps.mail.send.bind(deps.mail);
  deps.mail.send = (m) => { keys.push(m.idempotencyKey); return realSend(m); };

  run(deps);
  run(deps);
  assert.ok(keys.length >= 2);
  assert.equal(keys[0], keys[1], 'a retry is the same digest, not a new one');
});

/* ── Splitting ────────────────────────────────────────────────────────────── */

function modelWith(records) {
  return {
    groups: [{ key: 'zachary_russell', title: 'Gathered through Zachary Russell', sub: '', records: records }],
    counts: [],
    windowLine: 'Collected Aug 1 through Aug 2.',
    totalCount: records.length,
    partIndex: 1,
    partCount: 1,
  };
}

function record(i) {
  return {
    submissionId: `s-${i}`,
    name: `Person ${i}`,
    org: 'Org',
    category: 'Other',
    email: `p${i}@example.test`,
    phone: '',
    collected: 'Aug 1, 9:00 AM Central',
    gatheredThrough: 'Zachary Russell',
    currentOwner: 'Unassigned',
    followUp: 'Not contacted',
    matchNote: '',
  };
}

test('a small digest is one part', () => {
  const parts = ctx.splitDigestModel(modelWith([record(1), record(2)]), 90 * 1024, () => 1600);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].partCount, 1);
});

test('an oversized digest splits instead of truncating', () => {
  const records = [];
  for (let i = 0; i < 60; i += 1) records.push(record(i));
  const parts = ctx.splitDigestModel(modelWith(records), 30 * 1024, () => 1600);

  assert.ok(parts.length > 1);
  const total = parts.reduce((n, p) => n + p.totalCount, 0);
  assert.equal(total, 60, 'every record survives the split');
});

test('every part is numbered and knows how many there are', () => {
  const records = [];
  for (let i = 0; i < 60; i += 1) records.push(record(i));
  const parts = ctx.splitDigestModel(modelWith(records), 30 * 1024, () => 1600);

  parts.forEach((p, i) => {
    assert.equal(p.partIndex, i + 1);
    assert.equal(p.partCount, parts.length);
  });
});

test('a record is never split across parts', () => {
  const records = [];
  for (let i = 0; i < 40; i += 1) records.push(record(i));
  const parts = ctx.splitDigestModel(modelWith(records), 20 * 1024, () => 1600);

  const seen = new Set();
  parts.forEach((p) => p.groups.forEach((g) => g.records.forEach((r) => {
    assert.equal(seen.has(r.submissionId), false, 'a record appears in two parts');
    seen.add(r.submissionId);
  })));
  assert.equal(seen.size, 40);
});

test('a single oversized record still ships whole rather than clipped', () => {
  const parts = ctx.splitDigestModel(modelWith([record(1)]), 10 * 1024, () => 200 * 1024);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].totalCount, 1);
});

test('counts on a split part describe that part, not the whole window', () => {
  const records = [];
  for (let i = 0; i < 30; i += 1) records.push(record(i));
  const parts = ctx.splitDigestModel(modelWith(records), 20 * 1024, () => 1600);

  parts.forEach((p) => {
    const counted = p.counts.reduce((n, c) => n + c.count, 0);
    assert.equal(counted, p.totalCount);
  });
});

test('thirty real contacts are delivered whole, splitting if the ceiling requires it', () => {
  // The real stress case: one conference table, one morning digest.
  //
  // A rendered record costs about 3.1 KB, so thirty of them plus the shell land near
  // 99 KB and the digest splits into two numbered parts. That is the CORRECT outcome,
  // not a shortfall: the approved rule is that a window over the ceiling splits at
  // Contact boundaries rather than truncating or clipping, because a clipped digest has
  // failed at exactly the part nobody reads. This test therefore asserts the guarantee
  // that matters, which is that all thirty arrive and nothing is lost.
  const deps = buildDeps();
  for (let i = 1; i <= 30; i += 1) seed(deps, i, Z);
  run(deps);

  const parts = deps.templates.digests;
  const total = parts.reduce((n, p) => n + p.total, 0);
  assert.equal(total, 30, 'every contact is delivered');

  const ids = new Set(parts.flatMap((p) => p.records));
  assert.equal(ids.size, 30, 'no contact is duplicated or dropped across parts');

  parts.forEach((p, i) => {
    assert.equal(p.partIndex, i + 1);
    assert.equal(p.partCount, parts.length);
  });

  assert.equal(deps.mail.sent.length, parts.length, 'one email per part');
});

test('every part stays under the ceiling even with long values and many categories', () => {
  // The case that a fixed shell estimate gets wrong. A counts panel listing seven
  // categories plus long organization strings pushed a part over the ceiling, where it
  // would have clipped in Gmail. The packer now measures its own output and re-packs, so
  // this asserts the invariant against realistic content rather than an easy fixture.
  const categories = [
    'property_owner_operator', 'broker_real_estate_advisor', 'investor_capital_partner',
    'lender_financial_professional', 'property_management_operations',
    'service_provider_vendor', 'other',
  ];
  const deps = buildDeps({ templates: ctx.realTemplates() });

  for (let i = 1; i <= 30; i += 1) {
    seed(deps, i, Z, {
      payload: {
        fullName: 'Dr. Margarethe Van Der Bergh-Whitfield the ' + i,
        company: 'Van Der Bergh Family Holdings and Real Estate Partners, LLC, number ' + i,
        roleOrTitle: 'Managing Director of Portfolio Operations and Asset Strategy',
        email: `margarethe.vanderbergh.${i}@vdbfamilyholdings-realestate.example`,
        contactCategory: categories[i % categories.length],
      },
    });
  }
  run(deps);

  assert.ok(deps.mail.sent.length >= 1);
  deps.mail.sent.forEach((message) => {
    assert.ok(
      ctx.byteLength(message.htmlBody) <= ctx.DIGEST_MAX_HTML_BYTES,
      `a part measured ${ctx.byteLength(message.htmlBody)} bytes, over the ceiling`,
    );
  });
});

test('every delivered part stays under the working ceiling', () => {
  // Rendered for real, then measured. This is the assertion that actually protects
  // against Gmail clipping, because it uses the production renderer rather than an
  // estimate of it.
  const deps = buildDeps({ templates: ctx.realTemplates() });
  for (let i = 1; i <= 30; i += 1) seed(deps, i, Z);
  run(deps);

  assert.ok(deps.mail.sent.length >= 1);
  deps.mail.sent.forEach((message) => {
    assert.ok(
      ctx.byteLength(message.htmlBody) <= ctx.DIGEST_MAX_HTML_BYTES,
      `a part measured ${ctx.byteLength(message.htmlBody)} bytes, over the ceiling`,
    );
  });
});
