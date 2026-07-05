/**
 * Existing Asset Owner · Step 2 — Personal info (name, email, phone).
 *
 * Collected up front, right after "Who you are". Values live on the shared
 * FormController (c.eaoContact) so they persist across Back/Next and are read
 * by the final Schedule step at submit time.
 */
import type { FormController } from '../types';
import { SQ, SH3, FL, NavBack, NavNext } from '../primitives';

export function EAOPersonalStep({ c }: { c: FormController }) {
  const { eaoContact, setEaoContact } = c;

  const valid =
    eaoContact.name.trim().length > 1 &&
    /.+@.+\..+/.test(eaoContact.email.trim()) &&
    eaoContact.phone.trim().length >= 7;

  const field =
    'w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm max-md:text-base font-[Figtree,sans-serif] outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5]';

  return (
    <div>
      <SQ>Let's start with your details</SQ>
      <SH3>So we know who we are talking to and how to reach you.</SH3>

      <div className="mb-3.5">
        <FL>Full name *</FL>
        <input
          type="text"
          value={eaoContact.name}
          onChange={(e) => setEaoContact((p) => ({ ...p, name: e.target.value }))}
          placeholder="Jane Smith"
          autoComplete="name"
          className={field}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <div className="mb-3.5">
          <FL>Email *</FL>
          <input
            type="email"
            value={eaoContact.email}
            onChange={(e) => setEaoContact((p) => ({ ...p, email: e.target.value }))}
            placeholder="jane@company.com"
            autoComplete="email"
            className={field}
          />
        </div>
        <div className="mb-3.5">
          <FL>Phone *</FL>
          <input
            type="tel"
            value={eaoContact.phone}
            onChange={(e) => setEaoContact((p) => ({ ...p, phone: e.target.value }))}
            placeholder="(713) 555-0100"
            autoComplete="tel"
            className={field}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <NavNext onClick={c.goNext} disabled={!valid} />
      </div>
    </div>
  );
}
