'use client';

import { Download } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppCard, AppCardBody, AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';

export default function ClientExportPage() {
  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/client/export');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <LayoutWrapper variant="narrow">
      <PageHeader
        title="Export your data"
        subtitle="Download a copy of your profile, pets, bookings, reports, messages, and payment history"
      />
      <Section>
      {exportMutation.isError ? (
        <AppErrorState
          title="Export failed"
          subtitle={exportMutation.error?.message || 'Something went wrong'}
          onRetry={() => exportMutation.mutate()}
        />
      ) : (
        <AppCard>
          <AppCardBody>
            <p className="mb-4 text-sm text-text-secondary">
              You can download all your data as a JSON file. This includes your profile, pets, bookings, visit reports, messages, and payment history.
            </p>
            <Button
              variant="primary"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              isLoading={exportMutation.isPending}
              leftIcon={<Download className="h-4 w-4" />}
            >
              {exportMutation.isPending ? 'Preparing...' : 'Download export'}
            </Button>
          </AppCardBody>
        </AppCard>
      )}
      </Section>
    </LayoutWrapper>
  );
}
