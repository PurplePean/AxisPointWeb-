import { useState } from 'react';

import { Mark } from '@axispoint/brand';
import { FIRM, PARTNERS, type PartnerProfile } from './profiles';
import { WEB_LINKS } from './webLinks';
import { useSaveContact } from './useSaveContact';
import { ContactExchange } from './exchange/ContactExchange';

/**
 * The QR business-card surface, built from the approved board
 * `AxisPoint QR Frontend.dc.html` (design@2026-07-30) and amended by the owner-directed
 * single-page collapse of 2026-08-17.
 *
 * WHAT THE COLLAPSE CHANGED. The board drew one template rendering one of three records:
 * Zachary, Ethaniel, or a firm fallback for a card that did not resolve. This surface now
 * renders ONE page carrying BOTH partners together, with each partner's owner-confirmed
 * direct line and direct address visible on it. There is no per-partner variant, no
 * fallback state, and nothing for a visitor or a query parameter to select.
 *
 * The firm fallback's copy is gone with the state it belonged to. That includes the
 * owner-directed 2026-07-31 replacement for the board's unresolved-card sentence: there is
 * no unresolved card to describe when every scan lands on the same page.
 *
 * Everything else the board fixed is unchanged: the real AxisPoint header, no photography,
 * no headshots, no language selector, no in-page QR code. Above 480px the single column
 * caps its measure and centres. There is no desktop composition and no second breakpoint,
 * which is the approved wide-screen behaviour.
 */

const ROUTE_ROW =
  'flex items-center justify-between gap-4 rounded-[2px] font-semibold transition-colors hover:bg-[rgba(56,40,93,0.06)] hover:px-2';

function RouteRow({ href, children, accent = false, last = false }: { href: string; children: React.ReactNode; accent?: boolean; last?: boolean }) {
  return (
    <a
      href={href}
      className={`${ROUTE_ROW} ${last ? '' : 'border-b border-[rgba(28,22,40,0.1)]'}`}
      style={{ minHeight: 54, fontSize: 15, color: accent ? '#38285D' : '#1C1628' }}
    >
      {children}
      <span aria-hidden="true" style={{ fontSize: 17, color: accent ? '#38285D' : 'rgba(28,22,40,0.45)' }}>
        &#8594;
      </span>
    </a>
  );
}

const SECONDARY =
  'inline-flex items-center justify-center rounded-[2px] font-semibold transition-colors hover:border-v2-teal hover:text-v2-teal-support';

/**
 * One direct-contact row: the value a visitor can read, and the action it performs.
 *
 * The VALUE is the visible text, not a generic "Call" button, because the owner's decision
 * is that both partners' real numbers and addresses are on the page rather than hidden
 * behind a tap. The action word sits on the right as a quiet label, and the accessible name
 * still says which action and which person, so a screen-reader user is not handed two
 * unlabelled links per partner.
 *
 * Full width and stacked rather than a two-column pair: `ethaniel@axispoint.llc` does not
 * fit beside another control at 320px without truncating, and a truncated address on a
 * contact card is worse than a taller card.
 */
function ContactRow({ href, value, action, label }: { href: string; value: string; action: string; label: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      className={`${SECONDARY} justify-between gap-3`}
      style={{
        minHeight: 52,
        padding: '0 14px',
        fontSize: 15,
        border: '1px solid rgba(28,22,40,0.3)',
        background: 'rgba(255,255,255,0.5)',
      }}
    >
      <span style={{ overflowWrap: 'anywhere' }}>{value}</span>
      <span
        aria-hidden="true"
        className="flex-none font-bold uppercase text-[rgba(28,22,40,0.5)]"
        style={{ fontSize: 10, letterSpacing: '0.14em' }}
      >
        {action}
      </span>
    </a>
  );
}

/**
 * One partner's block on the combined page.
 *
 * The approved missing-data rules still govern this, and are still implemented rather than
 * assumed away: a null phone omits the Call row entirely and a null email falls back to the
 * one approved firm inbox with that disclosed in a line beneath. Both partners currently
 * have confirmed values, so neither branch renders today. They are kept because the rule is
 * the design's, not the fixture's, and a value can go stale in the world at any time.
 */
