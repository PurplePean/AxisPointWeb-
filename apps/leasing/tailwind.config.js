/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/brand/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('../../packages/brand/tailwind.preset.js')],
  theme: {
    extend: {},
  },
  plugins: [],
};
