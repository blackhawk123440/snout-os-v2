/**
 * SitterAssignmentDisplay Component
 * 
 * Shared primitive for displaying sitter assignment consistently across the app.
 * Universal Law: ONE ASSIGNMENT VISIBILITY CONTRACT
 * 
 * Universal Tier Badge Rule: All tier displays MUST use SitterTierBadge component.
 * Never use basic Badge for tier information.
 */

'use client';

import React from 'react';
import { tokens } from '@/lib/design-tokens';
import { SitterTierBadge, type TierInfo } from './SitterTierBadge';

export interface SitterInfo {
  id: string;
  firstName: string;
  lastName: string;
  currentTier?: TierInfo | null;
}

export interface SitterAssignmentDisplayProps {
  sitter: SitterInfo | null | undefined;
  showUnassigned?: boolean; // Show "Unassigned" badge when sitter is null
  compact?: boolean; // For use in lists/cards
  showTierBadge?: boolean; // Show tier badge if available
}

export const SitterAssignmentDisplay: React.FC<SitterAssignmentDisplayProps> = ({
  sitter,
  showUnassigned = true,
  compact = false,
  showTierBadge = false,
}) => {
  if (!sitter) {
    if (showUnassigned) {
      return (
        <span style={{ color: tokens.colors.text.tertiary, fontSize: compact ? tokens.typography.fontSize.sm[0] : tokens.typography.fontSize.base[0] }}>
          Unassigned
        </span>
      );
    }
    return null;
  }

  const fullName = `${sitter.firstName} ${sitter.lastName}`;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2], flexWrap: 'wrap' }}>
        <span style={{ fontSize: tokens.typography.fontSize.sm[0], fontWeight: tokens.typography.fontWeight.medium }}>
          {fullName}
        </span>
        {showTierBadge && sitter.currentTier && (
          <SitterTierBadge tier={sitter.currentTier} size="sm" />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2], flexWrap: 'wrap' }}>
      <div style={{ fontSize: tokens.typography.fontSize.base[0], fontWeight: tokens.typography.fontWeight.medium }}>
        {fullName}
      </div>
      {showTierBadge && sitter.currentTier && (
        <SitterTierBadge tier={sitter.currentTier} size="sm" />
      )}
    </div>
  );
};

