'use client';

import { Button, Card } from '@breezebox/ui';
import { useServiceWorker } from '@breezebox/pwa/client';

/**
 * "New version available, tap to refresh" (backbone §11).
 *
 * The worker never activates itself, so someone half way through a form is
 * never swapped onto new code mid-sentence. They are told, and they choose.
 *
 * Only ever appears on an update, never on a first install.
 */
export function UpdatePrompt() {
  const { updateReady, applyUpdate } = useServiceWorker();

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Card as="section" role="status" className="mx-auto max-w-md shadow-lg">
        <p className="text-base">New version available.</p>
        <Button variant="primary" fullWidth className="mt-3" onClick={applyUpdate}>
          Tap to refresh
        </Button>
      </Card>
    </div>
  );
}
