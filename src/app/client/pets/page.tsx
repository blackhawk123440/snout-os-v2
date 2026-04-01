'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PawPrint, Plus, ChevronRight } from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { AppCard, AppCardBody, AppCardHeader, AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';
import { useClientPets } from '@/lib/api/client-hooks';

export default function ClientPetsPage() {
  const router = useRouter();
  const { data, isLoading: loading, error, refetch } = useClientPets();
  const pets = data?.pets ?? [];

  return (
    <LayoutWrapper variant="narrow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight sm:text-2xl">
            Your pets
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">
            {pets.length > 0
              ? `${pets.length} pet${pets.length !== 1 ? 's' : ''} registered`
              : 'Your furry family'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClientRefreshButton onRefresh={refetch} loading={loading} />
          <Link href="/client/pets/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>Add pet</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <PetsSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load pets" subtitle={error.message || 'Unable to load pets'} onRetry={() => void refetch()} />
      ) : pets.length === 0 ? (
        <div className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.10),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
              <AppCardHeader title="Great care starts with a complete pet profile" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Add your pet’s basics first, then fill in routines, medications, and care notes so every sitter has the right context before the visit starts.</p>
                <p>The more complete the profile, the smoother bookings and handoffs become.</p>
              </AppCardBody>
            </AppCard>
            <AppCard>
              <AppCardHeader title="Best next moves" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Add your first pet so the care team can tailor visits correctly.</p>
                <p>Include breed, weight, and special instructions as soon as you have them.</p>
              </AppCardBody>
            </AppCard>
          </div>

          <div className="rounded-2xl bg-accent-tertiary p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
              <PawPrint className="h-7 w-7 text-text-inverse" />
            </div>
            <p className="text-xl font-bold text-text-primary">Add your first pet</p>
            <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
              Tell us about your pet so we can provide the best care.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/client/pets/new">
                <Button variant="primary" size="md">Add a pet</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.10),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
              <AppCardHeader title="Your pet profiles" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Each pet profile gives your care team the details they need before a visit, from identity and breed to special handling notes.</p>
                <p>Open a profile any time to review or update care information.</p>
              </AppCardBody>
            </AppCard>
            <AppCard>
              <AppCardHeader title="Best next moves" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Open each pet to confirm routines, medications, and safety notes stay current.</p>
                <p>Add another pet here any time your household changes.</p>
              </AppCardBody>
            </AppCard>
          </div>

          <div className="space-y-3">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm cursor-pointer hover:shadow-md transition"
              onClick={() => router.push(`/client/pets/${pet.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && router.push(`/client/pets/${pet.id}`)}
            >
              <div className="flex items-center gap-4">
                {pet.photoUrl ? (
                  <img src={pet.photoUrl} alt={pet.name || 'Pet'} className="w-16 h-16 rounded-2xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-accent-tertiary flex items-center justify-center shrink-0">
                    <span className="text-2xl font-bold text-accent-primary">{(pet.name || 'P')[0]}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-semibold text-text-primary truncate">{pet.name || 'Unnamed pet'}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {pet.species && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary">
                        {pet.species}
                      </span>
                    )}
                    {pet.breed && (
                      <span className="text-[12px] text-text-tertiary truncate">{pet.breed}</span>
                    )}
                  </div>
                  {pet.weight && <p className="text-[12px] text-text-tertiary mt-1">{pet.weight} lbs</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-text-disabled shrink-0" />
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
}

function PetsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse mt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border-default bg-surface-primary p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-tertiary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-28 rounded bg-surface-tertiary" />
              <div className="flex gap-2">
                <div className="h-5 w-12 rounded-full bg-surface-tertiary" />
                <div className="h-5 w-20 rounded bg-surface-tertiary" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
