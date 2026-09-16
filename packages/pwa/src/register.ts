'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Service worker registration and the update prompt (backbone §11).
 *
 * Only the shell calls this, at root scope. Tools never register their own.
 *
 * The update flow, and why it is shaped this way: the worker never calls
 * skipWaiting() on its own, so a new deploy sits in `waiting` until the user
 * taps. §11 says never leave users on stale code silently -- the fix is to
 * tell them, not to swap the code out from under a half-filled form.
 */

const SW_URL = '/sw.js';

export type UpdateState = {
  /** A new version is installed and waiting. */
  updateReady: boolean;
  /** Activate it and reload. */
  applyUpdate: () => void;
};

export function useServiceWorker(): UpdateState {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // A worker on http://localhost is allowed; anywhere else needs https.
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost'
        && !window.location.hostname.endsWith('.localhost')) {
      return;
    }

    let cancelled = false;

    const track = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
          // `controller` is null on the very first install. Offering "new
          // version available" to someone who just opened the app for the
          // first time would be nonsense.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            if (!cancelled) setWaiting(installing);
          }
        });
      });
    };

    navigator.serviceWorker
      .register(SW_URL, { scope: '/' })
      .then((registration) => {
        if (cancelled) return;
        track(registration);
        // Catch a deploy that landed while the app was closed.
        void registration.update();
      })
      .catch((error) => console.error('[pwa] service worker registration failed:', error));

    /*
     * One reload, driven by the new worker taking control -- but ONLY when
     * this page was already controlled.
     *
     * The worker calls clients.claim() on activate, so controllerchange also
     * fires on a first-ever install, when the controller goes from null to
     * the new worker. Reloading there would bounce every single first visit
     * to the app for no reason, which on a phone on school wifi is a second
     * of white screen and a "did that just crash?".
     */
    const hadController = navigator.serviceWorker.controller !== null;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    waiting?.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  return { updateReady: waiting !== null, applyUpdate };
}

/**
 * Drop every cache the worker owns. Used on sign-out (§11).
 *
 * Delegated to the worker rather than done here, because the worker also puts
 * the offline page back afterwards. Deleting from the page alone would leave
 * the device with no offline fallback until the next deploy.
 *
 * Falls back to deleting from the page when no worker is controlling, which
 * is the case on the very first visit and in a browser that has none.
 */
export async function clearCachedPages(): Promise<void> {
  try {
    const worker = navigator.serviceWorker?.controller;
    if (worker) {
      worker.postMessage({ type: 'CLEAR_CACHES' });
      return;
    }
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('breezebox-')).map((n) => caches.delete(n)),
      );
    }
  } catch (error) {
    console.error('[pwa] could not clear cached pages:', error);
  }
}
