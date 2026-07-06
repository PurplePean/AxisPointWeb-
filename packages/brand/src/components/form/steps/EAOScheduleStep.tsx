/**
 * Existing Asset Owner · Final step — Schedule.
 *
 * Booking only. Personal info (name, email, phone) is now captured up front in
 * EAOPersonalStep and lives on c.eaoContact; this step just renders the shared
 * BookingCalendar (the exact same scheduling / Meet-booking component the
 * Investor and RE Professional flows use — this books a real call, not a soft
 * text preference). On submit it calls c.submitEAO, which assembles and POSTs the
 * full payload to the shared form endpoint.
 */
import type { FormController } from '../types';
import { SQ, SH3, FL, NavBack } from '../primitives';
import { BookingCalendar } from '../BookingCalendar';

export function EAOScheduleStep({ c }: { c: FormController }) {
  const canSubmit = c.bookChoice !== null && !c.submitting;

  return (
    <div>
      <SQ>Pick a time to connect</SQ>
      <SH3>Choose a slot that works and we will confirm the call. Prefer we reach out? Just send your info.</SH3>

      <div className="mt-1">
        <FL>Preferred time to connect</FL>
        <BookingCalendar c={c} />
      </div>

      {c.submitError && (
        <div className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-[0.8rem] text-red-700 leading-relaxed">
          Something went wrong on our end. Please email us directly at{' '}
          <a href="mailto:zach@axispoint.llc" className="font-semibold underline">zach@axispoint.llc</a>.
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <button
          type="button"
          onClick={() => c.submitEAO()}
          disabled={!canSubmit}
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
