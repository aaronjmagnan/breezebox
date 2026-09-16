import type { Config } from 'tailwindcss';

/**
 * The shell owns no design tokens of its own. Everything comes from the shared
 * preset in @breezebox/ui so the shell and every tool stay in sync (§6).
 *
 * The preset lands in step 5; until then this is a plain Tailwind config.
 */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
