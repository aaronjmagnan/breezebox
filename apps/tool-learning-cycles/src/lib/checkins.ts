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

/**
 * Sortable columns, and where each one is sorted.
 *
 * Everything on the check-in itself sorts in Postgres. `site` sorts in JS,
 * because it lives on a joined row and PostgREST's ordering across a
 * relationship is fragile enough that a silent wrong order is a real risk --
 * and a wrong order that still looks plausible is worse than a slower one.
 * The volume here is a district's check-ins, not a log.
 */
export const SORT_KEYS = ['date', 'site', 'cycle', 'stage'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

const SQL_COLUMN: Partial<Record<SortKey, string>> = {
  date: 'checkin_date',
  cycle: 'cycle_number',
  stage: 'stage',
};

export function isSortKey(value: string | null | undefined): value is SortKey {
  return value != null && (SORT_KEYS as readonly string[]).includes(value);
}

export type CheckInSort = { key: SortKey; direction: SortDirection };

export const DEFAULT_SORT: CheckInSort = { key: 'date', direction: 'desc' };

export async function listSubmitted(
  filters: CheckInFilters = {},
  sort: CheckInSort = DEFAULT_SORT,
): Promise<CheckInWithNames[]> {
  const supabase = await serverClient();

  let query = supabase
    .from('learning_cycle_checkins')
    .select(WITH_NAMES)
    .not('submitted_at', 'is', null);

  const ascending = sort.direction === 'asc';
  const sqlColumn = SQL_COLUMN[sort.key];

  if (sqlColumn) {
    // nullsFirst false so unanswered cycles and stages sit at the end either
    // way, rather than a column of blanks at the top.
    query = query.order(sqlColumn, { ascending, nullsFirst: false });
  }
  // Always a stable tiebreak, or rows with equal dates shuffle between loads.
  query = query.order('created_at', { ascending: false });

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

  const rows = (data ?? []) as unknown as CheckInWithNames[];

  if (sort.key === 'site') {
    // localeCompare so "Ánimo" sorts where a reader expects, and numeric so
    // "School 2" comes before "School 10".
    rows.sort((a, b) => {
      const result = (a.site?.name ?? '').localeCompare(b.site?.name ?? '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return ascending ? result : -result;
    });
  }

  return rows;
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
