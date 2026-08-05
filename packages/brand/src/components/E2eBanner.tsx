/**
 * Dev-only warning banner shown when the app is running in e2e mode (`pnpm dev:e2e`), i.e.
 * wired to a REAL backend rather than the simulator.
 *
 * `__E2E_MODE__` is injected by each app's vite.config.ts define block. It is only ever
 * true in `--mode e2e`; in normal `pnpm dev` and production builds it is false and this
 * component renders nothing.
 *
 * THE COPY DELIBERATELY DOES NOT MENTION A CALENDAR EVENT. It used to, and that is wrong
 * for the V2 intake: submitting creates records and sends mail, but booking is a separate
 * command that a submission does not invoke. Overstating the blast radius trains people to
 * discount the warning, which is worse than not showing one. The wording is also kept
 * general because this component is shared, and the two apps do not reach the same backend.
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
      E2E MODE: a real backend is enabled. Submitting may create live records and send real
      email. It does not create a calendar event; booking is a separate command.
    </div>
  );
}
