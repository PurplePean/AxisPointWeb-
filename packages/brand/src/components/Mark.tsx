/**
 * The approved AxisPoint mark and lockup.
 *
 * Geometry is copied exactly from the approved design source
 * `AxisPointMark.dc.html` (design@2026-07-30): the same `0 0 64 85.45` viewBox,
 * the same `translate(-17.44 -11.66)` group transform, and the same eight
 * shapes in the same order. Do not redraw or approximate it.
 *
 * `lockup` renders the mark beside live "AxisPoint" text (Figtree 600, -0.035em),
 * which is how the approved sources do it. The word is real text, never a vector
 * outline, so it stays selectable and scales with the type system.
 *
 * Accessibility: in `lockup` mode the visible word already carries the name, so
 * the SVG is aria-hidden to avoid announcing "AxisPoint" twice. In `mark` mode
 * the SVG carries the accessible name itself. Per the approved QR board, the
 * mark alone is never the only identity on a page.
 */

export type MarkVariant = 'fullcolor' | 'white' | 'ink' | 'grayscale' | 'onDark';
export type MarkMode = 'lockup' | 'mark';

interface MarkPalette {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  word: string;
  accent: string;
}

/**
 * Four variants come straight from AxisPointMark.dc.html. `onDark` is the fifth,
 * taken from AxisPointFooter.dc.html, which lightens the two purples so the mark
 * holds up on the #141020 footer field. It is an approved source value, not a
 * tint invented here.
 */
const PALETTES: Record<MarkVariant, MarkPalette> = {
  fullcolor: { c1: '#24A5BC', c2: '#38285D', c3: '#9F328C', c4: '#4A3A72', word: '#38285D', accent: '#24A5BC' },
  white: { c1: '#FFFFFF', c2: '#FFFFFF', c3: '#FFFFFF', c4: '#FFFFFF', word: '#FFFFFF', accent: '#FFFFFF' },
  ink: { c1: '#1C1628', c2: '#1C1628', c3: '#1C1628', c4: '#1C1628', word: '#1C1628', accent: '#1C1628' },
  grayscale: { c1: '#8A8595', c2: '#3B3646', c3: '#615C6D', c4: '#4A4553', word: '#3B3646', accent: '#615C6D' },
  onDark: { c1: '#24A5BC', c2: '#6B58A0', c3: '#9F328C', c4: '#8574B8', word: '#FFFFFF', accent: '#24A5BC' },
};

export interface MarkProps {
  variant?: MarkVariant;
  mode?: MarkMode;
  /** Height of the glyph in px. The word scales from it, as in the approved component. */
  height?: number;
  className?: string;
}

export function Mark({ variant = 'fullcolor', mode = 'lockup', height = 24, className }: MarkProps) {
  const p = PALETTES[variant] ?? PALETTES.fullcolor;
  const markOnly = mode === 'mark';

  const glyph = (
    <svg
      viewBox="0 0 64 85.45"
      style={{ height, width: 'auto', display: 'block' }}
      {...(markOnly ? { role: 'img', 'aria-label': 'AxisPoint' } : { 'aria-hidden': true })}
    >
      <g transform="translate(-17.44 -11.66)">
        <polyline fill={p.c1} points="56.72 66.36 57.49 65.95 57.36 15.97 67.15 11.66 67.06 69.26 63.66 71.46" />
        <polyline fill={p.c2} points="63.66 71.46 53.48 78.08 44.27 71.3 44.27 28.89 53.93 24.56 53.93 67.85 56.72 66.36" />
        <polyline fill={p.c1} points="68.33 74.9 70.91 73.18 70.91 35.03 80.36 31.05 80.51 79.35 77.31 81.5" />
        <polyline fill={p.c2} points="68.33 74.9 58.67 81.45 67.62 88.02 77.31 81.5" />
        <path fill={p.c2} d="m27.31 66c.05.28 21.32 15.35 21.32 15.35l-8.71 5.82-22.48-16.33.04-12.47 9.84-4.86V66Z" />
        <polygon fill={p.c3} points="40.53 41.67 40.53 71.9 30.91 65.04 30.95 46.88" />
        <polygon fill={p.c3} points="51.76 83.55 62.65 91.37 54.15 97.11 43.53 89.24" />
        <polygon fill={p.c4} points="66.43 73.5 68.33 74.9 58.67 81.45 56.64 79.97" />
      </g>
    </svg>
  );

  if (markOnly) {
    return <span className={className} style={{ display: 'inline-flex' }}>{glyph}</span>;
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(height * 0.4) }}
    >
      {glyph}
      <span
        dir="ltr"
        style={{
          fontFamily: "'Figtree', system-ui, sans-serif",
          fontSize: Math.round(height * 0.82),
          fontWeight: 600,
          letterSpacing: '-0.035em',
          lineHeight: 1,
          color: p.word,
        }}
      >
        Axis<span style={{ color: p.accent }}>Point</span>
      </span>
    </span>
  );
}

export default Mark;
