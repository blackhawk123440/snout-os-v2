'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import {
  SitterPageHeader,
  SitterCard,
  SitterCardBody,
  SitterEmptyState,
  SitterSkeletonList,
  SitterErrorState,
} from '@/components/sitter';
import { useSitterReports } from '@/lib/api/sitter-portal-hooks';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-xs text-status-warning-text-secondary" aria-label={`${rating} star${rating !== 1 ? 's' : ''}`}>
      {Array.from({ length: rating }, (_, i) => (
        <span key={i} aria-hidden="true">*</span>
      )).length > 0 && `${'★'.repeat(rating)}`}
    </span>
  );
}

export default function SitterReportsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useSitterReports();

  const reports = data?.reports ?? [];

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader
        title="Reports"
        subtitle={`${reports.length} visit report${reports.length !== 1 ? 's' : ''}`}
        action={
          <Link href="/sitter/reports/new">
            <Button variant="primary" size="sm">New report</Button>
          </Link>
        }
      />

      {isLoading ? (
        <SitterSkeletonList count={4} />
      ) : error ? (
        <SitterErrorState title="Couldn't load reports" subtitle="Could not load reports." onRetry={refetch} />
      ) : reports.length === 0 ? (
        <SitterEmptyState
          title="No reports yet"
          subtitle="Submit a report after a visit — it will appear in the client's Latest report."
          cta={{ label: 'New report', onClick: () => router.push('/sitter/reports/new') }}
        />
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <SitterCard
              key={r.id}
              onClick={() => router.push(`/sitter/reports/edit/${r.id}`)}
              className="cursor-pointer hover:shadow-sm transition-shadow"
            >
              <SitterCardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-text-primary truncate">
                        {r.service || 'Visit'}
                      </span>
                      {r.hasPhotos && (
                        <span className="text-xs text-text-tertiary" title="Has photos">
                          Photo
                        </span>
                      )}
                    </div>
                    {r.clientName && (
                      <p className="text-sm text-text-secondary">{r.clientName}</p>
                    )}
                    {r.preview && (
                      <p className="text-sm text-text-tertiary mt-1 line-clamp-2">
                        {r.preview}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-text-tertiary">
                      {r.visitDate ? formatDate(r.visitDate) : formatDate(r.createdAt)}
                    </p>
                    {r.clientRating > 0 && (
                      <div className="mt-1">
                        <StarRating rating={r.clientRating} />
                      </div>
                    )}
                    {r.walkDuration > 0 && (
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {r.walkDuration} min walk
                      </p>
                    )}
                  </div>
                </div>
              </SitterCardBody>
            </SitterCard>
          ))}
        </div>
      )}
    </div>
  );
}
