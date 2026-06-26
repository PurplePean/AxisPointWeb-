/**
 * Step 1 — Role selection. Copied verbatim from
 * apps/web/src/pages/ContactPage.tsx (`step === 'role'`).
 */
import React from 'react';
import type { FormController, Role } from '../types';
import { SQ, SH3, NavNext } from '../primitives';

function RoleTile({ c, r, icon, label, desc, wide }: {
  c: FormController; r: Role; icon: React.ReactNode; label: string; desc: string; wide?: boolean;
}) {
  const sel = c.role === r;
  return (
    <div
      onClick={() => c.setRole(r)}
      className={`rounded-[13px] border cursor-pointer transition-all relative ${wide ? 'flex items-center gap-3 py-3 px-3.5' : 'p-3.5'} ${
        sel ? 'border-teal bg-[#E8F7FA]' : 'border-border bg-body hover:border-[#D4CEE8] hover:-translate-y-0.5 hover:bg-white'
      }`}
      style={wide ? { gridColumn: '1/-1' } : {}}
    >
      <div
        className={`absolute top-2 right-2 w-[15px] h-[15px] rounded-full border flex items-center justify-center text-[0.52rem] transition-all ${
          sel ? 'border-teal bg-teal text-white' : 'border-[#D4CEE8] text-transparent'
        }`}
        style={wide ? { position: 'static', flexShrink: 0 } : {}}
      >
        ✓
      </div>
      <div className="w-8 h-8 rounded-[8px] bg-body border border-border flex items-center justify-center mb-2 flex-shrink-0" style={wide ? { marginBottom: 0 } : {}}>
        {icon}
      </div>
      <div>
        <div className="text-[0.82rem] font-semibold text-ink mb-0.5">{label}</div>
        <div className="text-[0.68rem] text-sub leading-snug">{desc}</div>
      </div>
    </div>
  );
}

export function Step1Role({ c }: { c: FormController }) {
  return (
    <div>
      <SQ>Who are you?</SQ>
      <SH3>Pick the option that fits best. The form adapts from here.</SH3>
      <div className="grid grid-cols-2 gap-[9px]">
        <RoleTile c={c} r="investor" label="Investor" desc="Looking to place capital in CRE"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#24A5BC" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
        />
        <RoleTile c={c} r="referral" label="Referral Partner" desc="CPA, attorney, advisor"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38285D" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <RoleTile c={c} r="pro" label="RE Professional" desc="Broker, lender, developer"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9F328C" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>}
        />
        <RoleTile c={c} r="curious" label="Exploring CRE" desc="Learning, just starting out"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5A5270" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
        />
        <RoleTile c={c} r="refer" label="Making a Referral" desc="I want to introduce someone" wide
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5A5270" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
      </div>
      <div className="flex gap-2 mt-5">
        <NavNext onClick={() => c.setStep('context')} disabled={!c.role} />
      </div>
    </div>
  );
}
