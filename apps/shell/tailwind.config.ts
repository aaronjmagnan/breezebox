import type { Config } from 'tailwindcss';
import preset from '@breezebox/ui/tailwind-preset';

/**
 * The shell owns no design tokens of its own. Everything comes from the shared
 * preset in @breezebox/ui, so the shell and every tool stay in sync (§6).
 */
const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  plugins: [],
};

export default config;
