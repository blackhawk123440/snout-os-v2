/**
 * RiskPill Component
 * UI Constitution V1 - Phase 6
 * 
 * Risk level indicator pill.
 */

'use client';

import { SignalSeverity } from '@/lib/resonance/types';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/lib/design-tokens';

export interface RiskPillProps {
  severity: SignalSeverity;
  label?: string;
}

export function RiskPill({ severity, label }: RiskPillProps) {
  const variant = severity === 'critical' 
    ? 'error' 
    : severity === 'warning' 
    ? 'warning' 
    : 'info';

  return (
    <Badge variant={variant}>
      {label || severity.toUpperCase()}
    </Badge>
  );
}
