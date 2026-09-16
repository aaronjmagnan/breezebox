import { NextResponse, type NextRequest } from 'next/server';
import { resolveDistrict } from '@/lib/district/branding';
import {
  DISTRICT_HEADER,
  DISTRICT_NOT_FOUND_PATH,
  encodeDistrictHeader,
} from '@/lib/district/header';

/**
 * Hostname routing (backbone §8).
 *
 * {district-slug}.breezebox.com, or a district's own custom_domain. The
 * district is resolved before sign-in and handed to the app on a request
 * header. Anything that does not resolve gets the not-found page.
 *
 * Locally this works with no /etc/hosts edit: every current browser resolves
 * *.localhost to 127.0.0.1, so http://demo.localhost:3000 just works.
 */

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static files. Tool zone paths are
     * deliberately included: a tool rendered under the district origin needs
     * the same district on its request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf)$).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // The app treats this header as trusted state, so an inbound copy is
  // stripped on every path before anything else happens. Without this, a
  // client could send x-breezebox-district and pick its own district.
  requestHeaders.delete(DISTRICT_HEADER);

  const host = request.headers.get('host') ?? '';
  const district = await resolveDistrict(host);

  if (!district) {
    // Already there: render it, and do not loop.
    if (request.nextUrl.pathname === DISTRICT_NOT_FOUND_PATH) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    const url = request.nextUrl.clone();
    url.pathname = DISTRICT_NOT_FOUND_PATH;
    url.search = '';
    return NextResponse.rewrite(url, {
      status: 404,
      request: { headers: requestHeaders },
    });
  }

  requestHeaders.set(DISTRICT_HEADER, encodeDistrictHeader(district));

  return NextResponse.next({ request: { headers: requestHeaders } });
}
