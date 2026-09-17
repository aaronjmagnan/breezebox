import { createClient } from '@supabase/supabase-js';
import type { Database, DistrictBranding } from '@breezebox/db';

/**
 * Resolve a hostname to a district's public branding (§8).
 *
 * All the matching happens in Postgres, in get_district_branding(): custom
 * domain first (tolerating a `www.` prefix), then the subdomain slug, with
 * reserved labels refused. The districts table itself stays closed to
 * anonymous reads, so this function is the only way in before sign-in.
 *
 * Runs in middleware on every request, so results are cached in memory for a
 * short TTL. The cache is per server instance and dies with it; a district's
 * branding change shows up within TTL_MS everywhere.
 */

const TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const MAX_ENTRIES = 500;

type CacheEntry = { value: DistrictBranding | null; expiresAt: number };

const cache = new Map<string, CacheEntry>();

function readCache(host: string): CacheEntry | undefined {
  const hit = cache.get(host);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(host);
    return undefined;
  }
  return hit;
}

function writeCache(host: string, value: DistrictBranding | null): void {
  // Unknown hostnames are attacker-controllable, so cap the map and evict the
  // oldest key rather than letting it grow without bound.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(host, {
    value,
    expiresAt: Date.now() + (value ? TTL_MS : NEGATIVE_TTL_MS),
  });
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(':')[0]?.replace(/\.$/, '') ?? '';
}

let client: ReturnType<typeof createClient<Database>> | null = null;

function getClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

async function lookup(host: string): Promise<DistrictBranding | null> {
  const supabase = getClient();
  if (!supabase) {
    console.error(
      '[district] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is unset; ' +
        'every hostname will resolve to "district not found"',
    );
    return null;
  }

  const { data, error } = await supabase.rpc('get_district_branding', { host });

  if (error) {
    console.error(`[district] branding lookup failed for ${host}:`, error.message);
    return null;
  }

  return data?.[0] ?? null;
}

/**
 * The district for a hostname, or null if nothing matches.
 *
 * NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG is a fallback for hostnames that carry no
 * district of their own: Vercel preview URLs, a bare `localhost:3000`. It is
 * only consulted when the real hostname resolves to nothing, so it can never
 * override a district that does match.
 */
export async function resolveDistrict(rawHost: string): Promise<DistrictBranding | null> {
  const host = normalizeHost(rawHost);
  if (!host) return null;

  const cached = readCache(host);
  if (cached) return cached.value;

  let district = await lookup(host);

  const fallbackSlug = process.env.NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG;
  if (!district && fallbackSlug) {
    district = await lookup(`${fallbackSlug}.localhost`);

    if (district && process.env.NODE_ENV === 'production') {
      // Loud on purpose. Once a wildcard domain is live this variable is a
      // hazard: a typo'd or retired subdomain would quietly serve the fallback
      // district instead of "district not found". It is meant for preview
      // URLs and bare localhost only, and should be unset in production the
      // day real district hostnames start resolving.
      console.warn(
        `[district] "${host}" resolved to no district; falling back to ` +
          `NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG="${fallbackSlug}". Unset this in ` +
          `production once district hostnames resolve on their own.`,
      );
    }
  }

  writeCache(host, district);
  return district;
}

/** Test seam: drop everything cached so far. */
export function clearDistrictCache(): void {
  cache.clear();
}
