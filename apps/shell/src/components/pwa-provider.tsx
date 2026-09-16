'use client';

import { useEffect } from 'react';
import { onSignOut } from '@breezebox/auth/client';
import { clearDeviceData, useServiceWorker } from '@breezebox/pwa/client';

/**
 * Registers the one service worker and wires sign-out cleanup (backbone §11).
 *
 * Headless, and mounted from the root layout so the worker is registered on
 * every screen including sign-in. The visible pieces -- the update prompt and
 * the install button -- are separate components on the landing page.
 *
 * The sign-out registration is what makes §11's "sign-out clears the session,
 * the capture queue, and cached pages" true. Auth runs these cleanups before
 * it drops the session, so nothing district-related survives on the device
 * even if the network is gone.
 */
export function PwaProvider() {
  useServiceWorker();

  useEffect(() => onSignOut(clearDeviceData), []);

  return null;
}
