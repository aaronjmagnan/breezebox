import { toolZoneRewrites } from './src/config/tool-zones.mjs';

/**
 * The shell is the default multi-zone (§2). Each tool deploys independently
 * and is served under the district origin at /{tool-slug}, so one session
 * covers every tool (§5).
 *
 * The rewrite list is driven entirely by src/config/tool-zones.mjs. No tools
 * are registered yet, so this resolves to an empty list today.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@breezebox/ui', '@breezebox/db', '@breezebox/auth', '@breezebox/pwa'],
  async rewrites() {
    return { beforeFiles: toolZoneRewrites() };
  },
};

export default nextConfig;
