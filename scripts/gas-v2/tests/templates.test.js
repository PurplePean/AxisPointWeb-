'use strict';

/*
 * The email templates.
 *
 * WHAT THESE TESTS ARE FOR. Four failures here reach a real person and cannot be undone.
 *
 *  - Unescaped user content. A name is attacker-controlled text that ends up in HTML, in
 *    a plain-text part, and near a subject header. All three are tested.
 *  - The QR acknowledgement echoing the submitted record. The address has not been
 *    verified as belonging to the person who typed it, so mailing their phone number
 *    back mails it to whoever actually owns that inbox.
 *  - A promise nobody can keep. The acknowledgement once offered correction and removal
 *    on request. That is not offered, so no configuration may render that copy at all.
 *  - An invented value. A placeholder phone or address in a transactional email is a
 *    real number that belongs to somebody else.
 *
 * Escaping is asserted on the rendered OUTPUT, not by calling the escaper, because the
 * defect that matters is a call site that forgot to use it.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.js');
const fx = require('./helpers/fixtures.js');
const { buildDeps, fakeConfig, fixedOffsetResolver } = require('./helpers/fakes.js');

const ctx = load();

function renderConfig(overrides) {
  const config = fakeConfig(overrides);
  config.offsetResolver = fixedOffsetResolver();
  return config;
}

/**
 * Stores a submission and returns the record the template actually renders from.
 *
 * A website inquiry renders from its Lead. A QR Contact Exchange renders from its
 * immutable Submission, because it produces no Lead at all.
 */
function storedLead(envelope, deps) {
  const d = deps || buildDeps();
  const parsed = ctx.parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.ok, true, `fixture should be valid: ${parsed.code || ''}`);
  const result = ctx.processSubmission(parsed.value, d);

  return result.leadId
    ? d.leads.findLeadById(result.leadId)
    : d.submissions.findBySubmissionId(result.submissionId);
}

const HOSTILE = '<script>alert(1)</script>" onload="x';

/* ── QR acknowledgement: what it says ─────────────────────────────────────── */

