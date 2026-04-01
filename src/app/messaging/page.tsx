'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { Skeleton } from '@/components/ui';
import { Phone } from 'lucide-react';
import InboxView from '@/components/messaging/InboxView';
import { SittersPanel } from '@/components/messaging/SittersPanel';

type MessagesTab = 'inbox' | 'sitters';

function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as MessagesTab | null;
  const [activeTab, setActiveTab] = useState<MessagesTab>(
    tabParam === 'sitters' ? 'sitters' : 'inbox'
  );

  const { data: integrationData } = useQuery({
    queryKey: ['integration-stack'],
    queryFn: () => fetch('/api/settings/integration-stack').then((r) => r.json()),
    staleTime: 60000,
  });
  const provider = integrationData?.config?.messagingProvider ?? 'none';
  const hasProvider = provider !== 'none';
  const isNativePhoneMode = provider === 'none';

  const changeTab = (tab: MessagesTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'inbox') params.delete('tab');
    else params.set('tab', tab);
    router.replace(`/messaging${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  const tabs = [
    { id: 'inbox' as const, label: 'Inbox' },
    ...(hasProvider ? [{ id: 'sitters' as const, label: 'Sitters' }] : []),
  ];

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Messages"
          subtitle={activeTab === 'inbox' ? 'Client and sitter conversations' : 'Sitter thread visibility'}
          actions={
            <div className="flex gap-1 rounded-lg border border-border-default bg-surface-primary p-0.5">
              {tabs.map((tab) => (
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

        {isNativePhoneMode && (
          <Section>
            <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-secondary px-4 py-3">
              <Phone className="h-5 w-5 text-text-tertiary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Native phone mode is active</p>
                <p className="text-xs text-text-tertiary">
                  Owners, sitters, and clients can keep using their regular phone numbers.
                  Add Twilio or OpenPhone in{' '}
                  <a href="/settings?section=integrations" className="font-medium text-accent-primary hover:underline">Settings</a>{' '}
                  to move messaging onto a connected business line.
                </p>
              </div>
            </div>
          </Section>
        )}

        {activeTab === 'inbox' && (
          <Section>
            <div className="h-[70vh] min-h-[520px]">
              <InboxView role="owner" inbox="owner" nativePhoneMode={isNativePhoneMode} />
            </div>
          </Section>
        )}
        {activeTab === 'sitters' && hasProvider && (
          <Section>
            <SittersPanel />
          </Section>
        )}
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

export default function MessagingPage() {
  return (
    <Suspense fallback={
      <OwnerAppShell>
        <LayoutWrapper variant="wide">
          <Skeleton height={600} />
        </LayoutWrapper>
      </OwnerAppShell>
    }>
      <MessagesContent />
    </Suspense>
  );
}
