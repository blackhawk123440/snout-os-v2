'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ArrowRight, Building2, CreditCard, MessageSquare, Users, Briefcase } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { OwnerAppShell } from '@/components/layout';
import { PageHeader, Card, Button, Input, Badge, Skeleton } from '@/components/ui';
import { useAuth } from '@/lib/auth-client';
import {
  useProviderStatus,
  useTestConnection,
  useConnectProvider,
  useNumbersStatus,
  useWebhookStatus,
  useInstallWebhooks,
  useLastWebhookReceived,
  useReadiness,
} from '@/lib/api/setup-hooks';

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  href: string;
  cta: string;
  icon: ReactNode;
  note?: string;
};

type IntegrationStackData = {
  config: {
    messagingProvider: 'none' | 'twilio' | 'openphone';
    messagingFallbackPhone: string | null;
  };
  status: {
    messaging: {
      configured: boolean;
      detail: string;
      provider?: string;
    };
  };
};

function SetupSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
      <Skeleton height={120} />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Skeleton height={420} />
        <Skeleton height={420} />
      </div>
      <Skeleton height={320} />
    </div>
  );
}

function formatLastReceived(timestamp: string | null | undefined) {
  if (!timestamp) return 'No webhook activity yet';
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Webhook received just now';
  if (diffMins < 60) return `Last webhook ${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Last webhook ${diffHours}h ago`;
  return `Last webhook ${date.toLocaleString()}`;
}

