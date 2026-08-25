/**
 * Email HTML primitives.
 *
 * ONE CANONICAL RENDERER. V1 kept every template twice, as an embedded constant and as
 * a mirror file, and the two drifted silently until a parity test was written to catch
 * it. There is exactly one copy of each V2 template, it is a pure function, and its
 * plain-text part is generated from the same call rather than being a stripped
 * afterthought.
 *
 * EVERY interpolated value goes through `esc`. Not "every user value": every value.
 * Deciding case by case which string is trusted is how the one that was not gets
 * through, and a partner's own name arriving from a config property is no more trusted
 * than a visitor's. The only strings that skip escaping are literals in this file and
 * markup this file itself produced.
 *
 * Structure follows the approved handoff: single-column tables, 600px maximum, fluid to
 * 320px, all styling inline, square corners, no stylesheet, no class selectors, no
 * media queries, and nothing that breaks when a client strips the head.
 */

var EMAIL_MAX_WIDTH = 600;

var PALETTE = {
  ink: '#1C1628',
  muted: 'rgba(28,22,40,0.68)',
  faint: 'rgba(28,22,40,0.52)',
  hair: 'rgba(28,22,40,0.16)',
  surface: '#FFFFFF',
  panel: '#F6F2EA', // Warm page field (v2-surface). Was #F7F5FB, the older cool value superseded by design@2026-07-30.
  canvas: '#EDEAF3',
  teal: '#24A5BC',
  tealDeep: '#1B8DA2',
  purple: '#38285D',
  magenta: '#9F328C',
  matchBg: '#FDF2F9'
};

var FONT_BODY = "'Figtree', Arial, Helvetica, sans-serif";
var FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif";

/**
 * HTML escaping.
 *
 * Quotes are escaped as well as brackets. A value that is safe in a text node is not
 * safe in an attribute, and this is the only escaper, so it has to cover both. The
 * forward slash is escaped too, which closes the legacy `</script` break-out.
 */
function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#47;');
}

/**
 * Plain-text sanitizing.
 *
 * Control characters are stripped, and CR/LF are collapsed to a space inside a value.
 * A newline inside a name would otherwise let a submitted value forge a new labeled
 * line in the plain-text part, which is the text-mail equivalent of injection.
 */
