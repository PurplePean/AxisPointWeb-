import { E2eBanner } from '@axispoint/brand';
import App from './App';

/**
 * The QR application root: the e2e warning banner, then the card.
 *
 * WHY THIS IS A COMPONENT AND NOT JUST THE BODY OF `main.tsx`. `main.tsx` calls
 * `ReactDOM.createRoot`, which needs a real DOM element, so nothing inside it can be
 * rendered by a test. Everything this app shows therefore lives here instead, where
 * `apps/qr/tests/e2eBanner.test.ts` can render the real tree and read the real output.
 * That test is the reason the banner is now provably mounted rather than assumed to be.
 *
 * WHY THE BANNER IS BACK. It was removed alongside the V1 `ContactForm` on the reasoning
 * that the card "submits nothing and consumes no endpoint", so an e2e warning would have
 * described a connection that did not exist. That reasoning stopped being true when the
 * Contact Exchange was built: this app resolves `VITE_V2_SUBMISSION_ENDPOINT`, injects
 * `__E2E_MODE__`, and posts a real `contact_exchange` envelope to a real backend in e2e
 * mode. `vite.config.ts` kept printing the terminal warning the whole time, so the
 * in-browser half of the same warning was simply missing.
 *
 * The banner adds a VISIBLE warning on top of the fail-closed protections in
 * `vite.endpoint.ts`; it does not replace them. A missing endpoint, or a V1-style
 * `VITE_FORM_ENDPOINT` on its own, still throws at config time and the server never
 * starts.
 *
 * `E2eBanner` returns null unless `__E2E_MODE__` is true, which is false for plain
 * `pnpm dev` and false for every `vite build`. `scripts/test/inspect-bundle.mjs` proves
 * its copy is absent from the production bundle rather than trusting that.
 */
export default function Root() {
  return (
    <>
      <E2eBanner />
      <App />
    </>
  );
}
