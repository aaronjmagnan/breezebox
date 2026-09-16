/**
 * Supabase connection details, read once with a clear error when missing.
 *
 * Only the anon key ever appears here. The service role key bypasses RLS and
 * has no business in the shell or in any tool (§3).
 */
export type SupabaseEnv = { url: string; anonKey: string };

export function supabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set. ' +
        'Copy .env.example to .env.local and fill them in from `pnpm db:start`.',
    );
  }

  return { url, anonKey };
}
