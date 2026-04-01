'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import {
  SitterCard,
  SitterCardHeader,
  SitterCardBody,
  SitterPageHeader,
  SitterSkeletonList,
  SitterErrorState,
} from '@/components/sitter';

const MODULES = [
  {
    id: 'company_policies',
    label: 'Company Policies',
    description: 'Professional conduct, dress code, client confidentiality, cancellation procedures.',
  },
  {
    id: 'safety_procedures',
    label: 'Safety Procedures',
    description: 'Pet handling safety, recognizing signs of distress, heat/cold safety, avoiding hazards on walks.',
  },
  {
    id: 'gps_checkin',
    label: 'GPS Check-In / Check-Out',
    description: 'How to use the Start Visit and End Visit buttons. GPS captures your location for accountability.',
  },
  {
    id: 'visit_reports',
    label: 'Visit Report Instructions',
    description: 'How to submit a visit report with photos, structured details (walk, potty, food, water, meds), and a personal note.',
  },
  {
    id: 'emergency_protocol',
    label: 'Emergency Protocol',
    description: 'What to do if a pet is injured or sick. Finding vet info and emergency contacts in the pet profile. When to call the owner.',
  },
  {
    id: 'payment_tips',
    label: 'Payment & Tipping',
    description: 'How automatic payouts work after the 7-day hold, plus tip links and client tipping.',
  },
  {
    id: 'medication_admin',
    label: 'Medication Administration',
    description: 'How to read medication instructions on pet profiles. Logging medication given in your visit report.',
  },
  {
    id: 'client_communication',
    label: 'Client Communication',
    description: 'Messaging etiquette, when to contact the owner vs the client, using the in-app messaging system.',
  },
];

export default function SitterTrainingPage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: trainingData, isLoading: loading, error, refetch } = useQuery<{ completed: Record<string, boolean> }>({
    queryKey: ['sitter', 'training'],
    queryFn: async () => {
      const res = await fetch('/api/sitter/training');
      if (!res.ok) {
        // Fallback: try localStorage for offline
        try {
          const saved = localStorage.getItem('snout-sitter-training');
          if (saved) return { completed: JSON.parse(saved) };
        } catch {}
        throw new Error('Failed to load training progress');
      }
      return res.json();
    },
  });
  const completed = trainingData?.completed ?? {};

  const toggleMutation = useMutation({
    mutationFn: async ({ moduleId, newValue }: { moduleId: string; newValue: boolean }) => {
      const res = await fetch('/api/sitter/training', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, completed: newValue }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onMutate: async ({ moduleId, newValue }) => {
      await queryClient.cancelQueries({ queryKey: ['sitter', 'training'] });
      const prev = queryClient.getQueryData<{ completed: Record<string, boolean> }>(['sitter', 'training']);
      queryClient.setQueryData(['sitter', 'training'], (old: any) => ({
        ...old,
        completed: { ...old?.completed, [moduleId]: newValue },
      }));
      setSaving(moduleId);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['sitter', 'training'], context.prev);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['sitter', 'training'], data);
    },
    onSettled: () => setSaving(null),
  });

  const toggle = (id: string) => {
    toggleMutation.mutate({ moduleId: id, newValue: !completed[id] });
  };

  const doneCount = MODULES.filter((m) => completed[m.id]).length;
  const pct = Math.round((doneCount / MODULES.length) * 100);

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader title="Training" subtitle={loading ? 'Loading...' : `${doneCount}/${MODULES.length} completed`} />

      {loading ? (
        <SitterSkeletonList count={3} />
      ) : error ? (
        <SitterErrorState title="Couldn't load training" subtitle={error instanceof Error ? error.message : 'Unable to load'} onRetry={() => void refetch()} />
      ) : (
      <div className="space-y-4">
        {/* Progress */}
        <SitterCard>
          <SitterCardBody>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text-primary">Training Progress</p>
              <span className="text-sm font-bold text-accent-primary">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
              <div className="h-full rounded-full bg-accent-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </SitterCardBody>
        </SitterCard>

        {/* Modules */}
        <SitterCard>
          <SitterCardHeader>
            <h3 className="font-semibold text-text-primary">Training Modules</h3>
          </SitterCardHeader>
          <SitterCardBody>
            <div className="space-y-1">
              {MODULES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  disabled={saving === m.id}
                  className="flex w-full items-start gap-3 rounded-xl border border-border-default bg-surface-primary px-4 py-3 text-left transition hover:border-border-strong min-h-[44px] disabled:opacity-60"
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                    completed[m.id] ? 'border-status-success-fill bg-status-success-fill text-text-inverse' : 'border-border-strong'
                  }`}>
                    {completed[m.id] && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${completed[m.id] ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                      {m.label}
                    </p>
                    <p className="mt-0.5 text-xs text-text-tertiary">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </SitterCardBody>
        </SitterCard>
      </div>
      )}
    </div>
  );
}
