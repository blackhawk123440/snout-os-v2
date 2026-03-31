'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { OwnerAppShell, PageHeader } from '@/components/layout';
import { Card } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { TierForm } from '../TierForm';

type TierPayload = {
  id: string;
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
};

export default function EditTierPage() {
  const params = useParams<{ id: string }>();
  const [tier, setTier] = useState<TierPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTier() {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sitter-tiers/${params.id}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Failed to load tier');
        setLoading(false);
        return;
      }
      setTier(body.tier || null);
      setLoading(false);
    }
    if (params.id) {
      void loadTier();
    }
  }, [params.id]);

  return (
    <OwnerAppShell>
      <PageHeader
        title="Edit Policy Tier"
        subtitle="Update policy/entitlement rules. Reliability tier remains SRS."
      />
      <div className="p-6">
        {loading && <Card style={{ padding: tokens.spacing[4] }}>Loading tier...</Card>}
        {!loading && error && (
          <Card style={{ padding: tokens.spacing[4], color: tokens.colors.error[700] }}>
            {error}
          </Card>
        )}
        {!loading && !error && tier && (
          <TierForm
            mode="edit"
            tierId={tier.id}
            initialValues={{
              name: tier.name,
              pointTarget: tier.pointTarget,
              minCompletionRate: tier.minCompletionRate ?? '',
              minResponseRate: tier.minResponseRate ?? '',
              priorityLevel: tier.priorityLevel,
              commissionSplit: tier.commissionSplit,
              canTakeHouseSits: tier.canTakeHouseSits,
              canTakeTwentyFourHourCare: tier.canTakeTwentyFourHourCare,
              isDefault: tier.isDefault,
              benefits: tier.benefits || '',
              description: tier.description || '',
            }}
          />
        )}
      </div>
    </OwnerAppShell>
  );
}
