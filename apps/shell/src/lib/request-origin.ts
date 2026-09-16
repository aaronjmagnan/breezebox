import type { NextRequest } from 'next/server';

/**
 * The origin the browser actually asked for.
 *
 * Behind Vercel (and any proxy) `request.nextUrl.origin` can be the internal
 * origin rather than the district's. Every auth redirect has to land back on
 * the district hostname the user started on, or the session cookie is written
 * for the wrong origin and the sign-in silently fails. So read the forwarded
 * headers first.
 */
export function requestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();

  if (!host) return request.nextUrl.origin;

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const isLocal = host === 'localhost' || host.startsWith('localhost:') || host.endsWith('.localhost') || /\.localhost:\d+$/.test(host);
  const proto = forwardedProto || (isLocal ? 'http' : 'https');

  return `${proto}://${host}`;
}
