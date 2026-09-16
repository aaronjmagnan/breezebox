import type { Metadata } from 'next';
import { Button, Card } from '@breezebox/ui';

export const metadata: Metadata = {
  title: 'Page not found',
};

/** A real 404 inside a district that does resolve. PHONE FIRST. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <Card as="section">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-3 text-base leading-relaxed text-bb-muted">
          That page is not here. It may have moved, or the link may be out of
          date.
        </p>
        <Button variant="secondary" fullWidth href="/" className="mt-6">
          Back to your apps
        </Button>
      </Card>
    </main>
  );
}
