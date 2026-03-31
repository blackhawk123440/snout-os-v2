'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import {
  SitterCard,
  SitterCardBody,
  SitterPageHeader,
  SitterSkeletonList,
  SitterEmptyState,
  SitterErrorState,
} from '@/components/sitter';

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  bookingId: string;
  clientName?: string;
}

export default function SitterPetsPage() {
  const router = useRouter();
  const { data: pets = [], isLoading: loading, error: queryError, refetch } = useQuery<Pet[]>({
    queryKey: ['sitter', 'assigned-pets'],
    queryFn: async () => {
      const [todayRes, calRes] = await Promise.all([
        fetch('/api/sitter/today'),
        fetch('/api/sitter/calendar'),
      ]);
      const todayData = await todayRes.json().catch(() => ({}));
      const calData = await calRes.json().catch(() => ({}));
      if (!todayRes.ok && !calRes.ok) throw new Error('Unable to load pets');
      const allBookings = [
        ...(Array.isArray(todayData.bookings) ? todayData.bookings : []),
        ...(Array.isArray(calData.bookings) ? calData.bookings : []),
      ];
      const seen = new Set<string>();
      const petList: Pet[] = [];
      for (const b of allBookings) {
        for (const p of (b as any).pets || []) {
          if (p.id && !seen.has(p.id)) {
            seen.add(p.id);
            petList.push({
              id: p.id,
              name: p.name || p.species || 'Pet',
              species: p.species || 'Pet',
              breed: p.breed,
              bookingId: (b as any).id,
              clientName: (b as any).clientName,
            });
          }
        }
      }
      return petList;
    },
  });
  const error = queryError?.message || null;

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader
        title="Pets"
        subtitle="Pets you care for"
        action={
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={loading}>
            Refresh
          </Button>
        }
      />
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border-default bg-surface-primary p-4">
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-surface-tertiary" />
              <div className="h-4 w-3/4 rounded bg-surface-tertiary" />
            </div>
          ))}
        </div>
      ) : error ? (
        <SitterErrorState
          title="Couldn't load pets"
          subtitle={error}
          onRetry={() => void refetch()}
        />
      ) : pets.length === 0 ? (
        <SitterEmptyState
          title="No pets yet"
          subtitle="Pets from your bookings will appear here."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pets.map((pet) => (
            <SitterCard key={pet.id} onClick={() => router.push(`/sitter/pets/${pet.id}`)}>
              <SitterCardBody className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 min-w-[48px] items-center justify-center rounded-full bg-status-warning-bg text-lg font-semibold text-status-warning-text">
                  {(pet.name || '?').charAt(0).toUpperCase()}
                </div>
                <p className="truncate font-medium text-text-primary">{pet.name}</p>
                <p className="truncate text-xs text-text-tertiary">
                  {pet.species}
                  {pet.breed ? ` · ${pet.breed}` : ''}
                </p>
                {pet.clientName && (
                  <p className="mt-1 truncate text-xs text-text-disabled">{pet.clientName}</p>
                )}
              </SitterCardBody>
            </SitterCard>
          ))}
        </div>
      )}
    </div>
  );
}
