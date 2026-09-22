import { redirect } from 'next/navigation';
import { getSessionContext, serverClient } from '@breezebox/auth/server';
import type { LegalSource, Staff } from '@breezebox/db';

/**
 * Who is asking, and what corpus they can reach.
 *
 * Reach here is simpler than in a records tool. The Education Code is public
 * law and the same for everyone, and a district's board policy is readable by
 * anyone in that district: there is no site-level split, because a statute
 * does not belong to a school. The RLS policies say the same thing, and this
 * function only mirrors them so the UI can name what is loaded.
 */
export type ToolSession = {
  staff: Staff;
  districtId: string;
  /** Every corpus this person can search: shared law plus their own policy. */
  sources: LegalSource[];
  /** True once someone has ingested this district's board policy. */
  hasBoardPolicy: boolean;
  /** True once the Education Code itself is loaded. Nothing works without it. */
  hasEdCode: boolean;
};

export async function requireToolSession(): Promise<ToolSession> {
  const session = await getSessionContext();

  // No staff row means no district. The shell owns sign-in, so send them there
  // on the district origin rather than rendering a second sign-in screen.
  if (!session.signedIn || !session.staff) redirect('/sign-in');

  const staff = session.staff;
  const supabase = await serverClient();

  // RLS returns the shared corpus plus this district's and nothing else, so
  // there is no filter to write here: asking for everything IS asking for
  // what they may see.
  const { data: sources, error } = await supabase
    .from('legal_sources')
    .select('*')
    .eq('status', 'active')
    .order('kind')
    .order('title');

  if (error) console.error('[ed-code] could not load sources:', error.message);

  const list = sources ?? [];

  return {
    staff,
    districtId: staff.district_id,
    sources: list,
    hasBoardPolicy: list.some((s) => s.kind === 'board_policy'),
    hasEdCode: list.some((s) => s.kind === 'ed_code'),
  };
}
