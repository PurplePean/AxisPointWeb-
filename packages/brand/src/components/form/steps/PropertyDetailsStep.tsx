/**
 * PropertyDetailsStep — Property details step of the Existing Asset Owner flow.
 *
 * Fully isolated: owns all of its own local state and never touches the shared
 * FormController answer state used by the Investor / RE Professional steps.
 * On Continue it assembles a single `PropertyDetails` object (matching the
 * backend schema exactly) and hands it to the parent via `onContinue`.
 *
 * Branching:
 *   Single property → property type → unit count (number) or sqft (tier)
 *   Portfolio → single asset class (type + unit count or aggregate sqft tier)
 *            → mixed asset classes (Multifamily row + one combined Commercial row)
 *
 * Unit counts are plain number inputs; square footage stays as tier buttons.
 * In the mixed path, any combination of Retail/Office/Industrial collapses into
 * a single Commercial row (one asset count + one combined sqft tier); Multifamily
 * stays its own row (asset count + unit count) since it is measured differently.
 */
import { useMemo, useState } from 'react';
import type { PropertyDetails } from '../types';
import { SQ, SH3, FL, FLNote, ChipS, ChipM, NavBack, NavNext } from '../primitives';

/* ── option tokens (values are the exact strings emitted to the backend) ── */
const PROP_TYPES = [
  { token: 'multifamily', label: 'Multifamily' },
  { token: 'retail', label: 'Retail' },
  { token: 'office', label: 'Office' },
  { token: 'industrial', label: 'Industrial' },
] as const;

/** The three commercial types that collapse into one combined breakdown row. */
const COMMERCIAL_TOKENS = ['retail', 'office', 'industrial'] as const;

/* Single-property square-footage tiers (unit count is now a number input) */
const SINGLE_SQFT = [
  { token: 'under-5k', label: 'Under 5k' },
  { token: '5k-20k', label: '5k–20k' },
  { token: '20k-50k', label: '20k–50k' },
  { token: '50k+', label: '50k+' },
];

/* Portfolio / aggregate square-footage tiers (also used by the mixed commercial row) */
const AGG_SQFT = [
  { token: 'under-20k', label: 'Under 20k' },
  { token: '20k-100k', label: '20k–100k' },
  { token: '100k+', label: '100k+' },
];

const isMultifamily = (t: string | null) => t === 'multifamily';
const isCommercialToken = (t: string) => (COMMERCIAL_TOKENS as readonly string[]).includes(t);

/** A single-select row of chips. */
function ChipRow({ label, note, options, value, onSelect }: {
  label: string; note?: string; options: { token: string; label: string }[]; value: string | null; onSelect: (t: string) => void;
}) {
  return (
    <div className="mb-3.5">
      <FL>{label}{note && <FLNote>{note}</FLNote>}</FL>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <ChipS key={o.token} label={o.label} sel={value === o.token} onClick={() => onSelect(o.token)} />
        ))}
      </div>
    </div>
  );
}

/** A plain numeric text input (used for every unit / asset count). */
function NumberField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (digits: string) => void; placeholder: string;
}) {
  return (
    <div className="mb-3">
      <FL>{label}</FL>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder={placeholder}
        className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm max-md:text-base outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5]"
      />
    </div>
  );
}

export interface PropertyDetailsStepProps {
  /** Previously assembled value, so returning to this step restores answers. */
  initial: PropertyDetails | null;
  onBack: () => void;
  onContinue: (details: PropertyDetails) => void;
}

