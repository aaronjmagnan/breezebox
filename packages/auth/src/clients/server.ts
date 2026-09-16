import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@breezebox/db';
import { supabaseEnv } from '../env';

/**
 * Supabase client for server components, route handlers and server actions.
 *
 * Always carries the caller's session, never the service role, so every query
 * goes through RLS (§3).
 */
export async function serverClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. That is fine: the middleware
          // refreshes the session on every request, so the cookie is already
          // current by the time we get here.
        }
      },
    },
  });
}
