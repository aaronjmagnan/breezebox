'use client';

import { browserClient } from './clients/browser';
import { SIGN_IN_PATH } from './config';

/**
 * §11: "Sign-out clears the session, the capture queue, and cached pages."
 *
 * The queue and the caches belong to @breezebox/pwa, which registers its
 * cleanups here rather than auth importing pwa. Cleanups run BEFORE the
 * session is dropped, so a failure to reach the network still leaves nothing
 * district-related on the device.
 */
export type SignOutCleanup = () => Promise<void> | void;

const cleanups = new Set<SignOutCleanup>();

/** Register work to do on sign-out. Returns an unregister function. */
export function onSignOut(cleanup: SignOutCleanup): () => void {
  cleanups.add(cleanup);
  return () => cleanups.delete(cleanup);
}

export type SignOutReason = 'user' | 'inactivity' | 'denied';

export async function signOut(
  options: { reason?: SignOutReason; redirectTo?: string } = {},
): Promise<void> {
  const reason = options.reason ?? 'user';

  // One failing cleanup must not strand the others, or the session.
  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch (error) {
      console.error('[auth] sign-out cleanup failed:', error);
    }
  }

  try {
    await browserClient().auth.signOut({ scope: 'local' });
  } catch (error) {
    console.error('[auth] sign-out failed:', error);
  }

  const target = new URL(options.redirectTo ?? SIGN_IN_PATH, window.location.origin);
  if (reason !== 'user') target.searchParams.set('reason', reason);

  // A hard navigation, not a router push: it drops every piece of in-memory
  // state, including anything a tool was holding for the signed-in user.
  window.location.assign(target.toString());
}
