const DASH = '\u2014';

/**
 * Dates stored as a plain `date` (no time, no zone).
 *
 * Do NOT pass these to `new Date(value)`. That parses a bare YYYY-MM-DD as
 * UTC midnight, so everyone west of UTC sees the day before. Read the parts
 * literally instead. This is the single most common quiet bug in a tool that
 * records when something happened.
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
