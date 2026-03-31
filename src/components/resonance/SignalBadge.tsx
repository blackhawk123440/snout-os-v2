/**
 * SignalBadge Component
 * UI Constitution V1 - Phase 6
 * 
 * Individual signal indicator badge.
 */

'use client';

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Signal } from '@/lib/resonance/types';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { tokens } from '@/lib/design-tokens';

export interface SignalBadgeProps {
  signal: Signal;
  compact?: boolean;
}

export function SignalBadge({ signal, compact = false }: SignalBadgeProps) {
  const variant = signal.severity === 'critical' 
    ? 'error' 
    : signal.severity === 'warning' 
    ? 'warning' 
    : 'info';

  const badge = (
    <Badge variant={variant}>
      {compact ? (
        signal.severity === 'critical'
          ? <AlertCircle className="w-3.5 h-3.5" />
          : signal.severity === 'warning'
          ? <AlertTriangle className="w-3.5 h-3.5" />
          : <Info className="w-3.5 h-3.5" />
      ) : (
        signal.label
      )}
    </Badge>
  );

  if (compact) {
    return (
      <Tooltip content={signal.label}>
        {badge}
      </Tooltip>
    );
  }

  return badge;
}
