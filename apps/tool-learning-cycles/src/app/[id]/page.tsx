import { notFound } from 'next/navigation';
import { Button } from '@breezebox/ui';
import { requireToolSession } from '@/lib/session';
import { getCheckIn } from '@/lib/checkins';
import { formatCycle, formatDate, formatLevel, formatStage } from '@/lib/format';
import { appHref, isUuid } from '@/lib/routes';
import { CONVERSATION_BOXES, LEVELS } from '@/lib/template';
import { PrintButton } from '@/components/print-button';

export const dynamic = 'force-dynamic';

/**
 * One check-in, read view (§4 of the tool spec). BOTH devices.
 *
 * The same markup is the print view: the print stylesheet in globals.css drops
 * the app chrome, boxes each answer and sets Letter size, so what prints is
 * laid out like the paper organizer with its 1a-4e box labels. There is no
 * second template to keep in step, and no server-side PDF generation.
 *
 * Every label and hint comes from lib/template, the same constant the form
 * and the chart read.
 */

function Box({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="print-box rounded-bb border border-bb-border bg-bb-surface p-4">
      <h3 className="text-sm font-semibold">
        <span className="text-bb-muted">{label}</span> {title}
      </h3>
      <div className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{children}</div>
    </div>
  );
}

function orDash(value: string | null | undefined) {
  return value && value.trim() !== '' ? value : '—';
}

export default async function CheckInDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { template } = await requireToolSession();
  const { id } = await params;

  // A path that is not an id at all reaches here as one, and Postgres
  // answers a non-uuid with an error rather than an empty result.
  if (!isUuid(id)) notFound();

  // RLS decides this, not the app: an out-of-reach record simply is not found.
  const record = await getCheckIn(id);
  if (!record) notFound();

  const isDraft = record.submitted_at === null;

  return (
    <main className="print-sheet mx-auto w-full max-w-3xl px-4 py-6">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Learning Cycle Check-In</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" href={appHref('/')}>
            Back
          </Button>
          <PrintButton />
          <Button variant="secondary" href={appHref(`/${record.id}/docx`)}>
            Download Word
          </Button>
          <Button variant="primary" href={appHref(`/${record.id}/edit`)}>
            Edit
          </Button>
        </div>
      </div>

      {/* Printed header. Hidden on screen because the app chrome says it. */}
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold">Learning Cycle Check-In</h1>
        <p className="text-sm">
          {record.site?.name} &middot; {formatDate(record.checkin_date)} &middot;{' '}
          {record.template_version}
        </p>
      </div>

      {isDraft ? (
        <p className="print-hide mt-4 rounded-bb border border-bb-border bg-bb-surface-subtle p-3 text-sm">
          This is a draft. Only you can see it until it is submitted.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        <section aria-labelledby="d-basics">
          <h2 id="d-basics" className="text-base font-semibold">
            {template.sections.basics.number}. {template.sections.basics.title}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Box label="1a" title="School">
              {orDash(record.site?.name)}
            </Box>
            <Box label="1b" title="Principal">
              {orDash(record.principal?.name)}
            </Box>
            <Box label="1c" title="Date">
              {formatDate(record.checkin_date)}
            </Box>
            <Box label="1d" title="Cycle and stage">
              {formatCycle(record.cycle_number)} &middot;{' '}
              {formatStage(record.stage, template.stageLabels)}
            </Box>
          </div>
        </section>

        <section aria-labelledby="d-focus">
          <h2 id="d-focus" className="text-base font-semibold">
            {template.sections.focus.number}. {template.sections.focus.title}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <Box label="2a" title="Practice the staff is working on">
              {orDash(record.practice)}
            </Box>
            <Box label="2b" title="Student need behind it">
              {orDash(record.student_need)}
            </Box>
          </div>
        </section>

        <section aria-labelledby="d-cycle">
          <h2 id="d-cycle" className="text-base font-semibold">
            {template.sections.cycle.number}. {template.sections.cycle.title}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-bb-muted">
            {LEVELS.map(
              (level) =>
                `${template.levelLabels[level]}: ${template.levelMeanings[level]}`,
            ).join('. ')}
            .
          </p>

          <div className="mt-3 flex flex-col gap-3">
            {template.steps.map((step) => (
              <Box key={step.key} label={step.box} title={step.title}>
                <p className="text-sm text-bb-muted">{step.hint}</p>
                <p className="mt-1 font-semibold">
                  {formatLevel(
                    record[step.levelColumn] as string | null,
                    template.levelLabels,
                  )}
                </p>
                <p className="mt-1">{orDash(record[step.noteColumn] as string | null)}</p>
              </Box>
            ))}
          </div>
        </section>

        <section aria-labelledby="d-conversation">
          <h2 id="d-conversation" className="text-base font-semibold">
            {template.sections.conversation.number}. {template.sections.conversation.title}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <Box label={CONVERSATION_BOXES.working} title="What is working">
              {orDash(record.working)}
            </Box>
            <Box label={CONVERSATION_BOXES.barrier} title="What is getting in the way">
              {orDash(record.barrier)}
            </Box>
            <Box label={CONVERSATION_BOXES.next_step} title="Next step">
              {orDash(record.next_step)}
            </Box>
            <Box
              label={CONVERSATION_BOXES.district_support}
              title="Support needed from the district"
            >
              {orDash(record.district_support)}
            </Box>
            <Box label={CONVERSATION_BOXES.next_checkin_date} title="Next check-in">
              {formatDate(record.next_checkin_date)}
            </Box>
          </div>
        </section>
      </div>
    </main>
  );
}
