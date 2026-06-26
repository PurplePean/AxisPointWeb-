/**
 * Step 3 — Investor preferences (asset class + timeline). Investor-only.
 * Copied verbatim from apps/web/src/pages/ContactPage.tsx (`step === 'prefs'`).
 */
import type { FormController } from '../types';
import { SQ, SH3, FL, FLNote, ChipS, ChipM, NavBack, NavNext } from '../primitives';

export function Step3AssetClass({ c }: { c: FormController }) {
  return (
    <div>
      <SQ>What you are looking for</SQ>
      <SH3>Help us match you with the right deals and the right specialist.</SH3>
      <div className="mb-3.5">
        <FL>Asset class interest <FLNote>(select all)</FLNote></FL>
        <div className="flex flex-wrap gap-1.5">
          {['Multifamily','Industrial','Office','Retail','Mixed-Use','Self-Storage','Show me what fits'].map(v => (
            <ChipM key={v} label={v} sel={c.assetSel.has(v)} onClick={() => c.toggleSet(c.assetSel, c.setAssetSel, v)} />
          ))}
        </div>
      </div>
      <div className="mb-3.5">
        <FL>Investment timeline</FL>
        <div className="flex flex-wrap gap-1.5">
          {['Ready to move now','Within 6 months','6 to 12 months','Just researching'].map(v => (
            <ChipS key={v} label={v} sel={c.timelineSel===v} onClick={() => c.setTimelineSel(c.timelineSel===v ? null : v)} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <NavBack onClick={c.goBack} />
        <NavNext onClick={c.goNext} />
      </div>
    </div>
  );
}
