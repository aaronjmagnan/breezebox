import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { CheckInWithNames } from './checkins';
import {
  CONVERSATION_BOXES,
  LEVELS,
  LEVEL_LABELS,
  LEVEL_MEANINGS,
  SECTIONS,
  STEPS,
} from './template';
import { formatCycle, formatDate, formatLevel, formatStage } from './format';

/**
 * A check-in as a Word document.
 *
 * Why docx and not a server-rendered PDF: the browser's print dialog already
 * produces a PDF from the print stylesheet, and that stylesheet is the same
 * markup as the read view, so the two cannot drift. A server-side PDF would
 * need headless Chromium on a serverless function -- slow cold starts, bundle
 * size limits, ongoing maintenance -- to produce something we already have.
 *
 * Word earns its place by being different in kind: people paste a check-in
 * into a board packet, add a paragraph, track changes. A PDF cannot do that.
 *
 * Every heading and hint comes from lib/template, the same constant the form,
 * the table, the chart and the print view read.
 */

const EM_DASH = '—';

function orDash(value: string | null | undefined): string {
  return value && value.trim() !== '' ? value.trim() : EM_DASH;
}

function heading(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
  });
}

/**
 * One labelled answer. The box label (1a, 3c) is kept because the whole point
 * is that this matches the paper organizer people already use.
 */
function field(label: string, box: string, value: string) {
  return [
    new Paragraph({
      spacing: { before: 160, after: 40 },
      children: [
        new TextRun({ text: `${box}  `, bold: true, color: '5B646E' }),
        new TextRun({ text: label, bold: true }),
      ],
    }),
    new Paragraph({ text: value, spacing: { after: 60 } }),
  ];
}

/** The five steps as a table: level and note side by side, like the paper. */
function stepsTable(record: CheckInWithNames) {
  const header = new TableRow({
    tableHeader: true,
    children: ['Step', 'Where it is', 'Note'].map(
      (text) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        }),
    ),
  });

  const rows = STEPS.map(
    (step) =>
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  // The box label matters: this document is meant to sit
                  // alongside the paper organizer people already use.
                  new TextRun({ text: `${step.box}  `, bold: true, color: '5B646E' }),
                  new TextRun({ text: step.title, bold: true }),
                ],
              }),
              new Paragraph({
                children: [new TextRun({ text: step.hint, italics: true, size: 18 })],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph(formatLevel(record[step.levelColumn] as string | null)),
            ],
          }),
          new TableCell({
            children: [new Paragraph(orDash(record[step.noteColumn] as string | null))],
          }),
        ],
      }),
  );

  return new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

export async function checkInToDocx(record: CheckInWithNames): Promise<Buffer> {
  const doc = new Document({
    creator: 'Breeze Box',
    title: `Learning Cycle Check-In ${EM_DASH} ${record.site?.name ?? ''}`,
    description: `Check-in for ${formatDate(record.checkin_date)}`,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'Learning Cycle Check-In',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: [
                  record.site?.name,
                  formatDate(record.checkin_date),
                  record.template_version,
                ]
                  .filter(Boolean)
                  .join(`  ${EM_DASH}  `),
                color: '5B646E',
              }),
            ],
          }),

          heading(`${SECTIONS.basics.number}. ${SECTIONS.basics.title}`),
          ...field('School', '1a', orDash(record.site?.name)),
          ...field('Principal', '1b', orDash(record.principal?.name)),
          ...field('Date', '1c', formatDate(record.checkin_date)),
          ...field(
            'Cycle and stage',
            '1d',
            `${formatCycle(record.cycle_number)} ${EM_DASH} ${formatStage(record.stage)}`,
          ),

          heading(`${SECTIONS.focus.number}. ${SECTIONS.focus.title}`),
          ...field('Practice the staff is working on', '2a', orDash(record.practice)),
          ...field('Student need behind it', '2b', orDash(record.student_need)),

          heading(`${SECTIONS.cycle.number}. ${SECTIONS.cycle.title}`),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: LEVELS.map(
                  (level) => `${LEVEL_LABELS[level]}: ${LEVEL_MEANINGS[level]}`,
                ).join('.  '),
                italics: true,
                size: 18,
              }),
            ],
          }),
          stepsTable(record),

          heading(`${SECTIONS.conversation.number}. ${SECTIONS.conversation.title}`),
          ...field('What is working', CONVERSATION_BOXES.working, orDash(record.working)),
          ...field(
            'What is getting in the way',
            CONVERSATION_BOXES.barrier,
            orDash(record.barrier),
          ),
          ...field('Next step', CONVERSATION_BOXES.next_step, orDash(record.next_step)),
          ...field(
            'Support needed from the district',
            CONVERSATION_BOXES.district_support,
            orDash(record.district_support),
          ),
          ...field(
            'Next check-in',
            CONVERSATION_BOXES.next_checkin_date,
            formatDate(record.next_checkin_date),
          ),

          new Paragraph({
            spacing: { before: 400 },
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: record.submitted_at
                  ? `Submitted ${formatDate(record.submitted_at.slice(0, 10))}`
                  : 'Draft, not yet submitted',
                italics: true,
                size: 18,
                color: '5B646E',
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/** A filename someone can find again in a downloads folder. */
export function docxFilename(record: CheckInWithNames): string {
  const site = (record.site?.name ?? 'check-in')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `learning-cycle-${site}-${record.checkin_date}.docx`;
}
