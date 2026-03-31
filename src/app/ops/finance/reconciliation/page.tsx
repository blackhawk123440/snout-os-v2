/**
 * Finance reconciliation - run ledger vs Stripe comparison, view runs, export ledger.
 */

import { Suspense } from 'react';
import { ReconciliationContent } from './ReconciliationContent';
import { PageSkeleton } from '@/components/ui/loading-state';

export default function OpsFinanceReconciliationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReconciliationContent />
    </Suspense>
  );
}
