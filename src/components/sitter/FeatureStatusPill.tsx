'use client';

import { getFeatureStatus, getStatusPill } from '@/lib/sitter-nav';

interface FeatureStatusPillProps {
  featureKey: string;
  className?: string;
}

export function FeatureStatusPill({ featureKey, className = '' }: FeatureStatusPillProps) {
  const status = getFeatureStatus(featureKey);
  const { label, className: statusClass } = getStatusPill(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass} ${className}`}
    >
      {label}
    </span>
  );
}