function PartnerBlock({ partner }: { partner: PartnerProfile }) {
  const emailIsFirmInbox = !partner.email;
  const email = partner.email ?? FIRM.email;

  return (
    <article
      className="border-t border-[rgba(28,22,40,0.14)]"
      style={{ paddingTop: 16, marginTop: 16 }}
    >
      <h2 className="font-serif m-0" style={{ fontSize: 23, fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
        {partner.displayName}
      </h2>
      <p
        className="m-0 font-bold uppercase text-v2-teal-support"
        style={{ marginTop: 5, fontSize: 10.5, letterSpacing: '0.16em' }}
      >
        {partner.title}
      </p>

      <div className="grid gap-2.5" style={{ marginTop: 12 }}>
        {partner.phone && (
          <ContactRow
            href={partner.phone.href}
            value={partner.phone.display}
            action="Call"
            label={`Call ${partner.displayName} on ${partner.phone.display}`}
          />
        )}
        <ContactRow
          href={`mailto:${email}`}
          value={email}
          action="Email"
          label={`Email ${partner.displayName} at ${email}`}
        />
        {emailIsFirmInbox && (
          <p className="font-semibold text-[rgba(28,22,40,0.58)]" style={{ margin: 0, fontSize: 12.5 }}>
            Email goes to the firm inbox, {FIRM.email}
          </p>
        )}
      </div>
    </article>
  );
}

export default function Profile() {
  const save = useSaveContact();

  /*
   * The Contact Exchange is a full screen, not a sheet over the card (approved §x2): six
   * controls plus a category list is 470px of content at 320px wide, and a partial sheet
   * puts the submit control under the on-screen keyboard.
   *
   * The card stays mounted underneath, so Close returns to the exact card the visitor left
   * with its scroll position intact.
   */
  const [exchangeOpen, setExchangeOpen] = useState(false);

  const failed = save.state === 'failed';
  const preparing = save.state === 'preparing';
  const handedOff = save.state === 'handoffMobile' || save.state === 'handoffWide';

  /*
   * The exchange replaces the card rather than layering over it. Rendering it in place of
   * the card, instead of hiding the card with CSS, keeps a single focusable surface: a
   * visually hidden card underneath would still be reachable by Tab and by a screen reader.
   */
  if (exchangeOpen) {
    return <ContactExchange onClose={() => setExchangeOpen(false)} onSaveContact={save.save} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-v2-surface text-v2-ink">
      <a
        href="#card"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:items-center focus:rounded-[2px] focus:bg-v2-teal focus:px-5 focus:font-bold focus:text-v2-action-label"
        style={{ minHeight: 44 }}
      >
        Skip to contact actions
      </a>

      {/* The measure caps at 480px and centres. Same page at every width. */}
      <div className="w-full mx-auto flex flex-col flex-1" style={{ maxWidth: 480 }}>
        <header
          className="flex-none flex items-center justify-between gap-4 border-b border-[rgba(28,22,40,0.12)] px-4 min-[360px]:px-5"
          style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))', paddingBottom: 16 }}
        >
          <Mark variant="fullcolor" mode="lockup" height={22} />
          <span
            className="font-bold uppercase text-[rgba(28,22,40,0.5)]"
            style={{ fontSize: 10, letterSpacing: '0.14em' }}
          >
            {FIRM.locality}
          </span>
        </header>

        <main id="card" className="flex-1 px-4 min-[360px]:px-5" style={{ paddingTop: 22 }}>
          <p
            className="m-0 font-bold uppercase text-v2-teal-support"
            style={{ fontSize: 11, letterSpacing: '0.16em' }}
          >
            Property management, Texas
          </p>
          {/* One h1, the firm. Each partner below is an h2, which is what makes the page
              read as one card carrying two people rather than two competing cards. */}
          <h1
            className="font-serif m-0"
            style={{
              marginTop: 8,
              fontSize: 'clamp(33px, 10.5vw, 44px)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.02,
            }}
          >
            {FIRM.name}
          </h1>
          <p
            className="text-[rgba(28,22,40,0.7)]"
            style={{ margin: '14px 0 0', fontSize: 15.5, lineHeight: 1.55, textWrap: 'pretty' }}
          >
            {FIRM.description}
          </p>

          {/* ── Actions ── */}
          <div className="grid gap-3" style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={save.save}
              disabled={preparing}
              aria-busy={preparing || undefined}
              aria-label="Save both partners as contacts"
              className="inline-flex items-center justify-center gap-2.5 rounded-[2px] font-bold transition-colors"
              style={{
                minHeight: 54,
                padding: '0 22px',
                fontSize: 16,
                border: handedOff ? '1px solid #24A5BC' : 'none',
                background: handedOff ? '#FFFFFF' : preparing ? '#1B8DA2' : '#24A5BC',
                color: handedOff ? '#1C1628' : preparing ? '#FFFFFF' : '#0F1F27',
                cursor: preparing ? 'progress' : 'pointer',
              }}
            >
              {/* Address card with a person and a plus, per the board. Never a download arrow. */}
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
                <rect x="2.5" y="2.5" width="12" height="15" rx="1.5" />
                <path d="M2.5 6.5h-1.6M2.5 10h-1.6M2.5 13.5h-1.6" />
                <circle cx="8.5" cy="8" r="2.1" />
                <path d="M5.4 14c0.5-1.7 1.7-2.5 3.1-2.5s2.6 0.8 3.1 2.5" />
                <path d="M16 8.5v5M13.5 11h5" />
              </svg>
              {save.label}
            </button>

            {/*
              The approved additive action (§x1): directly under Save, because the exchange
              is the reciprocal half of the same gesture. Outlined rather than filled at
              52px, so Save remains the only teal fill and the only 54px control on the card.
              It is not a route row: those all leave for the website, this one stays inside.
            */}
            <button
              type="button"
              onClick={() => setExchangeOpen(true)}
              className={SECONDARY}
              style={{
                minHeight: 52,
                fontSize: 15.5,
                border: '1px solid #24A5BC',
                background: '#FFFFFF',
                color: '#1C1628',
                boxShadow: '0 0 0 3px rgba(36,165,188,0.12)',
              }}
            >
              Share your details
            </button>

            {/* One live region carries every handoff and failure message. Polite for a
                handoff, assertive for a failure. Neither ever asserts a completed save. */}
            <p
              role="status"
              aria-live={failed ? 'assertive' : 'polite'}
              className={failed ? 'font-semibold' : ''}
              style={{
                margin: 0,
                fontSize: failed ? 14.5 : 13,
                lineHeight: 1.5,
                color: failed ? '#1C1628' : 'rgba(28,22,40,0.6)',
              }}
            >
              {save.message}
            </p>
          </div>

          {/* Recoverable failure. Page state, scroll position, and focus are preserved, and
              only owner-confirmed details are printed, as selectable text, so the visitor
              can still reach either partner when the file could not be built. */}
          {failed && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                background: 'rgba(159,50,140,0.07)',
                borderInlineStart: '3px solid #9F328C',
                fontSize: 13.5,
                lineHeight: 1.6,
                color: 'rgba(28,22,40,0.78)',
              }}
            >
              <p className="font-bold m-0" style={{ marginBottom: 6 }}>Verified details</p>
              {PARTNERS.map((p) => (
                <p className="m-0" key={p.key} style={{ marginBottom: 6 }}>
                  {p.displayName}, {p.title}
                  {p.phone && (
                    <>
                      <br />
                      {p.phone.display}
                    </>
                  )}
                  <br />
                  {p.email ?? FIRM.email}
                </p>
              ))}
              <p className="m-0">
                {FIRM.name}, {FIRM.locality}
                <br />
                {FIRM.website}
              </p>
            </div>
          )}

          {/* ── Both partners, on the one page ── */}
          <section aria-label="Partner contact details" style={{ marginTop: 26 }}>
            <p
              className="m-0 font-bold uppercase text-[rgba(28,22,40,0.5)]"
              style={{ fontSize: 10, letterSpacing: '0.14em' }}
            >
              Partners
            </p>
            {PARTNERS.map((p) => (
              <PartnerBlock key={p.key} partner={p} />
            ))}
          </section>

          {/* ── Quiet routes out to the approved website ── */}
          <nav aria-label="AxisPoint website" className="grid border-t border-[rgba(28,22,40,0.14)]" style={{ marginTop: 26 }}>
            <RouteRow href={WEB_LINKS.managementProposal} accent>
              Request a Management Proposal
            </RouteRow>
            <RouteRow href={WEB_LINKS.propertyManagement}>Property Management</RouteRow>
            <RouteRow href={WEB_LINKS.home} last>
              Visit AxisPoint
            </RouteRow>
          </nav>
        </main>

        <footer
          className="flex-none flex flex-col gap-1 border-t border-[rgba(28,22,40,0.12)] px-4 min-[360px]:px-5"
          style={{ marginTop: 26, paddingTop: 16, paddingBottom: 'calc(22px + env(safe-area-inset-bottom))' }}
        >
          <span className="font-semibold text-[rgba(28,22,40,0.55)]" style={{ fontSize: 12 }}>
            {FIRM.name}. {FIRM.locality}
          </span>
          <a
            href={`mailto:${FIRM.email}`}
            className="font-semibold text-[rgba(28,22,40,0.55)] rounded-[2px] inline-flex items-center hover:text-v2-teal-support"
            style={{ fontSize: 12, minHeight: 44 }}
          >
            {FIRM.email}
          </a>
        </footer>
      </div>
    </div>
  );
}
