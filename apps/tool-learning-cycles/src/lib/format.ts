import { isLevel, isStage, type Level, type Stage } from './template';

const DASH = '\u2014';

/**
 * Dates are stored as plain `date` (no time, no zone). Formatting them with
 * the default Date parser would shift them a day for anyone west of UTC, so
 * the parts are read literally.
 */
export function formatDate(value: string | null): string {
  if (!value) return DASH;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Stage and level labels come from the resolved template, not a constant, so
 * a district's own wording reaches every screen and every export. Passing the
 * map in is what makes that impossible to forget: there is no default to fall
 * back to at the call site.
 */
export function formatStage(
  value: string | null,
  labels: Record<Stage, string>,
): string {
  return isStage(value) ? labels[value] : DASH;
}

export function formatLevel(
  value: string | null,
  labels: Record<Level, string>,
): string {
  return isLevel(value) ? labels[value] : DASH;
}

export function formatCycle(value: number | null): string {
  return value === null ? DASH : `Cycle ${value}`;
}
