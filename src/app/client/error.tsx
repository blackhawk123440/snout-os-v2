'use client';

import { useEffect } from 'react';
import { AppErrorState } from '@/components/app/AppErrorState';

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    import('@sentry/nextjs').then(({ captureException }) => {
      captureException(error, { tags: { boundary: 'client' } });
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AppErrorState
        message="Something went wrong"
        subtitle="We couldn't load this page. Give it another try."
        onRetry={reset}
      />
    </div>
  );
}
