/**
 * Multi-zone registry (backbone §2, §8).
 *
 * Each tool deploys independently and is stitched under the district origin at
 * /{tool-slug}. The tool sets `basePath` to its own slug; the shell rewrites to
 * its deployment. Adding a tool is a one-entry change here plus a
 * `tool_instances` row for each district that gets it.
 *
 * @typedef {object} ToolZone
 * @property {string} slug    path segment and the tool's own basePath
 * @property {string} envVar  env var holding the deployment origin
 */

/** @type {ToolZone[]} */
export const TOOL_ZONES = [
  {
    // Learning Cycle Check-In. Data tool (§7), offline "none" (§11).
    slug: 'learning-cycles',
    envVar: 'TOOL_LEARNING_CYCLES_ORIGIN',
  },
];

/**
 * Reduce whatever was pasted into the env var down to a bare origin.
 *
 * The trap this exists for: a tool's own root URL is
 * `https://tool.vercel.app/learning-cycles`, because the tool sets basePath.
 * Pasting that as the origin makes the rewrite target
 * `.../learning-cycles/learning-cycles`, the tool strips its basePath, and the
 * remaining `/learning-cycles` matches the `[id]` route -- so the first symptom
 * is Postgres complaining about an invalid uuid, nowhere near the cause.
 *
 * @param {string | undefined} value
 * @param {string} slug
 * @returns {string} bare origin, or '' when unset
 */
function normalizeOrigin(value, slug) {
  if (!value) return '';
  let origin = value.trim().replace(/\/+$/, '');
  // Drop a trailing copy of the slug: the rewrite adds it back.
  if (origin.endsWith(`/${slug}`)) {
    origin = origin.slice(0, -(slug.length + 1));
  }
  return origin.replace(/\/+$/, '');
}

/**
 * Turn the registry into Next rewrites. A zone with no origin configured is
 * skipped rather than rewritten to `undefined/...`, so a missing env var in
 * preview degrades to a 404 instead of a broken proxy.
 *
 * @returns {{ source: string, destination: string }[]}
 */
export function toolZoneRewrites() {
  return TOOL_ZONES.flatMap(({ slug, envVar }) => {
    const origin = normalizeOrigin(process.env[envVar], slug);
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
