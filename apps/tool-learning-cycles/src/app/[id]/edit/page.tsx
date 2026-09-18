import { notFound } from 'next/navigation';
import { Button } from '@breezebox/ui';
import { requireToolSession } from '@/lib/session';
import { getCheckIn, listStaffAtSite } from '@/lib/checkins';
import { valuesFromRecord } from '@/lib/form-state';
import { appHref, isUuid } from '@/lib/routes';
import { CheckInForm } from '@/components/checkin-form';

export const dynamic = 'force-dynamic';

/**
 * Edit an existing check-in, draft or submitted.
 *
 * The same form component as /new, handed initial values. That is the seam the
 * future photo step plugs into: it will build the same values object from a
 * photographed paper organizer and render this form for review.
 */
export default async function EditCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireToolSession();
  const { id } = await params;

  // A path that is not an id at all reaches here as one, and Postgres
  // answers a non-uuid with an error rather than an empty result.
  if (!isUuid(id)) notFound();

  const record = await getCheckIn(id);
  if (!record) notFound();

  const staff = await listStaffAtSite(record.site_id);
  const isDraft = record.submitted_at === null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {isDraft ? 'Continue check-in' : 'Edit check-in'}
        </h1>
        <Button variant="ghost" href={appHref(`/${record.id}`)}>
          Cancel
        </Button>
      </div>

      <div className="mt-6">
        <CheckInForm
          recordId={record.id}
          initialValues={valuesFromRecord(record)}
          alreadySubmitted={!isDraft}
          sites={session.sites}
          canChooseSite={session.canChooseSite}
          initialStaff={staff}
          template={session.template}
        />
      </div>
    </main>
  );
}
