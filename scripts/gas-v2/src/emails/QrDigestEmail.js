/**
 * The daily QR Contact digest, rendering only.
 *
 * This file draws what `scheduled/Digest.js` decided; the eligibility, routing, and splitting
 * decisions all live there. Shared pieces live in EmailHelpers.js; the two rules that govern
 * every template in this folder are stated there.
 */

/**
 * One digest part.
 *
 * `model` is produced by Digest.js and is already grouped, ordered, and split. This
 * function only renders; it makes no eligibility or routing decision, which is what
 * lets the splitting logic be tested without rendering and the rendering be tested
 * without a repository.
 */
function renderQrDigest(model, config) {
  var total = model.totalCount;
  var noun = total === 1 ? 'contact' : 'contacts';
  var partSuffix = model.partCount > 1 ? ', part ' + model.partIndex + ' of ' + model.partCount : '';

  var headlineText = total + ' new QR ' + noun + '.';
  var subject = 'Daily QR contact digest, ' + total + ' new ' + noun + partSuffix;

  var body =
    block(eyebrow('Internal, QR contacts')) +
    block(headline(headlineText)) +
    block(leadPara(model.windowLine));

  if (model.partCount > 1) {
    body += block(callout('info', '', 'Part ' + model.partIndex + ' of ' + model.partCount,
      'This window was split across ' + model.partCount + ' emails so nothing is clipped. No contact is split across parts.'), 'padding-top:16px;');
  }

  if (model.counts.length > 0) {
    body += block(panel('By contact category', model.counts.map(function (c) {
      return [c.label, String(c.count)];
    })), 'padding-top:22px;');
  }

  for (var g = 0; g < model.groups.length; g++) {
    var group = model.groups[g];
    body += block(groupHeading(group.title, group.sub), 'padding-top:24px;');
    for (var r = 0; r < group.records.length; r++) {
      body += block(digestRecordHtml(group.records[r]), 'padding-top:12px;');
    }
  }

  body += block('<div style="' + styleFont(13.5, 400, PALETTE.faint, 1.6) +
    'padding-top:16px;border-top:1px solid ' + PALETTE.hair + ';">' +
    esc('Every record above is a Contact. None is a Lead, none is assigned, and none has been contacted.') +
    '</div>', 'padding-top:24px;');

  return {
    ok: true,
    subject: escSubject(subject),
    htmlBody: shell({
      title: subject,
      headerMeta: 'Internal, QR contacts',
      preheader: total + ' new ' + noun + '. All unassigned, none contacted.',
      body: body,
      footerNote: 'Internal distribution.',
      footerLegal: 'Sent at 8:00 AM America/Chicago. Nothing is sent on a day with no new contacts.',
      logoUrl: config.logoUrl
    }),
    textBody: digestText(model, headlineText, subject)
  };
}

/**
 * A digest record.
 *
 * SEVEN ROWS IN A FIXED ORDER, EVERY TIME. The order never changes, so a partner who
 * learned the shape on a one-contact day reads the same shape on a thirty-contact day.
 * Absent values print "Not provided" rather than disappearing, because here the absence
 * IS the information: an empty Email row is why no acknowledgement was sent.
 *
 * "Gathered through" and "Current owner" are separate rows and always both present.
 * Attribution is immutable; ownership is whatever is stored at generation time.
 */
function digestRecordHtml(rec) {
  // Font family is declared ONCE, on the cell that contains everything else, rather than
  // on all fourteen row cells. At thirty records the repeated stack alone was pushing the
  // email toward the Gmail clipping threshold, and the approved budget guidance names
  // reducing inline style repetition as the first lever before anything else changes.
  var out = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="width:100%;border:1px solid ' + PALETTE.hair + ';"><tr>' +
    '<td style="padding:16px 18px;font-family:' + FONT_BODY + ';">' +
    '<div style="font-size:17px;font-weight:700;line-height:1.35;color:' + PALETTE.ink +
    ';letter-spacing:-0.015em;word-break:break-word;">' + esc(rec.name) + '</div>';

  if (rec.org) {
    out += '<div style="font-size:14px;line-height:1.5;color:' + PALETTE.muted +
      ';padding-top:4px;word-break:break-word;">' + esc(rec.org) + '</div>';
  }

  if (rec.matchNote) {
    out += '<div style="padding-top:12px;">' +
      callout('match', '!', 'Possible existing contact', rec.matchNote) + '</div>';
  }

  out += '<div style="padding-top:12px;">' + digestRowsHtml([
    ['Category', rec.category, false],
    ['Email', rec.email || NOT_PROVIDED_LABEL, !rec.email],
    ['Phone', rec.phone || NOT_PROVIDED_LABEL, !rec.phone],
    ['Collected', rec.collected, false],
    ['Gathered through', rec.gatheredThrough, false],
    ['Current owner', rec.currentOwner, rec.currentOwner === UNASSIGNED_LABEL],
    ['Follow-up', rec.followUp, true]
  ]) + '</div>';

  return out + '</td></tr></table>';
}