const posInt = (raw: string): number | null => {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function PropertyDetailsStep({ initial, onBack, onContinue }: PropertyDetailsStepProps) {
  /* ── hydrate from a previously assembled value ── */
  const [portfolioType, setPortfolioType] = useState<'single' | 'portfolio' | null>(initial?.portfolio_type ?? null);
  const [composition, setComposition] = useState<'single_asset_class' | 'mixed_asset_classes' | null>(
    initial && initial.portfolio_type === 'portfolio' ? initial.portfolio_composition : null,
  );

  /* single property + portfolio-single-asset-class share these ── */
  const [propType, setPropType] = useState<string | null>(
    initial && 'property_type' in initial ? initial.property_type : null,
  );
  /* unit count is a number (as a digit string); sqft is a tier token */
  const [units, setUnits] = useState<string>(
    initial && 'units' in initial && initial.units != null ? String(initial.units) : '',
  );
  const [sqft, setSqft] = useState<string | null>(
    initial && 'sqft' in initial ? (initial.sqft ?? null) : null,
  );

  /* mixed asset classes: which checkboxes are checked, plus the two possible rows */
  const mixedInit = initial && initial.portfolio_type === 'portfolio' && initial.portfolio_composition === 'mixed_asset_classes'
    ? initial.asset_breakdown : null;
  const mfInit = mixedInit?.find((r) => r.property_type === 'multifamily');
  const commInit = mixedInit?.find((r) => Array.isArray(r.property_type));

  const [mixedTypes, setMixedTypes] = useState<string[]>(() => {
    if (!mixedInit) return [];
    const out: string[] = [];
    if (mfInit) out.push('multifamily');
    if (commInit && Array.isArray(commInit.property_type)) out.push(...commInit.property_type);
    return out;
  });
  /* Multifamily row: asset count + unit count (both numbers) */
  const [mfCount, setMfCount] = useState<string>(mfInit ? String(mfInit.asset_count) : '');
  const [mfUnits, setMfUnits] = useState<string>(mfInit?.units != null ? String(mfInit.units) : '');
  /* Combined commercial row: asset count (number) + combined sqft (tier) */
  const [commCount, setCommCount] = useState<string>(commInit ? String(commInit.asset_count) : '');
  const [commSqft, setCommSqft] = useState<string | null>(commInit?.sqft ?? null);

  /* ── single-property / aggregate size options depend on property type ── */
  const singleSizeLabel = isMultifamily(propType) ? 'Unit count' : 'Square footage';
  const aggSizeLabel = isMultifamily(propType) ? 'Total units' : 'Total square footage';

  /* When property type changes, size captured under the other basis is invalid —
     clear both so we never emit e.g. an sqft tier alongside a unit count. */
  function selectPropType(t: string) {
    if (t !== propType) { setUnits(''); setSqft(null); }
    setPropType(t);
  }

  /* ── mixed: toggling a type updates the checked set and clears rows that
     lose all of their inputs ── */
  function toggleMixedType(t: string) {
    setMixedTypes((prev) => {
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t];
      if (t === 'multifamily' && !next.includes('multifamily')) { setMfCount(''); setMfUnits(''); }
      if (isCommercialToken(t) && !next.some(isCommercialToken)) { setCommCount(''); setCommSqft(null); }
      return next;
    });
  }

  const hasMF = mixedTypes.includes('multifamily');
  const commercialTypes = mixedTypes.filter(isCommercialToken);
  const hasCommercial = commercialTypes.length > 0;

  /* ── assemble + validate ── */
  const assembled = useMemo<PropertyDetails | null>(() => {
    if (portfolioType === 'single') {
      if (!propType) return null;
      if (isMultifamily(propType)) {
        const u = posInt(units);
        return u === null ? null : { portfolio_type: 'single', property_type: propType, units: u };
      }
      return sqft ? { portfolio_type: 'single', property_type: propType, sqft } : null;
    }
    if (portfolioType === 'portfolio') {
      if (composition === 'single_asset_class') {
        if (!propType) return null;
        if (isMultifamily(propType)) {
          const u = posInt(units);
          return u === null ? null
            : { portfolio_type: 'portfolio', portfolio_composition: 'single_asset_class', property_type: propType, units: u };
        }
        return sqft
          ? { portfolio_type: 'portfolio', portfolio_composition: 'single_asset_class', property_type: propType, sqft }
          : null;
      }
      if (composition === 'mixed_asset_classes') {
        if (!hasMF && !hasCommercial) return null;
        const breakdown: Array<{ property_type: string | string[]; asset_count: number; units?: number; sqft?: string }> = [];
        if (hasMF) {
          const count = posInt(mfCount);
          const u = posInt(mfUnits);
          if (count === null || u === null) return null;
          breakdown.push({ property_type: 'multifamily', asset_count: count, units: u });
        }
        if (hasCommercial) {
          const count = posInt(commCount);
          if (count === null || !commSqft) return null;
          breakdown.push({ property_type: commercialTypes, asset_count: count, sqft: commSqft });
        }
        return { portfolio_type: 'portfolio', portfolio_composition: 'mixed_asset_classes', asset_breakdown: breakdown };
      }
    }
    return null;
  }, [portfolioType, composition, propType, units, sqft, hasMF, hasCommercial, commercialTypes, mfCount, mfUnits, commCount, commSqft]);

  return (
    <div>
      <SQ>Tell us about the property</SQ>
      <SH3>This shapes how we scope management and what specialist we bring in.</SH3>

      {/* Q1 — single vs portfolio */}
      <div className="mb-3.5">
        <FL>Are you managing a single property or a portfolio?</FL>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { id: 'single' as const, label: 'Single property', desc: 'One asset' },
            { id: 'portfolio' as const, label: 'Portfolio', desc: 'Multiple assets' },
          ].map((opt) => (
            <div
              key={opt.id}
              onClick={() => setPortfolioType(opt.id)}
              className={`rounded-[13px] border cursor-pointer transition-all relative p-4 ${
                portfolioType === opt.id ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:bg-white hover:-translate-y-0.5'
              }`}
            >
              <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-full border flex items-center justify-center text-[0.55rem] transition-all ${
                portfolioType === opt.id ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] text-transparent'
              }`}>✓</div>
              <div className="text-[0.84rem] font-semibold text-ink mb-0.5">{opt.label}</div>
              <div className="text-[0.72rem] text-sub">{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SINGLE PROPERTY ── */}
      {portfolioType === 'single' && (
        <>
          <ChipRow label="Property type" options={PROP_TYPES as unknown as { token: string; label: string }[]} value={propType} onSelect={selectPropType} />
          {propType && (
            isMultifamily(propType)
              ? <NumberField label={singleSizeLabel} value={units} onChange={setUnits} placeholder="e.g. 24" />
              : <ChipRow label={singleSizeLabel} options={SINGLE_SQFT} value={sqft} onSelect={setSqft} />
          )}
        </>
      )}

      {/* ── PORTFOLIO ── */}
      {portfolioType === 'portfolio' && (
        <>
          <div className="mb-3.5">
            <FL>Is your portfolio all one asset class, or a mix?</FL>
            <div className="flex flex-wrap gap-1.5">
              {[
                { token: 'single_asset_class', label: 'Single asset class' },
                { token: 'mixed_asset_classes', label: 'Mixed asset classes' },
              ].map((o) => (
                <ChipS
                  key={o.token}
                  label={o.label}
                  sel={composition === o.token}
                  onClick={() => setComposition(o.token as typeof composition)}
                />
              ))}
            </div>
          </div>

          {/* Portfolio · single asset class */}
          {composition === 'single_asset_class' && (
            <>
              <ChipRow label="Property type" options={PROP_TYPES as unknown as { token: string; label: string }[]} value={propType} onSelect={selectPropType} />
              {propType && (
                isMultifamily(propType)
                  ? <NumberField label={aggSizeLabel} value={units} onChange={setUnits} placeholder="e.g. 120" />
                  : <ChipRow label={aggSizeLabel} options={AGG_SQFT} value={sqft} onSelect={setSqft} />
              )}
            </>
          )}

          {/* Portfolio · mixed asset classes */}
          {composition === 'mixed_asset_classes' && (
            <>
              <div className="mb-3.5">
                <FL>Property types <FLNote>(select all that apply)</FLNote></FL>
                <div className="flex flex-wrap gap-1.5">
                  {PROP_TYPES.map((o) => (
                    <ChipM key={o.token} label={o.label} sel={mixedTypes.includes(o.token)} onClick={() => toggleMixedType(o.token)} />
                  ))}
                </div>
              </div>

              {/* Multifamily row — its own asset count + unit count. */}
              {hasMF && (
                <div className="mb-3 rounded-[12px] border border-border bg-body p-3.5">
                  <div className="text-[0.8rem] font-semibold text-ink mb-2.5">Multifamily</div>
                  <NumberField label="Number of assets" value={mfCount} onChange={setMfCount} placeholder="e.g. 3" />
                  <NumberField label="Total units" value={mfUnits} onChange={setMfUnits} placeholder="e.g. 120" />
                </div>
              )}

              {/* Combined commercial row — one asset count + one combined sqft tier,
                  regardless of how many of Retail/Office/Industrial are checked. */}
              {hasCommercial && (
                <div className="mb-3 rounded-[12px] border border-border bg-body p-3.5">
                  <div className="text-[0.8rem] font-semibold text-ink mb-2.5">
                    Commercial
                    <span className="ml-1.5 text-[0.68rem] font-normal text-hint">
                      ({commercialTypes.map((t) => PROP_TYPES.find((p) => p.token === t)?.label ?? t).join(', ')})
                    </span>
                  </div>
                  <NumberField label="Number of assets" value={commCount} onChange={setCommCount} placeholder="e.g. 5" />
                  <div>
                    <FL>Total square footage</FL>
                    <div className="flex flex-wrap gap-1.5">
                      {AGG_SQFT.map((o) => (
                        <ChipS key={o.token} label={o.label} sel={commSqft === o.token} onClick={() => setCommSqft(o.token)} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="flex gap-2 mt-5">
        <NavBack onClick={onBack} />
        <NavNext onClick={() => assembled && onContinue(assembled)} disabled={!assembled} />
      </div>
    </div>
  );
}
