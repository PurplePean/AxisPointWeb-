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
      },

      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Figtree', 'sans-serif'],
      },

      boxShadow: {
        card: '0 1px 3px rgba(56,40,93,.06), 0 8px 24px rgba(56,40,93,.08)',
        'card-hover': '0 4px 12px rgba(56,40,93,.1), 0 20px 48px rgba(56,40,93,.14)',
      },

      spacing: {
        nav: '68px', // Navigation height
      },

      borderRadius: {
        card: '13px',
        button: '10px',
        chip: '100px',
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
