/**
 * Table Component
 *
 * Enterprise data table with sticky header, row hover, empty states, and loading skeletons.
 * On mobile, renders as card list instead of table.
 */

import React from 'react';
import { Inbox } from 'lucide-react';
import { useMobile } from '@/lib/use-mobile';
import { Card } from './Card';
import { colPriorityMd, colPriorityLg } from './data-table-shell';
import { cn } from './utils';

export interface TableColumn<T = any> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  mobileLabel?: string; // Label for mobile card view
  mobileOrder?: number; // Order in mobile view (lower = first)
  /** Hide column below breakpoint (md=768px, lg=1024px). Use for low-priority columns. */
  hideBelow?: 'md' | 'lg';
}

export interface TableProps<T = any> extends React.HTMLAttributes<HTMLTableElement> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  keyExtractor?: (row: T, index: number) => string;
  mobileCardRenderer?: (row: T, index: number) => React.ReactNode;
  /** When true, always render table layout (scrollable on mobile). Use for dense data tables. */
  forceTableLayout?: boolean;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  keyExtractor,
  mobileCardRenderer,
  forceTableLayout = false,
  ...props
}: TableProps<T>) {
  const isMobile = useMobile();

  const getKey = (row: T, index: number): string => {
    if (keyExtractor) return keyExtractor(row, index);
    return row.id || row.key || `row-${index}`;
  };

  // Mobile Card Layout (skip when forceTableLayout - use dense table on all screens)
  if (isMobile && !forceTableLayout) {
    const sortedColumns = [...columns].sort((a, b) => {
      const orderA = a.mobileOrder ?? 999;
      const orderB = b.mobileOrder ?? 999;
      return orderA - orderB;
    });

    return (
      <div className="flex flex-col gap-3 w-full max-w-full overflow-x-hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="p-4">
              <div className="h-4 bg-neutral-200 rounded-sm animate-pulse mb-2" />
              <div className="h-4 w-[60%] bg-neutral-200 rounded-sm animate-pulse" />
            </Card>
          ))
        ) : data.length === 0 ? (
          <Card className="p-6">
            <div className="flex flex-col items-center gap-2 text-text-secondary">
              <div className="text-2xl opacity-50">📭</div>
              <p className="text-base m-0">{emptyMessage}</p>
            </div>
          </Card>
        ) : (
          data.map((row, index) => (
            <Card
              key={getKey(row, index)}
              onClick={() => onRowClick?.(row, index)}
              className={cn(
                'p-4 transition-all duration-normal',
                onRowClick ? 'cursor-pointer hover:bg-surface-secondary' : 'cursor-default'
              )}
            >
              <div className="flex flex-col gap-3">
                {sortedColumns.map((column) => {
                  const content = column.render ? column.render(row, index) : row[column.key];
                  const label = column.mobileLabel || column.header;

                  return (
                    <div key={column.key} className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                        {label}
                      </div>
                      <div
                        className={cn(
                          'text-text-primary break-words leading-[1.4]',
                          column.key === 'client' || column.key === 'service'
                            ? 'text-xl'
                            : column.key === 'date' || column.key === 'schedule'
                            ? 'text-base'
                            : 'text-sm',
                          column.key === 'client'
                            ? 'font-bold'
                            : column.key === 'service'
                            ? 'font-semibold'
                            : 'font-normal'
                        )}
                      >
                        {content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Desktop Table Layout
  return (
    <div className="border border-border-default rounded-lg overflow-visible bg-surface-primary">
      <div
        className="table-wrapper overflow-y-auto w-full max-w-full relative"
        style={{
          overflowX: forceTableLayout ? 'auto' : isMobile ? 'hidden' : 'auto',
          maxHeight: 'calc(100vh - 300px)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          {...props}
          className={cn('w-full max-w-full border-collapse', props.className)}
          style={{
            tableLayout: isMobile && !forceTableLayout ? 'fixed' : 'auto',
            ...props.style,
          }}
        >
          <thead className="sticky top-0 z-[1020] bg-surface-secondary border-b-2 border-border-default">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'py-3 px-4 text-sm font-semibold text-text-primary uppercase tracking-wide whitespace-nowrap',
                    column.hideBelow === 'md' && colPriorityMd,
                    column.hideBelow === 'lg' && colPriorityLg
                  )}
                  style={{
                    textAlign: column.align || 'left',
                    width: column.width,
                    minWidth: column.width,
                  }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loading skeleton rows
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'p-4',
                        column.hideBelow === 'md' && colPriorityMd,
                        column.hideBelow === 'lg' && colPriorityLg
                      )}
                      style={{ textAlign: column.align || 'left' }}
                    >
                      <div className="h-4 bg-neutral-200 rounded-sm animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-text-secondary">
<Inbox className="w-7 h-7 opacity-50" aria-hidden />
                    <p className="text-base m-0">
                      {emptyMessage}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data rows
              data.map((row, index) => (
                <tr
                  key={getKey(row, index)}
                  onClick={() => onRowClick?.(row, index)}
                  className={cn(
                    'border-b border-border-muted transition-colors duration-normal',
                    onRowClick ? 'cursor-pointer hover:bg-surface-secondary' : 'cursor-default'
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'p-4 text-base text-text-primary',
                        column.hideBelow === 'md' && colPriorityMd,
                        column.hideBelow === 'lg' && colPriorityLg
                      )}
                      style={{ textAlign: column.align || 'left' }}
                    >
                      {column.render ? column.render(row, index) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
