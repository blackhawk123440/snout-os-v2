'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Search, Send, Zap } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  Button,
  Input,
  Badge,
  Skeleton,
  EmptyState,
  Flex,
  Grid,
  GridCol,
} from '@/components/ui';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppCard, AppCardBody, AppCardHeader, AppErrorState } from '@/components/app';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';

interface Automation {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  sendToClient?: boolean;
  sendToSitter?: boolean;
  sendToOwner?: boolean;
  lastFiredAt?: string | null;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface AutomationStats {
  totalEnabled: number;
  runsToday: number;
  failuresToday: number;
}

export default function AutomationsPage() {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');

  const { data: automationsData, isLoading: loading, error: automationsError, refetch } = useQuery<{ items: Automation[] }>({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await fetch('/api/automations');
      if (!res.ok) throw new Error('Failed to load automations');
      return res.json();
    },
  });
  const automations = automationsData?.items ?? [];

  const { data: statsData } = useQuery<AutomationStats>({
    queryKey: ['automations', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/automations/stats');
      if (!res.ok) return { totalEnabled: 0, runsToday: 0, failuresToday: 0 };
      return res.json();
    },
  });
  const stats = statsData ?? { totalEnabled: 0, runsToday: 0, failuresToday: 0 };

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Failed to toggle automation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  const filteredAutomations = automations.filter(automation => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!automation.name.toLowerCase().includes(search) &&
          !automation.description?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filterEnabled === 'enabled' && !automation.enabled) return false;
    if (filterEnabled === 'disabled' && automation.enabled) return false;
    return true;
  });

  if (loading) {
    return (
      <OwnerAppShell>
        <LayoutWrapper variant="wide">
          <PageHeader title="Automations" subtitle="Manage automation types and message templates" />
          <Section>
            <Skeleton height={400} />
          </Section>
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }

  if (automationsError) {
    return (
      <OwnerAppShell>
        <LayoutWrapper variant="wide">
          <PageHeader title="Automations" subtitle="Manage automation types and message templates" />
          <AppErrorState title="Couldn't load automations" subtitle={automationsError instanceof Error ? automationsError.message : 'Unable to load'} onRetry={() => void refetch()} />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Automations"
          subtitle="Keep follow-ups, reminders, and routine customer communication running without extra manual work."
          actions={
            <Link href="/ops/automation-failures">
              <Button variant="secondary" size="sm" leftIcon={<AlertTriangle size={14} />}>
                View failures
              </Button>
            </Link>
          }
        />

        <Section>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
            <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(234,88,12,0.10),_transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
              <AppCardHeader title="Automation should feel like business leverage" />
              <AppCardBody className="space-y-3">
                <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                  Strong SaaS automations are not just switches. They are the repeatable workflows that keep owners responsive, clients informed, and the team on schedule without creating more operational overhead.
                </p>
                <p className="text-sm leading-6 text-text-secondary">
                  Use this page to manage what runs automatically, what still needs human review, and where message reliability needs attention.
                </p>
              </AppCardBody>
            </AppCard>

            <AppCard>
              <AppCardHeader title="Best next moves" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Keep the most customer-visible automations on first, especially reminders and follow-up messaging.</p>
                <p>Treat failures like service-risk signals, not just technical logs.</p>
                <p>Use testing and edits to improve message quality, not just delivery volume.</p>
              </AppCardBody>
            </AppCard>
          </div>
        </Section>

        <Section title="Automation health" description="Runs and failures are org-wide. Use these metrics to spot customer-facing risk quickly.">
          <Grid gap={4}>
            <GridCol span={12} md={4}>
              <Card className="border border-border-default">
                <div style={{ padding: tokens.spacing[4] }}>
                  <div style={{ fontSize: tokens.typography.fontSize.sm[0], color: tokens.colors.text.secondary, marginBottom: tokens.spacing[1] }}>
                    Enabled
                  </div>
                  <div style={{ fontSize: tokens.typography.fontSize['2xl'][0], fontWeight: tokens.typography.fontWeight.bold }}>
                    {stats.totalEnabled}
                  </div>
                </div>
              </Card>
            </GridCol>
            <GridCol span={12} md={4}>
              <Card className="border border-border-default">
                <div style={{ padding: tokens.spacing[4] }}>
                  <div style={{ fontSize: tokens.typography.fontSize.sm[0], color: tokens.colors.text.secondary, marginBottom: tokens.spacing[1] }}>
                    Runs today
                  </div>
                  <div style={{ fontSize: tokens.typography.fontSize['2xl'][0], fontWeight: tokens.typography.fontWeight.bold }}>
                    {stats.runsToday}
                  </div>
                </div>
              </Card>
            </GridCol>
            <GridCol span={12} md={4}>
              <Card className="border border-border-default">
                <div style={{ padding: tokens.spacing[4] }}>
                  <div style={{ fontSize: tokens.typography.fontSize.sm[0], color: tokens.colors.text.secondary, marginBottom: tokens.spacing[1] }}>
                    Failures today
                  </div>
                  <div style={{ fontSize: tokens.typography.fontSize['2xl'][0], fontWeight: tokens.typography.fontWeight.bold, color: stats.failuresToday > 0 ? tokens.colors.error.DEFAULT : undefined }}>
                    {stats.failuresToday}
                  </div>
                  {stats.failuresToday > 0 && (
                    <Link href="/ops/automation-failures" className="text-sm text-accent-primary hover:underline mt-1 inline-block">
                      View failure log →
                    </Link>
                  )}
                </div>
              </Card>
            </GridCol>
          </Grid>
        </Section>

        <Section title="Automation workflows" description="Search for the workflows you want to review, then enable or refine them without leaving the product context.">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search automations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={14} />}
              style={{ flex: 1, minWidth: 200 }}
            />
            <select
              value={filterEnabled}
              onChange={(e) => setFilterEnabled(e.target.value)}
              className="rounded-lg border border-border-strong bg-surface-primary px-3 py-2 text-sm text-text-primary"
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {filteredAutomations.length === 0 ? (
            <Card>
              <EmptyState
                title="No automations found"
                description={searchTerm || filterEnabled !== 'all' ? 'Try adjusting your filters to bring more workflows into view.' : 'No automation workflows are configured yet.'}
                icon={<Zap className="w-8 h-8 text-text-tertiary" />}
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {filteredAutomations.map((automation) => (
                <Card key={automation.id} className="border border-border-default overflow-hidden">
                  <div style={{ padding: tokens.spacing[4] }}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-text-primary m-0">
                            {automation.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              automation.enabled
                                ? 'bg-status-success-bg text-status-success-text'
                                : 'bg-surface-tertiary text-text-secondary'
                            }`}
                          >
                            {automation.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <Badge variant="info">{automation.category}</Badge>
                        </div>
                        <p className="text-sm text-text-secondary m-0">
                          {automation.description}
                        </p>
                        <p className="mt-2 text-xs text-text-tertiary">
                          {automation.lastFiredAt
                            ? `Last fired: ${formatRelativeTime(automation.lastFiredAt)}`
                            : 'Never fired'}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={automation.enabled}
                            onChange={(e) => toggleMutation.mutate({ id: automation.id, enabled: e.target.checked })}
                            className="h-4 w-4 rounded border-border-strong"
                          />
                          <span className="text-sm">On / Off</span>
                        </label>
                        <Link href={`/automations/${automation.id}`}>
                          <Button variant="primary" size="sm" leftIcon={<Send size={14} />}>
                            Edit & test message
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
