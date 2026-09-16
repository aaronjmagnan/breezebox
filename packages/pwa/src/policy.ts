/**
 * Caching policy for the whole platform (backbone §11).
 *
 * Only the shell registers a service worker, at root scope, so these rules
 * cover the shell and every tool served under the district origin. Tools never
 * register their own worker and never add rules of their own.
 *
 * The three rules from §11, in order of how much they matter:
 *
 *  1. DISTRICT DATA IS NETWORK ONLY. Nothing from Supabase is ever written to
 *     a cache. Not a student name, not a staff row, not a signed URL. This is
 *     the rule that would be most damaging to get wrong and the easiest to
 *     break by adding a convenient "stale-while-revalidate" somewhere.
 *  2. App shell assets are cache first and versioned. Immutable build output
 *     only, never a rendered page.
 *  3. Navigations are network first with an offline fallback. A rendered page
 *     can contain district data, so it is never stored.
 */

/** Bumped on every deploy; caches from other versions are deleted on activate. */
export const CACHE_PREFIX = 'breezebox';

export function shellCacheName(version: string): string {
  return `${CACHE_PREFIX}-shell-${version}`;
}

export function isManagedCacheName(name: string): boolean {
  return name.startsWith(`${CACHE_PREFIX}-`);
}

/** The offline fallback page. Precached, and deliberately free of any data. */
export const OFFLINE_PATH = '/offline';

/**
 * Precached on install. Everything here must be static and district-data-free.
 * `/` is NOT in this list: it is a rendered, signed-in page.
 */
export const PRECACHE_PATHS = [OFFLINE_PATH];

/**
 * Path prefixes that are immutable build output, safe to serve cache-first.
 * `/_next/static` is content-hashed by Next, so a stale entry is impossible.
 */
export const CACHE_FIRST_PREFIXES = ['/_next/static/', '/fonts/'];

/**
 * Same-origin paths that must never be cached even though they are not
 * Supabase: they carry session state or per-request district branding.
 */
export const NEVER_CACHE_PREFIXES = [
  '/auth/',
  '/api/',
  '/manifest.webmanifest',
  '/sw.js',
];

/**
 * Hostname fragments that mean "district data": never cached, whatever the
 * request looks like. Covers both the hosted project and a custom Supabase
 * domain passed in at build time.
 */
export const NETWORK_ONLY_HOST_FRAGMENTS = ['supabase.co', 'supabase.in'];

// --- Capture queue (§11) ---------------------------------------------------

/** "Expire unsent items after 72 hours, with a warning shown before removal." */
export const CAPTURE_TTL_MS = 72 * 60 * 60 * 1000;

/** How long before expiry an item starts warning. */
export const CAPTURE_WARN_BEFORE_MS = 12 * 60 * 60 * 1000;

/**
 * Give up retrying after this many failures, but keep the item until it
 * expires so the user can still see it listed rather than losing it silently.
 */
export const CAPTURE_MAX_ATTEMPTS = 8;
