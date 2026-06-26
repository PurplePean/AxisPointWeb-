/**
 * Step 6 — Communication preferences + submit ("Stay in the loop").
 * Copied verbatim from apps/web/src/pages/ContactPage.tsx (`step === 'comms'`).
 */
import type { FormController } from '../types';
import { SQ, SH3, NavBack } from '../primitives';

function PrefItem({ c, val, title, desc }: { c: FormController; val: string; title: string; desc: string }) {
  const on = c.prefsSel.has(val);
  return (
    <div
      onClick={() => c.toggleSet(c.prefsSel, c.setPrefsSel, val)}
      className={`flex items-start gap-3 px-4 py-3.5 border rounded-xl cursor-pointer transition-all ${
        on ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'
      }`}
    >
      <div className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
        on ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] bg-white'
      }`}>
        {on && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
      <div>
        <div className="text-[0.875rem] font-semibold text-ink mb-0.5">{title}</div>
        <div className="text-[0.76rem] text-sub leading-snug">{desc}</div>
      </div>
    </div>
  );
}

export function Step6Loop({ c }: { c: FormController }) {
  return (
    <div>
      <SQ>Stay in the loop</SQ>
      <SH3>Optional. Choose what is relevant to you and we will only send what you asked for.</SH3>
      <div className="flex flex-col gap-2.5 mt-3.5">
        <PrefItem c={c} val="articles" title="New articles and insights" desc="When Zachary or Ethaniel publish something new on the Learn page." />
        <PrefItem c={c} val="opportunities" title="Investment opportunities" desc="When a deal or acquisition opportunity worth sharing comes across our desk." />
        <PrefItem c={c} val="firm" title="Firm updates" desc="What AxisPoint is working on, new capabilities, and firm news." />
      </div>
      <p className="text-[0.7rem] text-hint mt-2.5 leading-relaxed">You can unsubscribe from any of these at any time. We do not share your information.</p>

      {c.submitError && (
        <div className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[0.8rem] text-red-700 leading-relaxed">
          Something went wrong on our end. Please email us directly at{' '}
          <a href="mailto:zach@axispoint.llc" className="font-semibold underline">zach@axispoint.llc</a>{' '}
          or call{' '}
          <a href="tel:+18325802815" className="font-semibold underline">(832) 580-2815</a>.
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <button
          type="button"
          onClick={c.submitForm}
          disabled={c.submitting}
          className="flex-1 py-3 px-4 rounded-[10px] border-none cursor-pointer flex items-center justify-center gap-1.5 text-sm font-semibold text-white transition-all hover:brightness-[1.08] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: '#9F328C' }}
        >
          {c.submitting ? 'Sending…' : 'Send to AxisPoint'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
