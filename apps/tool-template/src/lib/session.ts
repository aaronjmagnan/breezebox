import { redirect } from 'next/navigation';
import { getSessionContext, serverClient } from '@breezebox/auth/server';
import type { Site, Staff } from '@breezebox/db';

/**
 * Who is asking, and what they can reach.
 *
 * A tool resolves everything from the SESSION, never from the hostname. The
 * shell owns hostname resolution and branding; by the time a request is
 * rewritten here the user is signed in, and their staff row carries the
 * district. That also means a tool does not depend on whether request headers
 * survive the multi-zone proxy -- they may not.
 *
 * REACH, and why null is not "everything":
 *
 *   district_wide -> every site in the district
 *   site_id       -> that site only
 *   neither       -> nothing, until someone assigns one
 *
 * claim_staff_membership() creates staff rows on first SSO login with site_id
 * null, because §5's point is that the staff list builds itself with no roster
 * upload. If "no site" meant "sees everything", every person who ever signed
 * in would start with district-wide reach, silently. Reach is granted, never
 * inferred -- and your RLS policies must say the same thing, or this is
 * decoration.
 */
export type ToolSession = {
  staff: Staff;
  districtId: string;
  /** Sites this person may record against. Empty means no reach yet. */
  sites: Site[];
  /** True when they may pick any site; false locks the picker to their own. */
  canChooseSite: boolean;
  /** This district's config for this tool, from tool_instances.config (§4). */
  config: unknown;
};

export async function requireToolSession(): Promise<ToolSession> {
  const session = await getSessionContext();

  // No staff row means no district. The shell owns sign-in, so send them there
  // on the district origin rather than rendering a second sign-in screen.
  if (!session.signedIn || !session.staff) redirect('/sign-in');

  const staff = session.staff;
  const supabase = await serverClient();

  // RLS already scopes sites to the district; narrow to the one site when the
  // person is site-bound, so a picker cannot offer what the policy refuses.
  let sitesQuery = supabase.from('sites').select('*').eq('active', true).order('name');
  if (!staff.district_wide) {
    sitesQuery = sitesQuery.eq(
      'id',
      staff.site_id ?? '00000000-0000-0000-0000-000000000000',
    );
  }

  const configQuery = supabase
    .from('tool_instances')
    .select('config')
    .eq('tool_slug', '__TOOL_SLUG__')
    .maybeSingle();

  const [{ data: sites, error }, { data: instance }] = await Promise.all([
    sitesQuery,
    configQuery,
  ]);

  if (error) console.error('[__TOOL_SLUG__] could not load sites:', error.message);

  return {
    staff,
    districtId: staff.district_id,
    sites: sites ?? [],
    canChooseSite: staff.district_wide,
    config: instance?.config ?? null,
  };
}

/**
 * True when this person has no reach at all: a staff row with neither a site
 * nor district_wide. That is where a brand new SSO user lands, by design. They
 * are a legitimate member of the district who has not been assigned yet, so
 * show them <NoReach /> rather than an error or an empty table.
 */
export function hasNoReach(session: ToolSession): boolean {
  return !session.staff.district_wide && session.staff.site_id === null;
}
