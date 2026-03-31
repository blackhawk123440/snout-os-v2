'use client';

import React, { useState } from 'react';
import { UserPlus, MessageSquare, Download, Columns3 } from 'lucide-react';
import { AppStatusPill } from './AppStatCard';

export interface AppTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  statusKey?: string;
  hideable?: boolean;
}

export interface AppTableProps<T> {
  columns: AppTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  /** Enable row selection + bulk actions */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Bulk actions (Assign / Message / Export) - stubbed */
  bulkActions?: Array<{ id: string; label: string; icon?: string }>;
  onBulkAction?: (actionId: string, ids: string[]) => void;
  /** Column picker - show visibility toggle */
  columnPicker?: boolean;
  /** Controlled column visibility (for persistence) */
  visibleColumns?: Set<string>;
  onVisibleColumnsChange?: (visible: Set<string>) => void;
}

const BULK_ACTION_ICONS: Record<string, React.ReactNode> = {
  assign: <UserPlus className="w-4 h-4" />,
  message: <MessageSquare className="w-4 h-4" />,
  export: <Download className="w-4 h-4" />,
};

const DEFAULT_BULK_ACTIONS = [
  { id: 'assign', label: 'Assign' },
  { id: 'message', label: 'Message' },
  { id: 'export', label: 'Export' },
];

export function AppTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data',
  loading = false,
  className = '',
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = DEFAULT_BULK_ACTIONS,
  onBulkAction,
  columnPicker = false,
  visibleColumns: controlledVisible,
  onVisibleColumnsChange,
}: AppTableProps<T>) {
  const [internalVisible, setInternalVisible] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.key))
  );
  const visibleColumns = controlledVisible ?? internalVisible;
  const setVisibleColumns = onVisibleColumnsChange ?? setInternalVisible;
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

  const displayColumns = columns.filter((c) => visibleColumns.has(c.key));
  const rowPadding = 'var(--density-row)';

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(data.map((r) => keyExtractor(r)));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange?.(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange?.([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div
        className={`animate-pulse overflow-hidden rounded-xl border border-border-default bg-surface-primary shadow-sm ${className}`}
      >
        <div className="divide-y divide-border-muted">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4" style={{ padding: rowPadding }}>
              {columns.map((_, j) => (
                <div
                  key={j}
                  className="h-4 flex-1 rounded bg-border-muted"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-secondary py-12 text-center text-sm text-text-tertiary ${className}`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border-default bg-surface-primary shadow-sm ${className}`}
    >
      {/* Bulk actions row */}
      {selectable && selectedIds.length > 0 && (
        <div
          className="flex items-center gap-4 border-b border-border-default bg-teal-50 px-4 py-2 dark:bg-teal-900/20"
          style={{ padding: rowPadding }}
        >
          <span className="text-sm font-medium text-text-primary">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2">
            {bulkActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onBulkAction?.(a.id, selectedIds)}
                className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
              >
                {BULK_ACTION_ICONS[a.id]}
                {a.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSelectionChange?.([])}
            className="ml-auto text-sm text-text-secondary hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-default">
          <thead>
            <tr>
              {selectable && (
                <th
                  className="w-10 text-left"
                  style={{ padding: rowPadding }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.length === data.length && data.length > 0}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {displayColumns.map((col) => (
                <th
                  key={col.key}
                  className="text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                  style={{ padding: rowPadding }}
                >
                  {col.header}
                </th>
              ))}
              {columnPicker && (
                <th className="w-10 text-right" style={{ padding: rowPadding }}>
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setColumnPickerOpen(!columnPickerOpen)}
                      className="rounded p-1 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500"
                      aria-label="Column picker"
                      aria-expanded={columnPickerOpen}
                    >
                      <Columns3 className="w-4 h-4" />
                    </button>
                    {columnPickerOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setColumnPickerOpen(false)}
                          aria-hidden="true"
                        />
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border-default bg-surface-primary py-2 shadow-lg">
                          {columns.map((col) => (
                            <label
                              key={col.key}
                              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-secondary"
                            >
                              <input
                                type="checkbox"
                                checked={visibleColumns.has(col.key)}
                                onChange={() => {
                                  const next = new Set(visibleColumns);
                                  if (next.has(col.key)) {
                                    // Keep at least one column visible.
                                    if (next.size > 1) next.delete(col.key);
                                  } else {
                                    next.add(col.key);
                                  }
                                  setVisibleColumns(next);
                                }}
                              />
                              {col.header}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted">
            {data.map((row) => {
              const id = keyExtractor(row);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={
                    onRowClick
                      ? 'cursor-pointer transition hover:bg-surface-secondary'
                      : ''
                  }
                >
                  {selectable && (
                    <td style={{ padding: rowPadding }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(id)}
                        onChange={() => toggleSelect(id)}
                        aria-label={`Select ${id}`}
                      />
                    </td>
                  )}
                  {displayColumns.map((col) => (
                    <td
                      key={col.key}
                      className="text-sm text-text-primary"
                      style={{ padding: rowPadding }}
                    >
                      {col.statusKey && row[col.statusKey] != null ? (
                        <AppStatusPill status={String(row[col.statusKey])} />
                      ) : col.render ? (
                        col.render(row)
                      ) : (
                        String(row[col.key] ?? '—')
                      )}
                    </td>
                  ))}
                  {columnPicker && <td style={{ padding: rowPadding }} />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
