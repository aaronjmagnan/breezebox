import { NextResponse } from 'next/server';
import { getCheckIn } from '@/lib/checkins';
import { checkInToDocx, docxFilename } from '@/lib/docx';
import { isUuid } from '@/lib/routes';
import { requireToolSession } from '@/lib/session';

/**
 * One check-in as a Word document.
 *
 * Reads through the same RLS-scoped query as the page, so the file can never
 * contain a record the person could not already open. A record out of reach is
 * indistinguishable from one that does not exist, which is the point.
 *
 * Node runtime: the docx package writes a zip, which the edge runtime cannot.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse('Not found', { status: 404 });

  // The session carries this district's own wording, so the document reads
  // the same as the screen it was downloaded from.
  const session = await requireToolSession();

  const record = await getCheckIn(id);
  if (!record) return new NextResponse('Not found', { status: 404 });

  const buffer = await checkInToDocx(record, session.template);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${docxFilename(record)}"`,
      'Content-Length': String(buffer.byteLength),
      // Never cached: it carries a named principal's coaching notes.
      'Cache-Control': 'no-store',
    },
  });
}
