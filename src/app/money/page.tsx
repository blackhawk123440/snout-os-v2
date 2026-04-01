'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
import { AppCard, AppCardBody, AppCardHeader } from '@/components/app';
import { TableSkeleton } from '@/components/ui';
import { PaymentsTab } from './tabs/PaymentsTab';
import { FinanceTab } from './tabs/FinanceTab';
import { ReportsTab } from './tabs/ReportsTab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { PayrollTab } from '@/app/sitters/tabs/PayrollTab';

type MoneyTab = 'payments' | 'finance' | 'payroll' | 'reports' | 'analytics';
const TABS: { id: MoneyTab; label: string }[] = [
  { id: 'payments', label: 'Payments' },
  { id: 'finance', label: 'Finance' },
  { id: 'payroll', label: 'Sitter Pay' },
  { id: 'reports', label: 'Reports' },
  { id: 'analytics', label: 'Analytics' },
];

const SUBTITLES: Record<MoneyTab, string> = {
  payments: 'Track collections, failed charges, refunds, and payment performance.',
  finance: 'Keep revenue, outstanding balances, and collection follow-through in one place.',
  payroll: 'Review sitter compensation, payouts, and pay-run readiness.',
  reports: 'Monitor business performance with cleaner executive reporting.',
  analytics: 'See revenue and operating trends without leaving the product workflow.',
};

function MoneyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as MoneyTab | null;
  const [activeTab, setActiveTab] = useState<MoneyTab>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : 'payments'
  );

  const changeTab = (tab: MoneyTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'payments') params.delete('tab');
    else params.set('tab', tab);
    router.replace(`/money${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Billing"
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

        <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
          <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(21,128,61,0.12),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
            <AppCardHeader title="Your billing and revenue workspace" />
            <AppCardBody className="space-y-3">
              <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                Elite SaaS finance surfaces should help owners understand what has been collected, what still needs follow-through, and where growth or leakage is showing up, without feeling like an accounting back office.
              </p>
              <p className="text-sm leading-6 text-text-secondary">
                Use payments for day-to-day collection health, finance for outstanding revenue, reports for executive summaries, and analytics when you need deeper trend visibility.
              </p>
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardHeader title="Best next moves" />
            <AppCardBody className="space-y-2 text-sm text-text-secondary">
              <p>Keep payment collection close to the booking lifecycle so unpaid work gets attention quickly.</p>
              <p>Review reports and analytics as decision tools, not separate systems owners have to learn from scratch.</p>
              <p>Sitter pay belongs here too, but it should stay clearly separated from customer-facing billing operations.</p>
            </AppCardBody>
          </AppCard>
        </div>

        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'finance' && <FinanceTab />}
        {activeTab === 'payroll' && <PayrollTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

export default function MoneyPage() {
  return (
    <Suspense fallback={<OwnerAppShell><LayoutWrapper variant="wide"><TableSkeleton rows={8} cols={5} /></LayoutWrapper></OwnerAppShell>}>
      <MoneyContent />
    </Suspense>
  );
}
