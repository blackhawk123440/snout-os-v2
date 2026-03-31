'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui';
import {
  SitterPageHeader,
  SitterCard,
  SitterCardHeader,
  SitterCardBody,
  SitterSkeletonList,
  SitterErrorState,
} from '@/components/sitter';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSitterReportDetail, useUpdateSitterReport } from '@/lib/api/sitter-portal-hooks';

interface ReportData {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  canEdit: boolean;
}

export default function SitterReportEditPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params?.id as string | undefined;

  const { data: report, isLoading, error } = useSitterReportDetail(reportId ?? null) as {
    data: ReportData | undefined;
    isLoading: boolean;
    error: Error | null;
  };
  const updateReport = useUpdateSitterReport(reportId ?? '');
  const [content, setContent] = useState('');
  const [contentInit, setContentInit] = useState(false);

  if (report && !contentInit) {
    setContent(report.content ?? '');
    setContentInit(true);
  }

  const handleSave = async () => {
    if (!reportId || !report?.canEdit) return;
    try {
      await updateReport.mutateAsync({ content });
      toastSuccess('Report updated');
      router.push('/sitter/reports');
    } catch {
      toastError('Failed to update report');
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader
        title="Edit Report"
        subtitle="Update your visit report"
        action={
          <Button variant="secondary" size="sm" onClick={() => router.push('/sitter/reports')}>
            Back to reports
          </Button>
        }
      />

      {isLoading ? (
        <SitterSkeletonList count={2} />
      ) : error || !report ? (
        <SitterErrorState
          title="Couldn't load report"
          subtitle={error?.message || 'Report not found.'}
          onRetry={() => router.push('/sitter/reports')}
        />
      ) : (
        <div className="space-y-4">
          {!report.canEdit && (
            <SitterCard>
              <SitterCardBody>
                <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-4">
                  <p className="font-semibold text-status-warning-text">Editing no longer available</p>
                  <p className="mt-0.5 text-sm text-status-warning-text-secondary">
                    Reports can only be edited within 15 minutes of submission.
                  </p>
                </div>
              </SitterCardBody>
            </SitterCard>
          )}

          <SitterCard>
            <SitterCardHeader>Report content</SitterCardHeader>
            <SitterCardBody>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!report.canEdit}
                rows={8}
                className="w-full rounded-xl border border-border-strong bg-surface-primary px-4 py-3 text-text-primary disabled:bg-surface-tertiary disabled:text-text-disabled focus:outline-none focus:ring-2 focus:ring-border-focus"
                placeholder="What happened during the visit?"
              />
            </SitterCardBody>
          </SitterCard>

          {report.mediaUrls?.length > 0 && (
            <SitterCard>
              <SitterCardHeader>Photos</SitterCardHeader>
              <SitterCardBody>
                <div className="flex flex-wrap gap-2">
                  {report.mediaUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-20 w-20 rounded-lg bg-surface-tertiary overflow-hidden"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
                <p className="mt-2 text-xs text-text-tertiary">Photos cannot be changed when editing.</p>
              </SitterCardBody>
            </SitterCard>
          )}

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSave()}
              disabled={updateReport.isPending || !report.canEdit}
              className="min-h-[44px] flex-1"
            >
              {updateReport.isPending ? 'Saving...' : 'Save changes'}
            </Button>
            <Button variant="secondary" size="md" onClick={() => router.back()} className="min-h-[44px]">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
