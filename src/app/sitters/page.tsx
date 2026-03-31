'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
import { TableSkeleton } from '@/components/ui';
import { RosterTab } from './tabs/RosterTab';
import { RankingsTab } from './tabs/RankingsTab';
import { GrowthTab } from './tabs/GrowthTab';
import { PayrollTab } from './tabs/PayrollTab';

type TeamTab = 'roster' | 'rankings' | 'growth' | 'payroll';
const TABS: { id: TeamTab; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'growth', label: 'Growth' },
  { id: 'payroll', label: 'Payroll' },
];

const SUBTITLES: Record<TeamTab, string> = {
  roster: 'Manage your sitter workforce',
  rankings: 'Performance comparison',
  growth: 'Reliability tiers and progression',
  payroll: 'Pay runs, approvals, and exports',
};

function TeamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TeamTab | null;
  const [activeTab, setActiveTab] = useState<TeamTab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'roster'
  );

  const changeTab = (tab: TeamTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'roster') params.delete('tab');
    else params.set('tab', tab);
    router.replace(`/sitters${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Team"
          subtitle={SUBTITLES[activeTab]}
          actions={
            <div className="flex gap-1 rounded-lg border border-border-default bg-surface-primary p-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => changeTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-surface-inverse text-text-inverse'
                      : 'text-text-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        />

        {activeTab === 'roster' && <RosterTab />}
        {activeTab === 'rankings' && <RankingsTab />}
        {activeTab === 'growth' && <GrowthTab />}
        {activeTab === 'payroll' && <PayrollTab />}
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

export default function SittersPage() {
  return (
    <Suspense fallback={<OwnerAppShell><LayoutWrapper variant="wide"><TableSkeleton rows={8} cols={4} /></LayoutWrapper></OwnerAppShell>}>
      <TeamContent />
    </Suspense>
  );
}
