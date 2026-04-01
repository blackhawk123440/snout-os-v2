'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { LayoutWrapper } from '@/components/layout';
import { toastError } from '@/lib/toast';
import {
  SitterCard,
  SitterCardHeader,
  SitterCardBody,
  SitterPageHeader,
  SitterSkeletonList,
  SitterErrorState,
  AvailabilityGrid,
} from '@/components/sitter';
import { Calendar, X } from 'lucide-react';
import {
  useSitterAvailabilityFull,
  useToggleSitterAvailability,
  useCreateAvailabilityOverride,
  useDeleteAvailabilityOverride,
} from '@/lib/api/sitter-portal-hooks';

interface AvailabilityOverride {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export default function SitterAvailabilityPage() {
  const { data, isLoading: loading, error, refetch } = useSitterAvailabilityFull();
  const availabilityEnabled = data?.availabilityEnabled ?? true;
  const overrides: AvailabilityOverride[] = Array.isArray(data?.overrides) ? data.overrides : [];

  const toggleMutation = useToggleSitterAvailability();
  const createOverrideMutation = useCreateAvailabilityOverride();
  const deleteOverrideMutation = useDeleteAvailabilityOverride();

  const [overrideDate, setOverrideDate] = useState('');
  const [overrideAvailable, setOverrideAvailable] = useState(false);
  const [overrideStart, setOverrideStart] = useState('09:00');
  const [overrideEnd, setOverrideEnd] = useState('17:00');

  const toggleAvailability = () => {
    toggleMutation.mutate(!availabilityEnabled, {
      onError: () => toastError('Failed to update'),
    });
  };

  const addOverride = () => {
    if (!overrideDate) return;
    createOverrideMutation.mutate(
      { date: overrideDate, startTime: overrideStart, endTime: overrideEnd, isAvailable: overrideAvailable },
      {
        onSuccess: () => setOverrideDate(''),
        onError: (e) => toastError(e instanceof Error ? e.message : 'Failed to add override'),
      },
    );
  };

  const removeOverride = (id: string) => {
    deleteOverrideMutation.mutate(id, {
      onError: () => toastError('Failed to remove override'),
    });
  };

  return (
    <LayoutWrapper variant="narrow">
      <SitterPageHeader
        title="Availability"
        subtitle="When you're available for bookings"
        action={
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <SitterSkeletonList count={2} />
      ) : error ? (
        <SitterErrorState
          title="Couldn't load availability"
          subtitle={error instanceof Error ? error.message : String(error)}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SitterCard>
              <SitterCardBody>
                <p className="text-sm font-semibold text-text-primary">Availability should stay easy to trust</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  The team needs a clear picture of when you are open for work. Keep your weekly pattern current, then use overrides for the days that need special handling.
                </p>
              </SitterCardBody>
            </SitterCard>
            <SitterCard>
              <SitterCardBody>
                <p className="text-sm font-semibold text-text-primary">Best next moves</p>
                <div className="mt-2 space-y-2 text-sm text-text-secondary">
                  <p>Turn off availability when you need a clean pause from new assignments.</p>
                  <p>Use date overrides for vacations, appointments, or unusual one-off openings.</p>
                </div>
              </SitterCardBody>
            </SitterCard>
          </div>

          {/* Master toggle */}
          <SitterCard>
            <SitterCardBody>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-text-primary">Available for new bookings</p>
                  <p className="text-sm text-text-tertiary">When off, you won&apos;t receive new assignments</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={availabilityEnabled}
                  onClick={() => void toggleAvailability()}
                  disabled={toggleMutation.isPending}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 disabled:opacity-50 ${
                    availabilityEnabled ? 'bg-accent-primary' : 'bg-surface-tertiary'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-primary shadow ring-0 transition ${
                      availabilityEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </SitterCardBody>
          </SitterCard>

          {/* Weekly availability grid */}
          <SitterCard>
            <SitterCardHeader>
              <p className="font-medium text-text-primary">Weekly schedule</p>
            </SitterCardHeader>
            <SitterCardBody>
              <p className="mb-4 text-sm text-text-tertiary">
                Tap a cell to mark when you&apos;re available. Changes save automatically.
              </p>
              <AvailabilityGrid />
            </SitterCardBody>
          </SitterCard>

          {/* Date overrides */}
          <SitterCard>
            <SitterCardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-text-tertiary" />
                <p className="font-medium text-text-primary">Date overrides</p>
              </div>
            </SitterCardHeader>
            <SitterCardBody>
              <p className="mb-4 text-sm text-text-tertiary leading-relaxed">
                Override your weekly schedule for a specific date — this replaces your weekly rule for that day only.
              </p>

              <div className="space-y-3">
                {/* Date field */}
                <div>
                  <label htmlFor="override-date" className="block text-xs font-medium text-text-secondary mb-1">
                    Date
                  </label>
                  <input
                    id="override-date"
                    type="date"
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                </div>

                {/* Available/Unavailable toggle */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Status for this date
                  </label>
                  <button
                    type="button"
                    onClick={() => setOverrideAvailable(!overrideAvailable)}
                    className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      overrideAvailable
                        ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                        : 'border-status-danger-border bg-status-danger-bg text-status-danger-text'
                    }`}
                  >
                    {overrideAvailable ? 'Available' : 'Unavailable all day'}
                  </button>
                </div>

                {/* Time range (only when marking as available) */}
                {overrideAvailable && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="override-start" className="block text-xs font-medium text-text-secondary mb-1">
                        From
                      </label>
                      <input
                        id="override-start"
                        type="time"
                        value={overrideStart}
                        onChange={(e) => setOverrideStart(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="override-end" className="block text-xs font-medium text-text-secondary mb-1">
                        To
                      </label>
                      <input
                        id="override-end"
                        type="time"
                        value={overrideEnd}
                        onChange={(e) => setOverrideEnd(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Add button */}
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void addOverride()}
                  disabled={!overrideDate || createOverrideMutation.isPending}
                  className="w-full"
                >
                  {createOverrideMutation.isPending ? 'Adding...' : 'Add override'}
                </Button>
              </div>

              {/* Existing overrides list */}
              {overrides.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {overrides.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between rounded-lg border border-border-default bg-surface-secondary px-3 py-2.5 text-sm"
                    >
                      <div>
                        <span className="font-medium text-text-primary">
                          {new Date(o.date + 'T12:00:00').toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="ml-2 text-text-tertiary">
                          {o.isAvailable ? `${o.startTime} – ${o.endTime}` : 'Unavailable all day'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeOverride(o.id)}
                        disabled={deleteOverrideMutation.isPending}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-tertiary hover:bg-status-danger-bg hover:text-status-danger-text transition"
                        aria-label="Remove override"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SitterCardBody>
          </SitterCard>
        </div>
      )}
    </LayoutWrapper>
  );
}
