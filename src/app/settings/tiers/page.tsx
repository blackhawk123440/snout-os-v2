'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star } from 'lucide-react';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  EmptyState,
  Skeleton,
  Modal,
} from '@/components/ui';
import { OwnerAppShell } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { tokens } from '@/lib/design-tokens';

interface SitterTier {
  id: string;
  orgId: string;
  name: string;
  pointTarget: number;
  minCompletionRate: number | null;
  minResponseRate: number | null;
  priorityLevel: number;
  commissionSplit: number;
  canTakeHouseSits: boolean;
  canTakeTwentyFourHourCare: boolean;
  isDefault: boolean;
  benefits: string | null;
  description: string | null;
}

export default function TiersPage() {
  const queryClient = useQueryClient();
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null);

  const { data: tiersData, isLoading: loading, error, refetch } = useQuery<{ tiers: SitterTier[] }>({
    queryKey: ['sitter-tiers'],
    queryFn: async () => {
      const res = await fetch('/api/sitter-tiers');
      if (!res.ok) throw new Error('Failed to load tiers');
      return res.json();
    },
  });
  const tiers = (tiersData?.tiers ?? []).sort((a, b) => a.priorityLevel - b.priorityLevel);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sitter-tiers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tier');
    },
    onSuccess: () => {
      setDeleteTierId(null);
      queryClient.invalidateQueries({ queryKey: ['sitter-tiers'] });
    },
  });

  return (
    <OwnerAppShell>
      <PageHeader
        title="Policy Tiers"
        description="Configure policy and entitlement tiers separately from SRS reliability tiers."
        actions={
          <Link href="/settings/tiers/new">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Create Policy Tier
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        <Card className="mb-4">
          <div className="p-4 text-sm text-text-secondary">
            <strong>Separation of concerns:</strong> SRS reliability tiers (Foundation/Reliant/Trusted/Preferred)
            measure performance. Policy tiers here control permissions, routing priority, and commission.
          </div>
        </Card>

        {error && (
          <div className="mb-6">
            <AppErrorState
              title="Couldn't load tiers"
              subtitle={error instanceof Error ? error.message : 'Unable to load'}
              onRetry={() => void refetch()}
            />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton height={150} />
            <Skeleton height={150} />
            <Skeleton height={150} />
          </div>
        ) : tiers.length === 0 ? (
          <EmptyState
            title="No Policy Tiers Configured"
            description="Create your first policy tier for sitter entitlements"
            icon={<Star className="w-12 h-12 text-text-disabled" />}
            action={{
              label: "Create Policy Tier",
              onClick: () => window.location.href = "/settings/tiers/new",
            }}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {tiers.map((tier) => {
              let benefits: Record<string, unknown> = {};
              if (tier.benefits) {
                try {
                  benefits = JSON.parse(tier.benefits);
                } catch {
                  benefits = {};
                }
              }
              return (
                <Card key={tier.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="font-bold text-lg text-text-primary">
                          {tier.name}
                        </div>
                        {tier.isDefault && (
                          <Badge variant="warning">Default</Badge>
                        )}
                        <Badge variant="info">Priority: {tier.priorityLevel}</Badge>
                      </div>
                      <div
                        className="grid gap-4 text-sm text-text-secondary mb-3"
                        style={{
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        }}
                      >
                        <div>
                          <strong>Point Target:</strong> {tier.pointTarget}
                        </div>
                        <div>
                          <strong>Min Completion:</strong> {tier.minCompletionRate ?? 'N/A'}{tier.minCompletionRate !== null ? '%' : ''}
                        </div>
                        <div>
                          <strong>Min Response:</strong> {tier.minResponseRate ?? 'N/A'}{tier.minResponseRate !== null ? '%' : ''}
                        </div>
                        <div>
                          <strong>Commission Split:</strong> {tier.commissionSplit}%
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tier.canTakeHouseSits && (
                            <Badge variant="success">House Sits</Badge>
                          )}
                          {tier.canTakeTwentyFourHourCare && (
                            <Badge variant="info">24hr Care</Badge>
                          )}
                        </div>
                      </div>
                      {tier.description && (
                        <div className="text-sm text-text-secondary mb-2">
                          {tier.description}
                        </div>
                      )}
                      {Object.keys(benefits).length > 0 && (
                        <div className="text-sm text-text-secondary">
                          <strong>Benefits:</strong> {JSON.stringify(benefits)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Link href={`/settings/tiers/${tier.id}`}>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTierId(tier.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <Modal
        isOpen={!!deleteTierId}
        onClose={() => !deleteMutation.isPending && setDeleteTierId(null)}
        title="Delete tier"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTierId(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteTierId && deleteMutation.mutate(deleteTierId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete tier'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">Are you sure you want to delete this tier? This cannot be undone.</p>
      </Modal>
    </OwnerAppShell>
  );
}
