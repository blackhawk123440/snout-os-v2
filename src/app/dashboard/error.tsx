'use client';

import { useEffect } from 'react';
import { AppErrorState } from '@/components/app/AppErrorState';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    import('@sentry/nextjs').then(({ captureException }) => {
      captureException(error, { tags: { boundary: 'dashboard' } });
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <AppErrorState
        message="Something went wrong"
        subtitle="We couldn't load the dashboard. Give it another try."
        onRetry={reset}
      />
    </div>
  );
}
