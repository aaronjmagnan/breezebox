import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'District not found',
  robots: { index: false, follow: false },
};

/**
 * Where the middleware sends a hostname that matches no district (§8).
 *
 * Says nothing about which districts exist: an unknown subdomain and a
 * suspended one look identical from here.
 *
 * Phone first. Works from 360px up.
 */
export default function DistrictNotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl">We could not find that district</h1>
      <p className="mt-4 text-base leading-relaxed">
        This web address is not set up for a district yet. Check the address and
        try again.
      </p>
      <p className="mt-4 text-base leading-relaxed">
        If you reached this from a link your district sent you, let them know so
        they can pass it on to us.
      </p>
    </main>
  );
}
