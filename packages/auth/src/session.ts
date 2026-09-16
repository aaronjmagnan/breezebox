import type { Staff } from '@breezebox/db';
import { DEFAULT_INACTIVITY_TIMEOUT_MINUTES } from './config';
import { serverClient } from './clients/server';

/**
 * Everything a district-facing page needs to know about who is asking.
 *
 * `staff` is the row RLS resolves the caller through; if it is null the user
 * has a Supabase session but no district, which means the domain check refused
 * them or their account was turned off. Pages treat that as signed out.
 */
export type SessionContext = {
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  staff: Staff | null;
  /** §11 session safety, from the district row. */
  inactivityTimeoutMinutes: number;
};

const SIGNED_OUT: SessionContext = {
  signedIn: false,
  userId: null,
  email: null,
  staff: null,
  inactivityTimeoutMinutes: DEFAULT_INACTIVITY_TIMEOUT_MINUTES,
};

/**
 * getUser() rather than getSession(): it revalidates with the auth server, so
 * a session revoked elsewhere does not keep rendering pages here.
 *
 * The staff and district reads both go through RLS with the caller's own
 * token, so this cannot return another district's row even if the district id
 * on the request were wrong.
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await serverClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return SIGNED_OUT;

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  let inactivityTimeoutMinutes = DEFAULT_INACTIVITY_TIMEOUT_MINUTES;

  if (staff) {
    const { data: district } = await supabase
      .from('districts')
      .select('inactivity_timeout_minutes')
      .eq('id', staff.district_id)
      .maybeSingle();;

    if (district?.inactivity_timeout_minutes) {
      inactivityTimeoutMinutes = district.inactivity_timeout_minutes;
    }
  }

  return {
    signedIn: true,
    userId: user.id,
    email: user.email ?? null,
    staff: staff ?? null,
    inactivityTimeoutMinutes,
  };
}
