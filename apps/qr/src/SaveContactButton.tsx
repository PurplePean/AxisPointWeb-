import { FIRM, type PartnerProfile } from './profiles';
import { useSaveContact } from './useSaveContact';

/**
 * ONE partner's Save action: the control, its status line, and its recoverable-failure block.
 *
 * WHY THIS IS A COMPONENT NOW. The card used to hold a single Save button inline, and the
 * Contact Exchange's success screen reused only its LABEL, rendering its own button around it.
 * The owner-directed split of 2026-08-18 turns one action into two, on both surfaces, and two
 * copies of a control that owns a five-state machine is exactly the shape that drifts. The
 * whole control lives here and both surfaces render it.
 *
 * EACH INSTANCE OWNS ITS OWN STATE, because it calls `useSaveContact` itself. That is the
 * point of the split rather than an implementation detail: Zachary's button reaching a handoff
 * or a failure must say nothing about Ethaniel's, and neither press may disturb the other's
 * file. Lifting the state up to the page would put both partners back on one state machine,
 * which is the thing being undone.
 *
 * THE APPROVED HONESTY RULE IS UNCHANGED. No state here claims a contact was saved. The page
 * can report that it handed a file over; only the operating system knows what happened next.
 */
export function SaveContactButton({ partner }: { partner: PartnerProfile }) {
  const save = useSaveContact(partner);

  const preparing = save.state === 'preparing';
  const failed = save.state === 'failed';
  const handedOff = save.state === 'handoffMobile' || save.state === 'handoffWide';

  return (
    <div>
      <button
        type="button"
        onClick={save.save}
        disabled={preparing}
        aria-busy={preparing || undefined}
        /* The visible label carries the given name; the accessible name carries the whole
           person, so a screen-reader user is not offered two similar-sounding actions. */
        aria-label={`Save ${partner.displayName} as a contact`}
        className="w-full inline-flex items-center justify-center gap-2.5 rounded-[2px] font-bold transition-colors"
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
        <svg
          width="17"
          height="17"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="2.5" y="2.5" width="12" height="15" rx="1.5" />
          <path d="M2.5 6.5h-1.6M2.5 10h-1.6M2.5 13.5h-1.6" />
          <circle cx="8.5" cy="8" r="2.1" />
          <path d="M5.4 14c0.5-1.7 1.7-2.5 3.1-2.5s2.6 0.8 3.1 2.5" />
          <path d="M16 8.5v5M13.5 11h5" />
        </svg>
        {save.label}
      </button>

      {/* This partner's own live region. Polite for a handoff, assertive for a failure.
          Neither ever asserts a completed save. */}
      <p
        role="status"
        aria-live={failed ? 'assertive' : 'polite'}
        className={failed ? 'font-semibold' : ''}
        style={{
          margin: '8px 0 0',
          fontSize: failed ? 14.5 : 13,
          lineHeight: 1.5,
          color: failed ? '#1C1628' : 'rgba(28,22,40,0.6)',
        }}
      >
        {save.message}
      </p>

      {/*
        Recoverable failure, now scoped to the partner whose file failed rather than to the
        page. Page state, scroll position, and focus are preserved, and only owner-confirmed
        details are printed, as selectable text, so the visitor can still reach this partner
        when their file could not be built. The other partner's control is untouched, which is
        the behaviour the split buys: one failure no longer takes both people down.
      */}
      {failed && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: 'rgba(159,50,140,0.07)',
            borderInlineStart: '3px solid #9F328C',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'rgba(28,22,40,0.78)',
          }}
        >
          <p className="font-bold m-0" style={{ marginBottom: 6 }}>
            Verified details
          </p>
          <p className="m-0" style={{ marginBottom: 6 }}>
            {partner.displayName}, {partner.title}
            {partner.phone && (
              <>
                <br />
                {partner.phone.display}
              </>
            )}
            <br />
            {partner.email ?? FIRM.email}
          </p>
          <p className="m-0">
            {FIRM.name}, {FIRM.locality}
            <br />
            {FIRM.website}
          </p>
        </div>
      )}
    </div>
  );
}
