import type { Metadata } from 'next';
import { Button, Card } from '@breezebox/ui';
import { OfflineQueue } from '@/components/offline-queue';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * The offline fallback (backbone §11).
 *
 * Deliberately static and free of district data: the service worker precaches
 * it, and anything cached must be safe to keep on the device. The district
 * name is not here for that reason.
 *
 * PHONE FIRST. This is a teacher in a building with no signal.
 */
export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Card as="section">
        <h1 className="text-lg font-semibold">You are offline</h1>
        <p className="mt-3 text-base leading-relaxed text-bb-muted">
          This app needs a connection for most things. Anything you captured is
          safe on this device.
        </p>

        <OfflineQueue />

        <Button variant="secondary" fullWidth href="/" className="mt-6">
          Try again
        </Button>
      </Card>
    </main>
  );
}
