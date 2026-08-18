import { useCallback, useRef, useState } from 'react';
import { FIRM, type PartnerProfile } from './profiles';

/**
 * Save one partner's contact, as specified in the approved board's q7 (design@2026-07-30),
 * amended by the owner-directed single-page collapse of 2026-08-17 and by the owner-directed
 * split of 2026-08-18.
 *
 * WHAT CHANGED, AND WHY IT CHANGED BACK. The board drew one Save Contact per partner page,
 * because a scan resolved to one partner. The 2026-08-17 collapse replaced that with ONE
 * action producing ONE file carrying TWO records. Real-device testing then established that
 * this cannot work on the delivery path this app has: **iOS Safari ignores the `download`
 * attribute on a `blob:` URL**, so it never sees a real named `.vcf`, never offers the
 * "Add All 2 Contacts" import flow, and falls back to a single-item Quick Look preview. That
 * is a platform limitation, not a defect in the file, and no amount of correcting the bytes
 * reaches it.
 *
 * So the page now offers **two separate actions, one per partner, each producing a file that
 * contains exactly one record.** Single-record delivery over this exact path is the proven
 * case: it is what this project shipped for its entire life before 2026-08-17. There is still
 * deliberately no combined or firm-level record: a person's address book should end up with
 * the two people they met, not with an organization stub they did not ask for.
 *
 * The honest ceiling, quoting the board, is unchanged: a web page can open or download a
 * contact file, but it cannot observe whether the visitor completed the operating system's
 * save. Every state below reports only what the page actually knows, and **no state claims a
 * person was saved to your contacts.**
 *
 * STILL LOCAL, STILL NOT A PRODUCTION DELIVERY ARCHITECTURE. The contact-file generation and
 * delivery method remains an unresolved owner value (`docs/design-sources.md`). No hosted
 * `.vcf` is fetched, no GAS endpoint is called, nothing is uploaded. The file is built in
 * memory from owner-confirmed values and handed to the browser as an object URL, which is
 * then revoked on a delay. When the real architecture is decided, `prepare()` is the single
 * function to replace.
 */

export type SaveState = 'default' | 'preparing' | 'handoffMobile' | 'handoffWide' | 'failed';

/** The board caps the preparing state at roughly six seconds. */
const PREPARE_TIMEOUT_MS = 6000;
/** Simulated preparation time, short enough to feel real without being fake-slow. */
const SIMULATED_PREPARE_MS = 450;

/**
 * Splits a display name into the family/given components `N` requires.
 *
 * Deliberately simple, and deliberately not clever: the two real names are two words each.
 * A single-word name yields a given name and no family name rather than guessing, and any
 * additional words are treated as part of the family name, which is the right default for
 * the compound surnames this would first encounter.
 */
function nameComponents(displayName: string): { given: string; family: string } {
  const parts = displayName.trim().split(/\s+/);
  const given = parts[0] ?? '';
  const family = parts.slice(1).join(' ');
  return { given, family };
}

/**
 * One partner's Save action label.
 *
 * THE GIVEN NAME IS WHAT DISTINGUISHES THEM. "Save Zachary's contact" beside "Save Ethaniel's
 * contact" differs in the first word after the verb, which is where a thumb scanning two
 * stacked controls at 15px actually looks. Two full names differ later and read as one
 * repeated button. The accessible name on the control carries the full name, so nothing
 * depends on a visitor already knowing which Zachary.
 *
 * Exported as a function rather than a constant because the Contact Exchange's success screen
 * reuses these exact controls as its primary actions (approved §x10). One function, read in
 * both places, so the card and the success screen cannot drift into calling the same button
 * two different things.
 */
export function saveActionLabel(profile: PartnerProfile): string {
  return `Save ${nameComponents(profile.displayName).given}'s contact`;
}

