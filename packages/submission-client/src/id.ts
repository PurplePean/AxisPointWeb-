/**
 * Submission id generation.
 *
 * The backend validates this as a UUID v4 with a strict pattern, so a "good enough"
 * random string is rejected at the boundary. `crypto.randomUUID` is used where available
 * and a `getRandomValues` fallback covers the rest; the last resort exists only so a test
 * environment without either does not crash, and it is never the path a browser takes.
 */

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
};

function getCrypto(): CryptoLike | undefined {
  return typeof globalThis !== 'undefined'
    ? (globalThis as { crypto?: CryptoLike }).crypto
    : undefined;
}

export function newSubmissionId(): string {
  const c = getCrypto();

  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    // Version 4 and the RFC 4122 variant, set explicitly. The backend pattern checks both
    // nibbles, so leaving them to chance fails roughly fifteen times in sixteen.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex: string[] = [];
    for (let i = 0; i < bytes.length; i += 1) hex.push(bytes[i].toString(16).padStart(2, '0'));

    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  throw new Error('no crypto source available for submission id generation');
}

/** Exposed so tests can assert an id would survive the backend's own pattern. */
export function isSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}
