/**
 * Learning Cycle Check-In (backbone §2, §7, §11).
 *
 * A multi-zone under the district origin. basePath is the tool's slug, and the
 * shell rewrites /learning-cycles/* here. Users never reach this deployment
 * directly, which is what lets one session and one service worker cover
 * everything.
 *
 * offline: "none" (§11). This tool registers NO service worker. The shell owns
 * the only one, at root scope, and it serves the offline fallback when there
 * is no connection.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/learning-cycles',
  transpilePackages: ['@breezebox/ui', '@breezebox/db', '@breezebox/auth'],
};

export default nextConfig;
