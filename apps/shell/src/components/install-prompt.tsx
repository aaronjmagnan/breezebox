'use client';

import { Button, Card } from '@breezebox/ui';
import { useInstallPrompt } from '@breezebox/pwa/client';

/**
 * The install experience (backbone §11).
 *
 *   - Android, desktop Chrome and Edge: the browser's own prompt, behind an
 *     "Install app" button.
 *   - iPhone and iPad: no prompt exists, so a short Add to Home Screen guide
 *     on the first Safari visit, dismissed for good once seen.
 *
 * Renders nothing at all when the app is already installed.
 */
export function InstallPrompt() {
  const { canPrompt, promptInstall, showIosGuide, dismissIosGuide, installed } =
    useInstallPrompt();

  if (installed) return null;

  if (showIosGuide) {
    return (
      <Card as="section" className="mt-6">
        <h2 className="text-base font-semibold">Add this to your home screen</h2>
        <p className="mt-2 text-sm leading-relaxed text-bb-muted">
          It opens like an app, without the browser bars, and stays signed in.
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm leading-relaxed text-bb-muted">
          <li>
            Tap the Share button at the bottom of Safari (a square with an arrow
            pointing up).
          </li>
          <li>Scroll down and tap Add to Home Screen.</li>
          <li>Tap Add.</li>
        </ol>
        <Button variant="secondary" fullWidth className="mt-4" onClick={dismissIosGuide}>
          Got it
        </Button>
      </Card>
    );
  }

  if (!canPrompt) return null;

  return (
    <Card as="section" className="mt-6">
      <h2 className="text-base font-semibold">Install this app</h2>
      <p className="mt-2 text-sm leading-relaxed text-bb-muted">
        It opens from your home screen or desktop and stays signed in.
      </p>
      <Button
        variant="secondary"
        fullWidth
        className="mt-4"
        onClick={() => void promptInstall()}
      >
        Install app
      </Button>
    </Card>
  );
}
