'use client';

/** Client-only surface of @breezebox/auth. */

export { browserClient } from './clients/browser';
export { signInWithProvider } from './sign-in';
export { signOut, onSignOut, type SignOutReason, type SignOutCleanup } from './sign-out';
export {
  useInactivitySignOut,
  clearInactivityState,
  type InactivityState,
} from './inactivity';
