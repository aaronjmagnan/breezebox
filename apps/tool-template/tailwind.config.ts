import type { Config } from 'tailwindcss';
import preset from '@breezebox/ui/tailwind-preset';

/** No tokens of its own: everything comes from the shared preset (§6). */
const config: Config = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  plugins: [],
};

export default config;
