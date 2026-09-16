import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@breezebox/db';
import { supabaseEnv } from '../env';

/**
 * Refresh the session on every request and write the rotated cookies onto the
 * response the caller is about to return.
 *
 * Without this, a long-lived tab's access token expires and every server
 * component starts seeing a signed-out user. Supabase's own guidance is to do
 * the refresh in middleware, where cookies can actually be set.
 *
 * `getUser()` rather than `getSession()` on purpose: getUser revalidates the
 * token with the auth server, so a revoked session is caught. getSession only
 * decodes whatever the cookie claims.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
