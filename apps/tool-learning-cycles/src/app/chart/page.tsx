import Link from 'next/link';
import { Button, Card } from '@breezebox/ui';
import { requireToolSession, hasNoReach } from '@/lib/session';
import { latestPerSiteForCycle } from '@/lib/checkins';
import { CYCLES, LEVELS, isLevel } from '@/lib/template';
import { appHref } from '@/lib/routes';
import { NoReach } from '@/components/no-reach';

export const dynamic = 'force-dynamic';

/**
 * One chart (§7).
 *
 * LAPTOP FIRST: a cross-school view, which is the laptop case by definition.
 * It reads on a phone -- the bars stack full width -- but it is not the phone
 * screen.
 *
 * For a chosen cycle, one stacked bar per school showing how many of the five
 * steps are Not yet, Happening or Routine, from that school's latest submitted
 * check-in.
 *
 * Drawn with divs rather than a charting library: five segments across a
 * handful of schools does not justify the dependency or the bundle, and plain
 * elements are the only way the counts stay in the accessibility tree and
 * survive the print stylesheet.
 */

const SEGMENT: Record<string, string> = {
  not_yet: 'bg-bb-surface-subtle',
  happening: 'bg-accent-amber',
  routine: 'bg-accent-teal',
};

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireToolSession();
  const { template } = session;
  const params = await searchParams;

  const requested = Number.parseInt(
    typeof params.cycle === 'string' ? params.cycle : '',
    10,
  );
  const cycle = CYCLES.includes(requested as (typeof CYCLES)[number]) ? requested : 1;

  const rows = hasNoReach(session) ? [] : await latestPerSiteForCycle(cycle);

  const bars = rows.map((row) => {
    const counts: Record<string, number> = { not_yet: 0, happening: 0, routine: 0 };
    let answered = 0;
    for (const step of template.steps) {
      const level = row[step.levelColumn] as string | null;
      if (isLevel(level)) {
        counts[level] = (counts[level] ?? 0) + 1;
        answered += 1;
      }
    }
    return { row, counts, answered };
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Where schools are in cycle {cycle}</h1>
        <Button variant="ghost" href={appHref('/')}>
          Back to check-ins
        </Button>
      </div>

      {hasNoReach(session) ? (
        <div className="mt-6">
          <NoReach />
        </div>
      ) : (
        <>
          <nav aria-label="Choose a cycle" className="mt-4 flex flex-wrap gap-2">
            {CYCLES.map((n) => (
              <Link
                key={n}
                href={`/chart?cycle=${n}`}
                aria-current={n === cycle ? 'page' : undefined}
                className={
                  'inline-flex min-h-tap items-center rounded-bb border px-4 text-base no-underline ' +
                  (n === cycle
                    ? 'border-bb-text bg-bb-surface-subtle font-semibold text-bb-text'
                    : 'border-bb-border bg-bb-surface text-bb-muted')
                }
              >
                Cycle {n}
              </Link>
            ))}
          </nav>

          <p className="mt-4 text-sm leading-relaxed text-bb-muted">
            Each bar is one school&rsquo;s {template.steps.length} steps, from its most recent
            submitted check-in for this cycle.
          </p>

          <ul className="mt-2 flex flex-wrap gap-4" aria-hidden="true">
            {LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-2 text-sm text-bb-muted">
                <span
                  className={`inline-block h-3 w-3 rounded-sm border border-bb-border ${SEGMENT[level]}`}
                />
                {template.levelLabels[level]}
              </li>
            ))}
          </ul>

          {bars.length === 0 ? (
            <Card as="section" className="mt-6">
              <h2 className="text-base font-semibold">
                No submitted check-ins for cycle {cycle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-bb-muted">
                Once a check-in for this cycle is submitted, the school appears
                here.
              </p>
            </Card>
          ) : (
            <ul className="mt-6 flex flex-col gap-5">
              {bars.map(({ row, counts, answered }) => (
                <li key={row.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold">
                      {row.site?.name ?? 'Unknown school'}
                    </h2>
                    <p className="text-sm text-bb-muted">
                      {answered} of {template.steps.length} steps answered
                    </p>
                  </div>

                  {/*
                    The bar is decorative; the counts below it are the data, so
                    the numbers are readable without interpreting colour or
                    width. That also means this survives printing and works for
                    anyone who cannot distinguish the segments.
                  */}
                  <div
                    aria-hidden="true"
                    className="mt-2 flex h-5 w-full overflow-hidden rounded-bb border border-bb-border"
                  >
                    {LEVELS.map((level) =>
                      counts[level] ? (
                        <span
                          key={level}
                          className={SEGMENT[level]}
                          style={{ width: `${(counts[level]! / template.steps.length) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </div>

                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {LEVELS.map((level) => (
                      <div key={level} className="flex gap-1">
                        <dt className="text-bb-muted">{template.levelLabels[level]}:</dt>
                        <dd className="font-semibold">{counts[level] ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
