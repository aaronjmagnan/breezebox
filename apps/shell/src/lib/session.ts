import { redirect } from 'next/navigation';
import { AUTH_DENIED_PATH, SIGN_IN_PATH } from '@breezebox/auth';
import { getSessionContext } from '@breezebox/auth/server';
import type { DistrictBranding, Staff } from '@breezebox/db';
import { requireDistrict } from './district/server';

export type DistrictSession = {
  district: DistrictBranding;
  staff: Staff;
  inactivityTimeoutMinutes: number;
};

/**
 * The district for this hostname plus the staff row of whoever is asking,
 * with the two proven to agree.
 *
 * That last part matters. Session cookies are host-only, so a session for one
 * district should never turn up on another's origin, and §8 counts on exactly
 * that for its "sessions are separated per district" claim. But if a cookie
 * domain is ever widened, the failure would be silent and ugly: the header
 * would show district B's name while RLS quietly served district A's tools.
 * Compare them instead of assuming.
 */
export async function requireDistrictSession(): Promise<DistrictSession> {
  const district = await requireDistrict();
  const session = await getSessionContext();

  // No staff row means the domain check refused them or their account was
  // turned off. Either way they have no district, so treat them as signed out.
  if (!session.signedIn || !session.staff) redirect(SIGN_IN_PATH);

  if (session.staff.district_id !== district.id) {
    redirect(`${AUTH_DENIED_PATH}?reason=other_district`);
  }

  return {
    district,
    staff: session.staff,
    inactivityTimeoutMinutes: session.inactivityTimeoutMinutes,
  };
}
