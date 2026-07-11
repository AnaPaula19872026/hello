import type { Config } from 'tailwindcss';

const hsl = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),
        background: hsl('background'),
        foreground: hsl('foreground'),
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
        destructive: { DEFAULT: hsl('destructive'), foreground: hsl('destructive-foreground') },
      },
      boxShadow: {
        soft: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
        card: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
      },
      borderRadius: { '2xl': '1rem' },
    },
  },
  plugins: [],
} satisfies Config;
