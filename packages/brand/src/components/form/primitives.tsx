/**
 * Stateless presentational atoms shared across the form steps.
 * Copied verbatim from apps/web/src/pages/ContactPage.tsx.
 */
import React from 'react';

/* ── Chip helpers ── */
export function ChipS({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
        sel ? 'border-purple bg-[#EEEAF5] text-purple' : 'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

export function ChipM({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
        sel ? 'border-teal bg-[#E8F7FA] text-teal' : 'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

export function CapC({ label, sel, dim, onClick }: { label: string; sel: boolean; dim?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 px-1 rounded-[10px] border text-xs font-semibold transition-all cursor-pointer text-center leading-snug ${
        sel ? 'border-[#9F328C] bg-[#F5EAF4] text-[#9F328C]' :
        dim && !sel ? 'border-border bg-white text-sub/40 hover:text-sub hover:border-[#D4CEE8]' :
        'border-border bg-white text-sub hover:border-[#D4CEE8] hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/* ── Field label ── */
export function FL({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[0.63rem] font-semibold text-sub uppercase tracking-[0.09em] mb-1.5 flex items-center gap-1">
      {children}
    </div>
  );
}

export function FLNote({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.6rem] font-normal normal-case tracking-normal text-hint">{children}</span>;
}

export function FInput({ id, label, type = 'text', placeholder, autocomplete }: {
  id: string; label: React.ReactNode; type?: string; placeholder: string; autocomplete?: string;
}) {
  return (
    <div className="mb-3.5">
      <FL>{label}</FL>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autocomplete}
        className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm font-[Figtree,sans-serif] outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5]"
      />
    </div>
  );
}

export function FTextarea({ id, label, placeholder, rows = 3 }: { id: string; label: string; placeholder: string; rows?: number; }) {
  return (
    <div className="mb-3.5">
      <FL>{label}</FL>
      <textarea
        id={id}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-ink text-sm outline-none transition-all placeholder:text-hint focus:border-purple focus:shadow-[0_0_0_3px_#EEEAF5] resize-y leading-snug min-h-[76px]"
      />
    </div>
  );
}

/* ── Nav buttons ── */
export function NavBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2.5 rounded-[10px] border border-border bg-transparent text-sub text-[0.82rem] font-medium cursor-pointer transition-all hover:border-[#D4CEE8] hover:text-ink flex-shrink-0"
    >
      Back
    </button>
  );
}

export function NavNext({ onClick, disabled, label = 'Continue' }: { onClick: () => void; disabled?: boolean; label?: string; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-3 px-4 rounded-[10px] border-none bg-purple text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none"
    >
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  );
}

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[0.62rem] font-semibold tracking-[0.09em] uppercase text-sub whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function SQ({ children }: { children: React.ReactNode }) {
  return <div className="font-serif font-semibold text-ink mb-1 leading-snug" style={{ fontSize: '1.18rem' }}>{children}</div>;
}

export function SH3({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.8rem] text-sub leading-relaxed mb-4">{children}</div>;
}
