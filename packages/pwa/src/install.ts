'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * The install experience (backbone §11).
 *
 *   - Android and desktop Chrome/Edge: use the browser's own prompt, surfaced
 *     from an "Install app" button.
 *   - iPhone and iPad: there is no prompt to surface. Safari only installs via
 *     Share -> Add to Home Screen, so we show a short guide on the first
 *     Safari visit and never again.
 *
 * The iOS branch is not an afterthought: push notifications there only work
 * after install, and Safari may evict storage for a site that is not installed
 * and goes unused, which is the other reason the capture queue is short-lived.
 */

const IOS_GUIDE_SEEN_KEY = 'breezebox:ios-install-guide-seen';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || iosStandalone === true;
}

/**
 * iOS Safari specifically. Chrome and Firefox on iOS (CriOS, FxiOS) use the
 * same engine but cannot add to the home screen, so telling their users to do
 * it would send them looking for a menu item that is not there.
 */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua)
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export type InstallState = {
  /** The browser offered a prompt and we are holding it. */
  canPrompt: boolean;
  /** Fire the browser's install prompt. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Show the iOS Add to Home Screen guide. */
  showIosGuide: boolean;
  /** Mark the guide seen so it does not come back. */
  dismissIosGuide: () => void;
  /** Already installed: show nothing at all. */
  installed: boolean;
};

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstall = (event: Event) => {
      // Keep our own button as the entry point rather than the browser's
      // mini-infobar, which districts' IT will not recognise.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    if (!isStandalone() && isIosSafari()) {
      let seen = false;
      try {
        seen = window.localStorage.getItem(IOS_GUIDE_SEEN_KEY) === '1';
      } catch {
        // Blocked storage: show it once this session rather than never.
      }
      setShowIosGuide(!seen);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use; the browser fires a fresh one if it still
    // wants to offer installation.
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const dismissIosGuide = useCallback(() => {
    setShowIosGuide(false);
    try {
      window.localStorage.setItem(IOS_GUIDE_SEEN_KEY, '1');
    } catch {
      /* nothing to persist to */
    }
  }, []);

  return {
    canPrompt: deferred !== null && !installed,
    promptInstall,
    showIosGuide,
    dismissIosGuide,
    installed,
  };
}
