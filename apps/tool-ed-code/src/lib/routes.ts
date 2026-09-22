/**
 * Link paths, and the basePath rule that makes them confusing.
 *
 * This app is served under `/ed-code` (next.config `basePath`), and Next
 * handles that inconsistently depending on how you navigate:
 *
 *   next/link, router.push, router.replace  ->  Next ADDS basePath for you.
 *                                               Pass a bare path.
 *
 *   a plain <a href>, and fetch()           ->  Nothing is added. Pass the
 *                                               full path via appHref().
 *
 * fetch() is the one that bites here: the browser resolves '/api/ask' against
 * the district origin, not against the basePath, so it lands on the SHELL's
 * routes and comes back as the shell's 404 page. Always appHref() it.
 */
export const BASE_PATH = '/ed-code';

/** For plain anchors and fetch. Never pass this to next/link or the router. */
export function appHref(path: string): string {
  if (!path.startsWith('/')) return `${BASE_PATH}/${path}`;
  return `${BASE_PATH}${path}`;
}
