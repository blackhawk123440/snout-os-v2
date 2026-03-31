'use client';

/**
 * Calendar Repair - Owner/admin tool to repair Google Calendar sync for a sitter.
 * One-way Snout OS → Google. Repairs drift when events were deleted in Google.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppCard, AppCardBody, AppErrorState } from '@/components/app';
import { Button, EmptyState, TableSkeleton } from '@/components/ui';

interface SitterOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface RepairResult {
  success: boolean;
  jobId?: string;
  message?: string;
  range?: { start: string; end: string };
  error?: string;
}

export default function CalendarRepairPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [sitters, setSitters] = useState<SitterOption[]>([]);
  const [sitterId, setSitterId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);

  const loadSitters = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/sitters?page=1&pageSize=200');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSitters([]);
        setLoadError(json.error || 'Failed to load sitters');
        return;
      }
      const list = json.items;
      setSitters(Array.isArray(list) ? list : []);
      if (list.length && !sitterId) {
        setSitterId(list[0].id ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [sitterId]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, sessionStatus, router]);

  useEffect(() => {
    if (session) void loadSitters();
  }, [session, loadSitters]);

  useEffect(() => {
    const now = new Date();
    const s = new Date(now);
    s.setDate(s.getDate() - 1);
    const e = new Date(now);
    e.setDate(e.getDate() + 14);
    if (!startDate) setStartDate(s.toISOString().slice(0, 10));
    if (!endDate) setEndDate(e.toISOString().slice(0, 10));
  }, [startDate, endDate]);

  const handleRepair = async () => {
    if (!sitterId) return;
    setRepairing(true);
    setResult(null);
    try {
      const res = await fetch('/api/ops/calendar/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sitterId,
          start: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          end: endDate ? `${endDate}T23:59:59.999Z` : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      setResult({
        success: res.ok,
        jobId: json.jobId,
        message: json.message,
        range: json.range,
        error: json.error ?? json.message,
      });
    } finally {
      setRepairing(false);
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <OwnerAppShell>
        <LayoutWrapper>
          <PageHeader title="Calendar Repair" subtitle="Loading..." />
          <TableSkeleton rows={4} cols={2} />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }
  if (!session) return null;

  return (
    <OwnerAppShell>
      <LayoutWrapper>
        <PageHeader
          title="Calendar Repair"
          subtitle="Repair Google Calendar sync for a sitter. Re-pushes Snout OS bookings to Google."
        />
        <Section>
      {loadError ? (
        <AppErrorState title="Couldn't load calendar repair" subtitle={loadError} onRetry={() => void loadSitters()} />
      ) : sitters.length === 0 && !loading ? (
        <EmptyState
          title="No sitters available"
          description="Add an active sitter to run calendar repair."
          primaryAction={{ label: 'Refresh', onClick: () => void loadSitters() }}
        />
      ) : (
      <AppCard>
        <AppCardBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Sitter</label>
              <select
                value={sitterId}
                onChange={(e) => setSitterId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                disabled={loading}
              >
                <option value="">Select sitter</option>
                {sitters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <Button
              onClick={() => void handleRepair()}
              disabled={!sitterId || repairing}
            >
              {repairing ? 'Repairing…' : 'Repair Sync'}
            </Button>
          </div>
        </AppCardBody>
      </AppCard>
      )}
      {result && (
        <AppCard className={`mt-4 ${result.success ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/50'}`}>
          <AppCardBody>
            {result.success ? (
              <div>
                <p className="font-medium text-green-800">Repair enqueued</p>
                <p className="mt-1 text-sm text-green-700">{result.message}</p>
                {result.jobId && (
                  <p className="mt-1 text-xs text-neutral-600">Job ID: {result.jobId}</p>
                )}
                {result.range && (
                  <p className="mt-1 text-xs text-neutral-600">
                    Range: {result.range.start} → {result.range.end}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="font-medium text-red-800">Repair failed</p>
                <p className="mt-1 text-sm text-red-700">{result.error}</p>
              </div>
            )}
          </AppCardBody>
        </AppCard>
      )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
