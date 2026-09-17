import { Suspense } from 'react';
import Link from 'next/link';
import { Button, Card, Table, type TableColumn } from '@breezebox/ui';
import { requireToolSession, hasNoReach } from '@/lib/session';
import { listOwnDrafts, listSubmitted, type CheckInWithNames } from '@/lib/checkins';
import { formatCycle, formatDate, formatStage } from '@/lib/format';
import { Filters } from '@/components/filters';
import { NoReach } from '@/components/no-reach';

export const dynamic = 'force-dynamic';

/**
 * Check-ins list (§7).
 *
 * LAPTOP FIRST: a wide table with filters and export, for looking across
 * schools. It still works on a phone -- the table scrolls sideways and the
 * narrow columns drop out -- but this is not the screen you fill in standing
 * in a hallway. That is /new.
 *
 * Drafts are a separate section and appear only for their author. That is not
 * a UI convention: the RLS policy refuses other people's unsubmitted drafts,
 * because a draft is half-formed thinking about a named colleague's practice.
 */
export default async function CheckInsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireToolSession();
  const params = await searchParams;

  const one = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string) : undefined;
  const cycle = Number.parseInt(one('cycle') ?? '', 10);

  const [rows, drafts] = await Promise.all([
    listSubmitted({
      siteId: one('site'),
      cycleNumber: Number.isFinite(cycle) ? cycle : undefined,
      stage: one('stage'),
      from: one('from'),
      to: one('to'),
    }),
    listOwnDrafts(),
  ]);

  const columns: ReadonlyArray<TableColumn<CheckInWithNames>> = [
    {
      key: 'date',
      header: 'Date',
      cell: (row) => (
        <Link href={`/${row.id}`} className="font-semibold underline underline-offset-2">
          {formatDate(row.checkin_date)}
        </Link>
      ),
    },
    { key: 'site', header: 'School', cell: (row) => row.site?.name ?? '—' },
    {
      key: 'principal',
      header: 'Principal',
      hideBelow: 'md',
      cell: (row) => row.principal?.name ?? '—',
    },
    { key: 'cycle', header: 'Cycle', hideBelow: 'sm', cell: (row) => formatCycle(row.cycle_number) },
    { key: 'stage', header: 'Stage', hideBelow: 'sm', cell: (row) => formatStage(row.stage) },
    {
      key: 'practice',
      header: 'Practice',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="line-clamp-2 max-w-[28ch]">{row.practice ?? '—'}</span>
      ),
    },
  ];

  if (hasNoReach(session)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-xl font-semibold">Learning Cycle Check-In</h1>
        <div className="mt-6">
          <NoReach />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Learning Cycle Check-In</h1>
        <div className="flex gap-2">
          <Button variant="secondary" href="/learning-cycles/chart">
            Chart
          </Button>
          <Button variant="primary" href="/learning-cycles/new">
            New check-in
          </Button>
        </div>
      </div>

      {drafts.length > 0 ? (
        <section className="mt-6" aria-labelledby="drafts">
          <h2 id="drafts" className="text-base font-semibold">
            Your drafts
          </h2>
          <p className="mt-1 text-sm text-bb-muted">
            Only you can see these until you submit them.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Card padding="sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">
                        {draft.site?.name ?? 'No school yet'}
                      </p>
                      <p className="mt-0.5 text-sm text-bb-muted">
                        Started {formatDate(draft.checkin_date)}
                      </p>
                    </div>
                    <Button variant="secondary" href={`/learning-cycles/${draft.id}/edit`}>
                      Continue
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="submitted">
        <h2 id="submitted" className="text-base font-semibold">
          Submitted check-ins
        </h2>

        <div className="mt-4">
          <Suspense fallback={null}>
            <Filters sites={session.sites} />
          </Suspense>
        </div>

        <div className="mt-4">
          <Table
            caption="Submitted learning cycle check-ins"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            empty={
              <Card as="section">
                <h3 className="text-base font-semibold">Nothing here yet</h3>
                <p className="mt-2 text-sm leading-relaxed text-bb-muted">
                  {session.sites.length === 0
                    ? 'No schools are set up for your district yet.'
                    : 'No submitted check-ins match. Try clearing the filters, or start a new check-in.'}
                </p>
              </Card>
            }
          />
        </div>
      </section>
    </main>
  );
}
