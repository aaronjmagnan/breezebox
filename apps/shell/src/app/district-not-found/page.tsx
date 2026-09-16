import type { Metadata } from 'next';
import { Card } from '@breezebox/ui';

export const metadata: Metadata = {
  title: 'District not found',
  robots: { index: false, follow: false },
};

/**
 * Where the middleware sends a hostname that matches no district (§8).
 *
 * Says nothing about which districts exist: an unknown subdomain and a
 * suspended one look identical from here. No AppHeader either, because there
 * is no district to put in it.
 *
 * PHONE FIRST.
 */
export default function DistrictNotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <Card as="section">
        <h1 className="text-lg font-semibold">We could not find that district</h1>
        <p className="mt-3 text-base leading-relaxed text-bb-muted">
          This web address is not set up for a district yet. Check the address
          and try again.
        </p>
        <p className="mt-3 text-base leading-relaxed text-bb-muted">
          If you reached this from a link your district sent you, let them know
          so they can pass it on to us.
        </p>
      </Card>
    </main>
  );
}
