/**
 * Existing Asset Owner · Step 3 — Current situation (single select).
 */
import type { FormController } from '../types';
import { SQ, SH3, NavBack, NavNext } from '../primitives';

const OPTIONS = [
  'No property manager, I handle it myself',
  "I have a PM but they aren't performing",
  'I have a PM but no real asset management strategy',
  "The property is underperforming and I don't know why",
  'I recently acquired it and need structure from day one',
];

function SituationCard({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 border rounded-xl cursor-pointer transition-all ${
        sel ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white'
      }`}
    >
      <div className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
        sel ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] bg-white'
      }`}>
        {sel && <div className="w-[7px] h-[7px] rounded-full bg-white" />}
      </div>
      <div className="text-[0.84rem] font-medium text-ink leading-snug">{label}</div>
    </div>
  );
}

export function EAOSituationStep({ c }: { c: FormController }) {
  return (
    <div>
      <SQ>Where do things stand today?</SQ>
      <SH3>Pick the statement that best describes your current situation.</SH3>
      <div className="flex flex-col gap-2.5">
        {OPTIONS.map((o) => (
          <SituationCard key={o} label={o} sel={c.eaoSituation === o} onClick={() => c.setEaoSituation(c.eaoSituation === o ? null : o)} />
        ))}
      </div>
      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <NavNext onClick={c.goNext} disabled={!c.eaoSituation} />
      </div>
    </div>
  );
}
