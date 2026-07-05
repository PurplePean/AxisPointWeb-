/**
 * MarketLocationInput — isolated multi-select market/location field.
 *
 * Google Places Autocomplete is not provisioned yet, so this is a styled chip
 * input backed by plain text: type a city, press Enter (or comma), and it
 * becomes a removable chip. It accepts and emits an array of `Market`
 * ({ label, placeId? }) objects — `placeId` is always undefined for now.
 *
 * When the Places API key lands, swapping in real autocomplete should only
 * touch THIS file: keep the same `value` / `onChange` contract and populate
 * `placeId` from the selected prediction. Nothing upstream needs to change.
 */
import { useState, type KeyboardEvent } from 'react';
import type { Market } from './types';
import { FL, FLNote } from './primitives';

export interface MarketLocationInputProps {
  value: Market[];
  onChange: (next: Market[]) => void;
}

export function MarketLocationInput({ value, onChange }: MarketLocationInputProps) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const label = draft.trim();
    if (!label) return;
    /* de-dupe case-insensitively */
    if (value.some((m) => m.label.toLowerCase() === label.toLowerCase())) {
      setDraft('');
      return;
    }
    /* placeId intentionally undefined until Google Places is wired */
    onChange([...value, { label }]);
    setDraft('');
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    /* Enter commits. Comma is NOT a separator so "City, State" stays one chip. */
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      removeAt(value.length - 1);
    }
  }

  return (
    <div className="mb-3.5">
      <FL>Market / location <FLNote>(type a city, press Enter)</FLNote></FL>
      <div className="w-full bg-white border border-border rounded-[10px] px-2 py-2 flex flex-wrap items-center gap-1.5 transition-all focus-within:border-purple focus-within:shadow-[0_0_0_3px_#EEEAF5]">
        {value.map((m, i) => (
          <span
            key={`${m.label}-${i}`}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full border border-teal bg-[#E8F7FA] text-teal text-xs font-medium"
          >
            {m.label}
            <button
              type="button"
              aria-label={`Remove ${m.label}`}
              onClick={() => removeAt(i)}
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-teal hover:text-white transition-colors cursor-pointer leading-none"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commitDraft}
          placeholder={value.length ? 'Add another…' : 'e.g. Houston, TX'}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none px-1.5 py-1 text-ink text-sm max-md:text-base font-[Figtree,sans-serif] placeholder:text-hint"
        />
      </div>
      <p className="text-[0.67rem] text-hint mt-1.5">Add every market your properties are in.</p>
    </div>
  );
}
