/**
 * Link paths, and the basePath rule that makes them confusing.
 *
 * This app is served under `/__TOOL_SLUG__` (next.config `basePath`), and
 * Next handles that inconsistently depending on how you navigate:
 *
 *   next/link, router.push, router.replace  ->  Next ADDS basePath for you.
 *                                               Pass a bare path: '/chart'.
 *
 *   a plain <a href>, which is what the
 *   shared Button renders                   ->  Nothing is added.
 *                                               Pass the full path, via
 *                                               appHref('/chart').
 *
 * Getting it backwards produces `/__TOOL_SLUG__/__TOOL_SLUG__/chart`,
 * which the [id] route then happily matches with id = "__TOOL_SLUG__" --
 * and the first sign of it is an "invalid input syntax for type uuid" from
 * Postgres, a long way from the cause.
 */
export const BASE_PATH = '/__TOOL_SLUG__';

/** For plain anchors. Never pass this to next/link or the router. */
export function appHref(path: string): string {
  if (!path.startsWith('/')) return `${BASE_PATH}/${path}`;
  return `${BASE_PATH}${path}`;
}

/** Postgres rejects a non-uuid with an error, so filter before querying. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
