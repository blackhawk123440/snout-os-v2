'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Plus, SkipForward, Pencil } from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatServiceName } from '@/lib/format-utils';
import {
  useClientRecurringSchedules,
  useUpdateRecurringSchedule,
  useCancelRecurringSchedule,
} from '@/lib/api/client-hooks';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function statusChip(s: string) {
  switch (s) {
    case 'active': return 'bg-status-success-bg text-status-success-text';
    case 'paused': return 'bg-status-warning-bg text-status-warning-text';
    case 'pending': return 'bg-status-info-bg text-status-info-text';
    case 'cancelled': return 'bg-surface-tertiary text-text-secondary';
    default: return 'bg-surface-tertiary text-text-secondary';
  }
}

export default function ClientRecurringPage() {
  const { data, isLoading, error, refetch } = useClientRecurringSchedules();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<{ scheduleId: string; schedule: any } | null>(null);
  const [skipDate, setSkipDate] = useState('');
  const [skipLoading, setSkipLoading] = useState(false);
  const [skipSuccess, setSkipSuccess] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: string; schedule: any } | null>(null);
  const [editForm, setEditForm] = useState({ startTime: '', endTime: '', frequency: '', daysOfWeek: [] as number[] });
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  const cancelMutation = useCancelRecurringSchedule(cancelId || '');
  const pauseMutation = useUpdateRecurringSchedule(actionId || '');
  const skipMutation = useUpdateRecurringSchedule(skipTarget?.scheduleId || '');

  const schedules = data?.schedules ?? [];
  const active = schedules.filter((s: any) => s.status === 'active' || s.status === 'pending');
  const inactive = schedules.filter((s: any) => s.status === 'paused' || s.status === 'cancelled');

  async function handlePauseResume(id: string, currentStatus: string) {
    setActionId(id);
    try {
      await pauseMutation.mutateAsync({
        action: currentStatus === 'active' ? 'pause' : 'resume',
      });
    } catch {}
    setActionId(null);
  }

  async function handleCancel() {
    if (!cancelId) return;
    try {
      await cancelMutation.mutateAsync();
    } catch {}
    setCancelId(null);
  }

  const openSkipModal = useCallback((schedule: any) => {
    // Default to next upcoming date based on schedule days
    const today = new Date();
    const days: number[] = schedule.daysOfWeek || [];
    let nextDate = '';
    if (days.length > 0) {
      for (let i = 1; i <= 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        if (days.includes(d.getDay())) {
          nextDate = d.toISOString().split('T')[0];
          break;
        }
      }
    }
    setSkipDate(nextDate);
    setSkipSuccess(false);
    setSkipTarget({ scheduleId: schedule.id, schedule });
  }, []);

  async function handleSkip() {
    if (!skipTarget || !skipDate) return;
    setSkipLoading(true);
    try {
      await skipMutation.mutateAsync({ action: 'skip', skipDate });
      setSkipSuccess(true);
      setTimeout(() => { setSkipTarget(null); setSkipSuccess(false); }, 1500);
    } catch {}
    setSkipLoading(false);
  }

  const editMutation = useUpdateRecurringSchedule(editTarget?.id || '');

  const openEditModal = useCallback((schedule: any) => {
    setEditForm({
      startTime: schedule.startTime || '09:00',
      endTime: schedule.endTime || '10:00',
      frequency: schedule.frequency || 'weekly',
      daysOfWeek: schedule.daysOfWeek || [],
    });
    setEditSuccess(false);
    setEditTarget({ id: schedule.id, schedule });
  }, []);

  async function handleEditSave() {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      await editMutation.mutateAsync({
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        frequency: editForm.frequency,
        daysOfWeek: editForm.daysOfWeek,
      });
      setEditSuccess(true);
      setTimeout(() => { setEditTarget(null); setEditSuccess(false); }, 1500);
    } catch {}
    setEditLoading(false);
  }

  function toggleDay(day: number) {
    setEditForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day].sort(),
    }));
  }

  return (
    <LayoutWrapper variant="narrow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight sm:text-2xl">
            Recurring bookings
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">
            {schedules.length > 0
              ? `${active.length} active schedule${active.length !== 1 ? 's' : ''}`
              : 'Manage your regular pet care'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClientRefreshButton onRefresh={refetch} />
          {schedules.length > 0 && (
            <Link href="/client/bookings/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>New</Button>
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <RecurringSkeleton />
      ) : error ? (
        <AppErrorState message="Could not load recurring schedules." onRetry={refetch} />
      ) : schedules.length === 0 ? (
        <div className="rounded-2xl bg-accent-tertiary p-8 text-center mt-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
            <RefreshCw className="h-7 w-7 text-text-inverse" />
          </div>
          <p className="text-xl font-bold text-text-primary">No recurring schedules</p>
          <p className="mt-2 text-sm text-text-secondary max-w-[300px] mx-auto leading-relaxed">
            Set up a regular schedule so you never have to rebook the same service.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/client/bookings/new">
              <Button variant="primary" size="md">Book a visit</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          {active.length > 0 && (
            <section>
              <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Active schedules
              </h2>
              <div className="space-y-3">
                {active.map((s: any) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    onPauseResume={() => handlePauseResume(s.id, s.status)}
                    onCancel={() => setCancelId(s.id)}
                    onSkip={() => openSkipModal(s)}
                    onEdit={() => openEditModal(s)}
                    actionLoading={actionId === s.id}
                  />
                ))}
              </div>
            </section>
          )}

          {inactive.length > 0 && (
            <section>
              <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Paused &amp; cancelled
              </h2>
              <div className="space-y-3">
                {inactive.map((s: any) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    onPauseResume={() => handlePauseResume(s.id, s.status)}
                    onCancel={() => setCancelId(s.id)}
                    onSkip={() => openSkipModal(s)}
                    onEdit={() => openEditModal(s)}
                    actionLoading={actionId === s.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel Recurring Schedule"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            This will cancel the recurring schedule and all future bookings associated with it.
            Completed visits will not be affected.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setCancelId(null)}>
              Keep Schedule
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              isLoading={cancelMutation.isPending}
            >
              Cancel Schedule
            </Button>
          </div>
        </div>
      </Modal>

      {/* Skip occurrence modal */}
      <Modal
        isOpen={!!skipTarget}
        onClose={() => !skipLoading && setSkipTarget(null)}
        title="Skip a visit"
      >
        <div className="space-y-4">
          {skipSuccess ? (
            <div className="flex items-center gap-2 rounded-lg bg-status-success-bg px-3 py-3">
              <span className="text-sm font-medium text-status-success-text">Visit skipped.</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                Skip a single visit without pausing your recurring schedule.
                The skipped booking will be cancelled but future visits continue as normal.
              </p>
              {skipTarget?.schedule && (
                <div className="rounded-xl bg-surface-secondary px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {formatServiceName(skipTarget.schedule.service)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {skipTarget.schedule.frequency} schedule
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Date to skip
                </label>
                <input
                  type="date"
                  value={skipDate}
                  onChange={(e) => setSkipDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" size="sm" onClick={() => setSkipTarget(null)} disabled={skipLoading}>
                  Never mind
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSkip}
                  isLoading={skipLoading}
                  disabled={!skipDate}
                  leftIcon={<SkipForward className="w-3.5 h-3.5" />}
                >
                  Skip this visit
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
      {/* Edit schedule modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => !editLoading && setEditTarget(null)}
        title="Edit schedule"
      >
        <div className="space-y-4">
          {editSuccess ? (
            <div className="flex items-center gap-2 rounded-lg bg-status-success-bg px-3 py-3">
              <span className="text-sm font-medium text-status-success-text">Schedule updated. Future bookings will be adjusted.</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                Changes apply to all future bookings. Completed visits are not affected.
              </p>

              {/* Frequency */}
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Frequency</label>
                <select
                  value={editForm.frequency}
                  onChange={(e) => setEditForm((f) => ({ ...f, frequency: e.target.value }))}
                  className="w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Days of week */}
              {editForm.frequency !== 'daily' && (
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Days</label>
                  <div className="flex gap-1.5">
                    {DAY_LABELS.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          editForm.daysOfWeek.includes(i)
                            ? 'bg-accent-primary text-text-inverse'
                            : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary'
                        }`}
                      >
                        {label[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Start time</label>
                  <input
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">End time</label>
                  <input
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <Button variant="secondary" size="sm" onClick={() => setEditTarget(null)} disabled={editLoading}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleEditSave} isLoading={editLoading}>
                  Save changes
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </LayoutWrapper>
  );
}

function ScheduleCard({
  schedule,
  onPauseResume,
  onCancel,
  onSkip,
  onEdit,
  actionLoading,
}: {
  schedule: any;
  onPauseResume: () => void;
  onCancel: () => void;
  onSkip: () => void;
  onEdit: () => void;
  actionLoading: boolean;
}) {
  const days: number[] = schedule.daysOfWeek || [];
  const dayLabels = days.length > 0
    ? days.map((d: number) => DAY_LABELS[d]).join(', ')
    : schedule.frequency;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-tertiary text-sm font-bold text-accent-primary mt-0.5">
            {(schedule.service || 'S')[0]}
          </div>
          <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-semibold text-text-primary truncate">
              {formatServiceName(schedule.service)}
            </h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusChip(schedule.status)}`}>
              {schedule.status}
            </span>
          </div>
          <p className="text-[13px] text-text-secondary">
            {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} {'\u00b7'} {dayLabels}
          </p>
          <p className="text-[13px] text-text-secondary">
            {formatTime(schedule.startTime)} {'\u2013'} {formatTime(schedule.endTime)}
          </p>
          {schedule.totalPrice > 0 && (
            <p className="text-[14px] font-semibold text-text-primary mt-1.5 tabular-nums">
              ${schedule.totalPrice.toFixed(2)} per visit
            </p>
          )}
          {schedule.effectiveUntil && (
            <p className="text-[12px] text-text-tertiary mt-1">
              Until {new Date(schedule.effectiveUntil).toLocaleDateString()}
            </p>
          )}
          </div>
        </div>
        {schedule.status !== 'cancelled' && (
          <div className="flex items-center gap-2 shrink-0">
            {schedule.status === 'active' && (
              <>
                <Button variant="secondary" size="sm" onClick={onEdit} leftIcon={<Pencil className="w-3.5 h-3.5" />}>
                  Edit
                </Button>
                <Button variant="secondary" size="sm" onClick={onSkip} leftIcon={<SkipForward className="w-3.5 h-3.5" />}>
                  Skip
                </Button>
              </>
            )}
            {(schedule.status === 'active' || schedule.status === 'paused') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onPauseResume}
                isLoading={actionLoading}
              >
                {schedule.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              className="text-status-danger-text hover:text-status-danger-text"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecurringSkeleton() {
  return (
    <div className="space-y-3 animate-pulse mt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border-default bg-surface-primary p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-32 rounded bg-surface-tertiary" />
            <div className="h-5 w-14 rounded-full bg-surface-tertiary" />
          </div>
          <div className="h-3 w-48 rounded bg-surface-tertiary mt-2" />
          <div className="h-3 w-36 rounded bg-surface-tertiary mt-2" />
        </div>
      ))}
    </div>
  );
}
