/**
 * SignalStack Component
 * UI Constitution V1 - Phase 6
 * 
 * Display multiple signals in a compact stack.
 */

'use client';

import { Signal } from '@/lib/resonance/types';
import { Flex } from '@/components/ui/Flex';
import { SignalBadge } from './SignalBadge';
import { tokens } from '@/lib/design-tokens';
import { useMemo } from 'react';

export interface SignalStackProps {
  signals: Signal[];
  maxVisible?: number;
  showCount?: boolean;
  compact?: boolean;
}

export function SignalStack({ 
  signals, 
  maxVisible = 3, 
  showCount = true,
  compact = false 
}: SignalStackProps) {
  // Sort by severity: critical > warning > info
  const sortedSignals = useMemo(() => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return [...signals].sort((a, b) => 
      severityOrder[a.severity] - severityOrder[b.severity]
    );
  }, [signals]);

  const visibleSignals = sortedSignals.slice(0, maxVisible);
  const remainingCount = signals.length - visibleSignals.length;

  if (signals.length === 0) {
    return null;
  }

  return (
    <Flex gap={2} wrap>
      {visibleSignals.map(signal => (
        <SignalBadge key={signal.id} signal={signal} compact={compact} />
      ))}
      {remainingCount > 0 && showCount && (
        <span
          style={{
            fontSize: tokens.typography.fontSize.xs[0],
            color: tokens.colors.text.tertiary,
            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          }}
        >
          +{remainingCount}
        </span>
      )}
    </Flex>
  );
}
