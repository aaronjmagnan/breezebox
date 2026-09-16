import { headers } from 'next/headers';
import type { DistrictBranding } from '@breezebox/db';
import { DISTRICT_HEADER, decodeDistrictHeader } from './header';

/**
 * The district the middleware resolved for this request, or null.
 *
 * Server components and route handlers only. The middleware has already
 * rewritten unresolvable hostnames to the not-found page, so anything that
 * renders under a district origin can use requireDistrict() instead.
 */
export async function getDistrict(): Promise<DistrictBranding | null> {
  const headerList = await headers();
  return decodeDistrictHeader(headerList.get(DISTRICT_HEADER));
}

export async function requireDistrict(): Promise<DistrictBranding> {
  const district = await getDistrict();
  if (!district) {
    throw new Error(
      'No district on this request. Either the middleware did not run for this ' +
        'path (check the matcher in src/middleware.ts) or the hostname resolves ' +
        'to no district.',
    );
  }
  return district;
}
