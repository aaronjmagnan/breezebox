import type { CheckInWithNames } from './checkins';
import type { Template } from './template';
import { formatLevel, formatStage } from './format';

/**
 * CSV export (§7: every data tool has one).
 *
 * Quoting is not optional here. Free-text answers routinely contain commas,
 * quotes and newlines -- "what's getting in the way?" is a sentence, not a
 * token -- and an unquoted export corrupts silently rather than failing.
 *
 * The leading-character guard stops a spreadsheet treating a cell beginning
 * with =, +, - or @ as a formula. A note starting "=see attached" should not
 * execute in Excel.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CheckInWithNames[], template: Template): string {
  const headers = [
    'Date',
    'School',
    'Principal',
    'Cycle',
    'Stage',
    'Practice',
    'Student need',
    ...template.steps.flatMap((s) => [`${s.title} level`, `${s.title} note`]),
    'What is working',
    'What is getting in the way',
    'Next step',
    'District support',
    'Next check-in',
    'Submitted',
  ];

  const lines = rows.map((row) =>
    [
      row.checkin_date,
      row.site?.name ?? '',
      row.principal?.name ?? '',
      row.cycle_number ?? '',
      formatStage(row.stage, template.stageLabels),
      row.practice ?? '',
      row.student_need ?? '',
      ...template.steps.flatMap((s) => [
        formatLevel(row[s.levelColumn] as string | null, template.levelLabels),
        (row[s.noteColumn] as string | null) ?? '',
      ]),
      row.working ?? '',
      row.barrier ?? '',
      row.next_step ?? '',
      row.district_support ?? '',
      row.next_checkin_date ?? '',
      row.submitted_at ?? '',
    ]
      .map(cell)
      .join(','),
  );

  // CRLF and a BOM: Excel on Windows mis-reads UTF-8 without them, and these
  // exports get opened in Excel.
  return '﻿' + [headers.map(cell).join(','), ...lines].join('\r\n');
}