export function saveLabels(profile: PartnerProfile): Record<SaveState, string> {
  const action = saveActionLabel(profile);
  return {
    default: action,
    preparing: 'Preparing contact',
    handoffMobile: action,
    handoffWide: action,
    failed: 'Try again',
  };
}

export function saveMessages(profile: PartnerProfile): Record<SaveState, string> {
  return {
    default: `Adds ${profile.displayName} to your contacts as one record.`,
    preparing: 'Preparing contact…',
    handoffMobile: 'Contact card opened. Finish saving it in Contacts.',
    handoffWide: `Contact file downloaded. It contains ${profile.displayName}'s record.`,
    failed: 'Contact file could not be prepared. Try again or use the verified details below.',
  };
}

/**
 * The filename the browser is offered for one partner's file.
 *
 * It names the person, because the visitor now chooses a person before the file exists, and a
 * downloads folder holding two files both called `AxisPoint-Partners.vcf` would be the worse
 * outcome of the split. Spaces become hyphens: a space in a `download` attribute survives most
 * browsers and is mangled by some, and there is no reason to find out which.
 */
export function contactFilename(profile: PartnerProfile): string {
  return `AxisPoint-${profile.displayName.trim().replace(/\s+/g, '-')}.vcf`;
}

/**
 * Escapes one vCard TEXT value.
 *
 * Backslash, comma, semicolon, and newline carry structural meaning inside a property value,
 * so a real name or note containing one would otherwise split the value or invent a field.
 * Backslash goes first, or it would double-escape the escapes added after it. Structured
 * properties (`N`, `ADR`) escape each COMPONENT and then join with a literal `;`, which is
 * why the separator is added by the caller rather than by this function.
 */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Both specifications fold a content line longer than 75 octets. */
const FOLD_LIMIT = 75;

/**
 * Folds one content line to the 75-octet limit, per RFC 2426 §2.6.
 *
 * WHY THIS EXISTS NOW. The owner-approved organization note is 91 octets once escaped and
 * prefixed with `NOTE:`, so it is the first value this builder can emit that passes the limit.
 * Folding is the specification's own answer to that, and the alternative — emitting a
 * too-long line and hoping — is the kind of thing that works on one handset and not the other.
 *
 * The continuation marker is CRLF followed by a single space, which an unfolding parser strips
 * to recover the original value. Measurement is in OCTETS, because the limit is stated in
 * octets; iteration is by CODE POINT, so a multi-byte character can never be split across the
 * fold into two invalid bytes. The first line spends the full 75 and each continuation spends
 * 74, because its leading space is one of the octets.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= FOLD_LIMIT) return line;

  const out: string[] = [];
  let current = '';
  let used = 0;
  let budget = FOLD_LIMIT;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (used + size > budget) {
      out.push(current);
      current = '';
      used = 0;
      // Every continuation line starts with the space that marks it as one.
      budget = FOLD_LIMIT - 1;
    }
    current += char;
    used += size;
  }
  out.push(current);

  return out.join('\r\n ');
}

/**
 * Builds ONE vCard record for one partner.
 *
 * Nothing unverified is ever written. A null phone, email, or profile URL simply produces no
 * line, which is why a record can never carry a placeholder.
 *
 * VERSION IS 3.0 ON PURPOSE. vCard 3.0 (RFC 2426) is what iOS Contacts and Android import
 * most reliably; 4.0 (RFC 6350) support is uneven across exactly the consumer apps this file
 * is aimed at. The record's grammar, escaping, folding, CRLF line breaks, and property
 * ordering satisfy both specifications; only the version token differs.
 */