test('a partner acknowledgement names the partner in the subject and headline', () => {
  const lead = storedLead(fx.qrSubmission(1, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());

  assert.equal(out.ok, true);
  assert.equal(out.subject, 'Zachary Russell has your contact details');
  assert.match(out.htmlBody, /Thank you, Priya\. Your details are with Zachary Russell\./);
});

test('an unresolved card falls back to the firm without apology or a partner choice', () => {
  const lead = storedLead(fx.qrSubmission(2, 'retired-card'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());

  assert.equal(out.subject, 'AxisPoint Partners has your contact details');
  assert.match(out.htmlBody, /did not resolve to a partner profile/);
  assert.equal(/sorry|apolog/i.test(out.htmlBody), false);
});

test('a firm-card scan is acknowledged by the firm', () => {
  const lead = storedLead(fx.qrSubmission(3, 'axispoint-partners'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());
  assert.equal(out.subject, 'AxisPoint Partners has your contact details');
});

/* ── QR acknowledgement: what it must never contain ───────────────────────── */

test('the acknowledgement echoes the display name and nothing else the person typed', () => {
  const lead = storedLead(fx.qrSubmission(4, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());
  const body = out.htmlBody + '\n' + out.textBody;

  assert.match(body, /Priya/, 'the display name is the one submitted value that appears');
  assert.equal(body.indexOf('priya@ramanbrokers.test'), -1, 'submitted email echoed');
  assert.equal(body.indexOf('972-555-0143'), -1, 'submitted phone echoed');
  assert.equal(body.indexOf('Raman Brokers'), -1, 'submitted company echoed');
  assert.equal(body.indexOf('Principal'), -1, 'submitted role echoed');
  assert.equal(body.indexOf('Broker or Real Estate Advisor'), -1, 'submitted category echoed');
});

test('the acknowledgement carries no marketing, nurture, or tracking', () => {
  const lead = storedLead(fx.qrSubmission(5, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());
  const body = out.htmlBody.toLowerCase();

  assert.equal(/unsubscribe|preference cent|newsletter|subscribe to/.test(body), false);
  assert.equal(/<img[^>]*width="1"|height="1"|tracking|open-rate/.test(body), false);
  assert.match(out.htmlBody, /This is not a mailing list/);
});

test('the acknowledgement promises no response time and shows no reference number', () => {
  const lead = storedLead(fx.qrSubmission(6, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());
  const body = out.htmlBody + out.textBody;

  assert.equal(/one business day|1 business day|within 24 hours/i.test(body), false);
  // Checked against the identifiers this record actually has. A QR acknowledgement now
  // renders from the Submission, whose leadId is empty, and indexOf('') is 0.
  [lead.submissionId, lead.contactId, lead.leadId]
    .filter((id) => typeof id === 'string' && id !== '')
    .forEach((id) => {
      assert.equal(body.indexOf(id), -1, `identifier ${id} appeared in the email`);
    });
});

test('the acknowledgement offers no Save Contact action', () => {
  // Withheld until a permanent profile URL or a verified vCard delivery method exists.
  const lead = storedLead(fx.qrSubmission(7, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());
  assert.equal(/save contact|\.vcf|add to contacts/i.test(out.htmlBody), false);
});

/* ── No correction or removal promise, under any configuration ────────────── */

test('the acknowledgement never promises correction or removal', () => {
  // AxisPoint does not offer correction or removal on request, so no configuration may
  // produce this copy. The two keys below are DEAD: `AXP_REPLY_TO_MONITORED` and
  // `AXP_REMOVAL_PROCEDURE_CONFIGURED` once gated the promise and no longer exist in
  // `Config.js`. They are passed here deliberately, at their most permissive value, so
  // that a reintroduced gate reading either one fails this test instead of quietly
  // rendering the promise again on a project where somebody set them years ago.
  const lead = storedLead(fx.qrSubmission(8, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig({
    replyToMonitored: true,
    removalProcedureConfigured: true,
  }));

  // The text part hard-wraps at 62 columns, so it is checked with whitespace normalized
  // rather than letting a correct line break hide a sentence from the assertion.
  const text = out.textBody.replace(/\s+/g, ' ');
  [out.htmlBody, text].forEach((body) => {
    assert.equal(/we will update them/.test(body), false);
    assert.equal(/we will remove your information/.test(body), false);
    assert.equal(/needs? correcting/i.test(body), false);
    assert.equal(/reply to this message at any time/.test(body), false);
  });
});

test('config health reports no promise blockers, because no promise is made', () => {
  const health = ctx.configHealth(fakeConfig());

  // Length, not deepEqual: the array is constructed inside the loaded GAS context, so it
  // has a different Array prototype and a strict structural compare rejects it.
  assert.equal(health.blockers.length, 0);
  assert.equal(health.promisesKeepable, true);
});

/* ── Missing values disappear, nothing is invented ────────────────────────── */

test('an unverified partner phone omits the row rather than showing it empty', () => {
  const lead = storedLead(fx.qrSubmission(11, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig({ partnerDirectPhone: {} }));

  assert.equal(/>Phone</.test(out.htmlBody), false);
  assert.equal(/Phone:/.test(out.textBody), false);
  assert.equal(/Not provided/.test(out.htmlBody), false);
});

test('an unverified firm phone omits the row on the firm fallback', () => {
  const lead = storedLead(fx.qrSubmission(12, 'unknown-card'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());
  assert.equal(/>Phone</.test(out.htmlBody), false);
});

test('a partner with no configured direct address falls back to the firm block', () => {
  // A partner block with no way to reach that partner is worse than the firm block.
  const lead = storedLead(fx.qrSubmission(13, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig({ partnerDirectEmail: {} }));

  assert.equal(out.subject, 'AxisPoint Partners has your contact details');
  assert.match(out.htmlBody, /firm@example\.test/);
});

test('no phone number or address appears that was not configured', () => {
  const lead = storedLead(fx.qrSubmission(14, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig({
    partnerDirectPhone: {},
    firmPhone: '',
  }));
  const body = out.htmlBody + out.textBody;

  // No invented number of any shape reaches the output.
  assert.equal(/\(\d{3}\)\s?\d{3}[- ]\d{4}/.test(body), false);
  assert.equal(/555-01|555 01/.test(body), false);
});

test('with no logo configured the header prints the wordmark and no broken image', () => {
  const lead = storedLead(fx.qrSubmission(15, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig({ logoUrl: '' }));

  assert.equal(/<img/.test(out.htmlBody), false);
  assert.match(out.htmlBody, />AxisPoint</);
});

test('a configured logo is rendered with dimensions and alt text', () => {
  const lead = storedLead(fx.qrSubmission(16, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig({ logoUrl: 'https://cdn.example.test/m.png' }));
  assert.match(out.htmlBody, /<img [^>]*alt="AxisPoint Partners"/);
  assert.match(out.htmlBody, /width="120"/);
});

/* ── Escaping ─────────────────────────────────────────────────────────────── */

test('a hostile display name is escaped in the HTML part', () => {
  const lead = storedLead(fx.qrSubmission(17, 'zachary-russell', {
    payload: { fullName: HOSTILE },
  }));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());

  assert.equal(out.htmlBody.indexOf('<script>'), -1);
  assert.equal(out.htmlBody.indexOf('onload="x'), -1);
  assert.match(out.htmlBody, /&lt;script&gt;/);
});

test('a hostile display name cannot break out of the plain-text part', () => {
  const lead = storedLead(fx.qrSubmission(18, 'zachary-russell', {
    payload: { fullName: 'Dana\nEmail: attacker@evil.test' },
  }));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());

  // A newline inside a value would otherwise forge a new labelled line.
  assert.equal(/^Email: attacker@evil\.test$/m.test(out.textBody), false);
});

test('a subject line carries no CR or LF', () => {
  const lead = storedLead(fx.qrSubmission(19, 'zachary-russell', {
    payload: { fullName: 'Dana\r\nBcc: attacker@evil.test' },
  }));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());

  assert.equal(/[\r\n]/.test(out.subject), false);
});

test('the subject carries no submitted content beyond the approved behaviour', () => {
  // The QR subject names the partner or the firm. The display name is not in it.
  const lead = storedLead(fx.qrSubmission(20, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig());
  assert.equal(out.subject.indexOf('Priya'), -1);
});

test('hostile content in an internal notification is escaped too', () => {
  const lead = storedLead(fx.managementProposal({
    payload: { contact: { fullName: HOSTILE, organization: HOSTILE } },
  }));
  const out = ctx.renderInternalNotification(lead, renderConfig());

  assert.equal(out.htmlBody.indexOf('<script>'), -1);
  assert.match(out.htmlBody, /&lt;script&gt;/);
});

test('a long email address wraps rather than widening the layout', () => {
  const lead = storedLead(fx.qrSubmission(21, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(lead, renderConfig({
    partnerDirectEmail: { zachary_russell: 'margarethe.vanderbergh@vdbfamilyholdings-realestate.example' },
  }));
  assert.match(out.htmlBody, /word-break:break-word/);
});

/* ── Website acknowledgement and internal notification ────────────────────── */

test('the website acknowledgement repeats the property back', () => {
  const lead = storedLead(fx.managementProposal());
  const out = ctx.renderWebsiteAcknowledgement(lead, renderConfig());

  assert.equal(out.ok, true);
  assert.match(out.htmlBody, /Dallas, TX/);
  assert.match(out.htmlBody, /Multifamily/);
  assert.match(out.htmlBody, /Within 30 days/);
});

test('missing optional property values disappear rather than reading empty', () => {
  const lead = storedLead(fx.managementProposal({
    payload: { property: { scale: undefined, propertyCount: undefined }, contact: { organization: undefined } },
  }));
  const out = ctx.renderWebsiteAcknowledgement(lead, renderConfig());

  assert.equal(/Ownership group/.test(out.htmlBody), false);
  assert.equal(/Units or square footage/.test(out.htmlBody), false);
});

test('no template prints a raw wire token', () => {
  const lead = storedLead(fx.managementProposal());
  const ack = ctx.renderWebsiteAcknowledgement(lead, renderConfig());
  const internal = ctx.renderInternalNotification(lead, renderConfig());
  const body = ack.htmlBody + ack.textBody + internal.htmlBody + internal.textBody;

  ['management_proposal', 'multifamily', 'within_30_days', 'replace_current_management',
    'one_property', 'pm_plus_am', 'property_owner_operator'].forEach((token) => {
    assert.equal(body.indexOf(token), -1, `wire token ${token} reached an email`);
  });
});

test('the internal notification names the preferred language so the reply goes out right', () => {
  const lead = storedLead(fx.investorServices());
  const out = ctx.renderInternalNotification(lead, renderConfig());

  assert.match(out.htmlBody, /Preferred language/);
  assert.match(out.htmlBody, /Spanish/);
  assert.match(out.htmlBody, /stays in English/);
});

test('the internal notification contains no dead link to a surface that does not exist', () => {
  const lead = storedLead(fx.managementProposal());
  const out = ctx.renderInternalNotification(lead, renderConfig());

  assert.equal(/Open the lead record|href=/.test(out.htmlBody), false);
});

test('the internal notification carries the SLA due time in words with the zone', () => {
  const lead = storedLead(fx.managementProposal());
  const out = ctx.renderInternalNotification(lead, renderConfig());
  assert.match(out.htmlBody, /Central Time/);
});

/* ── Structure and house style ────────────────────────────────────────────── */

test('every template ships both an HTML and a real plain-text part', () => {
  const inquiry = storedLead(fx.managementProposal());
  const qr = storedLead(fx.qrSubmission(22, 'zachary-russell'));
  const outputs = [
    ctx.renderWebsiteAcknowledgement(inquiry, renderConfig()),
    ctx.renderInternalNotification(inquiry, renderConfig()),
    ctx.renderQrAcknowledgement(qr, renderConfig()),
  ];

  outputs.forEach((out) => {
    assert.equal(out.ok, true);
    assert.ok(out.htmlBody.length > 500);
    assert.ok(out.textBody.length > 100);
    assert.equal(/<[a-z]/i.test(out.textBody), false, 'the text part is not stripped HTML');
  });
});

test('no template contains an em dash', () => {
  const inquiry = storedLead(fx.managementProposal());
  const qr = storedLead(fx.qrSubmission(23, 'zachary-russell'));
  const bodies = [
    ctx.renderWebsiteAcknowledgement(inquiry, renderConfig()),
    ctx.renderInternalNotification(inquiry, renderConfig()),
    ctx.renderQrAcknowledgement(qr, renderConfig()),
  ].map((o) => o.htmlBody + o.textBody + o.subject).join('');

  assert.equal(bodies.indexOf('—'), -1, 'an em dash reached an email');
});

test('every email carries a hidden preheader and no visible low-contrast line', () => {
  const qr = storedLead(fx.qrSubmission(24, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(qr, renderConfig());
  assert.match(out.htmlBody, /display:none;font-size:1px;line-height:1px;max-height:0/);
});

test('layout is table-based and capped at 600px', () => {
  const qr = storedLead(fx.qrSubmission(25, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(qr, renderConfig());

  assert.match(out.htmlBody, /max-width:600px/);
  assert.match(out.htmlBody, /role="presentation"/);
});

test('the layout does not DEPEND on the stylesheet a client may strip', () => {
  // Gmail strips the document head. The one <style> block only stacks key above value
  // below 480px; with it removed, every cell still carries its full inline style and the
  // email renders the side-by-side layout correctly. This test simulates the strip.
  const qr = storedLead(fx.qrSubmission(26, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(qr, renderConfig());
  const stripped = out.htmlBody.replace(/<style>[\s\S]*?<\/style>/g, '');

  assert.match(stripped, /max-width:600px/);
  assert.match(stripped, /font-family:'Figtree'/);
  assert.match(stripped, /Zachary Russell/);
  // Every styled cell keeps its inline style once the sheet is gone.
  assert.equal(/<td class="axp-[kv]"(?! style=)/.test(stripped), false);
});

test('the only stylesheet rule is the narrow-width stacking enhancement', () => {
  const qr = storedLead(fx.qrSubmission(27, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(qr, renderConfig());
  const styles = out.htmlBody.match(/<style>([\s\S]*?)<\/style>/g) || [];

  assert.equal(styles.length, 1);
  assert.match(styles[0], /@media only screen and \(max-width:480px\)/);
  // No layout, colour, or font rule hides in there.
  assert.equal(/background|color:|font-family|position:/.test(styles[0]), false);
});

test('there is no external request of any kind beyond an optional configured logo', () => {
  const qr = storedLead(fx.qrSubmission(26, 'zachary-russell'));
  const out = ctx.renderQrAcknowledgement(qr, renderConfig({ logoUrl: '' }));

  assert.equal(/https?:\/\//.test(out.htmlBody), false);
});
