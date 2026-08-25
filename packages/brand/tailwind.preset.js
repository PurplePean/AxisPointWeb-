/**
 * AxisPoint Partners Tailwind CSS Preset
 * Shared configuration for both web and QR apps
 *
 * Extends Tailwind with brand colors, fonts, and custom utilities
 * All design tokens extracted from HTML prototypes
 */

module.exports = {
  theme: {
    extend: {
      colors: {
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
        ink: '#1C1628', // Primary text
        body: '#F7F5FB', // Background
        card: '#FFFFFF', // Card background

        // Borders
        border: {
          DEFAULT: '#E8E4F0',
          dark: '#D4CEE8',
        },

        // Text
        sub: '#5A5270', // Subtext
        hint: '#9490A8', // Hint text

        /* ── Approved V2 tokens (design@2026-07-30) ──
           ADDITIVE ONLY. Every token above is left at its existing value because
           apps/qr consumes this same preset, and changing one would restyle the QR
           app without touching its files. The V2 public site opts in by using the
           `v2-` names below; the QR surface adopts them in its own pass.

           Note `v2-surface` (#F6F2EA) supersedes the older cool `body` (#F7F5FB).
           The approved QR board states this explicitly: "#F7F5FB was inherited from
           an older brief and is superseded here." */
        'v2-surface': '#F6F2EA', // Warm page field
        'v2-field-warm': '#FFFCF6', // Warm off-white for form fields and alternating section backgrounds
        'v2-ink': '#1C1628', // Primary text
        'v2-teal': '#24A5BC', // Primary action
        'v2-teal-support': '#1B8DA2', // Hover / supporting teal
        'v2-purple': '#38285D', // Structure, rules, focus ring
        'v2-magenta': '#9F328C', // Accent, used sparingly
        'v2-magenta-bg': '#FDF2F9', // Very light magenta tint for match/highlight backgrounds
        'v2-action-label': '#0F1F27', // Label on the teal action, 8.1:1
        'v2-footer': '#141020', // Footer field, from AxisPointFooter.dc.html
      },

      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Figtree', 'sans-serif'],
      },

      /* Approved radii. v2 (2px) is the approved default for the V2 public site.
         card/button/chip are kept for the QR app and any surfaces that reference them.
         Previously these were two separate borderRadius keys; JavaScript object literals
         keep only the last key, which silently dropped v2. They are merged here. */
      borderRadius: {
        v2: '2px',
        card: '13px',
        button: '10px',
        chip: '100px',
      },

      maxWidth: {
        /* Approved content measure, from the page sections in AxisPointPage.dc.html
           and AxisPoint System Studies.dc.html. */
        v2: '1240px',
      },

      boxShadow: {
        card: '0 1px 3px rgba(56,40,93,.06), 0 8px 24px rgba(56,40,93,.08)',
        'card-hover': '0 4px 12px rgba(56,40,93,.1), 0 20px 48px rgba(56,40,93,.14)',
      },

      spacing: {
        nav: '68px', // Navigation height
      },

      fontSize: {
        eyebrow: ['0.72rem', { lineHeight: '1.4', letterSpacing: '0.1em' }],
      },

      backdropBlur: {
        nav: '12px',
      },

      animation: {
        'fade-up': 'fadeUp 0.28s ease',
        pop: 'pop 0.45s cubic-bezier(.175,.885,.32,1.275)',
      },

      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.2)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
