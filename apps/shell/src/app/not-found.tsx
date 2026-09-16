import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page not found',
};

/** A real 404 inside a district that does resolve. Phone first. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl">Page not found</h1>
      <p className="mt-4 text-base leading-relaxed">
        That page is not here. It may have moved, or the link may be out of
        date.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[44px] items-center underline underline-offset-4"
      >
        Back to your apps
      </Link>
    </main>
  );
}
