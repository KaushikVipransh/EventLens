import type { Config } from 'tailwindcss';

/**
 * Palette + type scale from design.md: warm cream canvas, near-black ink,
 * white floating panels, small purposeful accents. Bold geometric grotesk.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#F2F1EC', light: '#F7F7F4' },
        ink: '#17171A',
        panel: '#FFFFFF',
        coral: { DEFAULT: '#E8623A', soft: '#F0997B' },
        grass: { DEFAULT: '#4C9A5B', soft: '#63C48A' },
        sky: { DEFAULT: '#3A7BD5', soft: '#6FA8E8' },
        grape: '#8B6FD9',
        amber: '#F0B429',
      },
      fontFamily: {
        sans: ['var(--font-sora)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(2.75rem, 6vw, 4rem)', { lineHeight: '1.02', fontWeight: '600' }],
        h1: ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.1', fontWeight: '500' }],
        h2: ['1.5rem', { lineHeight: '1.2', fontWeight: '500' }],
      },
      borderRadius: {
        pill: '999px',
        card: '16px',
      },
      boxShadow: {
        lift: '0 12px 40px -12px rgba(23,23,26,0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