export default function SetupPage() {
  const { isOwner, loading: authLoading } = useAuth();
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [connectionTested, setConnectionTested] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const providerStatus = useProviderStatus();
  const testConnection = useTestConnection();
  const connectProvider = useConnectProvider();
  const numbersStatus = useNumbersStatus();
  const webhookStatus = useWebhookStatus();
  const installWebhooks = useInstallWebhooks();
  const lastWebhook = useLastWebhookReceived();
  const readiness = useReadiness();
  const integrationStack = useQuery<IntegrationStackData>({
    queryKey: ['settings', 'integration-stack', 'setup-page'],
    queryFn: async () => {
      const res = await fetch('/api/settings/integration-stack');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load integration settings');
      return body;
    },
    staleTime: 30000,
  });

  if (authLoading) {
    return (
      <OwnerAppShell>
        <PageHeader title="Launch Setup" description="Loading your launch checklist" />
        <SetupSkeleton />
      </OwnerAppShell>
    );
  }

  if (!isOwner) {
    return (
      <OwnerAppShell>
        <PageHeader title="Launch Setup" description="Owner access required" />
        <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
          <Card>
            <p className="text-sm text-text-secondary">Only owners can manage launch readiness for the workspace.</p>
          </Card>
        </div>
      </OwnerAppShell>
    );
  }

  const messagingProvider = integrationStack.data?.config.messagingProvider ?? 'none';
  const isNativePhoneMode = messagingProvider === 'none';
  const isTwilioSelected = messagingProvider === 'twilio';
  const isOpenPhoneSelected = messagingProvider === 'openphone';
  const providerReady = providerStatus.data?.connected === true;
  const hasFrontDesk = numbersStatus.data?.hasFrontDesk === true;
  const hasAnyNumbers =
    (numbersStatus.data?.frontDesk.count ?? 0) +
      (numbersStatus.data?.pool.count ?? 0) +
      (numbersStatus.data?.sitter.count ?? 0) >
    0;
  const webhooksVerified = webhookStatus.data?.verified === true;
  const messagingReady = isNativePhoneMode
    ? true
    : isTwilioSelected
      ? providerReady && hasFrontDesk && webhooksVerified
      : integrationStack.data?.status.messaging.configured === true;
  const overallReady = isNativePhoneMode ? true : (readiness.data?.overall ?? readiness.data?.ready) === true;
  const messagingModeLabel =
    isNativePhoneMode ? 'Native phone mode' : isOpenPhoneSelected ? 'OpenPhone' : 'Twilio';

  const checklist = useMemo<ChecklistItem[]>(
    () => [
      {
        id: 'business',
        title: 'Set your business basics',
        description: 'Add your company name, timezone, branding, and service settings so the product feels like yours.',
        complete: false,
        href: '/settings?section=business',
        cta: 'Open settings',
        icon: <Building2 className="h-4 w-4" />,
        note: 'Recommended first step for every new workspace.',
      },
      {
        id: 'billing',
        title: 'Review payments and billing',
        description: 'Connect payment tools and confirm how invoices, payouts, and billing will work before inviting customers.',
        complete: false,
        href: '/settings?section=integrations',
        cta: 'Review billing setup',
        icon: <CreditCard className="h-4 w-4" />,
        note: 'Stripe and payout setup should be confirmed before live bookings.',
      },
      {
        id: 'messaging',
        title: 'Turn on customer messaging',
        description: 'Choose how your team communicates: native phone mode by default, with OpenPhone or Twilio available if you want connected workflows.',
        complete: messagingReady,
        href: '/settings?section=integrations',
        cta: messagingReady ? 'Review messaging options' : 'Choose messaging mode',
        icon: <MessageSquare className="h-4 w-4" />,
        note: isNativePhoneMode
          ? 'Native phone mode is active. Owners, sitters, and clients can work with their normal numbers.'
          : messagingReady
            ? `${messagingModeLabel} is ready for live use.`
            : !providerReady && isTwilioSelected
              ? 'Twilio credentials are still missing.'
              : !hasFrontDesk && isTwilioSelected
                ? 'A front desk number is still missing.'
                : isTwilioSelected
                  ? 'Webhooks still need verification.'
                  : `${messagingModeLabel} still needs connection details.`,
      },
      {
        id: 'team',
        title: 'Add your team',
        description: 'Invite sitters and make sure the owner team can operate bookings, communication, and coverage.',
        complete: false,
        href: '/sitters',
        cta: 'Manage team',
        icon: <Users className="h-4 w-4" />,
        note: 'Even a one-person launch should confirm the team workflow.',
      },
      {
        id: 'test-booking',
        title: 'Run a first-booking rehearsal',
        description: 'Create a test booking and walk through the customer, sitter, and owner experience before going live.',
        complete: overallReady,
        href: '/bookings/new',
        cta: overallReady ? 'Create a test booking' : 'Finish blockers first',
        icon: <Briefcase className="h-4 w-4" />,
        note: overallReady
          ? 'Your core launch signals are green enough for a live rehearsal.'
          : 'Complete messaging blockers before you test the live workflow.',
      },
    ],
    [messagingReady, overallReady, providerReady, hasFrontDesk, isNativePhoneMode, messagingModeLabel, isTwilioSelected]
  );

  const completedCount = checklist.filter((item) => item.complete).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  const handleTestConnection = async () => {
    setConnectionError(null);
    try {
      const result = await testConnection.mutateAsync({
        accountSid: accountSid || undefined,
        authToken: authToken || undefined,
      });

      if (result.success) {
        setConnectionTested(true);
        setConnectionError(null);
      } else {
        setConnectionTested(false);
        setConnectionError(result.error || 'Connection test failed');
      }
    } catch (error: any) {
      setConnectionTested(false);
      setConnectionError(error.message || 'Connection test failed');
    }
  };

  const handleConnectProvider = async () => {
    if (!accountSid || !authToken) {
      setConnectionError('Please enter both Account SID and Auth Token.');
      return;
    }

    try {
      await connectProvider.mutateAsync({ accountSid, authToken });
      setConnectionTested(true);
      setConnectionError(null);
    } catch (error: any) {
      setConnectionError(error.message || 'Failed to connect provider');
    }
  };

  return (
    <OwnerAppShell>
      <PageHeader
        title="Launch Setup"
        description="A guided checklist to get your workspace ready for a real customer rollout."
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-0">
            <div className="border-b border-border-muted px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Launch checklist</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Focus on the customer-facing essentials first. Support tools can wait until after launch.
                  </p>
                </div>
                <Badge variant={overallReady ? 'success' : 'warning'}>
                  {overallReady ? 'Core launch ready' : 'Still blocked'}
                </Badge>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-text-tertiary">
                  <span>{completedCount} of {checklist.length} complete</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
                  <div className="h-full rounded-full bg-accent-primary transition-[width]" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="divide-y divide-border-muted">
              {checklist.map((item, index) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-text-secondary">
                      {item.complete ? <CheckCircle2 className="h-4 w-4 text-status-success-fill" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 text-text-primary">
                          {item.icon}
                          <h2 className="text-sm font-semibold">{item.title}</h2>
                        </div>
                        <Badge variant={item.complete ? 'success' : 'neutral'}>
                          {item.complete ? 'Complete' : 'Action needed'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                      {item.note && <p className="mt-2 text-xs text-text-tertiary">{item.note}</p>}
                    </div>
                    <Link href={item.href} className="shrink-0">
                      <Button variant={item.complete ? 'secondary' : 'primary'} size="sm">
                        {item.cta}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Messaging readiness</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    OpenPhone and Twilio are optional. Native phone mode is a valid launch path if you want to keep communication simple.
                  </p>
                </div>
                <Badge variant={messagingReady ? 'success' : 'warning'}>
                  {messagingReady ? 'Ready' : 'Needs work'}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-start justify-between gap-3 rounded-xl bg-surface-secondary px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Selected messaging mode</p>
                    <p className="text-xs text-text-tertiary">
                      {isNativePhoneMode
                        ? 'No connector selected. The workspace can run with owner, sitter, and client phone numbers directly.'
                        : isOpenPhoneSelected
                          ? integrationStack.data?.status.messaging.detail ?? 'OpenPhone can be connected if you want a shared business line.'
                          : providerReady
                            ? `Connected as ${providerStatus.data?.accountSid ?? 'provider'}`
                            : 'Connect Twilio before inviting customers.'}
                    </p>
                  </div>
                  <Badge variant={messagingReady ? 'success' : 'warning'}>{messagingModeLabel}</Badge>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-xl bg-surface-secondary px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Phone routing</p>
                    <p className="text-xs text-text-tertiary">
                      {isNativePhoneMode
                        ? 'Native phone mode does not require masked routing numbers.'
                        : hasAnyNumbers
                          ? `${numbersStatus.data?.frontDesk.count ?? 0} front desk, ${numbersStatus.data?.pool.count ?? 0} pool, ${numbersStatus.data?.sitter.count ?? 0} sitter numbers`
                          : 'No active numbers detected yet.'}
                    </p>
                  </div>
                  <Badge variant={isNativePhoneMode || hasFrontDesk ? 'success' : 'warning'}>
                    {isNativePhoneMode ? 'Not required' : hasFrontDesk ? 'Front desk ready' : 'Missing front desk'}
                  </Badge>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-xl bg-surface-secondary px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Webhook health</p>
                    <p className="text-xs text-text-tertiary">
                      {isNativePhoneMode
                        ? 'No webhook dependency in native phone mode.'
                        : isOpenPhoneSelected
                          ? 'Review provider webhook settings if you want inbound sync.'
                          : formatLastReceived(lastWebhook.data?.lastReceivedAt)}
                    </p>
                  </div>
                  <Badge variant={isNativePhoneMode || isOpenPhoneSelected || webhooksVerified ? 'success' : 'warning'}>
                    {isNativePhoneMode ? 'Not required' : isOpenPhoneSelected ? 'Optional' : webhooksVerified ? 'Verified' : 'Not verified'}
                  </Badge>
                </div>
              </div>

              <div className="mt-4">
                <Link href="/settings?section=integrations" className="inline-flex">
                  <Button variant="secondary" size="sm">Open integration settings</Button>
                </Link>
              </div>
            </Card>

            <Card>
              <p className="text-sm font-semibold text-text-primary">What “ready to launch” means</p>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>You have business settings filled out.</p>
                <p>Your billing and payout flow has been reviewed.</p>
                <p>Customer messaging can send and receive messages reliably.</p>
                <p>Your team can complete at least one full booking rehearsal.</p>
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Step 3: Choose messaging mode</p>
              <p className="mt-1 text-sm text-text-secondary">
                The system works natively with normal phone numbers. Connect OpenPhone or Twilio only if you want a dedicated business line or deeper automation.
              </p>
            </div>
            <Badge variant={messagingReady ? 'success' : 'warning'}>
              {messagingReady ? `${messagingModeLabel} ready` : `${messagingModeLabel} in progress`}
            </Badge>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <div className="rounded-xl bg-surface-secondary px-4 py-4">
                <p className="text-sm font-semibold text-text-primary">Available options</p>
                <div className="mt-3 space-y-3 text-sm text-text-secondary">
                  <div>
                    <p className="font-medium text-text-primary">Native phone mode</p>
                    <p>Use the owner, sitter, and client phone numbers directly. Best for a fast launch and simple communication.</p>
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">OpenPhone</p>
                    <p>Optional shared business line when you want a dedicated team inbox and business identity.</p>
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">Twilio</p>
                    <p>Optional advanced connector for masked numbers, routing, automations, and webhook-driven workflows.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href="/settings?section=integrations" className="inline-flex">
                    <Button variant="secondary" size="sm">Choose messaging mode</Button>
                  </Link>
                </div>
              </div>

              {isTwilioSelected && (
                <>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Account SID</label>
                <Input
                  type="text"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Auth Token</label>
                <Input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Enter your auth token"
                />
              </div>

              {connectionError && (
                <div className="rounded-xl border border-status-danger-border bg-status-danger-bg px-4 py-3">
                  <p className="text-sm text-status-danger-text">{connectionError}</p>
                </div>
              )}

              {connectionTested && !connectionError && (
                <div className="rounded-xl border border-status-success-border bg-status-success-bg px-4 py-3">
                  <p className="text-sm text-status-success-text">Connection test passed. You can save this provider.</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleTestConnection}
                  disabled={testConnection.isPending}
                  variant="secondary"
                >
                  {testConnection.isPending ? 'Testing...' : 'Test connection'}
                </Button>
                <Button
                  onClick={handleConnectProvider}
                  disabled={!connectionTested || connectProvider.isPending || !accountSid || !authToken}
                  variant="primary"
                >
                  {connectProvider.isPending ? 'Saving...' : 'Connect and save'}
                </Button>
                {!webhooksVerified && providerReady && (
                  <Button
                    onClick={() => installWebhooks.mutate()}
                    disabled={installWebhooks.isPending}
                    variant="secondary"
                  >
                    {installWebhooks.isPending ? 'Installing...' : 'Install webhooks'}
                  </Button>
                )}
              </div>
                </>
              )}

              {isOpenPhoneSelected && (
                <div className="rounded-xl border border-border-default bg-surface-secondary px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">OpenPhone selected</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    OpenPhone is available as an optional connection. Configure it when you want a shared business line instead of native phone mode.
                  </p>
                  <div className="mt-4">
                    <Link href="/settings?section=openphone" className="inline-flex">
                      <Button variant="secondary" size="sm">Open OpenPhone setup</Button>
                    </Link>
                  </div>
                </div>
              )}

              {isNativePhoneMode && (
                <div className="rounded-xl border border-border-default bg-surface-secondary px-4 py-4">
                  <p className="text-sm font-semibold text-text-primary">Native phone mode is active</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    This workspace can launch without a connector. Owners, sitters, and clients can use their usual phone numbers while you validate the core workflow.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {providerStatus.isLoading || numbersStatus.isLoading || webhookStatus.isLoading || readiness.isLoading ? (
                <Skeleton height={260} />
              ) : (
                <>
                  <div className="rounded-xl bg-surface-secondary px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">Provider status</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {isNativePhoneMode
                        ? 'No connector required in native phone mode.'
                        : isOpenPhoneSelected
                          ? integrationStack.data?.status.messaging.detail ?? 'OpenPhone not connected yet.'
                          : providerReady
                            ? 'Connected and saved for this workspace.'
                            : 'No provider credentials saved yet.'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-surface-secondary px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">Numbers status</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {isNativePhoneMode
                        ? 'Use real owner, sitter, and client numbers directly.'
                        : hasAnyNumbers
                          ? `${numbersStatus.data?.frontDesk.count ?? 0} front desk, ${numbersStatus.data?.pool.count ?? 0} pool, ${numbersStatus.data?.sitter.count ?? 0} sitter numbers available.`
                          : 'Sync or connect numbers after the provider is connected.'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-surface-secondary px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">Webhook status</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {isNativePhoneMode
                        ? 'No webhook dependency in native phone mode.'
                        : isOpenPhoneSelected
                          ? 'Review OpenPhone webhook settings if you want inbound sync.'
                          : webhooksVerified
                            ? 'Inbound webhooks are verified.'
                            : 'Webhooks still need installation or verification.'}
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">{formatLastReceived(lastWebhook.data?.lastReceivedAt)}</p>
                  </div>

                  <div className="rounded-xl bg-surface-secondary px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">Launch signal</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {overallReady
                        ? 'Core readiness checks are green for a booking rehearsal.'
                        : 'Complete the selected connector setup before you run your launch rehearsal.'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Recommended next actions</p>
              <p className="mt-1 text-sm text-text-secondary">
                Move through these in order for the smoothest launch.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Link href="/settings?section=business" className="group rounded-xl border border-border-default bg-surface-secondary px-4 py-4 transition hover:bg-surface-tertiary">
              <p className="text-sm font-semibold text-text-primary">Review business profile</p>
              <p className="mt-1 text-sm text-text-secondary">Company details, timezone, branding, and services.</p>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-primary">
                Open settings <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link href="/sitters" className="group rounded-xl border border-border-default bg-surface-secondary px-4 py-4 transition hover:bg-surface-tertiary">
              <p className="text-sm font-semibold text-text-primary">Confirm team readiness</p>
              <p className="mt-1 text-sm text-text-secondary">Make sure owner and sitter workflows are ready for a real booking.</p>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-primary">
                Review team <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link href="/bookings/new" className="group rounded-xl border border-border-default bg-surface-secondary px-4 py-4 transition hover:bg-surface-tertiary">
              <p className="text-sm font-semibold text-text-primary">Run a booking rehearsal</p>
              <p className="mt-1 text-sm text-text-secondary">Create a test booking and walk it through the full lifecycle.</p>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-primary">
                Create test booking <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </OwnerAppShell>
  );
}
