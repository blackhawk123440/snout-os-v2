'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Badge, Skeleton, Input, Flex } from '@/components/ui';

export function ReviewsSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    enabled: false,
    googlePlaceId: '',
    minStarRating: 4,
    frequencyCapDays: 30,
    minVisitsBeforeAsking: 3,
  });
  const [saved, setSaved] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['review-automation'],
    queryFn: async () => {
      const res = await fetch('/api/ops/review-automation');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setForm({
        enabled: data.enabled || false,
        googlePlaceId: data.googlePlaceId || '',
        minStarRating: data.minStarRating || 4,
        frequencyCapDays: data.frequencyCapDays || 30,
        minVisitsBeforeAsking: data.minVisitsBeforeAsking || 3,
      });
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/review-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _saveConfig: true, ...form }),
      });
      if (!res.ok) throw new Error('Save failed');
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['review-automation'] });
    },
  });

  if (isLoading) return <Skeleton height={300} />;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="p-4">
          <Flex align="center" gap={3} className="mb-4">
            <label className="font-semibold">Automation Enabled</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              style={{
                width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                backgroundColor: form.enabled ? '#10b981' : '#d4d4d4',
                position: 'relative', transition: 'background-color 200ms',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: form.enabled ? 22 : 2,
                width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
                transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
            <Badge variant={form.enabled ? 'success' : 'warning'}>{form.enabled ? 'Active' : 'Disabled'}</Badge>
          </Flex>

          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
            <div>
              <label className="block text-sm font-medium mb-1">Google Place ID</label>
              <Input value={form.googlePlaceId} onChange={(e) => setForm({ ...form, googlePlaceId: e.target.value })} placeholder="ChIJ..." />
              <p className="text-xs text-text-tertiary mt-1">Find your Place ID at Google&apos;s Place ID Finder</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Minimum Star Rating</label>
              <Input type="number" min={1} max={5} value={form.minStarRating} onChange={(e) => setForm({ ...form, minStarRating: parseInt(e.target.value) || 4 })} />
              <p className="text-xs text-text-tertiary mt-1">Only ask for reviews after visits rated this highly or above</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Frequency Cap (days)</label>
              <Input type="number" min={1} value={form.frequencyCapDays} onChange={(e) => setForm({ ...form, frequencyCapDays: parseInt(e.target.value) || 30 })} />
              <p className="text-xs text-text-tertiary mt-1">Don&apos;t ask the same client more than once in this many days</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Minimum Visits Before Asking</label>
              <Input type="number" min={1} value={form.minVisitsBeforeAsking} onChange={(e) => setForm({ ...form, minVisitsBeforeAsking: parseInt(e.target.value) || 3 })} />
              <p className="text-xs text-text-tertiary mt-1">Client must have this many completed visits before being asked</p>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving\u2026' : 'Save Settings'}
            </Button>
            {saved && <Badge variant="success" className="ml-2">Saved</Badge>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ol className="text-sm text-text-secondary pl-5 flex flex-col gap-2">
            <li>A sitter completes a visit and submits a report</li>
            <li>If the visit rating is {form.minStarRating}+ stars, the system waits 1 hour</li>
            <li>If the client hasn&apos;t been asked in the last {form.frequencyCapDays} days and has {form.minVisitsBeforeAsking}+ visits, an SMS is sent</li>
            <li>The SMS includes a direct link to your Google review page</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
