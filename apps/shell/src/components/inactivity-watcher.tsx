'use client';

import { useInactivitySignOut } from '@breezebox/auth/client';

/**
 * §11 session safety: auto sign-out after inactivity, configurable per
 * district, default 30 minutes.
 *
 * Mounted once from the signed-in layout. The warning is a live region so a
 * screen reader announces it, and both controls clear 44px.
 *
 * Step 5 rebuilds the warning from @breezebox/ui components.
 */
export function InactivityWatcher({ timeoutMinutes }: { timeoutMinutes: number }) {
  const { warning, secondsRemaining, staySignedIn } = useInactivitySignOut({
    timeoutMinutes,
  });

  if (!warning) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Signing out soon"
      className="fixed inset-x-0 bottom-0 z-50 border-t p-4"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p className="text-base">
          Signing you out in {secondsRemaining ?? 0} second
          {secondsRemaining === 1 ? '' : 's'}.
        </p>
        <button
          type="button"
          onClick={staySignedIn}
          className="inline-flex min-h-[48px] items-center justify-center rounded-lg border px-4 text-base"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
