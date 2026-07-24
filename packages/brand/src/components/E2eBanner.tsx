/**
 * Dev-only warning banner shown when the app is running in e2e mode
 * (`pnpm dev:e2e`), i.e. wired to the REAL production GAS backend.
 *
 * `__E2E_MODE__` is injected by each app's vite.config.ts define block. It is only ever
 * true in `--mode e2e`; in normal `pnpm dev` and production builds it is false and this
 * component renders nothing. The goal is to make it impossible to forget that a live
 * submission would create a real lead, email, and calendar event.
 */
declare const __E2E_MODE__: boolean;

export function E2eBanner() {
  const active = typeof __E2E_MODE__ !== 'undefined' ? __E2E_MODE__ : false;
  if (!active) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: '#b91c1c',
        color: '#ffffff',
        font: '600 13px/1.4 system-ui, sans-serif',
        textAlign: 'center',
        padding: '6px 12px',
        letterSpacing: '0.02em',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
      }}
    >
      E2E MODE: real production backend enabled. Submitting this form creates a live lead,
      email, and calendar event.
    </div>
  );
}
