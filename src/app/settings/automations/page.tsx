'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Clock, CreditCard, Bell, Star, Zap, History } from 'lucide-react';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Skeleton,
} from '@/components/ui';
import { Switch } from '@/components/ui/Switch';
import { OwnerAppShell } from '@/components/layout';
import { tokens } from '@/lib/design-tokens';

interface AutomationItem {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  sendToClient: boolean;
  sendToSitter: boolean;
  sendToOwner: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  booking: <CalendarCheck className="w-3.5 h-3.5" />,
  reminder: <Clock className="w-3.5 h-3.5" />,
  payment: <CreditCard className="w-3.5 h-3.5" />,
  notification: <Bell className="w-3.5 h-3.5" />,
  review: <Star className="w-3.5 h-3.5" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  booking: 'Booking',
  reminder: 'Reminder',
  payment: 'Payment',
  notification: 'Notification',
  review: 'Review',
};

export default function AutomationSettingsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: automationsData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'automations'],
    queryFn: async () => {
      const res = await fetch('/api/automations');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      return json.items || [];
    },
  });
  const automations = automationsData || [];

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch('/api/automations/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [id]: { enabled } }),
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'automations'] });
    },
    onError: () => {
      setError('Failed to save. Please try again.');
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/automations/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingConfirmation: { enabled: true },
          nightBeforeReminder: { enabled: true },
          paymentReminder: { enabled: true },
          sitterAssignment: { enabled: true },
          postVisitThankYou: { enabled: true },
          ownerNewBookingAlert: { enabled: true },
        }),
      });
      if (!res.ok) throw new Error('Failed to reset');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'automations'] });
    },
    onError: () => {
      setError('Failed to reset. Please try again.');
    },
  });

  const saving = toggleMutation.isPending ? (toggleMutation.variables?.id ?? null) : resetMutation.isPending ? 'reset' : null;

  return (
    <OwnerAppShell>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader
          title="Automations"
          description="Configure automatic messages and actions"
        />

        {(error || queryError) && (
          <Card className="p-3 mb-4" style={{ backgroundColor: tokens.colors.error[50] }}>
            <div className="text-sm" style={{ color: tokens.colors.error.DEFAULT }}>
              {error || (queryError as Error)?.message || 'Failed to load automations'}
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-2">
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {automations.map((automation: AutomationItem) => (
              <Card key={automation.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-primary">{CATEGORY_ICONS[automation.category] || <Zap className="w-3.5 h-3.5" />}</span>
                      <span className="font-semibold text-base">
                        {automation.name}
                      </span>
                      <Badge variant={automation.enabled ? 'success' : 'default'}>
                        {automation.enabled ? 'Active' : 'Off'}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-secondary m-0">
                      {automation.description}
                    </p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {automation.sendToClient && (
                        <Badge variant="default">Client</Badge>
                      )}
                      {automation.sendToSitter && (
                        <Badge variant="default">Sitter</Badge>
                      )}
                      {automation.sendToOwner && (
                        <Badge variant="default">Owner</Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Switch
                      checked={automation.enabled}
                      onChange={(checked) => toggleMutation.mutate({ id: automation.id, enabled: checked })}
                      disabled={saving === automation.id}
                      aria-label={`Toggle ${automation.name}`}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center mt-6 gap-3 flex-wrap">
          <Button
            variant="secondary"
            onClick={() => resetMutation.mutate()}
            disabled={saving === 'reset'}
          >
            {saving === 'reset' ? 'Resetting...' : 'Reset to defaults'}
          </Button>
          <Link href="/settings/automations/history">
            <Button variant="ghost">
              <History className="w-4 h-4 mr-2 inline-block" />
              View run history
            </Button>
          </Link>
        </div>
      </div>
    </OwnerAppShell>
  );
}