/**
 * The seven rows, in the fixed order, rendered lean.
 *
 * The style strings are constants rather than built per row, and colour and font are
 * inherited from the enclosing cell. Every muted value still carries its own colour,
 * because "Not provided" and "Unassigned" are status words a reader must be able to see,
 * and the approved accessibility note is explicit that no status word may fade into
 * decoration.
 */
/*
 * Built INSIDE the function, not as top-level constants.
 *
 * PALETTE lives in Html.js, and Apps Script evaluates pushed files in an order this
 * repository does not control. A top-level `var X = '...' + PALETTE.faint` here throws
 * for every request and every trigger whenever this file is evaluated first. That is
 * a full outage, and `deployability.test.js` loads src in reverse order precisely to
 * catch it.
 */
function digestRowStyles() {
  return {
    key: 'padding:7px 14px 7px 0;vertical-align:top;width:148px;font-size:13px;color:' +
      PALETTE.faint + ';',
    value: 'padding:7px 0;vertical-align:top;word-break:break-word;font-size:15px;' +
      'font-weight:600;color:' + PALETTE.ink + ';',
    valueMuted: 'padding:7px 0;vertical-align:top;word-break:break-word;font-size:15px;' +
      'font-weight:500;color:' + PALETTE.faint + ';',
    border: 'border-top:1px solid ' + PALETTE.hair + ';'
  };
}

function digestRowsHtml(rows) {
  var s = digestRowStyles();
  var out = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="width:100%;background:' + PALETTE.panel + ';border:1px solid ' + PALETTE.hair +
    ';padding:0;line-height:1.5;">';

  for (var i = 0; i < rows.length; i++) {
    var border = i === 0 ? '' : s.border;
    out += '<tr><td class="axp-k" style="' + border + s.key + '">' + esc(rows[i][0]) + '</td>' +
      '<td class="axp-v" style="' + border + (rows[i][2] ? s.valueMuted : s.value) + '">' +
      esc(rows[i][1]) + '</td></tr>';
  }
  return out + '</table>';
}

function digestText(model, headlineText, subject) {
  var lines = [textRule('Daily QR contact digest'), headlineText, model.windowLine, ''];

  if (model.partCount > 1) {
    lines.push('Part ' + model.partIndex + ' of ' + model.partCount + '. No contact is split across parts.');
    lines.push('');
  }

  if (model.counts.length > 0) {
    lines.push(textRule('By contact category'));
    model.counts.forEach(function (c) { lines.push('  ' + textRow(c.label, String(c.count), 40)); });
    lines.push('');
  }

  var n = 0;
  model.groups.forEach(function (group) {
    lines.push('=== ' + textRule(group.title) + ' ===');
    if (group.sub) lines.push(textWrap(group.sub));
    lines.push('');
    group.records.forEach(function (rec) {
      n += 1;
      lines.push(n + '. ' + escText(rec.name).toUpperCase());
      if (rec.org) lines.push('   ' + escText(rec.org));
      if (rec.matchNote) {
        lines.push('   ** POSSIBLE EXISTING CONTACT **');
        lines.push('   ' + textWrap(rec.matchNote, 58).split('\n').join('\n   '));
      }
      lines.push('   ' + textRow('Category', rec.category));
      lines.push('   ' + textRow('Email', rec.email || NOT_PROVIDED_LABEL));
      lines.push('   ' + textRow('Phone', rec.phone || NOT_PROVIDED_LABEL));
      lines.push('   ' + textRow('Collected', rec.collected));
      lines.push('   ' + textRow('Gathered through', rec.gatheredThrough));
      lines.push('   ' + textRow('Current owner', rec.currentOwner));
      lines.push('   ' + textRow('Follow-up', rec.followUp));
      if (!rec.email) lines.push('   Note: phone only. No acknowledgement email was sent.');
      lines.push('');
    });
  });

  lines.push(textWrap('Every record above is a Contact. None is a Lead, none is assigned, and none has been contacted.'));
  lines.push('');
  lines.push(textWrap('Sent at 8:00 AM America/Chicago. Nothing is sent on a day with no new contacts.'));
  return lines.join('\n');
}
