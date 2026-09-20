/**
 * CSV export (§7: every data tool has one).
 *
 * Two things here are not optional, and both fail silently rather than loudly.
 *
 * QUOTING. Free-text answers routinely contain commas, quotes and newlines --
 * "what is getting in the way?" is a sentence, not a token. An unquoted export
 * does not error; it produces a file that opens with the columns shifted, and
 * nobody notices until a number is read against the wrong label.
 *
 * FORMULA INJECTION. A spreadsheet treats a cell starting with =, +, - or @ as
 * a formula. A note beginning "=see attached" executes on open. Prefixing an
 * apostrophe makes it text, which is what it always was.
 *
 * The BOM and CRLF are for Excel on Windows, which mis-reads UTF-8 without
 * them. These files get opened in Excel.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => unknown;
};

export function toCsv<Row>(rows: Row[], columns: ReadonlyArray<CsvColumn<Row>>): string {
  const header = columns.map((c) => cell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => cell(c.value(row))).join(','));
  return '﻿' + [header, ...lines].join('\r\n');
}
