import { redirect } from 'next/navigation';
import { getSessionContext, serverClient } from '@breezebox/auth/server';
import type { Site, Staff } from '@breezebox/db';

/**
 * Who is asking, and what they can reach.
 *
 * The tool resolves everything from the SESSION, not from the hostname. The
 * shell owns hostname resolution and branding; by the time a request is
 * rewritten here the user is already signed in, and their staff row carries
 * the district. That also means the tool does not depend on whether request
 * headers survive the multi-zone proxy.
 *
 * Reach comes from the staff row, matching the RLS policy exactly:
 *   district_wide -> every site in the district
 *   site_id       -> that site only
 *   neither       -> nothing
 */
export type ToolSession = {
  staff: Staff;
  districtId: string;
  /** Sites this person may record against. Empty means no reach yet. */
  sites: Site[];
  /** True when they may pick any site; false locks the picker to their own. */
  canChooseSite: boolean;
};

export async function requireToolSession(): Promise<ToolSession> {
  const session = await getSessionContext();

  // No staff row means no district. The shell owns sign-in, so send them there
  // on the district origin rather than rendering a second sign-in screen.
  if (!session.signedIn || !session.staff) redirect('/sign-in');

  const staff = session.staff;
  const supabase = await serverClient();

  // RLS already scopes sites to the district; narrow to the one site when the
  // person is site-bound, so the picker cannot offer what the policy refuses.
  let query = supabase.from('sites').select('*').eq('active', true).order('name');
  if (!staff.district_wide) {
    query = query.eq('id', staff.site_id ?? '00000000-0000-0000-0000-000000000000');
  }

  const { data: sites, error } = await query;
  if (error) console.error('[learning-cycles] could not load sites:', error.message);

  return {
    staff,
    districtId: staff.district_id,
    sites: sites ?? [],
    canChooseSite: staff.district_wide,
  };
}

/**
 * True when this person has no reach at all: a brand new SSO user whose staff
 * row exists but has neither a site nor district_wide. They are a legitimate
 * member of the district who simply has not been assigned yet, so they get an
 * explanation rather than an error.
 */
export function hasNoReach(session: ToolSession): boolean {
  return !session.staff.district_wide && session.staff.site_id === null;
}
