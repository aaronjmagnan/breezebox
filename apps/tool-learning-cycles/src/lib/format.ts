import { LEVEL_LABELS, STAGE_LABELS, isLevel, isStage } from './template';

/**
 * Dates are stored as plain `date` (no time, no zone). Formatting them with
 * the default Date parser would shift them a day for anyone west of UTC, so
 * the parts are read literally.
 */
export function formatDate(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatStage(value: string | null): string {
  return isStage(value) ? STAGE_LABELS[value] : '—';
}

export function formatLevel(value: string | null): string {
  return isLevel(value) ? LEVEL_LABELS[value] : '—';
}

export function formatCycle(value: number | null): string {
  return value === null ? '—' : `Cycle ${value}`;
}
