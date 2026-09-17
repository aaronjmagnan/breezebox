import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * A data table (backbone §6, §7).
 *
 * Laptop-first by nature, but it still has to survive a phone, so the wrapper
 * scrolls horizontally rather than squeezing columns into unreadability. The
 * scroll region is focusable and labelled, because a keyboard user has to be
 * able to reach a scrollable box.
 *
 * Column headers use scope="col" so a screen reader can announce which column
 * a cell belongs to while moving across a row.
 */

export type TableColumn<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Hide below the given breakpoint on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
};

export type TableProps<Row> = {
  caption: string;
  columns: ReadonlyArray<TableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  empty?: ReactNode;
  className?: string;
};

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const;

export function Table<Row>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  className,
}: TableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn(
        'overflow-x-auto rounded-bb border border-bb-border bg-bb-surface',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-focus',
        className,
      )}
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-bb-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-3 py-2 font-semibold text-bb-text',
                  column.align === 'right' && 'text-right',
                  column.hideBelow && HIDE[column.hideBelow],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-bb-border last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-3 py-2 align-top text-bb-text',
                    column.align === 'right' && 'text-right',
                    column.hideBelow && HIDE[column.hideBelow],
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
