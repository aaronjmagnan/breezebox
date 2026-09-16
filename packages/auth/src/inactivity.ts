'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_INACTIVITY_TIMEOUT_MINUTES, INACTIVITY_WARNING_SECONDS } from './config';
import { signOut } from './sign-out';

/**
 * Auto sign-out after inactivity (backbone §11).
 *
 * Default 30 minutes, overridden per district by
 * districts.inactivity_timeout_minutes.
 *
 * Three things this gets right that a naive setTimeout does not:
 *
 *  - Last activity lives in localStorage, so two tabs on the same district do
 *    not sign each other out while one of them is in use.
 *  - It polls on a coarse interval instead of resetting a timer on every
 *    pointer event. On a phone that is the difference between a background
 *    timer and a battery complaint.
 *  - It re-checks on visibilitychange, so a phone that was asleep past the
 *    timeout signs out the moment the app comes back, rather than whenever
 *    the next interval happens to fire.
 */

const STORAGE_KEY = 'breezebox:last-activity';
const POLL_MS = 15_000;

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'wheel',
] as const;

function readLastActivity(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  } catch {
    // Private mode, blocked storage. Fall back to "active now": a timer that
    // cannot read the clock must not sign people out at random.
    return Date.now();
  }
}

function writeLastActivity(at: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    /* see readLastActivity */
  }
}

export function clearInactivityState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export type InactivityState = {
  /** True once the user is inside the warning window. */
  warning: boolean;
  /** Whole seconds until sign-out, or null when not warning. */
  secondsRemaining: number | null;
  /** Dismiss the warning by counting as activity. */
  staySignedIn: () => void;
};

export function useInactivitySignOut(
  options: { timeoutMinutes?: number | null; enabled?: boolean } = {},
): InactivityState {
  const enabled = options.enabled ?? true;
  const timeoutMs =
    Math.max(1, options.timeoutMinutes ?? DEFAULT_INACTIVITY_TIMEOUT_MINUTES) * 60_000;

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const signingOut = useRef(false);

  const markActive = useCallback(() => {
    writeLastActivity(Date.now());
    setSecondsRemaining(null);
  }, []);

  const check = useCallback(() => {
    if (signingOut.current) return;

    const remainingMs = timeoutMs - (Date.now() - readLastActivity());

    if (remainingMs <= 0) {
      signingOut.current = true;
      clearInactivityState();
      void signOut({ reason: 'inactivity' });
      return;
    }

    const remainingSeconds = Math.ceil(remainingMs / 1000);
    setSecondsRemaining(
      remainingSeconds <= INACTIVITY_WARNING_SECONDS ? remainingSeconds : null,
    );
  }, [timeoutMs]);

  // Coarse poll plus activity listeners. This is the only timer running while
  // someone is working normally.
  useEffect(() => {
    if (!enabled) return;

    markActive();

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisible);

    const interval = window.setInterval(check, POLL_MS);
    check();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [enabled, markActive, check]);

  // A one-second tick, but only once the warning is on screen, so the
  // countdown reads correctly without a per-second timer the rest of the time.
  const warning = secondsRemaining !== null;
  useEffect(() => {
    if (!enabled || !warning) return;
    const tick = window.setInterval(check, 1_000);
    return () => window.clearInterval(tick);
  }, [enabled, warning, check]);

  return {
    warning,
    secondsRemaining,
    staySignedIn: markActive,
  };
}
