import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

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
        // Sombras em camadas — mais profundidade, menos "flat"
        soft: '0 1px 2px rgba(16,24,40,.04), 0 2px 6px rgba(16,24,40,.06)',
        card: '0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.06)',
        lift: '0 10px 30px -8px rgba(16,24,40,.18), 0 4px 10px -4px rgba(16,24,40,.10)',
        // Brilho verde para ações primárias
        glow: '0 6px 20px -6px hsl(160 84% 31% / .5)',
        'glow-lg': '0 12px 32px -8px hsl(160 84% 31% / .55)',
      },
      borderRadius: { '2xl': '1rem' },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, hsl(160 84% 36%), hsl(160 84% 28%))',
        'brand-sheen': 'linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,0) 60%)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .4s ease-out both',
        'fade-up': 'fade-up .5s cubic-bezier(.21,1.02,.73,1) both',
        'scale-in': 'scale-in .3s ease-out both',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
