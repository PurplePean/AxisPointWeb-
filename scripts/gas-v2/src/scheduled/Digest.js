/**
 * The daily internal QR Contact digest.
 *
 * WHY A DIGEST REPLACED PER-SCAN NOTIFICATION. One email per scanned card is unreadable
 * after a conference table: thirty separate messages arrive overnight, a partner
 * archives them in a block, and the one that mattered goes with the rest. One email at
 * 8:00 AM lets a partner read a whole day in one pass.
 *
 * FOUR RULES THIS MODULE EXISTS TO ENFORCE.
 *
 * 1. Zero eligible Contacts sends NOTHING. There is no empty-state digest, because an
 *    empty digest teaches partners to ignore the digest.
 *
 * 2. Routing is by ACQUISITION ATTRIBUTION alone, never by ownership. Receiving a
 *    digest does not make a partner the owner of anything in it.
 *
 * 3. The window advances only on CONFIRMED DELIVERY. A failed send retries against the
 *    same open window, so a retry contains the same Contacts rather than a second copy
 *    of a day already read, and a two-day outage produces one digest covering two days.
 *
 * 4. Nothing is ever truncated. Above the size ceiling the digest SPLITS at Contact
 *    boundaries, preferring group boundaries, and every part says which part it is.
 *
 * The delivery guarantee is unchanged and unimproved: bounded at-least-once. A crash
 * between a successful send and the state write re-sends that digest. Deterministic
 * digest identity narrows that window; it does not close it, and no exactly-once claim
 * is made anywhere.
 */

/**
 * Starting allowance for the shell, header, footer, window line, group headings, and the
 * counts panel.
 *
 * It is an ESTIMATE, and estimates of this are unreliable: the counts panel grows with
 * the number of distinct categories, and group headings grow with the number of groups.
 * A part that overshoots the ceiling clips in Gmail, which is the exact failure the
 * ceiling exists to prevent, so the packer's output is MEASURED after rendering and
 * re-packed with a smaller allowance if it came out too large. See `packPartsWithinCeiling`.
 */
var DIGEST_SHELL_OVERHEAD_BYTES = 8 * 1024;

/** How much to give back to the shell on each re-pack, and how many times to try. */
var DIGEST_REPACK_STEP_BYTES = 8 * 1024;
var DIGEST_REPACK_ATTEMPTS = 6;

/**
 * Selects the Contacts a digest may include.
 *
 * Spam-suspected Contacts are stored and excluded here. They are excluded from the
 * acknowledgement for the same reason: a flagged record should not be able to use this
 * system to mail a third party, and it should not be able to fill a partner's morning
 * digest either.
 */
function selectEligibleSubmissions(submissions) {
  return submissions.filter(function (s) {
    if (String(s.submissionKind) !== 'contact_exchange') return false;
    if (String(s.digestStatus) !== 'pending_digest') return false;
    if (s.spamSuspected === true || s.spamSuspected === 'TRUE') return false;
    return ACQUISITION_SOURCES.indexOf(String(s.acquisitionSource)) !== -1;
  });
}

/**
 * Joins the pending Delivery rows to their immutable Submissions.
 *
 * The Delivery row owns the queue state and the Submission owns the content, so the digest
 * reads both. Pass 9A read a Lead row instead, which is exactly the record a QR Contact
 * Exchange no longer produces.
 *
 * A Delivery whose Submission is missing is skipped and logged rather than rendered blank.
 * An empty record in a partner's morning email is worse than a missing one, because it
 * looks like a real person whose details were lost.
 */
function loadPendingDigestSubmissions(deps) {
  var pending = deps.deliveries.listPendingDigest();
  var out = [];

  for (var i = 0; i < pending.length; i++) {
    var submission = deps.submissions.findBySubmissionId(pending[i].submissionId);
    if (!submission) {
      tryLog(deps, {
        level: 'error',
        event: 'digest_orphan_delivery',
        submissionId: pending[i].submissionId,
        detail: 'delivery row has no submission'
      });
      continue;
    }
    var merged = clone(submission);
    merged.digestStatus = pending[i].digestStatus;
    out.push(merged);
  }
  return out;
}

/**
 * Which partners receive which Contacts.
 *
 * A partner gets the Contacts gathered through their own validated card, plus every
 * shared Contact. Shared means the firm card and the unresolved card: neither belongs
 * to a person, and both need somebody to look at them, so both go to both partners
 * identically.
 *
 * A partner with nothing attributed and nothing shared receives nothing that morning.
 */
