/**
 * Supabase connection details, read once with a clear error when missing.
 *
 * Only the anon / publishable key ever appears here. The service role key
 * bypasses RLS and has no business in the shell or in any tool (§3).
 *
 * TWO NAMES FOR THE SAME KEY. Supabase has been renaming "anon key" to
 * "publishable key", and which one the dashboard offers depends on when the
 * project was created. Both are accepted, because the failure otherwise is
 * silent and miserable: the variable sits in Vercel looking correct, the app
 * reports it as unset, and every hostname resolves to "district not found".
 */
export type SupabaseEnv = { url: string; anonKey: string };

const URL_VARS = ['NEXT_PUBLIC_SUPABASE_URL'] as const;

const KEY_VARS = [
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

/**
 * Next inlines NEXT_PUBLIC_* at build time by literal text match, so each name
 * has to appear as a full `process.env.NAME` expression. A lookup built from a
 * variable would compile to undefined.
 */
function firstSet(candidates: Record<string, string | undefined>): string | null {
  for (const value of Object.values(candidates)) {
    if (value && value.trim() !== '') return value.trim();
  }
  return null;
}

export function supabaseEnv(): SupabaseEnv {
  const url = firstSet({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const anonKey = firstSet({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!url || !anonKey) {
    const missing = [
      !url ? URL_VARS.join(' or ') : null,
      !anonKey ? KEY_VARS.join(' or ') : null,
    ]
      .filter(Boolean)
      .join(', and ');

    throw new Error(
      `Supabase is not configured: ${missing} must be set. ` +
        'Copy .env.example to .env.local locally, or set them on the Vercel ' +
        'project and redeploy -- NEXT_PUBLIC_ values are baked in at build time, ' +
        'so adding them to an existing deployment does nothing.',
    );
  }

  return { url, anonKey };
}

/** Same resolution, without throwing. Used where a miss must not crash. */
export function supabaseEnvOrNull(): SupabaseEnv | null {
  try {
    return supabaseEnv();
  } catch {
    return null;
  }
}
