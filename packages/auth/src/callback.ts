import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Staff } from '@breezebox/db';
import { reasonFromClaimError, type AuthDeniedReason } from './errors';

export type CallbackResult =
  | { ok: true; staff: Staff }
  | { ok: false; reason: AuthDeniedReason; detail?: string };

/**
 * Finish an OAuth sign-in for a district (backbone §5).
 *
 * Two steps, in this order:
 *
 *  1. Exchange the code for a session. Until this happens there is no JWT, so
 *     no domain check is possible.
 *  2. Call claim_staff_membership(), which re-checks the email domain against
 *     districts.sso_domain **in the database** and, on a first valid login,
 *     creates the staff row with created_via = 'sso_first_login'.
 *
 * Doing the domain check in the database rather than here is what makes it
 * real: a user who gets past this function still cannot read a single row,
 * because the RLS helpers resolve them through the staff row that
 * claim_staff_membership() refused to create.
 *
 * On refusal the caller must sign the user out. `completeOAuthCallback` does
 * not do it itself, so the caller can decide where to send them.
 */
export async function completeOAuthCallback(
  supabase: SupabaseClient<Database>,
  params: { code: string; districtId: string },
): Promise<CallbackResult> {
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);

  if (exchangeError) {
    return { ok: false, reason: 'exchange_failed', detail: exchangeError.message };
  }

  const { data, error } = await supabase.rpc('claim_staff_membership', {
    p_district_id: params.districtId,
  });

  if (error) {
    return {
      ok: false,
      reason: reasonFromClaimError(error.message),
      detail: error.message,
    };
  }

  if (!data) {
    return { ok: false, reason: 'unknown' };
  }

  return { ok: true, staff: data as Staff };
}
