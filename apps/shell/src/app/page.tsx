import { redirect } from 'next/navigation';
import { SIGN_IN_PATH } from '@breezebox/auth';
import { getSessionContext } from '@breezebox/auth/server';
import { requireDistrict } from '@/lib/district/server';
import { InactivityWatcher } from '@/components/inactivity-watcher';

export const dynamic = 'force-dynamic';

/**
 * Placeholder landing page. Step 5 replaces the body with the tile grid over
 * the district's active tool_instances (§8), built from @breezebox/ui only.
 *
 * Phone first.
 */
export default async function Page() {
  const district = await requireDistrict();
  const session = await getSessionContext();

  // No staff row means the domain check refused them or their account was
  // turned off. Either way they have no district, so treat them as signed out.
  if (!session.signedIn || !session.staff) redirect(SIGN_IN_PATH);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <InactivityWatcher timeoutMinutes={session.inactivityTimeoutMinutes} />

      <h1 className="text-2xl">{district.name}</h1>
      <p className="mt-2 text-base">
        Signed in as {session.staff.name}. The tile grid is step 5.
      </p>
    </main>
  );
}
