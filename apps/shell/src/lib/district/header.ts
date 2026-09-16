import type { DistrictBranding } from '@breezebox/db';

/**
 * How the middleware hands the resolved district to the rest of the app.
 *
 * The middleware is the only thing that may set this. It strips any inbound
 * copy first, so a client cannot spoof its way into another district by
 * sending the header itself.
 */
export const DISTRICT_HEADER = 'x-breezebox-district';

/** Where an unresolvable hostname is rewritten to (§8). */
export const DISTRICT_NOT_FOUND_PATH = '/district-not-found';

/**
 * Headers are latin-1 only, and district names carry accents and apostrophes.
 * encodeURIComponent keeps the payload inside that range.
 */
export function encodeDistrictHeader(district: DistrictBranding): string {
  return encodeURIComponent(JSON.stringify(district));
}

export function decodeDistrictHeader(value: string | null): DistrictBranding | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as DistrictBranding).id === 'string'
    ) {
      return parsed as DistrictBranding;
    }
    return null;
  } catch {
    return null;
  }
}
