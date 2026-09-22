/**
 * Ed Code Assistant (backbone §2, §11).
 *
 * A multi-zone under the district origin. basePath is the tool's slug, and the
 * shell rewrites /ed-code/* here.
 *
 * offline: "none" (§11). This tool registers NO service worker, and nothing it
 * returns is cacheable: an answer is built from a live query against the
 * library, and a stale statute is worse than no statute.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/ed-code',
  transpilePackages: ['@breezebox/ui', '@breezebox/db', '@breezebox/auth'],
};

export default nextConfig;
