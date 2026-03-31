/**
 * InsightRow Component
 * UI Constitution V1 - Phase 6
 * 
 * Single-line insight display.
 */

'use client';

import { Flex } from '@/components/ui/Flex';
import { tokens } from '@/lib/design-tokens';
import { Signal } from '@/lib/resonance/types';
import { SignalBadge } from './SignalBadge';

export interface InsightRowProps {
  signal: Signal;
  onClick?: () => void;
}

export function InsightRow({ signal, onClick }: InsightRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: tokens.spacing[3],
        borderRadius: tokens.radius.md,
        cursor: onClick ? 'pointer' : 'default',
        transition: `background-color ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = tokens.colors.accent.secondary;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Flex align="center" justify="space-between" gap={3}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: tokens.typography.fontSize.sm[0],
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.text.primary,
              marginBottom: tokens.spacing[1],
            }}
          >
            {signal.label}
          </div>
          <div
            style={{
              fontSize: tokens.typography.fontSize.xs[0],
              color: tokens.colors.text.secondary,
            }}
          >
            {signal.reason}
          </div>
        </div>
        <SignalBadge signal={signal} compact />
      </Flex>
    </div>
  );
}
