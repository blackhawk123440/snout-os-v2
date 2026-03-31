/**
 * Payouts - Owner view: list transfers by sitter with filters and failures.
 */

import { Suspense } from 'react';
import { PayoutsContent } from './PayoutsContent';
import { TableSkeleton } from '@/components/ui/loading-state';

export default function OpsPayoutsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={5} cols={3} />}>
      <PayoutsContent />
    </Suspense>
  );
}
