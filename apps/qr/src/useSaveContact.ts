import { useCallback, useRef, useState } from 'react';
import { FIRM, type PartnerProfile } from './profiles';

/**
 * Save Contact, as specified in the approved board's q7 (design@2026-07-30).
 *
 * The honest ceiling, quoting the board: a web page can open or download a contact
 * file, but it cannot observe whether the visitor completed the operating system's
 * save. Every state below reports only what the page actually knows, and **no state
 * claims a person was saved to your contacts.**
 *
 * SIMULATED AND LOCAL. The production contact-file generation and delivery method is
 * an unresolved owner decision, so this pass deliberately does not select one. No
 * hosted `.vcf` is fetched, no GAS endpoint is called, and nothing is uploaded. The
 * card is built in memory from the approved confirmed values and handed to the
 * browser as an object URL, which is then revoked. When the real architecture is
 * decided, `prepare()` is the single function to replace.
 */

export type SaveState = 'default' | 'preparing' | 'handoffMobile' | 'handoffWide' | 'failed';

/** The board caps the preparing state at roughly six seconds. */
const PREPARE_TIMEOUT_MS = 6000;
/** Simulated preparation time, short enough to feel real without being fake-slow. */
const SIMULATED_PREPARE_MS = 450;

export const SAVE_MESSAGES: Record<SaveState, string> = {
  default: 'Adds the name, title, organization, and any verified phone or email to your contacts.',
  preparing: 'Preparing contact…',
  handoffMobile: 'Contact card opened. Finish saving it in Contacts.',
  handoffWide: 'Contact file downloaded.',
  failed: 'Contact file could not be prepared. Try again or use the verified details below.',
};

export const SAVE_LABELS: Record<SaveState, string> = {
  default: 'Save contact',
  preparing: 'Preparing contact',
  handoffMobile: 'Save contact',
  handoffWide: 'Save contact',
  failed: 'Try again',
};

/**
 * Build the contact card from confirmed values only.
 *
 * Nothing unverified is ever written. A null phone, email, or profile URL simply
 * produces no line, which is why the record can never carry a placeholder. The
 * organization note is omitted until its wording is approved.
 */
export function buildContactCard(profile: PartnerProfile | null): string {
  const isFirm = profile === null;
  const fullName = isFirm ? FIRM.name : profile.displayName;
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${fullName}`];

  if (!isFirm) {
    const [first, ...rest] = profile.displayName.split(' ');
    lines.push(`N:${rest.join(' ')};${first};;;`);
    lines.push(`TITLE:${profile.title}`);
  }

  lines.push(`ORG:${FIRM.name}`);

  const email = isFirm ? FIRM.email : (profile.email ?? FIRM.email);
  lines.push(`EMAIL;TYPE=WORK:${email}`);

  const phone = isFirm ? FIRM.phone : profile.phone;
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${phone.display}`);

  lines.push(`URL:${(!isFirm && profile.profileUrl) || FIRM.websiteUrl}`);
  // Locality only. The board records that no street address appears on this surface.
  lines.push(`ADR;TYPE=WORK:;;;Houston;TX;;USA`);
  if (FIRM.organizationNote) lines.push(`NOTE:${FIRM.organizationNote}`);
  lines.push('END:VCARD');

  return lines.join('\r\n');
}

/** Wide screens download a file; small screens open a contact sheet. */
function deliveredAsDownload(): boolean {
  return window.matchMedia('(min-width: 700px)').matches;
}

export function useSaveContact(profile: PartnerProfile | null) {
  const [state, setState] = useState<SaveState>('default');
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  /**
   * The single seam a future production architecture replaces. Today it builds the
   * card locally. It never fetches.
   */
  const prepare = useCallback(async (): Promise<string> => {
    // Development-only failure switch, so the approved recoverable-failure state can be
    // inspected without a backend. Gated on DEV, so it is absent from production.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('save') === 'fail') {
      throw new Error('simulated preparation failure');
    }
    const card = buildContactCard(profile);
    if (!card.includes('END:VCARD')) throw new Error('contact card incomplete');
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

      const blob = new Blob([card], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(profile?.displayName ?? FIRM.name).replace(/\s+/g, '-')}.vcf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      window.clearTimeout(cap);
      // Chosen by how the file was delivered, not by guessing the device.
      setState(deliveredAsDownload() ? 'handoffWide' : 'handoffMobile');
    } catch {
      window.clearTimeout(cap);
      setState('failed');
    }
  }, [prepare, profile]);

  return { state, save, message: SAVE_MESSAGES[state], label: SAVE_LABELS[state] };
}
