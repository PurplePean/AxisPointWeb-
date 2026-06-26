/**
 * Success screen. Copied verbatim from
 * apps/web/src/pages/ContactPage.tsx (`step === 'success'`), with the
 * shared "Save our contact" vCard button added below the referral block.
 */
import type { FormController } from './types';
import { downloadVCard } from '../../utils/vcard';

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

      {/* Save our contact — vCard download */}
      <button
        type="button"
        onClick={downloadVCard}
        className="w-full py-3 px-4 rounded-[10px] border bg-white text-teal text-[0.82rem] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all hover:bg-[#E8F7FA] active:scale-[0.98]"
        style={{ borderColor: '#24A5BC' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save our contact — we will be in touch
      </button>
    </div>
  );
}
