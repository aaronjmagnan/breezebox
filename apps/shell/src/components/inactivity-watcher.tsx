'use client';

import { Button, Card } from '@breezebox/ui';
import { useInactivitySignOut } from '@breezebox/auth/client';

/**
 * §11 session safety: auto sign-out after inactivity, per-district, default 30
 * minutes.
 *
 * Mounted once per signed-in screen. The countdown is a live region so it is
 * announced rather than only seen, and the control clears 44px because it is
 * the one thing standing between a teacher and losing their place.
 */
export function InactivityWatcher({ timeoutMinutes }: { timeoutMinutes: number }) {
  const { warning, secondsRemaining, staySignedIn } = useInactivitySignOut({
    timeoutMinutes,
  });

  if (!warning) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Card
        as="section"
        role="alertdialog"
        aria-label="Signing out soon"
        className="mx-auto max-w-md shadow-lg"
      >
        <p aria-live="assertive" className="text-base">
          Signing you out in {secondsRemaining ?? 0} second
          {secondsRemaining === 1 ? '' : 's'}.
        </p>
        <Button variant="primary" fullWidth className="mt-4" onClick={staySignedIn}>
          Stay signed in
        </Button>
      </Card>
    </div>
  );
}
