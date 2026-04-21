/**
 * AxisPoint Partners Typography
 * Font families and configurations from prototypes
 */

export const fonts = {
  serif: "'Cormorant Garamond', serif",
  sans: "'Figtree', sans-serif",
} as const;

export const fontWeights = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Google Fonts URL for preconnect and loading
 * Loads both font families with required weights
 */
export const googleFontsUrl =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Figtree:wght@300;400;500;600&display=swap';

export const fontConfig = {
  /**
   * Cormorant Garamond (Serif)
   * Use for: Headings, section titles, hero text
   */
  serif: {
    family: fonts.serif,
    weights: [400, 500, 600, 700],
    styles: ['normal', 'italic'],
  },

  /**
   * Figtree (Sans-serif)
   * Use for: Body text, UI elements, buttons, navigation
   */
  sans: {
    family: fonts.sans,
    weights: [300, 400, 500, 600],
    styles: ['normal'],
  },
} as const;
