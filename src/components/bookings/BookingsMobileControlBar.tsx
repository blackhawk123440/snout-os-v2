/**
 * BookingsMobileControlBar Component
 * 
 * Mobile control bar for bookings list with stats toggle, count, select all, and batch actions.
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/lib/design-tokens';

export interface BookingsMobileControlBarProps {
  count: number;
  statsVisible: boolean;
  onToggleStats: (visible: boolean) => void;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onBatchStatus: () => void;
  onBatchSitterPool: () => void;
  onClearSelection: () => void;
}

export const BookingsMobileControlBar: React.FC<BookingsMobileControlBarProps> = ({
  count,
  statsVisible,
  onToggleStats,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onBatchStatus,
  onBatchSitterPool,
  onClearSelection,
}) => {
  const showBatchActions = selectedCount > 0;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: tokens.zIndex.sticky,
        backgroundColor: tokens.colors.background.primary,
        borderBottom: `1px solid ${tokens.colors.border.default}`,
        padding: tokens.spacing[3],
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
        flexWrap: 'wrap',
      }}
    >
      {/* Booking Count */}
      <div
        style={{
          fontSize: tokens.typography.fontSize.sm[0],
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.text.primary,
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        Bookings: {count}
      </div>

      {/* Hide Stats Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToggleStats(!statsVisible)}
        style={{
          minHeight: '44px',
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          borderRadius: tokens.borderRadius.full, // Made rounded per requirements
        }}
      >
        {statsVisible ? 'Hide Stats' : 'Show Stats'}
      </Button>

      {/* Select All Checkbox - Made rounded or hidden per requirements */}
      {!showBatchActions && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
            cursor: 'pointer',
            minHeight: '44px',
            padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            borderRadius: tokens.borderRadius.full, // Made rounded per requirements
          }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer',
              borderRadius: tokens.borderRadius.full, // Made rounded per requirements
            }}
          />
          <span
            style={{
              fontSize: tokens.typography.fontSize.sm[0],
              color: tokens.colors.text.primary,
            }}
          >
            Select All
          </span>
        </label>
      )}

      {/* Batch Actions */}
      {showBatchActions && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onBatchStatus}
            style={{
              minHeight: '44px',
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            }}
          >
            Change Status ({selectedCount})
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onBatchSitterPool}
            style={{
              minHeight: '44px',
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            }}
          >
            Set Pool ({selectedCount})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            style={{
              minHeight: '44px',
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
            }}
          >
            Clear
          </Button>
        </>
      )}
    </div>
  );
};

