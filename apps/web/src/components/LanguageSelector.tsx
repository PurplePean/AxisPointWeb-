import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useMessages } from '../i18n/LocaleProvider';
import { withLanguage } from '../i18n/messages';
import {
  PREVIEW_FONT_HREF,
  getDefaultLocale,
  launchReadyLocales,
  proofLocales,
  resolveLocale,
  shouldCycle,
  type LocaleCode,
} from '../i18n/locales';

/**
 * The approved global language selector (design@2026-07-31,
 * `AxisPoint Language Selector.dc.html`).
 *
 * Two slots. A fixed 82px decorative slot that crossfades the native word for
 * "Language", a hairline divider, then the active locale stated permanently beside it,
 * and a caret. On mobile the second slot becomes the two-letter code so the trigger
 * holds 152px.
 *
 * Motion is a 130ms opacity crossfade on a 1500ms hold. Nothing slides, marquees,
 * ticks, bounces, or types. The slot has a fixed width so the navigation never moves.
 *
 * This ships the control and its registry only. It does not translate the site, add
 * routing, persist a choice, or store a locale with a submission.
 */

const HOLD_MS = 1500;
const FADE_MS = 130;
/** Approved: fixed decorative slot, 82px desktop and 62px in the compact trigger. */
const SLOT_DESKTOP = 82;
const SLOT_MOBILE = 62;
/** Approved: the compact mobile trigger holds this width rather than growing. */
const MOBILE_TRIGGER_WIDTH = 152;
/** Approved: roughly six rows visible, then scroll. */
const MENU_MAX_HEIGHT = 340;

export interface LanguageSelectorProps {
  /** Controlled active locale. */
  value?: LocaleCode;
  /**
   * Explicit change callback.
   *
   * Wired to the app-level `LocaleProvider`, so a change updates `<html lang>` and `dir`,
   * swaps the message catalog, and reaches the page locale carried on a submission. It does
   * NOT change the URL or persist: no approved source settles a locale routing contract, so
   * none was invented.
   */
  onChange?: (code: LocaleCode) => void;
  /** Compact trigger for the mobile header: locale code instead of the native name. */
  compact?: boolean;
}

/** Development-only preview, gated so it cannot exist in a production build. */
function usePreviewMode(): boolean {
  const [on] = useState(() => {
    if (!import.meta.env.DEV) return false;
    return new URLSearchParams(window.location.search).get('locale-preview') === 'all';
  });
  return on;
}

/**
 * Loads the script fonts only while previewing, so production pays nothing.
 *
 * The DEV guard is inside the effect as well as at the call site: it makes the whole
 * body statically unreachable in a production build, where Vite substitutes
 * `import.meta.env.DEV` with `false`.
 */
