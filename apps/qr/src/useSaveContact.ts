import { useCallback, useRef, useState } from 'react';
import { FIRM, PARTNERS, type PartnerProfile } from './profiles';

/**
 * Save our contacts, as specified in the approved board's q7 (design@2026-07-30), amended
 * by the owner-directed single-page collapse of 2026-08-17.
 *
 * WHAT CHANGED. The board drew one Save Contact per partner page, because a scan resolved
 * to one partner. There is one combined page now, so there is one action, and it produces
 * **exactly two contact records, Zachary and Ethaniel individually**. There is deliberately
 * no third combined or firm-level record: a person's address book should end up with the two
 * people they met, not with two people and an organization stub they did not ask for. A
 * device presented with this file typically prompts to add 2 contacts.
 *
 * The honest ceiling, quoting the board: a web page can open or download a contact file, but
 * it cannot observe whether the visitor completed the operating system's save. Every state
 * below reports only what the page actually knows, and **no state claims a person was saved
 * to your contacts.**
 *
 * STILL LOCAL, STILL NOT A PRODUCTION DELIVERY ARCHITECTURE. The contact-file generation and
 * delivery method remains an unresolved owner value (`docs/design-sources.md`). No hosted
 * `.vcf` is fetched, no GAS endpoint is called, nothing is uploaded. The file is built in
 * memory from owner-confirmed values and handed to the browser as an object URL, which is
 * then revoked on a delay. When the real architecture is decided, `prepare()` is the single function to
 * replace.
 *
 * NOT VERIFIED ON A REAL DEVICE. The delivery mechanism below is a synthetic anchor click on
 * a `blob:` URL. That has never been exercised on a real iPhone or a real Android handset,
 * and a multi-record file adds a second unverified behaviour on top of it, because some
 * contact importers read only the first record in a stream. The tests in
 * `apps/qr/tests/vcard.test.ts` pin what the FILE contains; they cannot pin what a phone does
 * with it. Real-device import is an outstanding manual verification, recorded in
 * `docs/STATUS.md`.
 */

export type SaveState = 'default' | 'preparing' | 'handoffMobile' | 'handoffWide' | 'failed';

/** The board caps the preparing state at roughly six seconds. */
const PREPARE_TIMEOUT_MS = 6000;
/** Simulated preparation time, short enough to feel real without being fake-slow. */
const SIMULATED_PREPARE_MS = 450;

export const SAVE_MESSAGES: Record<SaveState, string> = {
  default: 'Adds Zachary and Ethaniel to your contacts as two separate records.',
  preparing: 'Preparing contacts…',
  handoffMobile: 'Contact cards opened. Finish saving them in Contacts.',
  handoffWide: 'Contact file downloaded. It contains both partner records.',
  failed: 'Contact file could not be prepared. Try again or use the verified details below.',
};

/**
 * The one Save action label.
 *
 * Exported on its own because the Contact Exchange's success screen reuses this exact
 * control as its primary action (approved §x10). One constant, read in both places, so the
 * card and the success screen cannot drift into calling the same button two things.
 */
export const SAVE_ACTION_LABEL = 'Save our contacts';

export const SAVE_LABELS: Record<SaveState, string> = {
  default: SAVE_ACTION_LABEL,
  preparing: 'Preparing contacts',
  handoffMobile: SAVE_ACTION_LABEL,
  handoffWide: SAVE_ACTION_LABEL,
  failed: 'Try again',
};

/** The filename the browser is offered on a wide-screen download. */
export const CONTACT_FILENAME = 'AxisPoint-Partners.vcf';

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
 * Builds ONE vCard record for one partner.
 *
 * Nothing unverified is ever written. A null phone, email, or profile URL simply produces no
 * line, which is why a record can never carry a placeholder. The organization note is omitted
 * until its wording is approved.
 *
 * VERSION IS 3.0 ON PURPOSE. vCard 3.0 (RFC 2426) is what iOS Contacts and Android import
 * most reliably; 4.0 (RFC 6350) support is uneven across exactly the consumer apps this file
 * is aimed at. Since real-device import is the outstanding risk on this feature, this is not
 * the change to take that risk with. The record's grammar, escaping, CRLF line breaks, and
 * property ordering satisfy both specifications; only the version token differs.
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

  return lines.join('\r\n');
}

/**
 * Builds the contact file: one record per partner, concatenated.
 *
 * Both specifications define a vCard stream as one or more records back to back, so this is
 * the standard shape for "two contacts in one file" and not a trick. The file ends with a
 * trailing CRLF, so the last `END:VCARD` is a complete line; some parsers drop a final record
 * that is not newline-terminated.
 */
export function buildContactCard(partners: readonly PartnerProfile[] = PARTNERS): string {
  return partners.map(buildPartnerRecord).join('\r\n') + '\r\n';
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
 * timer keeps each file's cleanup tied to that file. The callback closes over a string and
 * touches no React state, so it is safe after an unmount, and a real page teardown releases
 * every outstanding object URL regardless.
 *
 * Returns the URL it created, so a caller can name it in an assertion.
 */
export function deliverContactFile(
  card: string,
  filename: string = CONTACT_FILENAME,
  port: DeliveryPort = browserDelivery(),
): string {
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

export function useSaveContact() {
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
    const card = buildContactCard();
    // Counts terminators rather than checking for one: a file that lost a record on the way
    // out is the failure mode worth catching, and it is the exact multi-record risk here.
    const records = card.split('END:VCARD').length - 1;
    if (records !== PARTNERS.length) throw new Error('contact file incomplete');
    return card;
  }, []);

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

      deliverContactFile(card);

      window.clearTimeout(cap);
      // Chosen by how the file was delivered, not by guessing the device.
      setState(deliveredAsDownload() ? 'handoffWide' : 'handoffMobile');
    } catch {
      window.clearTimeout(cap);
      setState('failed');
    }
  }, [prepare]);

  return { state, save, message: SAVE_MESSAGES[state], label: SAVE_LABELS[state] };
}
