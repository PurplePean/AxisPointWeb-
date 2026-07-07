/**
 * BookingCalendar — the shared scheduling / Google Meet booking component.
 *
 * Extracted verbatim from Step5Booking so every flow that "books a real call"
 * (Investor, RE Professional, and the Existing Asset Owner schedule step) uses
 * the exact same booking UI and controller state — no duplicate calendars.
 *
 * Renders the Yes/No choice cards, month calendar, time slots and meet-type
 * picker. It reads and writes booking state through the shared FormController
 * (bookChoice, selDay, selSlot, meetType, calendar helpers).
 */
import type { FormController, MeetType } from './types';
import { FL, FInput } from './primitives';
import { MONTHS, DAYS, SLOTS, fmtDate } from './utils';

function CalDay({ c, d, cellIdx }: { c: FormController; d: number | null; cellIdx: number }) {
  if (d === null) return <div />;
  const past  = c.isPast(d);
  const wknd  = c.isWknd(d, cellIdx);
  const avail = !past && !wknd;
  const sel   = c.selDay === d;
  return (
    <div
      onClick={() => avail && c.setSelDay(d)}
      className={`aspect-square rounded-[7px] flex items-center justify-center text-[0.78rem] font-medium transition-all ${
        sel   ? 'bg-purple text-white border border-purple scale-105' :
        avail ? 'bg-white border border-border text-ink cursor-pointer hover:bg-[#EEEAF5] hover:border-[#C4B8DC] hover:text-purple hover:scale-[1.08]' :
                'text-[#D4CEE8] cursor-default'
      }`}
    >
      {d}
    </div>
  );
}

export function BookingCalendar({ c }: { c: FormController }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        {[
          { id: 'yes' as const, label: 'Yes, book a time now', desc: 'Pick a slot and we will confirm' },
          { id: 'no' as const,  label: 'No, just send my info',  desc: 'We will reach out within one business day' },
        ].map(opt => (
          <div
            key={opt.id}
            onClick={() => c.setBookChoice(opt.id)}
            className={`rounded-[13px] border cursor-pointer transition-all relative p-4 ${
              c.bookChoice === opt.id ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white hover:-translate-y-0.5'
            }`}
          >
            <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-full border flex items-center justify-center text-[0.55rem] transition-all ${
              c.bookChoice === opt.id ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] text-transparent'
            }`}>✓</div>
            <div className="text-[0.84rem] font-semibold text-ink mb-0.5">{opt.label}</div>
            <div className="text-[0.72rem] text-sub">{opt.desc}</div>
          </div>
        ))}
      </div>

      {c.bookChoice === 'yes' && (
        <div className="mt-4 bg-body border border-border rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-3.5">
            <button
              type="button"
              onClick={() => c.changeMonth(-1)}
              disabled={!c.canPrevMonth}
              className="w-7 h-7 rounded-[7px] border border-border bg-white flex items-center justify-center text-sub cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="font-serif font-semibold text-ink" style={{ fontSize: '1.05rem' }}>{MONTHS[c.calMonth]} {c.calYear}</div>
            <button
              type="button"
              onClick={() => c.changeMonth(1)}
              className="w-7 h-7 rounded-[7px] border border-border bg-white flex items-center justify-center text-sub cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[0.6rem] font-semibold tracking-[0.06em] uppercase text-hint py-0.5">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-3.5">
            {c.calCells.map((d, i) => <CalDay key={i} c={c} d={d} cellIdx={i} />)}
          </div>

          {c.selDay !== null && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[0.7rem] font-semibold" style={{ background: '#EEEAF5', borderColor: '#C4B8DC', color: '#38285D' }}>
                  {fmtDate(c.calYear, c.calMonth, c.selDay)}
                </div>
                <span className="text-[0.72rem] text-hint">
                  {c.slotsLoading ? 'Checking availability…' : 'Pick a time'}
                </span>
              </div>
              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 transition-opacity ${c.slotsLoading ? 'opacity-50' : ''}`}>
                {SLOTS.map(s => {
                  // slotAvail null (not loaded / check failed) → treat as available.
                  const booked = c.slotAvail ? c.slotAvail[s] === false : false;
                  const disabled = booked || c.slotsLoading;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && c.setSelSlot(s)}
                      className={`py-2 rounded-[8px] border text-center text-[0.72rem] font-semibold transition-all ${
                        booked         ? 'bg-body border-border text-[#D4CEE8] cursor-not-allowed line-through font-normal' :
                        c.slotsLoading ? 'bg-white border-border text-sub cursor-wait' :
                        c.selSlot === s  ? 'bg-teal border-teal text-white' :
                                         'bg-white border-border text-sub cursor-pointer hover:border-teal/40 hover:bg-[#E8F7FA] hover:text-teal'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="text-[0.63rem] text-hint mt-1.5">All times Central Time (CT)</div>
            </div>
          )}

          {c.selSlot !== null && (
            <div className="mt-4">
              <FL>How would you like to meet?</FL>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                {[
                  { id: 'meet' as MeetType, label: 'Google Meet', desc: 'We will send a video link' },
                  { id: 'phone' as MeetType, label: 'Phone Call', desc: 'We will call you' },
                ].map(opt => (
                  <div
                    key={opt.id!}
                    onClick={() => c.setMeetType(opt.id)}
                    className={`rounded-[11px] border cursor-pointer transition-all p-3 text-center ${
                      c.meetType === opt.id ? 'border-purple bg-[#EEEAF5]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'
                    }`}
                  >
                    <div className="text-[0.82rem] font-semibold text-ink mb-0.5">{opt.label}</div>
                    <div className="text-[0.7rem] text-sub">{opt.desc}</div>
                  </div>
                ))}
              </div>
              {c.meetType === 'phone' && (
                <FInput id="cal-phone" label="Your phone number" type="tel" placeholder="(713) 555-0100" />
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
