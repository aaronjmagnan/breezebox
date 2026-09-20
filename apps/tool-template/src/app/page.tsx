import { Card } from '@breezebox/ui';
import { requireToolSession, hasNoReach } from '@/lib/session';
import { NoReach } from '@/components/no-reach';

export const dynamic = 'force-dynamic';

/**
 * Replace this with the tool's own screen.
 *
 * Mark every screen phone first or laptop first (§11), and say which in the
 * comment. Capture and quick review are phone first; cross-site views, wide
 * tables and charts are laptop first.
 *
 * LAPTOP FIRST.
 */
export default async function Page() {
  const session = await requireToolSession();

  if (hasNoReach(session)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-xl font-semibold">__TOOL_NAME__</h1>
        <div className="mt-6">
          <NoReach />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold">__TOOL_NAME__</h1>

      <Card as="section" className="mt-6">
        <h2 className="text-base font-semibold">Nothing here yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-bb-muted">
          Signed in as {session.staff.name}, with{' '}
          {session.canChooseSite
            ? 'district-wide access'
            : `access to ${session.sites[0]?.name ?? 'one school'}`}
          .
        </p>
        <p className="mt-2 text-sm leading-relaxed text-bb-muted">
          Build the real screen here, from @breezebox/ui components only.
        </p>
      </Card>
    </main>
  );
}
