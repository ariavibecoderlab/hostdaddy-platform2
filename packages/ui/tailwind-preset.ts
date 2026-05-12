import type { Config } from 'tailwindcss';

/**
 * HostDaddy.app Tailwind preset.
 * Brand tokens from Section 1 of the build spec:
 *   Navy          #0A1628
 *   Electric Blue #1A56DB
 *   Cyan          #06B6D4
 *
 * Apps consume this via `presets: [hostdaddyPreset]` in their tailwind.config.
 */
const preset = {
  content: [],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#E6E9EE',
          100: '#C2C9D5',
          200: '#9BA6B8',
          300: '#74829A',
          400: '#4D5E7C',
          500: '#2A3D5E',
          600: '#1A2C4A',
          700: '#0F1E36',
          800: '#0A1628',
          900: '#050B16',
          DEFAULT: '#0A1628',
        },
        electric: {
          50: '#EBF1FE',
          100: '#C9D8FB',
          200: '#A2BAF7',
          300: '#7A9CF3',
          400: '#5380EE',
          500: '#1A56DB',
          600: '#1448B7',
          700: '#0E3A93',
          800: '#082C6F',
          900: '#03204C',
          DEFAULT: '#1A56DB',
        },
        cyan: {
          50: '#E6FAFD',
          100: '#B9F0F8',
          200: '#8AE5F2',
          300: '#5BD9EC',
          400: '#2DCCE4',
          500: '#06B6D4',
          600: '#0594AB',
          700: '#047384',
          800: '#03525E',
          900: '#013138',
          DEFAULT: '#06B6D4',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'var(--font-inter)',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        glow: '0 0 0 4px rgba(26, 86, 219, 0.15)',
        'glow-cyan': '0 0 0 4px rgba(6, 182, 212, 0.18)',
        card: '0 1px 2px 0 rgba(10, 22, 40, 0.04), 0 4px 12px -2px rgba(10, 22, 40, 0.08)',
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default preset;
