/**
 * __TOOL_NAME__ (backbone §2, §7, §11).
 *
 * A multi-zone under the district origin. basePath is the tool's slug, and the
 * shell rewrites /__TOOL_SLUG__/* here. Users never reach this deployment
 * directly, which is what lets one session and one service worker cover
 * everything.
 *
 * This tool registers NO service worker. The shell owns the only one, at root
 * scope, and it serves the offline fallback. See template.config.mjs for the
 * offline mode.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/__TOOL_SLUG__',
  transpilePackages: ['@breezebox/ui', '@breezebox/db', '@breezebox/auth'],
};

export default nextConfig;
