import { Button } from '@breezebox/ui';
import { requireToolSession, hasNoReach } from '@/lib/session';
import { appHref } from '@/lib/routes';
import { CheckInForm } from '@/components/checkin-form';
import { NoReach } from '@/components/no-reach';

export const dynamic = 'force-dynamic';

/**
 * New check-in. PHONE FIRST: filled in during a coaching conversation,
 * standing in a hallway.
 */
export default async function NewCheckInPage() {
  const session = await requireToolSession();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">New check-in</h1>
        <Button variant="ghost" href={appHref('/')}>
          Cancel
        </Button>
      </div>

      <div className="mt-6">
        {hasNoReach(session) ? (
          <NoReach />
        ) : (
          <CheckInForm sites={session.sites} canChooseSite={session.canChooseSite} />
        )}
      </div>
    </main>
  );
}
