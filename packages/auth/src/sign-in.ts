'use client';

import { browserClient } from './clients/browser';
import {
  AUTH_CALLBACK_PATH,
  PROVIDER_SCOPES,
  safeNextPath,
  type OAuthProvider,
} from './config';

/**
 * Start an OAuth sign-in (backbone §5).
 *
 * The provider is only ever configured with the single Supabase callback URL.
 * `redirectTo` here is where **Supabase** sends the user afterwards, which is
 * this district's own origin. That origin must be in Supabase's redirect
 * allow list; see the README.
 *
 * window.location.origin rather than a configured domain, deliberately: it is
 * already the district origin, it is correct on localhost, on a preview URL,
 * on a custom domain, and inside the installed PWA, and it keeps the PKCE
 * verifier cookie and the callback on the same origin.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
  options: { next?: string } = {},
): Promise<{ error: string | null }> {
  const supabase = browserClient();

  const callback = new URL(AUTH_CALLBACK_PATH, window.location.origin);
  callback.searchParams.set('next', safeNextPath(options.next));

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      scopes: PROVIDER_SCOPES[provider],
      queryParams:
        provider === 'google'
          ? // Without this, a teacher already signed into a personal Google
            // account is silently signed in as that account and then bounced
            // by the domain check, which reads as "the app is broken".
            { prompt: 'select_account' }
          : { prompt: 'select_account' },
    },
  });

  return { error: error?.message ?? null };
}