function usePreviewFonts(active: boolean) {
  useEffect(() => {
    if (!import.meta.env.DEV || !active) return;
    const existing = document.head.querySelector(`link[href="${PREVIEW_FONT_HREF}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = PREVIEW_FONT_HREF;
    link.dataset.localePreview = 'true';
    document.head.appendChild(link);
  }, [active]);
}

export default function LanguageSelector({
  value,
  onChange,
  compact = false,
}: LanguageSelectorProps) {
  const preview = usePreviewMode();
  const t = useMessages();
  usePreviewFonts(preview);

  // One registry, filtered. Production takes the launch gate; the preview relaxes it.
  const available = preview ? proofLocales() : launchReadyLocales();
  const active = resolveLocale(value ?? getDefaultLocale().code, available);
  const cycles = shouldCycle(available);

  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<LocaleCode | null>(null);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [activeRow, setActiveRow] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  /* ── Cycling ──
     Frozen while open, hovered, focused, after a selection, under reduced motion, or
     whenever there are fewer than two locales to show. Pausing freezes the current
     word rather than snapping back to English, so nothing jumps under the cursor. */
  const frozen = open || paused || chosen !== null || reduced || !cycles;

  useEffect(() => {
    if (frozen) return;
    const hold = window.setTimeout(() => {
      setVisible(false);
      const fade = window.setTimeout(() => {
        setIdx((i) => (i + 1) % available.length);
        setVisible(true);
      }, FADE_MS);
      timers.current.push(fade);
    }, HOLD_MS);
    timers.current.push(hold);
    return () => window.clearTimeout(hold);
  }, [frozen, idx, visible, available.length]);

  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const word = (available[idx] ?? active).nativeWord;
  const wordLocale = available[idx] ?? active;

  /* ── Selection ──
     The decorative slot moves to the chosen locale's own word before it freezes, so
     the two slots agree: "زبان | اردو", never the previously cycling word beside a
     different active locale. This mirrors the approved board's `pick`, which sets the
     cycle index and visibility alongside the selection.

     `chosen` keeps `frozen` true from here on, so reopening and closing the menu
     never restarts the cycle. */
  const select = useCallback(
    (code: LocaleCode) => {
      const at = available.findIndex((l) => l.code === code);
      if (at >= 0) setIdx(at);
      setVisible(true);
      setChosen(code);
      setOpen(false);
      onChange?.(code);
      triggerRef.current?.focus();
    },
    [available, onChange]
  );

  const openMenu = useCallback(() => {
    setActiveRow(
      Math.max(
        0,
        available.findIndex((l) => l.code === active.code)
      )
    );
    setOpen(true);
  }, [available, active.code]);

  /* Focus the listbox when it opens so arrow keys work immediately. */
  useLayoutEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  /* Click outside closes. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveRow((i) => (i + 1) % available.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveRow((i) => (i - 1 + available.length) % available.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveRow(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveRow(available.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const l = available[activeRow];
      if (l) select(l.code);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      // Tab closes and lets focus continue naturally, keeping tab order predictable
      // and leaving the mobile menu's focus trap intact.
      setOpen(false);
    }
  }

  const slot = compact ? SLOT_MOBILE : SLOT_DESKTOP;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        /* Stable accessible name. The cycling word never enters it. */
        /* The active locale's ENGLISH name is substituted, unchanged from before this
           migration. A reviewer may reasonably argue the native name belongs here instead,
           but swapping it would change what a screen reader announces, which is a behaviour
           decision rather than a translation one. Recorded in STATUS.md. */
        aria-label={withLanguage(t.languageChooseAria, active.englishName)}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="inline-flex items-center gap-2.5 rounded-v2 text-v2-ink"
        style={{
          minHeight: 44,
          padding: compact ? '0 10px' : '0 12px',
          fontSize: 13,
          background: open ? '#FFFFFF' : 'transparent',
          border: `1px solid ${open ? '#24A5BC' : 'rgba(28,22,40,0.22)'}`,
          ...(compact ? { width: MOBILE_TRIGGER_WIDTH } : null),
        }}
      >
        {/* Decorative slot. Fixed width so the navigation never shifts, and hidden from
            screen readers: it is shimmer, not information. */}
        <span
          aria-hidden="true"
          style={{
            width: slot,
            flex: `0 0 ${slot}px`,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textAlign: 'start',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontFamily: wordLocale.fontStack,
              color: 'rgba(28,22,40,0.62)',
              fontWeight: 500,
              opacity: visible ? 1 : 0,
              transition: reduced ? 'none' : `opacity ${FADE_MS}ms ease`,
              /* Urdu shapes and orders correctly inside its own isolate, so the
                 trigger, caret side, and header never reverse. */
              unicodeBidi: 'isolate',
              direction: wordLocale.direction,
            }}
          >
            {word}
          </span>
        </span>

        <span
          aria-hidden="true"
          style={{ width: 1, height: 16, flex: '0 0 1px', background: 'rgba(28,22,40,0.2)' }}
        />

        {/* Active locale. Its own slot, never animates. */}
        <span
          style={{
            fontFamily: active.fontStack,
            fontWeight: 600,
            color: '#1C1628',
            unicodeBidi: 'isolate',
            direction: active.direction,
            lineHeight: active.lineHeight,
          }}
        >
          {compact ? active.shortCode : active.nativeName}
        </span>

        <span aria-hidden="true" style={{ color: 'rgba(28,22,40,0.5)', fontSize: 11 }}>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={t.languageListAria}
          aria-activedescendant={`${listboxId}-${activeRow}`}
          onKeyDown={onListKeyDown}
          className="absolute right-0 z-50 m-0 list-none overflow-y-auto bg-white p-0"
          style={{
            top: 'calc(100% + 6px)',
            width: 262,
            maxHeight: MENU_MAX_HEIGHT,
            border: '1px solid rgba(28,22,40,0.25)',
            boxShadow: '0 14px 34px rgba(28,22,40,0.16)',
          }}
        >
          {available.map((l, i) => {
            const isActive = l.code === active.code;
            const isCursor = i === activeRow;
            return (
              <li
                key={l.code}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={isActive}
                onClick={() => select(l.code)}
                onMouseEnter={() => setActiveRow(i)}
                className="flex cursor-pointer items-center justify-between gap-3"
                style={{
                  minHeight: compact ? 60 : 54,
                  padding: compact ? '9px 16px' : '7px 14px',
                  fontWeight: isActive ? 600 : 500,
                  background: isActive
                    ? 'rgba(36,165,188,0.12)'
                    : isCursor
                      ? 'rgba(28,22,40,0.05)'
                      : 'transparent',
                  borderTop: i ? '1px solid rgba(28,22,40,0.1)' : undefined,
                  boxShadow: isCursor ? 'inset 0 0 0 2px #24A5BC' : undefined,
                }}
              >
                <span
                  style={{ display: 'block', textAlign: l.direction === 'rtl' ? 'right' : 'left' }}
                >
                  {/* Native name first, English name second. No flags. */}
                  <span
                    style={{
                      display: 'block',
                      fontFamily: l.fontStack,
                      fontSize: 15.5,
                      lineHeight: l.lineHeight,
                      unicodeBidi: 'isolate',
                      direction: l.direction,
                    }}
                  >
                    {l.nativeName}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 1,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgba(28,22,40,0.55)',
                    }}
                  >
                    {l.englishName}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    flex: '0 0 auto',
                    fontSize: 13,
                    color: isActive ? '#1B8DA2' : 'transparent',
                  }}
                >
                  &#10003;
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Development-only notice. Gated twice: the preview flag itself only resolves
          true under import.meta.env.DEV, and this render is gated again. */}
      {import.meta.env.DEV && preview && open && (
        <p
          className="absolute right-0 z-50 bg-[#38285D] text-white"
          style={{
            top: `calc(100% + ${MENU_MAX_HEIGHT + 12}px)`,
            width: 262,
            margin: 0,
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Development preview only. The page stays in English. Selecting a language changes this
          control alone and does not translate anything.
        </p>
      )}
    </div>
  );
}