export function buildPartnerRecord(profile: PartnerProfile): string {
  const { given, family } = nameComponents(profile.displayName);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeText(profile.displayName)}`,
    `N:${escapeText(family)};${escapeText(given)};;;`,
    `TITLE:${escapeText(profile.title)}`,
    `ORG:${escapeText(FIRM.name)}`,
  ];

  // A partner with no confirmed address falls back to the one approved firm inbox.
  const email = profile.email ?? FIRM.email;
  lines.push(`EMAIL;TYPE=WORK:${escapeText(email)}`);

  // No confirmed number means no TEL line at all, never a placeholder or a masked number.
  if (profile.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeText(profile.phone.display)}`);

  lines.push(`URL:${escapeText(profile.profileUrl ?? FIRM.websiteUrl)}`);
  // Locality only. The board records that no street address appears on this surface.
  lines.push('ADR;TYPE=WORK:;;;Houston;TX;;USA');
  if (FIRM.organizationNote) lines.push(`NOTE:${escapeText(FIRM.organizationNote)}`);
  lines.push('END:VCARD');

  return lines.map(foldLine).join('\r\n');
}

/**
 * Builds the contact file for ONE partner: exactly one record, and never more.
 *
 * WHY THIS TAKES ONE PROFILE AND NOT A LIST. It used to take a list and concatenate the
 * records, which is a valid vCard stream and was still the wrong file to hand this app's
 * visitors. iOS Safari ignores the `download` attribute on a `blob:` URL, so a multi-record
 * stream delivered this way never reaches the "Add All 2 Contacts" flow; it reaches a Quick
 * Look preview showing one card. Taking a single profile makes the one-record guarantee a
 * property of the signature rather than of a caller remembering to pass a one-element array.
 *
 * The file ends with a trailing CRLF, so `END:VCARD` is a complete line; some parsers drop a
 * record that is not newline-terminated.
 */
export function buildContactCard(profile: PartnerProfile): string {
  return buildPartnerRecord(profile) + '\r\n';
}

/**
 * How long the object URL outlives the click that consumed it.
 *
 * WHY THIS IS NOT ZERO, WHICH IS WHAT IT USED TO BE. `a.click()` only STARTS the download; the
 * browser reads the blob asynchronously afterwards. Revoking on the next line is therefore a
 * race, and it is a race iOS Safari loses in practice: the URL is already dead when the read
 * reaches it, and the visitor gets an empty file or no file at all. That is the single
 * most-reported failure of the synthetic-anchor download, and the synthetic-anchor download is
 * exactly the path this app takes.
 *
 * WHY FORTY SECONDS AND NOT FOUR HUNDRED MILLISECONDS. No event reports "the browser has
 * finished reading", so the only honest choice is a window longer than any plausible read
 * rather than a number tuned to one device. Forty seconds is FileSaver.js's long-standing
 * value, chosen against the same browsers for the same reason. Overshooting costs one ~1 KB
 * blob held a moment longer; undershooting costs the bug above, silently, on the device class
 * a QR card is most often scanned with.
 *
 * THE SPLIT MADE THIS MORE LOAD-BEARING, NOT LESS. A visitor who wants both partners now
 * presses Save twice, so two reads overlapping inside the window is the EXPECTED case rather
 * than an edge case. Each file's cleanup stays tied to that file; see `deliverContactFile`.
 */
export const REVOKE_DELAY_MS = 40_000;

/**
 * The browser operations that delivering a file needs, named so a test can supply its own.
 *
 * The defect this seam exists to hold shut is one of ORDERING and TIMING, and neither is
 * observable through the real `URL` and `document` globals from a node test. Injecting them is
 * what turns "the revoke does not happen synchronously" into an assertion rather than a
 * comment somebody has to keep believing.
 */
export interface DeliveryPort {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  /** Puts the file in front of the visitor: a download on wide screens, a sheet on phones. */
  triggerDownload: (url: string, filename: string) => void;
  /** Schedules the deferred revoke. */
  schedule: (run: () => void, delayMs: number) => void;
}

/** The real browser. Built on demand, so a test that injects a port never touches a global. */
function browserDelivery(): DeliveryPort {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    triggerDownload: (url, filename) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    schedule: (run, delayMs) => {
      window.setTimeout(run, delayMs);
    },
  };
}

