/**
 * DataRow Component
 * UI Constitution V1 - Data Component
 *
 * Label-value layout with optional copy affordance and truncation rules.
 *
 * @example
 * ```tsx
 * <DataRow
 *   label="Email"
 *   value="user@example.com"
 *   copyable
 * />
 * ```
 */

'use client';

import { ReactNode, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './utils';

export interface DataRowProps {
  label: string;
  value: string | ReactNode;
  copyable?: boolean;
  truncate?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function DataRow({
  label,
  value,
  copyable = false,
  truncate = false,
  className,
  'data-testid': testId,
}: DataRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof value === 'string') {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      data-testid={testId || 'data-row'}
      className={cn('flex items-start gap-4 py-3 border-b border-border-muted', className)}
    >
      <div className="min-w-[120px] shrink-0 text-sm font-medium text-text-secondary">
        {label}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div
          className={cn(
            'flex-1 text-base text-text-primary',
            truncate && 'overflow-hidden text-ellipsis whitespace-nowrap'
          )}
        >
          {value}
        </div>
        {copyable && typeof value === 'string' && (
          <IconButton
            icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          />
        )}
      </div>
    </div>
  );
}
