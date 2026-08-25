/**
 * AxisPoint Partners Brand Colors
 * Extracted from HTML prototypes - do not modify
 */

export const colors = {
  // Primary: Teal
  teal: {
    DEFAULT: '#24A5BC',
    light: '#E8F7FA',
    medium: '#B8E6EF',
    dark: '#1A8799',
  },

  // Secondary: Purple
  purple: {
    DEFAULT: '#38285D',
    light: '#EEEAF5',
    medium: '#C4B8DC',
    dark: '#2A1E47',
  },

  // Tertiary: Magenta
  magenta: {
    DEFAULT: '#9F328C',
    light: '#F5EAF4',
    medium: '#DDB8D9',
  },

  // Neutrals
  ink: '#1C1628', // Primary text color
  body: '#F7F5FB', // Main background
  card: '#FFFFFF', // Card backgrounds

  // Borders
  border: {
    DEFAULT: '#E8E4F0',
    dark: '#D4CEE8',
  },

  // Text colors
  sub: '#5A5270', // Subtext
  hint: '#9490A8', // Hint text

  // Shadows (CSS values)
  shadows: {
    card: '0 1px 3px rgba(56,40,93,.06), 0 8px 24px rgba(56,40,93,.08)',
    cardHover: '0 4px 12px rgba(56,40,93,.1), 0 20px 48px rgba(56,40,93,.14)',
  },
} as const;

/**
 * Approved V2 design tokens (design@2026-07-30).
 *
 * Kept separate from `colors` above rather than replacing it: `colors` and the
 * matching Tailwind preset are consumed by apps/qr and the existing V1 pages, so
 * editing those values in place would restyle surfaces this pass is not rebuilding.
 * The V2 public site reads from here and from the `v2-*` Tailwind tokens.
 *
 * `surface` supersedes the older cool `colors.body` (#F7F5FB). The approved QR
 * board states it directly: "#F7F5FB was inherited from an older brief and is
 * superseded here."
 */
export const v2 = {
  surface: '#F6F2EA', // Warm page field
  fieldWarm: '#FFFCF6', // Warm off-white for form fields and alternating section backgrounds
  ink: '#1C1628', // Primary text
  teal: '#24A5BC', // Primary action
  tealSupport: '#1B8DA2', // Hover / supporting teal
  purple: '#38285D', // Structure, rules, focus ring
  magenta: '#9F328C', // Accent, used sparingly
  magentaBg: '#FDF2F9', // Very light magenta tint for match/highlight backgrounds
  actionLabel: '#0F1F27', // Label on the teal action, 8.1:1 against #24A5BC
  footer: '#141020', // Footer field, from AxisPointFooter.dc.html
  radius: '2px',
  contentMax: '1240px',
} as const;

export type V2Token = keyof typeof v2;

export type ColorKey = keyof typeof colors;
export type TealShade = keyof typeof colors.teal;
export type PurpleShade = keyof typeof colors.purple;
export type MagentaShade = keyof typeof colors.magenta;
