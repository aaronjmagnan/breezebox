/**
 * Join class names, dropping falsy entries.
 *
 * Deliberately not tailwind-merge: components here own their own classes and
 * expose a small variant API instead of inviting arbitrary overrides, so
 * there is nothing to de-duplicate.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
