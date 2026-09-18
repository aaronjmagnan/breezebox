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
 * SORTING IS LINKS, NOT STATE. Each sortable header is an anchor to the same
 * page with different query parameters, so a sorted view is shareable, works
 * without JavaScript, survives a reload, and can be handed straight to an
 * export without reimplementing the order. `aria-sort` sits on the th, which
 * is what a screen reader reads.
 */

export type SortDirection = 'asc' | 'desc';

export type TableColumn<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Set to make the header a sort link. Passed back to `sortHref`. */
  sortKey?: string;
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
  /** Which column is sorted, and which way. */
  sort?: { key: string; direction: SortDirection };
  /** Where a header should link to in order to sort by that key. */
  sortHref?: (key: string) => string;
  className?: string;
};

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const;

/** Up and down arrows drawn in text so they print and never fail to load. */
function SortMark({ direction }: { direction: SortDirection | null }) {
  return (
    <span aria-hidden="true" className="ml-1 inline-block text-bb-muted">
      {direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}
    </span>
  );
}

export function Table<Row>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  sort,
  sortHref,
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
            {columns.map((column) => {
              const sorted =
                sort && column.sortKey === sort.key ? sort.direction : null;
              const sortable = column.sortKey && sortHref;

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sorted === 'asc'
                      ? 'ascending'
                      : sorted === 'desc'
                        ? 'descending'
                        : sortable
                          ? 'none'
                          : undefined
                  }
                  className={cn(
                    'whitespace-nowrap font-semibold text-bb-text',
                    sortable ? 'p-0' : 'px-3 py-2',
                    column.align === 'right' && 'text-right',
                    column.hideBelow && HIDE[column.hideBelow],
                  )}
                >
                  {sortable ? (
                    <a
                      href={sortHref(column.sortKey!)}
                      className={cn(
                        'flex min-h-tap w-full items-center px-3 py-2 no-underline',
                        'hover:bg-bb-surface-subtle',
                        'focus-visible:outline-none focus-visible:ring-2',
                        'focus-visible:ring-inset focus-visible:ring-bb-focus',
                        column.align === 'right' && 'justify-end',
                      )}
                    >
                      {column.header}
                      <SortMark direction={sorted} />
                      <span className="sr-only">
                        {sorted === 'asc'
                          ? ', sorted oldest first, activate to reverse'
                          : sorted === 'desc'
                            ? ', sorted newest first, activate to reverse'
                            : ', activate to sort by this column'}
                      </span>
                    </a>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
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
