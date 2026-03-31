/**
 * SitterTierBadge Component
 * 
 * Shared primitive for displaying sitter tier badges consistently across the app.
 * Universal Law: FEATURE COMPLETENESS RULE - Tier badges must appear everywhere sitters appear
 * 
 * Canonical Color Scheme:
 * - Trainee: Light neutral (gray)
 * - Certified: Soft brown outline
 * - Trusted: Brown filled
 * - Elite: Brown + pink accent or subtle glow
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/lib/design-tokens';

export interface TierInfo {
  id: string;
  name: string;
  priorityLevel?: number;
  badgeColor?: string | null;
  badgeStyle?: string | null; // "outline" | "filled" | "accent"
}

export interface SitterTierBadgeProps {
  tier: TierInfo | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

// Canonical tier color mapping
const TIER_COLORS: Record<string, { bg: string; border: string; text: string; style: 'outline' | 'filled' | 'accent' }> = {
  'Trainee': {
    bg: '#F5F5F5', // Light neutral gray
    border: '#E0E0E0',
    text: '#666666',
    style: 'outline',
  },
  'Certified': {
    bg: 'transparent',
    border: '#8B6F47', // Soft brown
    text: '#8B6F47',
    style: 'outline',
  },
  'Trusted': {
    bg: '#8B6F47', // Brown filled
    border: '#8B6F47',
    text: '#FFFFFF',
    style: 'filled',
  },
  'Elite': {
    bg: '#8B6F47', // Brown base
    border: '#E91E63', // Pink accent
    text: '#FFFFFF',
    style: 'accent',
  },
};

export const SitterTierBadge: React.FC<SitterTierBadgeProps> = ({
  tier,
  size = 'md',
}) => {
  if (!tier) {
    return null;
  }

  const sizeStyles = {
    sm: {
      fontSize: tokens.typography.fontSize.xs[0],
      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
      borderRadius: '12px', // Pill shape
    },
    md: {
      fontSize: tokens.typography.fontSize.sm[0],
      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
      borderRadius: '16px', // Pill shape
    },
    lg: {
      fontSize: tokens.typography.fontSize.base[0],
      padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
      borderRadius: '20px', // Pill shape
    },
  };

  const style = sizeStyles[size];

  // Use canonical colors if tier name matches, otherwise use tier's custom colors
  const tierName = tier.name;
  const canonicalColors = TIER_COLORS[tierName];
  const badgeStyle = tier.badgeStyle || canonicalColors?.style || 'outline';
  
  let backgroundColor: string;
  let borderColor: string;
  let color: string;
  let boxShadow: string | undefined;

  if (canonicalColors) {
    // Use canonical colors
    if (badgeStyle === 'outline') {
      backgroundColor = canonicalColors.bg;
      borderColor = canonicalColors.border;
      color = canonicalColors.text;
    } else if (badgeStyle === 'filled') {
      backgroundColor = canonicalColors.bg;
      borderColor = canonicalColors.border;
      color = canonicalColors.text;
    } else {
      // accent (Elite)
      backgroundColor = canonicalColors.bg;
      borderColor = canonicalColors.border;
      color = canonicalColors.text;
      boxShadow = `0 0 0 1px ${canonicalColors.border}, 0 2px 4px rgba(233, 30, 99, 0.2)`;
    }
  } else if (tier.badgeColor) {
    // Use custom color from tier
    if (badgeStyle === 'outline') {
      backgroundColor = 'transparent';
      borderColor = tier.badgeColor;
      color = tier.badgeColor;
    } else {
      backgroundColor = tier.badgeColor;
      borderColor = tier.badgeColor;
      color = '#FFFFFF';
    }
  } else {
    // Fallback
    backgroundColor = tokens.colors.primary[100];
    borderColor = tokens.colors.primary[300];
    color = tokens.colors.primary.DEFAULT;
  }

  return (
    <Badge
      variant="default"
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        color,
        fontSize: style.fontSize,
        padding: style.padding,
        borderRadius: style.borderRadius,
        fontWeight: tokens.typography.fontWeight.semibold,
        boxShadow,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {tier.name}
    </Badge>
  );
};

