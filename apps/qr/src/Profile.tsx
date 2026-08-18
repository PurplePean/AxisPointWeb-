import { useState } from 'react';

import { Mark } from '@axispoint/brand';
import { FIRM, PARTNERS, type PartnerProfile } from './profiles';
import { WEB_LINKS } from './webLinks';
import { SaveContactButton } from './SaveContactButton';
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
  /*
   * The Contact Exchange is a full screen, not a sheet over the card (approved §x2): six
   * controls plus a category list is 470px of content at 320px wide, and a partial sheet
   * puts the submit control under the on-screen keyboard.
   *
   * The card stays mounted underneath, so Close returns to the exact card the visitor left
   * with its scroll position intact.
   */
  const [exchangeOpen, setExchangeOpen] = useState(false);

  /*
   * The exchange replaces the card rather than layering over it. Rendering it in place of
   * the card, instead of hiding the card with CSS, keeps a single focusable surface: a
   * visually hidden card underneath would still be reachable by Tab and by a screen reader.
   */
  if (exchangeOpen) {
    return <ContactExchange onClose={() => setExchangeOpen(false)} />;
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
            {/*
              ONE SAVE ACTION PER PARTNER, owner-directed 2026-08-18.

              A single action delivering one file with both records cannot produce iOS
              Safari's "Add All 2 Contacts" flow: Safari ignores the `download` attribute on a
              `blob:` URL, so it never treats the file as a named `.vcf` and previews a single
              card instead. That was established on real devices, it is a platform limit
              rather than a bug in the file, and the answer is to ask the visitor which person
              they want and hand over one record at a time — the delivery shape that worked
              for this project's entire life before 2026-08-17.

              Mapped over `PARTNERS` rather than written out twice, so a third partner is a
              data change. Each button owns its own state; see `SaveContactButton`.
            */}
            {PARTNERS.map((p) => (
              <SaveContactButton key={p.key} partner={p} />
            ))}

            {/*
              The approved additive action (§x1): directly under the Save controls, because
              the exchange is the reciprocal half of the same gesture. Outlined rather than
              filled at 52px, so the two teal fills on the card are the two Save actions and
              nothing else competes with them. It is not a route row: those all leave for the
              website, this one stays inside.
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
          </div>

          {/*
            The status line and the recoverable-failure block moved into `SaveContactButton`
            with the split. Each is now scoped to the partner whose file it describes, because
            a page-level message cannot say WHICH of two saves was handed over or failed, and
            one partner's failure should not print the other's fallback details.
          */}

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
