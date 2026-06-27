/**
 * Success screen. Copied verbatim from
 * apps/web/src/pages/ContactPage.tsx (`step === 'success'`), with the
 * shared "Save our contact" vCard button added below the referral block.
 */
import type { FormController } from './types';
import { downloadVCard, shareVCard } from '../../utils/vcard';

export function FormSuccess({ c }: { c: FormController }) {
  return (
    <div className="flex flex-col items-center gap-4 py-3.5 text-center">
      <div
        className="w-[52px] h-[52px] rounded-full border-2 bg-[#E8F7FA] flex items-center justify-center text-teal text-[22px]"
        style={{ borderColor: '#24a5bc', animation: 'pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275) both' }}
      >
        ✓
      </div>
      <style>{`@keyframes pop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
      <div className="font-serif font-semibold text-ink" style={{ fontSize: '1.3rem' }}>You are on our radar.</div>
      <p className="text-[0.82rem] text-sub leading-relaxed max-w-[320px]">
        We will reach out personally within one business day.
      </p>

      {/* Referral code section */}
      <div className="w-full mt-1 rounded-[14px] border border-border bg-body p-5 text-left">
        <div className="text-[0.62rem] font-semibold tracking-[0.09em] uppercase text-sub mb-2">Your referral code</div>
        {c.responseReferralCode ? (
          <>
            <div
              className="font-serif font-semibold text-ink mb-2 tracking-wide"
              style={{ fontSize: '1.5rem', letterSpacing: '0.05em' }}
            >
              {c.responseReferralCode}
            </div>
            <p className="text-[0.78rem] text-sub leading-relaxed mb-3">
              Share this link with anyone you refer to AxisPoint and we will make sure you get credit for the introduction.
            </p>
            <div className="flex items-center gap-2 rounded-[9px] border border-border bg-white px-3 py-2">
              <span className="flex-1 text-[0.75rem] text-ink truncate font-mono">{c.shareLink}</span>
              <button
                type="button"
                onClick={c.copyLink}
                className="flex-shrink-0 px-3 py-1 rounded-[7px] text-[0.72rem] font-semibold transition-all cursor-pointer"
                style={{ background: c.copied ? '#E8F7FA' : '#EEEAF5', color: c.copied ? '#1A8799' : '#38285D' }}
              >
                {c.copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-[0.78rem] text-sub leading-relaxed">
            Check your confirmation email for your referral code.
          </p>
        )}
      </div>

      {/* Save / Share our contacts — vCard download & native share */}
      <div className="w-full flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={downloadVCard}
          className="flex-1 py-2.5 px-3 rounded-[10px] border-none bg-teal text-white text-[0.78rem] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Save Contacts
        </button>
        <button
          type="button"
          onClick={shareVCard}
          className="flex-1 py-2.5 px-3 rounded-[10px] border bg-white text-teal text-[0.78rem] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:bg-[#E8F7FA] active:scale-[0.98]"
          style={{ borderColor: '#24A5BC' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share Contacts
        </button>
      </div>
    </div>
  );
}