function planDigests(eligible, config) {
  var shared = eligible.filter(function (s) {
    return s.acquisitionSource === 'firm' || s.acquisitionSource === 'unknown';
  });

  var plans = [];
  for (var i = 0; i < PARTNERS.length; i++) {
    var partner = PARTNERS[i];
    var own = eligible.filter(function (s) { return s.acquisitionSource === partner; });
    if (own.length === 0 && shared.length === 0) continue;

    var address = (config.partnerEmailMap || {})[partner];
    plans.push({
      partner: partner,
      address: address || '',
      contacts: own.concat(shared),
      ownContacts: own,
      sharedContacts: shared
    });
  }
  return plans;
}

/**
 * Builds the render model for one partner.
 *
 * Records are ordered by collection time ascending inside each group. It is the only
 * ordering that carries no judgment: it reproduces the order the conversations actually
 * happened in, rather than implying a priority the system has no basis for.
 */
function buildDigestModel(plan, ctx) {
  var config = ctx.config;
  var groups = [];

  if (plan.ownContacts.length > 0) {
    groups.push({
      key: plan.partner,
      title: 'Gathered through ' + acquisitionLabel(plan.partner),
      sub: 'Acquisition attribution only. Ownership is unchanged.',
      records: plan.ownContacts.slice().sort(byCollectedAt).map(function (s) { return digestRecord(s, ctx); })
    });
  }

  var firm = plan.sharedContacts.filter(function (s) { return s.acquisitionSource === 'firm'; });
  if (firm.length > 0) {
    groups.push({
      key: 'firm',
      title: 'Gathered through ' + acquisitionLabel('firm'),
      sub: 'Shared section. This section is delivered to both partners.',
      records: firm.slice().sort(byCollectedAt).map(function (s) { return digestRecord(s, ctx); })
    });
  }

  var unknown = plan.sharedContacts.filter(function (s) { return s.acquisitionSource === 'unknown'; });
  if (unknown.length > 0) {
    groups.push({
      key: 'unknown',
      title: 'Gathered through ' + acquisitionLabel('unknown'),
      sub: 'The card did not resolve to a profile. Delivered to both partners.',
      records: unknown.slice().sort(byCollectedAt).map(function (s) { return digestRecord(s, ctx); })
    });
  }

  return {
    groups: groups,
    counts: countByCategory(plan.contacts),
    windowLine: windowLine(plan.contacts, ctx),
    totalCount: plan.contacts.length,
    partIndex: 1,
    partCount: 1
  };
}

function byCollectedAt(a, b) {
  return String(a.receivedAt) < String(b.receivedAt) ? -1 : 1;
}

/**
 * One record's printable fields.
 *
 * `currentOwner` is read from the Contact AT GENERATION TIME and is not hardcoded. At
 * launch it prints Unassigned on every new record because intake assigns nobody; once
 * internal assignment exists the same code prints the real owner, while the
 * "Gathered through" row stays fixed forever.
 */
function digestRecord(submission, ctx) {
  var org = normalizeWhitespace(submission.organization);
  var role = normalizeWhitespace(submission.roleOrTitle);
  var orgLine;
  if (org && role) orgLine = org + ' · ' + role;
  else if (org) orgLine = org + ' · Role not provided';
  else orgLine = 'Organization not provided';

  // The owner is read from the linked CONTACT, live, at generation time. Copying it onto
  // the submission at intake would freeze it, and a Contact assigned last week would
  // still print Unassigned forever.
  var contact = ctx.lookupContact(submission.contactId);

  return {
    submissionId: submission.submissionId,
    contactId: submission.contactId,
    name: normalizeWhitespace(submission.fullName),
    org: orgLine,
    category: categoryLabel(submission.contactCategory),
    email: normalizeWhitespace(submission.email),
    phone: normalizeWhitespace(submission.phone),
    collected: formatCollected(submission.receivedAt, ctx.config),
    gatheredThrough: acquisitionLabel(submission.acquisitionSource),
    currentOwner: ownerLabel(contact ? contact.ownerPartner : ''),
    followUp: followUpLabel(contact ? contact.followUpState : 'not_contacted'),
    matchNote: normalizeWhitespace(submission.matchNote)
  };
}

/**
 * Category totals for the counts panel.
 *
 * Every category present is listed rather than the top few, because at thirty records
 * this panel is the only place a partner can see the shape of an event without
 * scrolling.
 */
function countByCategory(submissions) {
  var order = [];
  var totals = {};
  submissions.forEach(function (c) {
    var label = categoryLabel(c.contactCategory);
    if (totals[label] === undefined) { totals[label] = 0; order.push(label); }
    totals[label] += 1;
  });
  return order.map(function (label) { return { label: label, count: totals[label] }; });
}

/**
 * The window sentence, written out with the zone named.
 *
 * Derived from the Contacts actually in the email rather than from a stored clock, so a
 * digest can never claim to cover a period it does not, and a two-day outage produces
 * one honest two-day window line.
 */
