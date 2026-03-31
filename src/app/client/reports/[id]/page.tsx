'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Footprints, Droplets, UtensilsCrossed,
  GlassWater, Pill, Heart, PawPrint, MapPin, AlertTriangle, Clock,
} from 'lucide-react';
import { LayoutWrapper } from '@/components/layout';
import {
  AppCard,
  AppCardBody,
  AppPageHeader,
  AppSkeletonList,
  AppErrorState,
} from '@/components/app';
import { toastSuccess, toastError } from '@/lib/toast';
import { useClientReportDetail, useRateReport } from '@/lib/api/client-hooks';
import { formatServiceName } from '@/lib/format-utils';

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
const formatTime = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

function parseMediaUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

export default function ClientReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: report, isLoading: loading, error, refetch } = useClientReportDetail(id);

  if (loading) {
    return (
      <LayoutWrapper variant="narrow">
        <AppPageHeader title="Visit report" />
        <AppSkeletonList count={3} />
      </LayoutWrapper>
    );
  }

  if (error || !report) {
    return (
      <LayoutWrapper variant="narrow">
        <AppPageHeader title="Visit report" />
        <AppErrorState title="Couldn't load report" subtitle={error?.message || ''} onRetry={() => void refetch()} />
      </LayoutWrapper>
    );
  }

  const photos = parseMediaUrls(report.mediaUrls);
  const heroPhoto = photos[0] ?? null;
  const otherPhotos = photos.slice(1);
  const petName = report.booking?.pets?.[0]?.name || 'Pet';
  const petSpecies = report.booking?.pets?.[0]?.species || '';

  let durationText: string | null = null;
  if (report.visitStarted && report.visitCompleted) {
    const diff = new Date(report.visitCompleted).getTime() - new Date(report.visitStarted).getTime();
    const mins = Math.round(diff / 60000);
    if (mins > 0) durationText = `${mins} min`;
  }

  const contentLower = (report.content || '').toLowerCase();
  const hasHealthAlert = contentLower.includes('alert') || contentLower.includes('concern') ||
    contentLower.includes('limping') || contentLower.includes('emergency') || contentLower.includes('refused');
  const medAlert = report.medicationNotes?.toLowerCase();
  const isMedAlert = medAlert === 'refused' || medAlert === 'not given';

  const iconCls = "w-4 h-4";
  const details: Array<{ icon: React.ReactNode; label: string; value: string; isAlert?: boolean }> = [];
  if (report.walkDuration) details.push({ icon: <Footprints className={iconCls} />, label: 'Walk', value: `${report.walkDuration} minutes` });
  if (report.pottyNotes) details.push({ icon: <Droplets className={iconCls} />, label: 'Potty', value: report.pottyNotes });
  if (report.foodNotes) details.push({ icon: <UtensilsCrossed className={iconCls} />, label: 'Food', value: report.foodNotes });
  if (report.waterNotes) details.push({ icon: <GlassWater className={iconCls} />, label: 'Water', value: report.waterNotes });
  if (report.medicationNotes) details.push({ icon: <Pill className={iconCls} />, label: 'Medication', value: report.medicationNotes, isAlert: isMedAlert });
  if (report.behaviorNotes) details.push({ icon: <Heart className={iconCls} />, label: 'Behavior', value: report.behaviorNotes });

  return (
    <LayoutWrapper variant="narrow">
      <AppPageHeader
        title={report.booking?.service ? formatServiceName(report.booking.service) : 'Visit report'}
        subtitle={report.createdAt ? formatDate(report.createdAt) : ''}
        action={
          <button
            type="button"
            onClick={() => router.back()}
            className="min-h-[44px] text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Back
          </button>
        }
      />

      <div className="space-y-4 pb-8">
        {hasHealthAlert && (
          <div className="flex items-center gap-3 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-status-warning-text shrink-0" />
            <div>
              <p className="text-sm font-semibold text-status-warning-text">Health concern noted</p>
              <p className="text-xs text-status-warning-text-secondary">Your sitter flagged a concern during this visit. Review the details below.</p>
            </div>
          </div>
        )}

        {heroPhoto && (
          <AppCard className="overflow-hidden !p-0 lg:!p-0">
            <button
              type="button"
              onClick={() => setLightboxUrl(heroPhoto)}
              className="block w-full"
              aria-label="View photo fullscreen"
            >
              <img
                src={heroPhoto}
                alt={`${petName} visit photo`}
                className="w-full max-h-[400px] object-cover"
              />
            </button>
            {otherPhotos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto p-3 scrollbar-thin">
                {otherPhotos.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setLightboxUrl(url)}
                    className="shrink-0"
                    aria-label={`View photo ${i + 2}`}
                  >
                    <img
                      src={url}
                      alt={`Visit photo ${i + 2}`}
                      className="h-20 w-20 rounded-lg object-cover border border-border-default"
                    />
                  </button>
                ))}
              </div>
            )}
          </AppCard>
        )}

        <AppCard>
          <AppCardBody>
            <div className="flex items-center gap-3">
              {!heroPhoto && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-text-tertiary">
                  <PawPrint className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-text-primary">{petName}&apos;s Visit Report</h2>
                <p className="text-sm text-text-secondary">
                  {report.booking?.service ? formatServiceName(report.booking.service) : ''}
                  {report.createdAt && ` \u00b7 ${formatDate(report.createdAt)}`}
                </p>
                {report.sitterName && (
                  <p className="text-sm text-text-tertiary">with {report.sitterName}</p>
                )}
              </div>
            </div>
            {(report.visitStarted || report.booking?.startAt) && (
              <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  {formatTime(report.visitStarted || report.booking?.startAt || null)}
                  {(report.visitCompleted || report.booking?.endAt) && (
                    <> {'\u2192'} {formatTime(report.visitCompleted || report.booking?.endAt || null)}</>
                  )}
                  {durationText && <span className="text-text-tertiary"> ({durationText})</span>}
                </span>
              </div>
            )}
          </AppCardBody>
        </AppCard>

        {/* GPS Visit Proof */}
        {(report.checkInLat || report.checkOutLat) && (
          <AppCard>
            <AppCardBody>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-text-tertiary" />
                <h3 className="text-sm font-semibold text-text-primary">Visit location proof</h3>
              </div>
              <div className="space-y-2">
                {report.checkInLat && report.checkInLng && (
                  <div className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-text-secondary">Arrived</p>
                      <p className="text-xs text-text-tertiary">
                        {report.visitStarted ? formatTime(report.visitStarted) : '—'}
                      </p>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${report.checkInLat},${report.checkInLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-accent-primary hover:underline"
                    >
                      View on map
                    </a>
                  </div>
                )}
                {report.checkOutLat && report.checkOutLng && (
                  <div className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-text-secondary">Departed</p>
                      <p className="text-xs text-text-tertiary">
                        {report.visitCompleted ? formatTime(report.visitCompleted) : '—'}
                      </p>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${report.checkOutLat},${report.checkOutLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-accent-primary hover:underline"
                    >
                      View on map
                    </a>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-text-disabled mt-2">
                Location captured automatically when your sitter starts and ends the visit.
              </p>
            </AppCardBody>
          </AppCard>
        )}

        {details.length > 0 && (
          <AppCard>
            <AppCardBody>
              <div className="space-y-3">
                {details.map((d) => (
                  <div
                    key={d.label}
                    className={`flex items-start gap-3 ${d.isAlert ? 'rounded-lg border border-status-warning-border bg-status-warning-bg p-2' : ''}`}
                  >
                    <span className={`shrink-0 mt-0.5 ${d.isAlert ? 'text-status-warning-text' : 'text-text-tertiary'}`}>
                      {d.isAlert ? <AlertTriangle className="w-4 h-4" /> : d.icon}
                    </span>
                    <div>
                      <p className={`text-xs font-medium ${d.isAlert ? 'text-status-warning-text-secondary' : 'text-text-tertiary'}`}>
                        {d.label}{d.isAlert ? ' — Health concern noted' : ''}
                      </p>
                      <p className={`text-sm ${d.isAlert ? 'text-status-warning-text font-medium' : 'text-text-primary'}`}>{d.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AppCardBody>
          </AppCard>
        )}

        {details.length === 0 && report.content && (
          <AppCard>
            <AppCardBody>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{report.content}</p>
            </AppCardBody>
          </AppCard>
        )}

        {report.personalNote && (
          <AppCard>
            <AppCardBody>
              <div className="rounded-lg bg-surface-secondary p-4">
                <p className="text-sm text-text-primary italic whitespace-pre-wrap">
                  &ldquo;{report.personalNote}&rdquo;
                </p>
                {report.sitterName && (
                  <p className="mt-2 text-xs font-medium text-text-tertiary text-right">
                    &mdash; {report.sitterName}
                  </p>
                )}
              </div>
            </AppCardBody>
          </AppCard>
        )}

        <RatingSection
          reportId={id}
          currentRating={report.clientRating}
          currentFeedback={report.clientFeedback}
          onRated={refetch}
        />
      </div>

      {lightboxUrl && (
        <PhotoLightbox
          photos={photos}
          initialUrl={lightboxUrl}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </LayoutWrapper>
  );
}

/* ─── Rating Section ────────────────────────────────────────────────── */

function RatingSection({
  reportId,
  currentRating,
  currentFeedback,
  onRated,
}: {
  reportId: string;
  currentRating: number | null;
  currentFeedback: string | null;
  onRated: () => void;
}) {
  const rateMutation = useRateReport(reportId);
  const [rating, setRating] = useState(currentRating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [feedback, setFeedback] = useState(currentFeedback ?? '');
  const [showFeedback, setShowFeedback] = useState(!!currentFeedback);
  const isRated = currentRating !== null;

  const handleRate = async (stars: number) => {
    if (isRated) return;
    setRating(stars);
    try {
      await rateMutation.mutateAsync({ rating: stars, feedback: feedback.trim() || undefined });
      toastSuccess('Thanks for the feedback!');
      onRated();
    } catch {
      toastError('Failed to save rating');
      setRating(0);
    }
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    try {
      await rateMutation.mutateAsync({ rating: rating || currentRating || 5, feedback: feedback.trim() });
      toastSuccess('Feedback saved');
      onRated();
    } catch { /* silent */ }
  };

  return (
    <AppCard>
      <AppCardBody>
        <p className="text-sm font-semibold text-text-primary mb-3">
          {isRated ? 'Your rating' : 'How was this visit?'}
        </p>

        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const active = star <= (hovered || rating);
            return (
              <button
                key={star}
                type="button"
                onClick={() => !isRated && handleRate(star)}
                onMouseEnter={() => !isRated && setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                disabled={rateMutation.isPending || isRated}
                className={`min-h-[44px] min-w-[44px] text-2xl transition ${
                  active ? 'text-status-warning-fill' : 'text-surface-tertiary'
                } ${isRated ? 'cursor-default' : 'hover:scale-110 cursor-pointer'}`}
                aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              >
                {'\u2605'}
              </button>
            );
          })}
        </div>

        {isRated && currentFeedback && (
          <p className="mt-2 text-sm text-text-secondary italic">&ldquo;{currentFeedback}&rdquo;</p>
        )}

        {!isRated && (
          <>
            {!showFeedback ? (
              <button
                type="button"
                onClick={() => setShowFeedback(true)}
                className="mt-2 min-h-[44px] text-sm font-medium text-accent-primary hover:underline"
              >
                Add feedback
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Any comments about the visit?"
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none resize-y"
                />
              </div>
            )}
          </>
        )}
      </AppCardBody>
    </AppCard>
  );
}

/* ─── Photo Lightbox ────────────────────────────────────────────────── */

function PhotoLightbox({
  photos,
  initialUrl,
  onClose,
}: {
  photos: string[];
  initialUrl: string;
  onClose: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(
    Math.max(0, photos.indexOf(initialUrl))
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCurrentIdx((i) => Math.min(photos.length - 1, i + 1));
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [photos.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface-primary/20 text-text-inverse text-lg hover:bg-surface-primary/30 transition"
        aria-label="Close"
      >
        {'\u00d7'}
      </button>

      {currentIdx > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCurrentIdx((i) => i - 1); }}
          className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface-primary/20 text-text-inverse hover:bg-surface-primary/30 transition"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <img
        src={photos[currentIdx]}
        alt={`Photo ${currentIdx + 1} of ${photos.length}`}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {currentIdx < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCurrentIdx((i) => i + 1); }}
          className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface-primary/20 text-text-inverse hover:bg-surface-primary/30 transition"
          aria-label="Next photo"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-surface-primary/20 px-3 py-1 text-xs text-text-inverse">
          {currentIdx + 1} / {photos.length}
        </div>
      )}
    </div>
  );
}
