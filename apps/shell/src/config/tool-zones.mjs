/**
 * Multi-zone registry (backbone §2, §8).
 *
 * Each tool deploys independently and is stitched under the district origin at
 * /{tool-slug}. The tool sets `basePath` to its own slug; the shell rewrites to
 * its deployment. Adding a tool is a one-entry change here plus a
 * `tool_instances` row for each district that gets it.
 *
 * No tools are registered yet, so this list is empty on purpose.
 *
 * @typedef {object} ToolZone
 * @property {string} slug    path segment and the tool's own basePath
 * @property {string} envVar  env var holding the deployment origin
 */

/** @type {ToolZone[]} */
export const TOOL_ZONES = [];

/**
 * Turn the registry into Next rewrites. A zone with no origin configured is
 * skipped rather than rewritten to `undefined/...`, so a missing env var in
 * preview degrades to a 404 instead of a broken proxy.
 *
 * @returns {{ source: string, destination: string }[]}
 */
export function toolZoneRewrites() {
  return TOOL_ZONES.flatMap(({ slug, envVar }) => {
    const origin = process.env[envVar]?.replace(/\/$/, '');
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[tool-zones] ${envVar} is unset; skipping /${slug} rewrite`);
      }
      return [];
    }
    return [
      { source: `/${slug}`, destination: `${origin}/${slug}` },
      { source: `/${slug}/:path*`, destination: `${origin}/${slug}/:path*` },
      // Each zone serves its own static chunks under its basePath.
      { source: `/${slug}/_next/:path*`, destination: `${origin}/${slug}/_next/:path*` },
    ];
  });
}