function windowLine(submissions, ctx) {
  if (submissions.length === 0) return '';
  var earliest = submissions.slice().sort(byCollectedAt)[0];
  var from = formatCollected(earliest.receivedAt, ctx.config);
  var to = formatCollected(toIso(ctx.now), ctx.config);
  return 'Collected ' + from + ' through ' + to + '.';
}

/**
 * Splits a model into parts that each fit the ceiling.
 *
 * Group boundaries are preferred, and a Contact is NEVER split. If one record on its own
 * exceeds the ceiling it still ships whole in its own part: a clipped record is worse
 * than a slightly oversized email, and truncating a person's details is not an option
 * the design allows.
 */
function splitDigestModel(model, maxBytes, renderRecordSize, shellAllowance) {
  var budget = maxBytes - (typeof shellAllowance === 'number' ? shellAllowance : DIGEST_SHELL_OVERHEAD_BYTES);
  if (budget < 1024) budget = 1024;
  var parts = [];
  var current = { groups: [], bytes: 0 };

  function flush() {
    if (current.groups.length > 0) parts.push(current.groups);
    current = { groups: [], bytes: 0 };
  }

  for (var g = 0; g < model.groups.length; g++) {
    var group = model.groups[g];
    var open = null;

    for (var r = 0; r < group.records.length; r++) {
      var size = renderRecordSize(group.records[r]);

      if (current.bytes + size > budget && current.groups.length > 0) {
        flush();
        open = null;
      }

      if (!open) {
        open = { key: group.key, title: group.title, sub: group.sub, records: [] };
        current.groups.push(open);
      }
      open.records.push(group.records[r]);
      current.bytes += size;
    }
  }
  flush();

  if (parts.length === 0) return [model];

  return parts.map(function (groups, i) {
    return {
      groups: groups,
      // Counts and the window line describe THIS email, never the whole window. The
      // first question a partner asks a digest is what is in front of them.
      counts: countRecordCategories(groups),
      windowLine: model.windowLine,
      totalCount: groups.reduce(function (n, gr) { return n + gr.records.length; }, 0),
      partIndex: i + 1,
      partCount: parts.length
    };
  });
}

function countRecordCategories(groups) {
  var order = [];
  var totals = {};
  groups.forEach(function (g) {
    g.records.forEach(function (rec) {
      if (totals[rec.category] === undefined) { totals[rec.category] = 0; order.push(rec.category); }
      totals[rec.category] += 1;
    });
  });
  return order.map(function (label) { return { label: label, count: totals[label] }; });
}

/**
 * Deterministic identity for one partner's digest over one eligible set.
 *
 * A retry over the same Contacts produces the same id, so a retried delivery is
 * recognisably the same digest rather than a new one. This narrows the duplicate window;
 * it does not close it, and nothing here claims otherwise.
 */
function digestIdentity(plan) {
  var ids = plan.contacts.map(function (s) { return String(s.submissionId); }).sort().join(',');
  return 'qr_digest:' + plan.partner + ':' + stableHash(ids);
}

/**
 * Runs one digest cycle.
 *
 * Callable by hand and by a future scheduled trigger. THIS PASS INSTALLS NO TRIGGER;
 * scheduling it is a separate, deliberate operation against a real Apps Script project.
 */
function runDailyQrDigest(deps) {
  return deps.lock.withLock(function () {
    var now = deps.clock.now();
    var config = deps.config;

    var eligible = selectEligibleSubmissions(loadPendingDigestSubmissions(deps));
    if (eligible.length === 0) {
      // Deliberately silent. No email, no log noise, no state change.
      return { sent: 0, parts: 0, contacts: 0, skipped: 'no_eligible_contacts' };
    }

    if (!isConfigured(config, 'digest')) {
      tryLog(deps, {
        level: 'error',
        event: 'digest_not_configured',
        detail: missingConfigFor(config, 'digest').join(',')
      });
      return { sent: 0, parts: 0, contacts: eligible.length, skipped: 'not_configured' };
    }

    var renderConfig = withOffsetResolver(config, deps.offsetResolver);
    var plans = planDigests(eligible, config);

    // Contacts are read once per run and cached. A thirty-record digest would otherwise
    // re-read the Contacts tab thirty times per partner.
    var contactCache = {};
    var ctx = {
      config: renderConfig,
      now: now,
      lookupContact: function (contactId) {
        if (!contactId) return null;
        if (!Object.prototype.hasOwnProperty.call(contactCache, contactId)) {
          contactCache[contactId] = deps.contacts.findContactById(contactId);
        }
        return contactCache[contactId];
      }
    };

    // Delivery outcome per contact. A Contact only advances when EVERY digest that was
    // supposed to carry it actually landed, which is what stops a shared Contact from
    // being marked delivered because one of the two partners received it.
    var outcome = {};
    eligible.forEach(function (s) { outcome[s.submissionId] = true; });

    var summary = { sent: 0, parts: 0, contacts: 0, failed: 0, plans: plans.length };

    for (var i = 0; i < plans.length; i++) {
      var plan = plans[i];
      var delivered = deliverPlan(plan, ctx, deps, summary);
      if (!delivered) {
        plan.contacts.forEach(function (s) { outcome[s.submissionId] = false; });
      }
    }

    var advanced = [];
    Object.keys(outcome).forEach(function (submissionId) {
      if (!outcome[submissionId]) return;
      // Written to the DELIVERY row. The Submission is immutable and is never patched.
      deps.deliveries.updateDelivery(submissionId, {
        digestStatus: 'delivered',
        digestDeliveredAt: toIso(now)
      });
      advanced.push(submissionId);
    });
    summary.contacts = advanced.length;

    tryLog(deps, {
      level: 'info',
      event: 'qr_digest_run',
      detail: 'plans=' + summary.plans + ' parts=' + summary.parts +
        ' sent=' + summary.sent + ' failed=' + summary.failed + ' advanced=' + advanced.length
    });

    return summary;
  });
}

