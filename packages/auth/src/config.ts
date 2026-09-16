import type { Enums } from '@breezebox/db';

/**
 * Auth configuration shared by the shell and every tool (backbone §5).
 *
 * The OAuth providers only ever redirect to the single Supabase callback URL.
 * Supabase then returns the user to the district origin, which is why the
 * district subdomain has to be in Supabase's redirect allow list. See the
 * "Supabase redirect URLs" section of the root README for the exact list.
 */

/** §5: Google and Microsoft. Microsoft is `azure` in Supabase. */
export const OAUTH_PROVIDERS = ['google', 'azure'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  azure: 'Microsoft',
};

/** Scopes beyond the defaults. We want a verified email and a display name. */
export const PROVIDER_SCOPES: Record<OAuthProvider, string> = {
  google: 'email profile',
  azure: 'email openid profile',
};

/** Where Supabase sends the user back to, on the district's own origin. */
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const SIGN_IN_PATH = '/sign-in';
export const SIGN_OUT_PATH = '/auth/sign-out';
export const AUTH_DENIED_PATH = '/auth/denied';

/** §11 session safety. Overridden per district by inactivity_timeout_minutes. */
export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30;

/** How long before the timeout the user gets a warning. */
export const INACTIVITY_WARNING_SECONDS = 60;

export type DistrictStatus = Enums<'district_status'>;

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Only same-origin, absolute-path redirects survive a sign-in. Anything else
 * is dropped, so a crafted link cannot bounce a freshly signed-in user off to
 * another site carrying their session in the referrer.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  // Block protocol-relative and scheme-ish forms that slipped past the above.
  if (/^\/[\\/]/.test(value) || value.includes('://')) return '/';
  return value;
}
