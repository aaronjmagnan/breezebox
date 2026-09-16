import { serverClient } from '@breezebox/auth/server';
import type { AccentColor, ToolInstance } from '@breezebox/db';

export type ShellTool = Pick<
  ToolInstance,
  'id' | 'tool_slug' | 'name' | 'description' | 'icon'
> & { accent: AccentColor };

/**
 * The district's active tools, in the order the tiles should appear (§8).
 *
 * No district filter here on purpose: RLS scopes this to the caller's district
 * already, and adding a filter would paper over a policy bug rather than
 * surface it. requireDistrictSession() has separately proven that the caller's
 * district is the one this hostname resolves to.
 */
export async function listActiveTools(): Promise<ShellTool[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from('tool_instances')
    .select('id, tool_slug, name, description, icon, accent')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[shell] could not load tool_instances:', error.message);
    return [];
  }

  return data ?? [];
}
