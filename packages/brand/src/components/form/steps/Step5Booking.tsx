/**
 * Step 5 — Booking / calendar. Thin wrapper around the shared BookingCalendar
 * component (extracted so the Existing Asset Owner schedule step reuses the
 * exact same scheduling / Meet-booking UI).
 */
import type { FormController } from '../types';
import { SQ, SH3, NavBack, NavNext } from '../primitives';
import { BookingCalendar } from '../BookingCalendar';

export function Step5Booking({ c }: { c: FormController }) {
  return (
    <div>
      <SQ>Would you like to book a call?</SQ>
      <SH3>30 minutes, Monday through Friday, 8am to 5pm CT. Totally optional.</SH3>

      <BookingCalendar c={c} />

      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <NavNext onClick={c.captureBookingAndAdvance} disabled={!c.bookChoice} label="Continue" />
      </div>
    </div>
  );
}
