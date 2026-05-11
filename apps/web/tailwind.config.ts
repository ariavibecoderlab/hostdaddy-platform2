import type { Config } from 'tailwindcss';
import hostdaddyPreset from '@hostdaddy/ui/tailwind-preset';

export default {
  presets: [hostdaddyPreset],
  content: [
    './src/**/*.{ts,tsx,mdx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
