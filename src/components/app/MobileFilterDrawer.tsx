'use client';

/**
 * MobileFilterDrawer - Filters collapse into Drawer on small screens, inline on large.
 * Enterprise pattern for list pages: payouts, message-failures, bookings, client/reports.
 */

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/utils';

export interface MobileFilterDrawerProps {
  /** Filter content (buttons, selects, date inputs) */
  children: React.ReactNode;
  /** Label for the filter trigger button on mobile */
  triggerLabel?: string;
  /** Optional active filter count for badge */
  activeCount?: number;
  className?: string;
}

export function MobileFilterDrawer({
  children,
  triggerLabel = 'Filters',
  activeCount,
  className,
}: MobileFilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: trigger button */}
      <div className={cn('md:hidden', className)}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={`Open ${triggerLabel}`}
        >
          <Filter className="w-4 h-4 mr-2" />
          {triggerLabel}
          {activeCount != null && activeCount > 0 && (
            <span className="ml-2 rounded-full bg-accent-primary px-2 py-0.5 text-xs text-text-inverse">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile: drawer */}
      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={triggerLabel}
        placement="right"
        width="min(360px, 90vw)"
      >
        <div className="space-y-4 pt-2">{children}</div>
      </Drawer>

      {/* Desktop: inline filters */}
      <div className={cn('hidden md:block', className)}>{children}</div>
    </>
  );
}
