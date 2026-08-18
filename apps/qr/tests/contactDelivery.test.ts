import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deliverContactFile,
  CONTACT_FILENAME,
  REVOKE_DELAY_MS,
  type DeliveryPort,
} from '../src/useSaveContact';

/*
 * THE OBJECT URL MUST OUTLIVE THE CLICK THAT CONSUMES IT.
 *
 * WHY THIS TEST EXISTS. The delivery step used to call `URL.revokeObjectURL(url)` on the line
 * after `a.click()`. That reads as tidy cleanup and is in fact a race: the click only STARTS
 * the download, and the browser reads the blob afterwards. iOS Safari loses that race
 * routinely, producing an empty file or no file, and it does so silently, on the device class
 * a QR card is most often scanned with. Nothing in `vcard.test.ts` could ever have caught it,
 * because the BYTES of the file were never wrong.
 *
 * WHAT THESE ASSERTIONS ACTUALLY PIN. Ordering and deferral inside our own code: that the
 * download is triggered before any revoke, that no revoke happens synchronously, that the
 * revoke which is scheduled targets the URL that was handed out, and that two deliveries do
 * not cross their cleanup. They run against an injected `DeliveryPort`, so they are exact.
 *
 * WHAT THEY CANNOT DO. They cannot prove forty seconds is enough on a real iPhone, because no
 * browser reports when it has finished reading a blob. That is why the constant is a generous
 * window rather than a tuned one, and real-device import remains the outstanding manual
 * verification recorded in `docs/STATUS.md`.
 */

interface Recorder {
  port: DeliveryPort;
  /** Every event in the order it happened, so ordering is asserted and not inferred. */
  events: string[];
  created: string[];
  revoked: string[];
  scheduled: { run: () => void; delayMs: number }[];
  /** Fires every pending timer, as the browser would once the delay elapses. */
  elapse: () => void;
}

function recorder(): Recorder {
  const r: Recorder = {
    events: [],
    created: [],
    revoked: [],
    scheduled: [],
    elapse: () => {
      const pending = r.scheduled.splice(0);
      for (const t of pending) t.run();
    },
    port: {
      createObjectURL: () => {
        const url = `blob:test/${r.created.length}`;
        r.created.push(url);
        r.events.push(`create ${url}`);
        return url;
      },
      revokeObjectURL: (url) => {
        r.revoked.push(url);
        r.events.push(`revoke ${url}`);
      },
      triggerDownload: (url, filename) => {
        r.events.push(`download ${url} as ${filename}`);
      },
      schedule: (run, delayMs) => {
        r.events.push(`schedule ${delayMs}`);
        r.scheduled.push({ run, delayMs });
      },
    },
  };
  return r;
}

const CARD = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Test\r\nEND:VCARD\r\n';

/* ── The regression itself ────────────────────────────────────────────────── */

test('no object URL is revoked synchronously with the click', () => {
  const r = recorder();

  const url = deliverContactFile(CARD, CONTACT_FILENAME, r.port);

  assert.equal(r.created.length, 1, 'exactly one object URL should be created');
  assert.deepEqual(
    r.revoked,
    [],
    'the URL was revoked before this call returned; that is the iOS Safari race this guards',
  );
  assert.equal(url, r.created[0]);
});

test('the download is triggered before anything schedules a revoke', () => {
  const r = recorder();

  deliverContactFile(CARD, CONTACT_FILENAME, r.port);

  assert.deepEqual(r.events, [
    'create blob:test/0',
    `download blob:test/0 as ${CONTACT_FILENAME}`,
    `schedule ${REVOKE_DELAY_MS}`,
  ]);
});

/* ── The delay is a real window, not a token one ──────────────────────────── */

test('the revoke is deferred by a window wide enough to be a fix', () => {
  const r = recorder();

  deliverContactFile(CARD, CONTACT_FILENAME, r.port);

  assert.equal(r.scheduled.length, 1, 'exactly one revoke should be scheduled');
  // A deferral of a few milliseconds would satisfy "not synchronous" while leaving the bug
  // intact on a slow device, so the floor is asserted rather than the mechanism alone.
  assert.ok(
    r.scheduled[0].delayMs >= 1000,
    `revoke delay ${r.scheduled[0].delayMs}ms is too short to survive a slow read`,
  );
  assert.equal(r.scheduled[0].delayMs, REVOKE_DELAY_MS);
});

/* ── Deferred is not skipped: the URL is still cleaned up ─────────────────── */

test('the scheduled revoke releases exactly the URL that was handed out', () => {
  const r = recorder();

  const url = deliverContactFile(CARD, CONTACT_FILENAME, r.port);
  r.elapse();

  assert.deepEqual(r.revoked, [url], 'the delayed cleanup must still happen, and on that URL');
});

test('two saves each get their own URL and each one is released', () => {
  const r = recorder();

  const first = deliverContactFile(CARD, CONTACT_FILENAME, r.port);
  const second = deliverContactFile(CARD, CONTACT_FILENAME, r.port);
  assert.notEqual(first, second, 'precondition: a second save creates a second object URL');

  // Both revokes are still pending here, which is the case a shared cancelling timer list
  // would break: the second save would drop the first file's cleanup on the floor.
  assert.equal(r.revoked.length, 0);
  r.elapse();

  assert.deepEqual(r.revoked.slice().sort(), [first, second].sort(), 'both URLs must be released');
});

/* ── The visitor-facing filename is unchanged by this refactor ────────────── */

test('the download is offered under the contact filename', () => {
  const r = recorder();

  deliverContactFile(CARD, CONTACT_FILENAME, r.port);

  assert.ok(
    r.events.includes(`download blob:test/0 as ${CONTACT_FILENAME}`),
    'the download must be offered under CONTACT_FILENAME',
  );
});
