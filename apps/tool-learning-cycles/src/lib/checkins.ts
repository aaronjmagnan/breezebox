import { serverClient } from '@breezebox/auth/server';
import type { Database } from '@breezebox/db';

/**
 * Reads and writes for learning_cycle_checkins.
 *
 * None of these filter by district or site. RLS does that, using the same
 * staff row the session resolved, and duplicating the filter here would hide a
 * policy bug rather than surface one. The only filters are the ones a user
 * actually chose.
 */

type Schema = Database['public']['Tables']['learning_cycle_checkins'];
export type CheckIn = Schema['Row'];
export type CheckInInsert = Schema['Insert'];
export type CheckInUpdate = Schema['Update'];

/** A check-in with the display names its list row needs. */
export type CheckInWithNames = CheckIn & {
  site: { id: string; name: string } | null;
  principal: { id: string; name: string } | null;
};

const WITH_NAMES =
  '*, site:sites!learning_cycle_checkins_site_id_fkey(id,name),' +
  ' principal:staff!learning_cycle_checkins_principal_staff_id_fkey(id,name)';

export type CheckInFilters = {
  siteId?: string;
  cycleNumber?: number;
  stage?: string;
  from?: string;
  to?: string;
};

export async function listSubmitted(
  filters: CheckInFilters = {},
): Promise<CheckInWithNames[]> {
  const supabase = await serverClient();

  let query = supabase
    .from('learning_cycle_checkins')
    .select(WITH_NAMES)
    .not('submitted_at', 'is', null)
    .order('checkin_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.siteId) query = query.eq('site_id', filters.siteId);
  if (filters.cycleNumber) query = query.eq('cycle_number', filters.cycleNumber);
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.from) query = query.gte('checkin_date', filters.from);
  if (filters.to) query = query.lte('checkin_date', filters.to);

  const { data, error } = await query;
  if (error) {
    console.error('[learning-cycles] list failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as CheckInWithNames[];
}

/**
 * Drafts. RLS already restricts these to their author, so this needs no
 * created_by filter; it is scoped by policy, not by query.
 */
export async function listOwnDrafts(): Promise<CheckInWithNames[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from('learning_cycle_checkins')
    .select(WITH_NAMES)
    .is('submitted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[learning-cycles] drafts failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as CheckInWithNames[];
}

export async function getCheckIn(id: string): Promise<CheckInWithNames | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from('learning_cycle_checkins')
    .select(WITH_NAMES)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[learning-cycles] fetch failed:', error.message);
    return null;
  }
  return (data ?? null) as unknown as CheckInWithNames | null;
}

/** Staff at one site, for the optional principal picker. */
export async function listStaffAtSite(
  siteId: string,
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from('staff')
    .select('id, name')
    .eq('site_id', siteId)
    .eq('status', 'active')
    .order('name');

  if (error) {
    console.error('[learning-cycles] staff lookup failed:', error.message);
    return [];
  }
  return data ?? [];
}

/** The latest submitted check-in per site for one cycle, for the chart. */
export async function latestPerSiteForCycle(
  cycleNumber: number,
): Promise<CheckInWithNames[]> {
  const rows = await listSubmitted({ cycleNumber });

  // Already ordered newest first, so the first row seen for a site is its
  // latest. Done here rather than in SQL to keep one RLS-scoped query.
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.site_id)) return false;
    seen.add(row.site_id);
    return true;
  });
}
