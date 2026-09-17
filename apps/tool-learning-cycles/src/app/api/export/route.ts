import { NextResponse, type NextRequest } from 'next/server';
import { listSubmitted } from '@/lib/checkins';
import { toCsv } from '@/lib/csv';

/**
 * CSV export of whatever the list is currently filtered to (§7).
 *
 * Runs the same RLS-scoped query as the page, so the file can never contain a
 * row the person could not already see on screen.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const cycle = Number.parseInt(params.get('cycle') ?? '', 10);

  const rows = await listSubmitted({
    siteId: params.get('site') || undefined,
    cycleNumber: Number.isFinite(cycle) ? cycle : undefined,
    stage: params.get('stage') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="learning-cycle-checkins-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
