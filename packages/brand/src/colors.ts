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

export type ColorKey = keyof typeof colors;
export type TealShade = keyof typeof colors.teal;
export type PurpleShade = keyof typeof colors.purple;
export type MagentaShade = keyof typeof colors.magenta;
