import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_DENIED_PATH, SIGN_IN_PATH, safeNextPath } from '@breezebox/auth';
import { completeOAuthCallback, serverClient } from '@breezebox/auth/server';
import { getDistrict } from '@/lib/district/server';
import { DISTRICT_NOT_FOUND_PATH } from '@/lib/district/header';
import { requestOrigin } from '@/lib/request-origin';

/**
 * The single place an OAuth sign-in lands (backbone §5).
 *
 * Google and Microsoft are only ever configured with Supabase's own callback
 * URL. Supabase then sends the user here, on the district's own origin, which
 * is why the district hostname has to be in Supabase's redirect allow list.
 *
 * Nothing is cached: the code in the query string is single-use.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;

  const denied = (reason: string) =>
    NextResponse.redirect(`${origin}${AUTH_DENIED_PATH}?reason=${encodeURIComponent(reason)}`);

  const district = await getDistrict();
  if (!district) {
    return NextResponse.redirect(`${origin}${DISTRICT_NOT_FOUND_PATH}`);
  }

  // The provider itself refused, or the user hit cancel.
  if (params.get('error')) {
    return NextResponse.redirect(`${origin}${SIGN_IN_PATH}`);
  }

  const code = params.get('code');
  if (!code) return denied('exchange_failed');

  const supabase = await serverClient();
  const result = await completeOAuthCallback(supabase, {
    code,
    districtId: district.id,
  });

  if (!result.ok) {
    // §5: if the email domain does not match, sign them out and say so. The
    // session is dropped here so a refused user is never left holding a token.
    await supabase.auth.signOut({ scope: 'local' });
    return denied(result.reason);
  }

  return NextResponse.redirect(`${origin}${safeNextPath(params.get('next'))}`);
}