/**
 * Hands one prepared contact file to the browser, then releases its object URL later.
 *
 * THE REVOKE TIMER IS DELIBERATELY NOT ONE OF THE HOOK'S TIMERS. `useSaveContact` keeps a list
 * of timers it cancels at the start of every save, which is correct for the state timers: a
 * second press must not be governed by the first press's clock. Putting the revoke in that
 * list would mean a visitor who presses Save twice inside forty seconds cancels the first
 * file's cleanup and leaks that URL for the life of the document. Leaving it a plain window
 * timer keeps each file's cleanup tied to that file. The split makes that ordinary rather than
 * hypothetical: two controls, pressed seconds apart, and each hook instance also keeps its own
 * timer list, so neither partner's save can cancel the other's. The callback closes over a
 * string and touches no React state, so it is safe after an unmount, and a real page teardown
 * releases every outstanding object URL regardless.
 *
 * Returns the URL it created, so a caller can name it in an assertion.
 */
export function deliverContactFile(card: string, filename: string, port: DeliveryPort = browserDelivery()): string {
  const blob = new Blob([card], { type: 'text/vcard;charset=utf-8' });
  const url = port.createObjectURL(blob);
  port.triggerDownload(url, filename);
  // Ordering is the whole point: the click is issued first, and the revoke is scheduled, never
  // performed, on this line.
  port.schedule(() => port.revokeObjectURL(url), REVOKE_DELAY_MS);
  return url;
}

/** Wide screens download a file; small screens open a contact sheet. */
function deliveredAsDownload(): boolean {
  return window.matchMedia('(min-width: 700px)').matches;
}

/**
 * ONE partner's save action, with its own independent state.
 *
 * ONE HOOK INSTANCE PER PARTNER, WHICH IS THE WHOLE POINT OF THE SPLIT. Each call owns its own
 * state machine, its own timers, and its own file. Zachary's save reaching a handoff or a
 * failure says nothing about Ethaniel's control, and pressing one while the other is preparing
 * cannot disturb it.
 */
export function useSaveContact(profile: PartnerProfile) {
  const [state, setState] = useState<SaveState>('default');
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  /**
   * The single seam a future production architecture replaces. Today it builds the file
   * locally. It never fetches.
   */
  const prepare = useCallback(async (): Promise<string> => {
    // Development-only failure switch, so the approved recoverable-failure state can be
    // inspected without a backend. Gated on DEV, so it is absent from production.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('save') === 'fail') {
      throw new Error('simulated preparation failure');
    }
    const card = buildContactCard(profile);
    // Counts terminators rather than checking for one. EXACTLY ONE is the reason this change
    // exists: a file that picked up a second record would reach iOS Safari as a preview of a
    // single card, which is the failure the split was made to leave behind.
    const records = card.split('END:VCARD').length - 1;
    if (records !== 1) throw new Error('contact file must hold exactly one record');
    return card;
  }, [profile]);

  const save = useCallback(async () => {
    clearTimers();
    setState('preparing');

    // The approved cap: if the file does not resolve in roughly six seconds, move to
    // recoverable failure rather than spinning indefinitely.
    const cap = window.setTimeout(() => {
      setState((s) => (s === 'preparing' ? 'failed' : s));
    }, PREPARE_TIMEOUT_MS);
    timers.current.push(cap);

    try {
      const card = await new Promise<string>((resolve, reject) => {
        const t = window.setTimeout(() => {
          prepare().then(resolve).catch(reject);
        }, SIMULATED_PREPARE_MS);
        timers.current.push(t);
      });

      deliverContactFile(card, contactFilename(profile));

      window.clearTimeout(cap);
      // Chosen by how the file was delivered, not by guessing the device.
      setState(deliveredAsDownload() ? 'handoffWide' : 'handoffMobile');
    } catch {
      window.clearTimeout(cap);
      setState('failed');
    }
  }, [prepare, profile]);

  return { state, save, message: saveMessages(profile)[state], label: saveLabels(profile)[state] };
}
