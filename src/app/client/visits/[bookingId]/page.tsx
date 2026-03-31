'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LayoutWrapper } from '@/components/layout';
import { AppErrorState, AppSkeletonList } from '@/components/app';
import { SitterTrustBadge } from '@/components/client/SitterTrustBadge';
import Link from 'next/link';
import { Camera, Clock, MapPin, Heart, Check, ArrowLeft } from 'lucide-react';

interface VisitCardData {
  id: string;
  sitterName: string;
  sitterProfile?: { tierLabel: string | null; statements: string[] } | null;
  petNames: string;
  service: string;
  date: string;
  checkInAt: string;
  checkOutAt: string;
  durationMinutes: number;
  checkInLat?: number | null;
  checkInLng?: number | null;
  photos: string[];
  petChecklists: Array<{
    petName?: string;
    food?: string;
    water?: string;
    potty?: string;
    meds?: string;
    behavior?: string;
  }>;
  sitterNote?: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function ChecklistItem({ label, value }: { label: string; value?: string }) {
  if (!value || value === 'N/A') return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Check className="h-3.5 w-3.5 text-status-success-text shrink-0" />
      <span className="text-text-secondary">{label}:</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  );
}

export default function VisitCardPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params?.bookingId as string;

  const { data: card, isLoading, error, refetch } = useQuery<VisitCardData>({
    queryKey: ['client', 'visit-card', bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/client/visits/${bookingId}`);
      if (!res.ok) throw new Error('Visit card not found');
      return res.json();
    },
    enabled: !!bookingId,
  });

  if (isLoading) {
    return (
      <LayoutWrapper variant="narrow">
        <AppSkeletonList count={4} />
      </LayoutWrapper>
    );
  }

  if (error || !card) {
    return (
      <LayoutWrapper variant="narrow">
        <AppErrorState
          message="Visit card not found"
          subtitle="This visit card may not be ready yet."
          onRetry={() => void refetch()}
        />
      </LayoutWrapper>
    );
  }

  const hasGps = card.checkInLat != null && card.checkInLng != null;
  const staticMapUrl = hasGps
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${card.checkInLat},${card.checkInLng}&zoom=15&size=600x200&scale=2&markers=color:red%7C${card.checkInLat},${card.checkInLng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}`
    : null;

  return (
    <LayoutWrapper variant="narrow">
      <div className="space-y-6 pb-8">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Visit Report
          </p>
          <h1 className="mt-1 text-xl font-bold text-text-primary">
            {card.sitterName} visited {card.petNames}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {formatDate(card.date)}
          </p>
        </div>

        {/* Duration + time badge */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 rounded-full bg-accent-tertiary px-4 py-1.5">
            <Clock className="h-4 w-4 text-accent-primary" />
            <span className="text-sm font-semibold text-accent-primary">
              {card.durationMinutes} min
            </span>
          </div>
          <span className="text-sm text-text-tertiary">
            {formatTime(card.checkInAt)} – {formatTime(card.checkOutAt)}
          </span>
        </div>

        {/* GPS Map */}
        {staticMapUrl && process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
          <div className="overflow-hidden rounded-xl border border-border-default">
            <div className="flex items-center gap-1.5 bg-surface-secondary px-3 py-2 text-xs text-text-tertiary">
              <MapPin className="h-3 w-3" /> Visit location verified by GPS
            </div>
            <img
              src={staticMapUrl}
              alt="Visit location map"
              className="w-full h-[160px] object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Photos */}
        {card.photos.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Camera className="h-4 w-4 text-text-tertiary" />
              <span className="text-sm font-medium text-text-secondary">
                {card.photos.length} photo{card.photos.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {card.photos.slice(0, 6).map((url, i) => (
                <div
                  key={i}
                  className={`overflow-hidden rounded-xl border border-border-default ${
                    i === 0 && card.photos.length > 1 ? 'col-span-2' : ''
                  }`}
                >
                  <img
                    src={url}
                    alt={`Visit photo ${i + 1}`}
                    className={`w-full object-cover ${
                      i === 0 && card.photos.length > 1 ? 'h-[240px]' : 'h-[160px]'
                    }`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pet checklists */}
        {card.petChecklists.length > 0 && (
          <div className="space-y-3">
            {card.petChecklists.map((pet, i) => (
              <div
                key={i}
                className="rounded-xl border border-border-default bg-surface-primary p-4"
              >
                <p className="text-sm font-semibold text-text-primary mb-2">
                  {pet.petName || `Pet ${i + 1}`}
                </p>
                <div className="space-y-1">
                  <ChecklistItem label="Food" value={pet.food} />
                  <ChecklistItem label="Water" value={pet.water} />
                  <ChecklistItem label="Potty" value={pet.potty} />
                  <ChecklistItem label="Medication" value={pet.meds} />
                  {pet.behavior && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      Behavior: {pet.behavior}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sitter note */}
        {card.sitterNote && (
          <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 p-5">
            <div className="flex items-center gap-1.5 mb-2">
              <Heart className="h-4 w-4 text-accent-primary" />
              <span className="text-xs font-medium text-accent-primary">
                Note from {card.sitterName.split(' ')[0]}
              </span>
            </div>
            <blockquote className="text-sm leading-relaxed text-text-primary italic">
              &ldquo;{card.sitterNote}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Trust badge */}
        {card.sitterProfile?.tierLabel && (
          <SitterTrustBadge
            tierLabel={card.sitterProfile.tierLabel}
            statements={card.sitterProfile.statements || []}
            sitterName={card.sitterName.split(' ')[0]}
          />
        )}

        {/* Link to pet timeline */}
        {(card as any).pets?.length > 0 && (
          <Link
            href={`/client/pets/${(card as any).pets[0].id}?tab=timeline`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border-default bg-surface-primary px-4 py-3 text-sm font-medium text-accent-primary transition hover:bg-surface-secondary"
          >
            See {(card as any).pets[0].name || 'pet'}&apos;s full history &rarr;
          </Link>
        )}
      </div>
    </LayoutWrapper>
  );
}
