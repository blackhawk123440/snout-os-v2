'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
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
  payments: 'Payment processing and collection',
  finance: 'Revenue summary and outstanding invoices',
  payroll: 'Pay runs, commissions, and sitter compensation',
  reports: 'Business performance metrics',
  analytics: 'Trends and operational intelligence',
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
          title="Money"
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