function escText(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

/**
 * Header safety.
 *
 * A subject line is a mail header. A CR or LF in one is header injection, so subjects
 * are stripped of both and length-capped before they ever reach the mail port.
 */
function escSubject(value) {
  var s = escText(value);
  return s.length > 180 ? s.slice(0, 177) + '...' : s;
}

/**
 * The visually hidden inbox-preview block.
 *
 * The approved email-safe combination, plus a run of zero-width non-joiners so the
 * client does not pull body copy in after the preheader and show it in the inbox list.
 */
function preheaderBlock(text) {
  var pad = new Array(60).join('&#8204;&nbsp;');
  return '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;' +
    'opacity:0;overflow:hidden;mso-hide:all;">' + esc(text) + pad + '</div>';
}

/**
 * Narrow-width stacking, as a PROGRESSIVE ENHANCEMENT.
 *
 * The approved design switches every key/value row from side-by-side to key-above-value
 * at 390px and below. A fixed 150px key column at 390 squeezes the value into a strip
 * barely wide enough for one word, and an email address then breaks mid-word.
 *
 * This is the one place a stylesheet is used, and the layout does NOT depend on it. Every
 * cell still carries its full inline style, so a client that strips the head (Gmail does)
 * renders exactly the side-by-side layout it rendered before. Nothing here is required
 * for the email to be correct; it only makes narrow widths better where it survives.
 */
var NARROW_STACK_STYLE =
  '<style>@media only screen and (max-width:480px){' +
  '.axp-k,.axp-v{display:block !important;width:auto !important;' +
  'padding-left:0 !important;padding-right:0 !important;}' +
  '.axp-k{padding-bottom:0 !important;}' +
  '.axp-v{padding-top:2px !important;}' +
  '}</style>';

function td(style, inner) {
  return '<td style="' + style + '">' + inner + '</td>';
}

/** A full-width single-cell row. Every block in every email is one of these. */
function block(inner, padStyle) {
  return '<tr>' + td(padStyle || '', inner) + '</tr>';
}

function styleFont(size, weight, color, lineHeight, family) {
  return 'font-family:' + (family || FONT_BODY) + ';font-size:' + size + 'px;font-weight:' + weight +
    ';color:' + color + ';line-height:' + lineHeight + ';';
}

function eyebrow(text) {
  return '<div style="' + styleFont(11.5, 700, PALETTE.tealDeep, 1.5) +
    'letter-spacing:0.13em;text-transform:uppercase;">' + esc(text) + '</div>';
}

function headline(text) {
  return '<div style="' + styleFont(31, 500, PALETTE.ink, 1.15, FONT_DISPLAY) +
    'letter-spacing:-0.01em;padding-top:10px;">' + esc(text) + '</div>';
}

/**
 * The opening paragraph under a headline.
 *
 * Named `leadPara`, not `lead`. Apps Script runs every file in one global scope, so a
 * bare `lead` here is shadowed inside any template whose own parameter is called `lead`,
 * and the call then invokes a Lead record as a function. That is a runtime failure in
 * exactly the templates that matter most, and it is invisible until something renders.
 */
function leadPara(text) {
  return '<div style="' + styleFont(16.5, 400, PALETTE.muted, 1.6) + 'padding-top:14px;">' +
    esc(text) + '</div>';
}

function para(text) {
  return '<div style="' + styleFont(15, 400, PALETTE.muted, 1.65) + 'padding-top:14px;">' +
    esc(text) + '</div>';
}

function note(text) {
  return '<div style="' + styleFont(13, 400, PALETTE.faint, 1.6) + 'padding-top:14px;">' +
    esc(text) + '</div>';
}

/**
 * A labelled panel of key/value rows.
 *
 * `rows` is a list of [key, value, muted?]. A row whose value is empty is DROPPED
 * entirely by the caller when the field is optional and printed as "Not provided" when
 * its absence is itself information. Both behaviours matter and neither is a default:
 * see the callers.
 */
function panel(title, rows) {
  var out = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="width:100%;background:' + PALETTE.panel + ';border:1px solid ' + PALETTE.hair + ';">' +
    '<tr><td style="padding:18px 20px;">';

  if (title) {
    out += '<div style="' + styleFont(11.5, 700, PALETTE.faint, 1.5) +
      'letter-spacing:0.13em;text-transform:uppercase;padding-bottom:10px;">' + esc(title) + '</div>';
  }

  out += '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">';
  for (var i = 0; i < rows.length; i++) {
    var key = rows[i][0];
    var value = rows[i][1];
    var muted = rows[i][2] === true;
    var border = i === 0 ? '' : 'border-top:1px solid ' + PALETTE.hair + ';';
    out += '<tr>' +
      '<td class="axp-k" style="' + border + 'padding:8px 14px 8px 0;vertical-align:top;width:150px;' +
      styleFont(13, 400, PALETTE.faint, 1.5) + '">' + esc(key) + '</td>' +
      '<td class="axp-v" style="' + border + 'padding:8px 0;vertical-align:top;word-break:break-word;' +
      styleFont(15, muted ? 500 : 600, muted ? PALETTE.faint : PALETTE.ink, 1.5) + '">' +
      esc(value) + '</td>' +
      '</tr>';
  }
  out += '</table></td></tr></table>';
  return out;
}

/**
 * A bordered callout.
 *
 * `tone` picks the colour, but the STATUS NEVER DEPENDS ON COLOUR: every callout also
 * carries a written title, so a colour-blind reader and a forced-dark client lose
 * nothing.
 */
function callout(tone, mark, title, body) {
  var color = tone === 'match' ? PALETTE.magenta : PALETTE.teal;
  var bg = tone === 'match' ? PALETTE.matchBg : 'rgba(36,165,188,0.09)';
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="width:100%;background:' + bg + ';border:1px solid ' + color + ';border-left:3px solid ' + color + ';">' +
    '<tr><td style="padding:14px 16px;">' +
    '<div style="' + styleFont(14.5, 700, PALETTE.ink, 1.45) + '">' + esc(mark) + ' ' + esc(title) + '</div>' +
    '<div style="' + styleFont(14, 400, PALETTE.muted, 1.6) + 'padding-top:4px;">' + esc(body) + '</div>' +
    '</td></tr></table>';
}

function groupHeading(title, sub) {
  var out = '<div style="' + styleFont(16, 700, PALETTE.ink, 1.35) +
    'letter-spacing:-0.01em;padding-bottom:6px;border-bottom:2px solid ' + PALETTE.teal + ';">' +
    esc(title) + '</div>';
  if (sub) {
    out += '<div style="' + styleFont(13, 400, PALETTE.faint, 1.55) + 'padding-top:8px;">' + esc(sub) + '</div>';
  }
  return out;
}

/**
 * The email shell: canvas, card, header, body, footer.
 *
 * The logo DEGRADES rather than failing. With no configured asset URL the header prints
 * the wordmark as live text, which is the same information without an image, and no
 * broken-image icon ever appears. This is also why there is no tracking pixel anywhere:
 * the only image either email may contain is the mark.
 */
function shell(o) {
  var logo = o.logoUrl
    ? '<img src="' + esc(o.logoUrl) + '" width="120" height="22" alt="AxisPoint Partners" ' +
      'style="display:block;border:0;outline:none;text-decoration:none;height:22px;width:auto;" />'
    : '<div style="' + styleFont(18, 600, PALETTE.purple, 1) + 'letter-spacing:-0.035em;">AxisPoint</div>';

  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '<title>' + esc(o.title) + '</title>' + NARROW_STACK_STYLE + '</head>' +
    '<body style="margin:0;padding:0;background:' + PALETTE.canvas + ';">' +
    preheaderBlock(o.preheader) +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="width:100%;background:' + PALETTE.canvas + ';"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="' + EMAIL_MAX_WIDTH + '" ' +
    'style="width:100%;max-width:' + EMAIL_MAX_WIDTH + 'px;background:' + PALETTE.surface +
    ';border:1px solid ' + PALETTE.hair + ';">' +

    '<tr><td style="padding:18px 26px;border-bottom:1px solid ' + PALETTE.hair + ';">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>' +
    '<td style="vertical-align:middle;">' + logo + '</td>' +
    '<td style="vertical-align:middle;text-align:right;' + styleFont(11, 700, PALETTE.faint, 1.5) +
    'letter-spacing:0.12em;text-transform:uppercase;">' + esc(o.headerMeta) + '</td>' +
    '</tr></table></td></tr>' +

    '<tr><td style="padding:28px 26px 30px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">' +
    o.body +
    '</table></td></tr>' +

    '<tr><td style="padding:18px 26px;background:' + PALETTE.panel + ';border-top:1px solid ' + PALETTE.hair + ';">' +
    '<div style="' + styleFont(13.5, 700, PALETTE.ink, 1.4) + 'letter-spacing:-0.01em;">AxisPoint Partners</div>' +
    '<div style="' + styleFont(12.5, 400, PALETTE.faint, 1.5) + 'padding-top:2px;">Houston, Texas</div>' +
    '<div style="' + styleFont(12.5, 400, PALETTE.faint, 1.6) + 'padding-top:8px;">' + esc(o.footerNote) + '</div>' +
    (o.footerLegal
      ? '<div style="' + styleFont(12.5, 400, PALETTE.faint, 1.6) + 'padding-top:4px;">' + esc(o.footerLegal) + '</div>'
      : '') +
    '</td></tr>' +

    '</table></td></tr></table></body></html>';
}

/** Byte length of a rendered part, used against the digest ceiling. */
function byteLength(text) {
  var s = String(text === undefined || text === null ? '' : text);
  var bytes = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

/** Plain-text helpers. The text part is a specification, not a stripped fallback. */
function textRule(title) {
  return escText(title).toUpperCase();
}

function textRow(key, value, width) {
  var k = escText(key) + ':';
  var w = width || 19;
  while (k.length < w) k += ' ';
  return k + escText(value);
}

function textWrap(value, width) {
  var w = width || 62;
  var words = escText(value).split(' ');
  var lines = [];
  var line = '';
  for (var i = 0; i < words.length; i++) {
    if (line === '') line = words[i];
    else if ((line + ' ' + words[i]).length <= w) line += ' ' + words[i];
    else { lines.push(line); line = words[i]; }
  }
  if (line !== '') lines.push(line);
  return lines.join('\n');
}