/**
 * Sends every part of one partner's digest.
 *
 * ALL OR NOTHING for that partner. A partial send leaves the whole eligible set open,
 * because half a digest read as a whole one is how a Contact is silently never seen.
 */
function deliverPlan(plan, ctx, deps, summary) {
  if (!plan.address) {
    tryLog(deps, { level: 'error', event: 'digest_no_recipient', detail: plan.partner });
    summary.failed += 1;
    return false;
  }

  var model = buildDigestModel(plan, ctx);
  var identity = digestIdentity(plan);
  var rendition = packPartsWithinCeiling(model, ctx, deps);

  if (!rendition.ok) {
    summary.failed += 1;
    return false;
  }

  var parts = rendition.parts;
  var allOk = true;
  for (var i = 0; i < parts.length; i++) {
    var rendered = parts[i];
    summary.parts += 1;
    var sent = deps.mail.send({
      to: plan.address,
      replyTo: ctx.config.replyTo,
      fromName: ctx.config.fromName,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
      idempotencyKey: identity + ':part' + (i + 1) + 'of' + parts.length
    });

    if (!sent || !sent.ok) {
      allOk = false;
      summary.failed += 1;
      break;
    }
    summary.sent += 1;
  }

  return allOk;
}

/**
 * Packs and renders, then MEASURES, and re-packs if a part came out over the ceiling.
 *
 * The packer works from an estimated shell allowance, and that estimate is wrong in a
 * direction that matters: a digest with many distinct categories carries a bigger counts
 * panel, and one with several groups carries more headings. Trusting the estimate ships a
 * part that clips in Gmail, and the clipped part is the part nobody reads.
 *
 * So the invariant is enforced by measurement, not by arithmetic. Each retry hands more
 * room back to the shell. The loop is bounded, and a single record too large to fit alone
 * still ships whole rather than being truncated.
 */
function packPartsWithinCeiling(model, ctx, deps) {
  var allowance = DIGEST_SHELL_OVERHEAD_BYTES;
  var sizeOf = function (rec) { return byteLength(digestRecordHtml(rec)); };

  for (var attempt = 0; attempt < DIGEST_REPACK_ATTEMPTS; attempt++) {
    var parts = splitDigestModel(model, DIGEST_MAX_HTML_BYTES, sizeOf, allowance);
    var rendered = [];
    var oversized = false;

    for (var i = 0; i < parts.length; i++) {
      var out = deps.templates.renderQrDigest(parts[i], ctx.config);
      if (!out || !out.ok) return { ok: false };
      rendered.push(out);

      // A lone record that cannot fit under any allowance ships whole. Splitting a
      // person's details in half is not an option the design allows.
      var single = parts[i].groups.length === 1 && parts[i].groups[0].records.length === 1;
      if (byteLength(out.htmlBody) > DIGEST_MAX_HTML_BYTES && !single) oversized = true;
    }

    if (!oversized) return { ok: true, parts: rendered };
    allowance += DIGEST_REPACK_STEP_BYTES;
  }

  tryLog(deps, {
    level: 'error',
    event: 'digest_repack_exhausted',
    detail: 'a part still exceeds the ceiling after ' + DIGEST_REPACK_ATTEMPTS + ' attempts'
  });
  return { ok: false };
}

/** Templates format instants; the resolver is a dependency, not a config property. */
function withOffsetResolver(config, offsetResolver) {
  var out = {};
  Object.keys(config).forEach(function (k) { out[k] = config[k]; });
  out.offsetResolver = offsetResolver;
  return out;
}
