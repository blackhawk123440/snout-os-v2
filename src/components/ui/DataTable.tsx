/**
 * DataTable Component
 * UI Constitution V1 - Data Component
 * 
 * Desktop data table with optional fixed header and internal body scroll.
 * Supports sorting, empty, loading, and error states.
 * Row actions accessible.
 * 
 * @example
 * ```tsx
 * <DataTable
 *   columns={columns}
 *   data={data}
 *   sortable
 *   loading={loading}
 *   onSort={(column, direction) => {}}
 * />
 * ```
 */

'use client';

import { ReactNode, useState } from 'react';
import { tokens } from '@/lib/design-tokens';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Skeleton } from './Skeleton';
import { cn } from './utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  sortable?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  fixedHeader?: boolean;
  maxHeight?: string;
  onRowClick?: (row: T, index: number) => void;
  rowActions?: (row: T, index: number) => ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  error,
  emptyMessage = 'No data available',
  sortable = false,
  onSort,
  fixedHeader = false,
  maxHeight,
  onRowClick,
  rowActions,
  className,
  'data-testid': testId,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (columnKey: string) => {
    if (!sortable || !onSort) return;

    const newDirection =
      sortColumn === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnKey);
    setSortDirection(newDirection);
    onSort(columnKey, newDirection);
  };

  if (error) {
    return <ErrorState message={error} />;
  }

  if (loading) {
    return (
      <div
        data-testid={testId || 'data-table-loading'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[2],
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height="48px" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title="No data" description={emptyMessage} />;
  }

  return (
    <div
      data-testid={testId || 'data-table'}
      className={cn('data-table', className)}
      style={{
        border: `1px solid ${tokens.colors.border.default}`,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          overflowX: 'auto',
          overflowY: fixedHeader ? 'auto' : 'visible',
          flex: 1,
          maxHeight: fixedHeader ? maxHeight : undefined,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead
            style={{
              backgroundColor: tokens.colors.surface.secondary,
              position: fixedHeader ? 'sticky' : 'relative',
              top: 0,
              zIndex: tokens.z.layer.elevated,
            }}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    padding: tokens.spacing[4],
                    textAlign: 'left',
                    fontSize: tokens.typography.fontSize.sm[0],
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.text.secondary,
                    borderBottom: `1px solid ${tokens.colors.border.default}`,
                    width: column.width,
                    cursor: column.sortable && sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                    }}
                  >
                    {column.header}
                    {column.sortable && sortable && (
                      <span
                        style={{
                          fontSize: tokens.typography.fontSize.xs[0],
                          color: tokens.colors.text.tertiary,
                        }}
                      >
                        {sortColumn === column.key
                          ? sortDirection === 'asc'
                            ? '↑'
                            : '↓'
                          : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {rowActions && <th style={{ width: '80px' }} />}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                onClick={() => onRowClick?.(row, index)}
                style={{
                  backgroundColor: tokens.colors.surface.primary,
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: `background-color ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor =
                      tokens.colors.accent.secondary;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    tokens.colors.surface.primary;
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: tokens.spacing[4],
                      fontSize: tokens.typography.fontSize.base[0],
                      color: tokens.colors.text.primary,
                      borderBottom: `1px solid ${tokens.colors.border.muted}`,
                    }}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
                {rowActions && (
                  <td
                    style={{
                      padding: tokens.spacing[4],
                      borderBottom: `1px solid ${tokens.colors.border.muted}`,
                    }}
                  >
                    {rowActions(row, index)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
