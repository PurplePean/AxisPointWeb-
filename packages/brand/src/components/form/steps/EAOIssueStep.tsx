/**
 * Existing Asset Owner · Step 4 — Pressing issue (free text, required).
 * Controlled textarea (so the value persists across Back/Next and feeds the
 * payload) styled to match the shared FTextarea pattern.
 */
import type { FormController } from '../types';
import { SQ, SH3, FL, NavBack, NavNext } from '../primitives';

export function EAOIssueStep({ c }: { c: FormController }) {
  return (
    <div>
      <SQ>What's the most pressing issue right now?</SQ>
      <SH3>Tell us in your own words. This goes straight to the person who follows up.</SH3>
      <div className="mb-3.5">
        <FL>The most pressing issue</FL>
        <textarea
          value={c.eaoIssue}
          onChange={(e) => c.setEaoIssue(e.target.value)}
          placeholder="Vacancy, deferred maintenance, cash flow, a PM that went dark. Whatever is keeping you up."
          rows={4}
          className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm max-md:text-base outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5] resize-y leading-snug min-h-[96px]"
        />
      </div>
      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <NavNext onClick={c.goNext} disabled={!c.eaoIssue.trim()} />
      </div>
    </div>
  );
}
