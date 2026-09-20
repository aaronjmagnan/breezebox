import { serverClient } from '@breezebox/auth/server';
import { formatDate } from './format';
import { isLevel, isStage, type Template } from './template';

/**
 * The history of a submitted check-in: who changed what, and when.
 *
 * Written by a database trigger, not by this code, so a change made through
 * the SQL editor or the service role appears here too. Nothing signed in can
 * add, alter or remove a revision -- otherwise an edit could be covered up by
 * editing its own history.
 */

export type Revision = {
  id: string;
  changed_at: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  changed_by: { id: string; name: string } | null;
};

export async function listRevisions(checkinId: string): Promise<Revision[]> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from('learning_cycle_checkin_revisions')
    .select(
      'id, changed_at, action, changes,' +
        ' changed_by:staff!learning_cycle_checkin_revisions_changed_by_fkey(id,name)',
    )
    .eq('checkin_id', checkinId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('[learning-cycles] history failed:', error.message);
    return [];
  }

  return (data ?? []) as unknown as Revision[];
}

/**
 * Columns that say nothing useful in a history.
 *
 * submitted_at is the whole meaning of a "submitted" entry, and repeating it
 * as a changed field is noise. The id columns change so rarely that naming
 * them is enough; showing a uuid moving to another uuid tells a reader
 * nothing.
 */
const SILENT = new Set(['submitted_at', 'template_version', 'entry_method']);
const ID_COLUMNS = new Set(['site_id', 'principal_staff_id', 'created_by', 'district_id']);
const DATE_COLUMNS = new Set(['checkin_date', 'next_checkin_date']);

/** Human name for a column, using this district's own wording. */
export function fieldLabel(column: string, template: Template): string {
  const step = template.steps.find(
    (s) => s.levelColumn === column || s.noteColumn === column,
  );
  if (step) {
    return column.endsWith('_note') ? `${step.title} note` : step.title;
  }

  const fixed: Record<string, string> = {
    site_id: 'School',
    principal_staff_id: 'Principal',
    checkin_date: 'Date',
    cycle_number: 'Cycle',
    stage: 'Stage',
    practice: 'Practice',
    student_need: 'Student need',
    working: 'What is working',
    barrier: 'What is getting in the way',
    next_step: 'Next step',
    district_support: 'District support',
    next_checkin_date: 'Next check-in',
  };

  return fixed[column] ?? column.replace(/_/g, ' ');
}

const EMPTY = '—';

/** A changed value, in the same words the rest of the tool uses. */
export function formatValue(
  column: string,
  value: unknown,
  template: Template,
): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  if (typeof value === 'string') {
    if (isLevel(value) && column.endsWith('_level')) return template.levelLabels[value];
    if (isStage(value) && column === 'stage') return template.stageLabels[value];
    if (DATE_COLUMNS.has(column)) return formatDate(value);
    return value;
  }
  if (typeof value === 'number') return String(value);
  return String(value);
}

export type ReadableChange = {
  column: string;
  label: string;
  /** Null when the values are not worth showing, only the fact of the change. */
  from: string | null;
  to: string | null;
};

export function readableChanges(
  revision: Revision,
  template: Template,
): ReadableChange[] {
  return Object.entries(revision.changes ?? {})
    .filter(([column]) => !SILENT.has(column))
    .map(([column, change]) => ({
      column,
      label: fieldLabel(column, template),
      from: ID_COLUMNS.has(column) ? null : formatValue(column, change?.from, template),
      to: ID_COLUMNS.has(column) ? null : formatValue(column, change?.to, template),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
