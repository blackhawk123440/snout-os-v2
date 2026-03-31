'use client';

import { ShieldCheck, Check } from 'lucide-react';

export interface SitterTrustBadgeProps {
  tierLabel: string | null;
  statements: string[];
  sitterName?: string;
}

export function SitterTrustBadge({ tierLabel, statements, sitterName }: SitterTrustBadgeProps) {
  if (!tierLabel) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-primary/20 bg-accent-primary/5 px-3 py-2">
      <ShieldCheck className="h-4 w-4 shrink-0 text-accent-primary mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-accent-primary">
          {sitterName ? `${sitterName} is ` : ''}{tierLabel}
        </p>
        {statements.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {statements.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Check className="h-3 w-3 shrink-0 text-accent-primary" />
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
