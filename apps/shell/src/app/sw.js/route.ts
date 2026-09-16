import { NextResponse } from 'next/server';
import { serviceWorkerSource } from '@breezebox/pwa/server';

/**
 * The one service worker, at root scope (backbone §11).
 *
 * Served from a route handler rather than public/sw.js so that the caching
 * rules stay in @breezebox/pwa, where §11 says they live, instead of being
 * copied into a static file that drifts.
 *
 * Serving it from `/sw.js` is what gives it root scope, which is what lets it
 * cover every tool zone under the district origin.
 */
export const dynamic = 'force-dynamic';

/**
 * Bumping this string invalidates every cache on the next activate. Vercel
 * supplies the commit SHA; locally it is "dev", which means the local cache is
 * reused across restarts. Set BB_BUILD_ID to force a bump by hand.
 */
function buildVersion(): string {
  return (
    process.env.BB_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    'dev'
  );
}

export function GET() {
  return new NextResponse(serviceWorkerSource({ version: buildVersion() }), {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // The browser re-checks the worker on navigation and at least daily.
      // no-cache keeps a proxy from pinning an old one.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      // Explicit, even though /sw.js already implies root scope.
      'Service-Worker-Allowed': '/',
    },
  });
}
