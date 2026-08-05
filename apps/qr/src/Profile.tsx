import { useState } from 'react';

import { Mark } from '@axispoint/brand';
import { FIRM, WEB_LINKS, type PartnerProfile } from './profiles';
import { useSaveContact } from './useSaveContact';
import { ContactExchange } from './exchange/ContactExchange';
import type { ExchangeSubject } from './exchange/model';

/**
 * The QR business-card surface, built from the approved board
 * `AxisPoint QR Frontend.dc.html` (design@2026-07-30).
 *
 * One template, one record per partner, plus the firm fallback. No per-partner
 * layouts: only the record differs. The page opens on the real AxisPoint header,
 * carries no photography, no headshots, no language selector, no form, and no
 * in-page QR code, all per the board's explicit scope.
 *
 * Above 480px the single column caps its measure and centres. There is no desktop
 * composition and no second breakpoint, which is the approved wide-screen behaviour.
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

export default function Profile({ profile }: { profile: PartnerProfile | null }) {
  const isFirm = profile === null;
  const save = useSaveContact(profile);

  /*
   * The Contact Exchange is a full screen, not a sheet over the card (approved §x2): six
   * controls plus a category list is 470px of content at 320px wide, and a partial sheet
   * puts the submit control under the on-screen keyboard.
   *
   * The card stays mounted underneath, so Close returns to the exact card the visitor left
   * with its scroll position intact.
   */
  const [exchangeOpen, setExchangeOpen] = useState(false);

  const subject: ExchangeSubject = isFirm
    ? { first: 'AxisPoint', full: FIRM.name, saveLabel: 'Save AxisPoint contact', isFirm: true }
    : {
        first: profile.displayName.split(' ')[0],
        full: profile.displayName,
        saveLabel: `Save ${profile.displayName.split(' ')[0]}'s contact`,
        isFirm: false,
      };

  /* Approved missing-data rules.
     Phone absent: omit Call entirely and give Email the full width.
     Partner email absent: keep Email, point it at the one approved firm address, and
     disclose that in a single line. Never a disabled control or a placeholder. */
  const phone = isFirm ? FIRM.phone : profile.phone;
  const partnerEmail = isFirm ? null : profile.email;
  const emailHref = `mailto:${partnerEmail ?? FIRM.email}`;
  const emailIsFirmInbox = !partnerEmail;
  const showCall = !!phone;

  const failed = save.state === 'failed';
  const preparing = save.state === 'preparing';
  const handedOff = save.state === 'handoffMobile' || save.state === 'handoffWide';

  /*
   * The exchange replaces the card rather than layering over it. Rendering it in place of
   * the card, instead of hiding the card with CSS, keeps a single focusable surface: a
   * visually hidden card underneath would still be reachable by Tab and by a screen reader.
   */
  if (exchangeOpen) {
    return (
      <ContactExchange
        subject={subject}
        profileKey={profile?.key ?? null}
        onClose={() => setExchangeOpen(false)}
        onSaveContact={save.save}
      />
    );
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
            {isFirm ? 'Property management, Texas' : profile.title}
          </p>
          {/* One h1, the name. "Partner" above it is a paragraph, not a heading. */}
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
            {isFirm ? FIRM.name : profile.displayName}
          </h1>
          <p
            className="text-[rgba(28,22,40,0.7)]"
            style={{ margin: '14px 0 0', fontSize: 15.5, lineHeight: 1.55, textWrap: 'pretty' }}
          >
            {isFirm ? FIRM.fallbackDescription : FIRM.description}
          </p>

          {/* ── Actions ── */}
          <div className="grid gap-3" style={{ marginTop: 24 }}>
            <button
              type="button"
              onClick={save.save}
              disabled={preparing}
              aria-busy={preparing || undefined}
              aria-label={`Save ${isFirm ? FIRM.name : profile.displayName} as a contact`}
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
              The approved additive action (§x1): directly under Save contact and above the
              Call and Email pair, because the exchange is the reciprocal half of the same
              gesture. Outlined rather than filled at 52px, so Save contact remains the only
              teal fill and the only 54px control on the card. It is not a route row: those
              all leave for the website, and this one stays inside the card.
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

            {/* Call is rendered only when a verified number exists. Absent, the row is
                omitted and Email takes the full width, so the pair never reads as broken. */}
            <div className={`grid gap-3 ${showCall ? 'min-[340px]:grid-cols-2' : ''}`}>
              {showCall && phone && (
                <a
                  href={phone.href}
                  className={SECONDARY}
                  aria-label={`Call ${isFirm ? FIRM.name : profile.displayName}`}
                  style={{ minHeight: 52, fontSize: 15.5, border: '1px solid rgba(28,22,40,0.3)', background: 'rgba(255,255,255,0.5)' }}
                >
                  Call
                </a>
              )}
              <a
                href={emailHref}
                className={SECONDARY}
                aria-label={`Email ${isFirm ? FIRM.name : profile.displayName}`}
                style={{ minHeight: 52, fontSize: 15.5, border: '1px solid rgba(28,22,40,0.3)', background: 'rgba(255,255,255,0.5)' }}
              >
                {isFirm ? `Email ${FIRM.email}` : 'Email'}
              </a>
            </div>

            {!isFirm && emailIsFirmInbox && (
              <p className="font-semibold text-[rgba(28,22,40,0.58)]" style={{ margin: 0, fontSize: 12.5 }}>
                Email goes to the firm inbox, {FIRM.email}
              </p>
            )}
          </div>

          {/* Recoverable failure. Page state, scroll position, and focus are preserved,
              and only verified details are printed, as selectable text. */}
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
              <p className="m-0">
                {isFirm ? FIRM.name : `${profile.displayName}, ${profile.title}`}
                <br />
                {FIRM.name}, {FIRM.locality}
                <br />
                {FIRM.website}
              </p>
              <p className="m-0 text-[rgba(28,22,40,0.6)]" style={{ marginTop: 8 }}>
                Phone and email lines appear here only when verified values exist.
              </p>
            </div>
          )}

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

          {/* The fallback names both partners once, as plain text, so the visitor can
              tell us who they met. No error styling, no red, no apology copy. */}
          {isFirm && (
            <p className="text-[rgba(28,22,40,0.52)]" style={{ margin: '22px 0 0', fontSize: 13, lineHeight: 1.55 }}>
              {FIRM.partnersLine}
            </p>
          )}
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
