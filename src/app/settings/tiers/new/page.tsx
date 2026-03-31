'use client';

import { OwnerAppShell, PageHeader } from '@/components/layout';
import { TierForm } from '../TierForm';

export default function NewTierPage() {
  return (
    <OwnerAppShell>
      <PageHeader
        title="Create Policy Tier"
        subtitle="Define sitter policy/entitlement rules. Reliability tier remains SRS."
      />
      <div className="p-6">
        <TierForm mode="create" />
      </div>
    </OwnerAppShell>
  );
}
