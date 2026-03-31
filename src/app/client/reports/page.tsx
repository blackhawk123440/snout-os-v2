'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, ChevronRight, Star, Clock } from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';
import { renderClientPreview } from '@/lib/strip-emojis';
import { useClientReports } from '@/lib/api/client-hooks';

function parseFirstPhoto(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null;
  } catch {
    return null;
  }
}

export default function ClientReportsPage() {
  const router = useRouter();
  const { data, isLoading: loading, error, refetch } = useClientReports();
  const reports = data?.reports ?? [];

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';

  const formatTime = (d: string | null) =>
    d ? new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

  const ratedCount = reports.filter(r => r.clientRating != null).length;
  const avgRating = ratedCount > 0
    ? (reports.reduce((sum, r) => sum + (r.clientRating ?? 0), 0) / ratedCount).toFixed(1)
    : null;
  const photosCount = reports.filter(r => parseFirstPhoto(r.mediaUrls)).length;

  const heroReport = reports[0] || null;
  const restReports = reports.slice(1);

  return (
    <LayoutWrapper variant="narrow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight sm:text-2xl">
            Visit reports
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">
            {reports.length > 0
              ? `${reports.length} report${reports.length !== 1 ? 's' : ''} from your sitter`
              : 'Updates from your sitter'}
          </p>
        </div>
        <ClientRefreshButton onRefresh={refetch} loading={loading} />
      </div>

      {loading ? (
        <ReportsSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load reports" subtitle={error.message || 'Unable to load reports'} onRetry={() => void refetch()} />
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-accent-tertiary p-8 text-center mt-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
            <FileText className="h-7 w-7 text-text-inverse" />
          </div>
          <p className="text-xl font-bold text-text-primary">No reports yet</p>
          <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
            Your sitter will send visit reports after each appointment.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/client/bookings">
              <Button variant="primary" size="md">View bookings</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {/* Summary strip — gives page presence even with few reports */}
          {reports.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-accent-tertiary p-4">
                <p className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">Reports</p>
                <p className="mt-2 text-2xl font-bold text-accent-primary tabular-nums">{reports.length}</p>
              </div>
              <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Avg rating</p>
                <p className="mt-2 text-2xl font-bold text-text-primary tabular-nums">{avgRating ?? '\u2014'}</p>
                {avgRating && <p className="mt-0.5 text-[11px] text-text-tertiary">out of 5</p>}
              </div>
              <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Photos</p>
                <p className="mt-2 text-2xl font-bold text-text-primary tabular-nums">{photosCount}</p>
              </div>
            </div>
          )}

          {/* Hero report — most recent, full card */}
          {heroReport && (() => {
            const photo = parseFirstPhoto(heroReport.mediaUrls);
            const preview = heroReport.personalNote || heroReport.content || '';
            const cleanPreview = renderClientPreview(preview, 160);
            const visitTime = heroReport.visitStarted
              ? `${formatTime(heroReport.visitStarted)}${heroReport.visitCompleted ? ` \u2013 ${formatTime(heroReport.visitCompleted)}` : ''}`
              : null;
            return (
              <div
                className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition"
                onClick={() => router.push(`/client/reports/${heroReport.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && router.push(`/client/reports/${heroReport.id}`)}
              >
                {photo ? (
                  <img src={photo} alt="Visit photo" className="w-full h-[200px] object-cover" />
                ) : (
                  <div className="h-16 bg-gradient-to-r from-accent-secondary to-accent-tertiary" />
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Latest report</p>
                    <p className="text-[11px] text-text-tertiary tabular-nums shrink-0">
                      {heroReport.createdAt ? formatDate(heroReport.createdAt) : '\u2014'}
                    </p>
                  </div>
                  <h3 className="text-[16px] font-semibold text-text-primary mt-1">
                    {heroReport.booking?.service || 'Visit report'}
                  </h3>
                  {(heroReport.sitterName || visitTime) && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {heroReport.sitterName && (
                        <p className="text-[12px] text-text-tertiary">with {heroReport.sitterName}</p>
                      )}
                      {visitTime && (
                        <p className="text-[12px] text-text-tertiary flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {visitTime}
                        </p>
                      )}
                    </div>
                  )}
                  {cleanPreview && (
                    <p className="text-[14px] text-text-secondary line-clamp-3 leading-relaxed mt-2">{cleanPreview}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-muted">
                    {heroReport.clientRating != null ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-status-warning-fill" />
                        <span className="text-[13px] font-semibold text-text-primary tabular-nums">{heroReport.clientRating}</span>
                        <span className="text-[12px] text-text-tertiary">/ 5</span>
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-accent-primary">Rate this visit</span>
                    )}
                    <span className="text-[12px] font-medium text-accent-primary">View full report</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Remaining reports — compact unified list */}
          {restReports.length > 0 && (
            <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Previous reports</h2>
                <span className="text-[11px] font-semibold text-text-disabled tabular-nums">{restReports.length}</span>
              </div>
              <div className="divide-y divide-border-muted">
                {restReports.map((report) => {
                  const photo = parseFirstPhoto(report.mediaUrls);
                  const visitTime = report.visitStarted
                    ? `${formatTime(report.visitStarted)}${report.visitCompleted ? ` \u2013 ${formatTime(report.visitCompleted)}` : ''}`
                    : null;
                  return (
                    <div
                      key={report.id}
                      className="flex items-center gap-3 px-5 py-3.5 min-h-[72px] cursor-pointer hover:bg-surface-secondary transition-colors"
                      onClick={() => router.push(`/client/reports/${report.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && router.push(`/client/reports/${report.id}`)}
                    >
                      {photo ? (
                        <img src={photo} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-accent-tertiary flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-accent-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-text-primary truncate">
                            {report.booking?.service || 'Visit report'}
                          </p>
                          {report.clientRating != null && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Star className="w-3 h-3 text-status-warning-fill" />
                              <span className="text-[11px] font-semibold text-text-secondary tabular-nums">{report.clientRating}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[12px] text-text-tertiary tabular-nums">
                            {report.createdAt ? formatDate(report.createdAt) : '\u2014'}
                          </p>
                          {report.sitterName && (
                            <p className="text-[12px] text-text-tertiary">{'\u00b7'} {report.sitterName}</p>
                          )}
                          {visitTime && (
                            <p className="text-[12px] text-text-tertiary">{'\u00b7'} {visitTime}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-disabled shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </LayoutWrapper>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse mt-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border-default bg-surface-primary p-4">
            <div className="h-3 w-14 rounded bg-surface-tertiary" />
            <div className="mt-3 h-7 w-8 rounded bg-surface-tertiary" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
        <div className="h-[200px] bg-surface-tertiary" />
        <div className="p-5 space-y-2">
          <div className="h-3 w-20 rounded bg-surface-tertiary" />
          <div className="h-5 w-32 rounded bg-surface-tertiary" />
          <div className="h-3 w-full rounded bg-surface-tertiary" />
          <div className="h-3 w-2/3 rounded bg-surface-tertiary" />
        </div>
      </div>
      <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="h-3 w-28 rounded bg-surface-tertiary" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <div className="w-12 h-12 rounded-xl bg-surface-tertiary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-surface-tertiary" />
              <div className="h-3 w-40 rounded bg-surface-tertiary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
