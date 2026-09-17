'use client';

import { browserClient } from './clients/browser';
import { reasonFromClaimError, type AuthDeniedReason } from './errors';

/**
 * Email and password sign-in, for demo districts only (backbone §5 is SSO;
 * this is a narrow addition, not a replacement).
 *
 * The important thing about this path is what it does NOT skip. A demo account
 * is an ordinary Supabase user with an ordinary staff row. It still calls
 * claim_staff_membership(), so the email domain is still checked against
 * districts.sso_domain in the database, and RLS still decides what it can see.
 * Nothing here is a bypass; the only difference from OAuth is which credential
 * proved who you are.
 *
 * The shell renders the form only when the resolved district has
 * demo_mode = true, and this function refuses to leave a session in place if
 * the district is not a demo -- so even a crafted call cannot use a demo
 * password against a real district.
 */
export type PasswordSignInResult =
  | { ok: true }
  | { ok: false; reason: AuthDeniedReason | 'bad_credentials'; message: string };

export async function signInWithPassword(params: {
  email: string;
  password: string;
  districtId: string;
  districtIsDemo: boolean;
}): Promise<PasswordSignInResult> {
  const supabase = browserClient();

  if (!params.districtIsDemo) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Password sign-in is not available for this district.',
    };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: params.email.trim().toLowerCase(),
    password: params.password,
  });

  if (signInError) {
    // Deliberately vague: never reveal whether the address exists.
    return {
      ok: false,
      reason: 'bad_credentials',
      message: 'That email address and password do not match.',
    };
  }

  const { error: claimError } = await supabase.rpc('claim_staff_membership', {
    p_district_id: params.districtId,
  });

  if (claimError) {
    // Same rule as OAuth: a refused user does not keep a session.
    await supabase.auth.signOut({ scope: 'local' });
    return {
      ok: false,
      reason: reasonFromClaimError(claimError.message),
      message: claimError.message,
    };
  }

  return { ok: true };
}
