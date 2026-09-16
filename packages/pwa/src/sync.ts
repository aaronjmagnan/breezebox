'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  capturesNeedingWarning,
  clearCaptureQueue,
  flushCaptureQueue,
  listCaptures,
  purgeExpiredCaptures,
  type CaptureItem,
} from './queue';
import { clearCachedPages } from './register';

/**
 * Drives the capture queue's retry schedule (backbone §11):
 * on app open, and on the browser's `online` event. No Background Sync.
 */
export type QueueState = {
  items: CaptureItem[];
  /** Items inside the warning window before their 72 hours run out. */
  expiringSoon: CaptureItem[];
  /** Items that just passed 72 hours and were removed, so the UI can say so. */
  justExpired: CaptureItem[];
  online: boolean;
  refresh: () => Promise<void>;
};

export function useCaptureQueue(userId?: string): QueueState {
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [justExpired, setJustExpired] = useState<CaptureItem[]>([]);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    const { expired } = await purgeExpiredCaptures();
    if (expired.length) setJustExpired(expired);
    setItems(await listCaptures(userId));
  }, [userId]);

  const attempt = useCallback(async () => {
    await flushCaptureQueue(userId);
    await refresh();
  }, [userId, refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);

    // Retry on app open. For an installed PWA this is also every resume from
    // the home screen, which is the case that actually matters.
    void attempt();

    const onOnline = () => {
      setOnline(true);
      void attempt();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void attempt();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [attempt]);

  return {
    items,
    expiringSoon: capturesNeedingWarning(items),
    justExpired,
    online,
    refresh,
  };
}

/**
 * §11: "Sign-out clears the session, the capture queue, and cached pages."
 *
 * Pass this to @breezebox/auth's onSignOut so it runs BEFORE the session is
 * dropped. Auth does not import pwa; pwa registers itself with auth.
 */
export async function clearDeviceData(): Promise<void> {
  await clearCaptureQueue();
  await clearCachedPages();
}
