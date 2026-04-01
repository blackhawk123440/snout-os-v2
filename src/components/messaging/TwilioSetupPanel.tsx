/**
 * Twilio Setup Panel - Embedded in Messages tab
 *
 * Owner can save credentials, test connection, install webhooks, check readiness
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, Button, Badge, Skeleton, Modal, Input } from '@/components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/client';
import { toastError, toastSuccess } from '@/lib/toast';
import { z } from 'zod';

const providerStatusSchema = z.object({
  connected: z.boolean(),
  accountSid: z.string().nullable(),
  hasAuthToken: z.boolean().optional(),
  lastTestedAt: z.string().nullable(),
  testResult: z.object({
    success: z.boolean(),
    message: z.string(),
  }).nullable().optional(),
  checkedAt: z.string().optional(),
  verified: z.boolean().optional(),
  errorDetail: z.string().optional(),
}).passthrough();

const webhookNumberInfoSchema = z.object({
  phoneNumberSid: z.string(),
  e164: z.string(),
  smsUrl: z.string().nullable(),
  verified: z.boolean(),
}).passthrough();

const webhookStatusSchema = z.object({
  installed: z.boolean(),
  url: z.string().nullable(),
  lastReceivedAt: z.string().nullable(),
  status: z.string(),
  checkedAt: z.string().optional(),
  verified: z.boolean().optional(),
  errorDetail: z.string().optional(),
  webhookUrlExpected: z.string().nullable().optional(),
  matchedNumbers: z.array(webhookNumberInfoSchema).optional(),
  unmatchedNumbers: z.array(webhookNumberInfoSchema).optional(),
}).passthrough();

const readinessSchema = z.object({
  provider: z.object({ ready: z.boolean(), message: z.string() }),
  numbers: z.object({ ready: z.boolean(), message: z.string() }),
  webhooks: z.object({ ready: z.boolean(), message: z.string() }),
  overall: z.boolean(),
  checkedAt: z.string().optional(),
}).passthrough();

function useProviderStatus() {
  return useQuery({
    queryKey: ['setup', 'provider', 'status'],
    queryFn: () => apiGet('/api/setup/provider/status', providerStatusSchema),
  });
}

function useWebhookStatus() {
  return useQuery({
    queryKey: ['setup', 'webhooks', 'status'],
    queryFn: () => apiGet('/api/setup/webhooks/status', webhookStatusSchema),
  });
}

function useReadiness() {
  return useQuery({
    queryKey: ['setup', 'readiness'],
    queryFn: () => apiGet('/api/setup/readiness', readinessSchema),
  });
}

function useTestConnection() {
  return useMutation({
    mutationFn: (params: { accountSid?: string; authToken?: string }) =>
      apiPost('/api/setup/provider/test', params, z.object({
        success: z.boolean(),
        message: z.string(),
      })),
  });
}

const connectResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  verified: z.boolean().optional(),
  ok: z.boolean().optional(),
  orgId: z.string().optional(),
  checkedAt: z.string().optional(),
}).passthrough();

const updatedNumberSchema = z.object({
  phoneNumberSid: z.string(),
  e164: z.string(),
  oldSmsUrl: z.string().nullable(),
  newSmsUrl: z.string(),
  verified: z.boolean(),
}).passthrough();

const installResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  url: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  webhookUrlConfigured: z.boolean().optional(),
  orgId: z.string().optional(),
  checkedAt: z.string().optional(),
  updatedNumbers: z.array(updatedNumberSchema).optional(),
  webhookUrlExpected: z.string().optional(),
}).passthrough();

function useConnectProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { accountSid: string; authToken: string }) =>
      apiPost('/api/setup/provider/connect', params, connectResponseSchema),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['setup'] });
      await queryClient.refetchQueries({ queryKey: ['setup', 'provider', 'status'] });
      await queryClient.refetchQueries({ queryKey: ['setup', 'readiness'] });
    },
  });
}

function useInstallWebhooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/api/setup/webhooks/install', {}, installResponseSchema),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['setup'] });
      await queryClient.refetchQueries({ queryKey: ['setup', 'webhooks', 'status'] });
      await queryClient.refetchQueries({ queryKey: ['setup', 'readiness'] });
    },
  });
}

const syncNumbersResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  synced: z.number(),
}).passthrough();

function useSyncNumbers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/api/setup/numbers/sync', {}, syncNumbersResponseSchema),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['setup'] });
      await queryClient.refetchQueries({ queryKey: ['setup', 'readiness'] });
    },
  });
}

function useTestSMS() {
  return useMutation({
    mutationFn: (params: { destinationE164: string; fromClass: 'front_desk' | 'pool' | 'sitter' }) =>
      apiPost('/api/setup/test-sms', params, z.object({
        success: z.boolean(),
        messageSid: z.string().nullable(),
        error: z.string().nullable(),
        errorCode: z.string().nullable(),
        fromE164: z.string().nullable(),
      })),
  });
}

export function TwilioSetupPanel() {
  const { data: providerStatus, isLoading: providerLoading } = useProviderStatus();
  const { data: webhookStatus, isLoading: webhookLoading } = useWebhookStatus();
  const { data: readiness, isLoading: readinessLoading } = useReadiness();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectForm, setConnectForm] = useState({ accountSid: '', authToken: '' });
  const [showTestModal, setShowTestModal] = useState(false);
  const [testForm, setTestForm] = useState({ accountSid: '', authToken: '' });
  const [showTestSMSModal, setShowTestSMSModal] = useState(false);
  const [testSMSForm, setTestSMSForm] = useState({ destinationE164: '', fromClass: 'front_desk' as 'front_desk' | 'pool' | 'sitter' });
  const [verificationFailedBanner, setVerificationFailedBanner] = useState<string | null>(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);

  const testConnection = useTestConnection();
  const connectProvider = useConnectProvider();
  const installWebhooks = useInstallWebhooks();
  const syncNumbers = useSyncNumbers();
  const testSMS = useTestSMS();

  const handleTest = async () => {
    try {
      const result = await testConnection.mutateAsync({
        accountSid: testForm.accountSid || undefined,
        authToken: testForm.authToken || undefined,
      });
      if (result.success) {
        toastSuccess(result.message || 'Connection test successful');
      } else {
        toastError(result.message || 'Connection test failed');
      }
    } catch (error: any) {
      toastError(`Test failed: ${error.message}`);
    }
  };

  const handleConnect = async () => {
    if (!connectForm.accountSid || !connectForm.authToken) {
      toastError('Enter both Account SID and Auth Token');
      return;
    }
    setVerificationFailedBanner(null);
    try {
      const result = await connectProvider.mutateAsync(connectForm);
      if (result.verified === true) {
        setShowConnectModal(false);
        setConnectForm({ accountSid: '', authToken: '' });
        toastSuccess('Twilio connected and verified');
      } else if (result.verified === false) {
        setVerificationFailedBanner('Connect reported success but verification failed. Use "Copy Setup Diagnostics" to debug.');
      } else {
        setShowConnectModal(false);
        setConnectForm({ accountSid: '', authToken: '' });
        toastSuccess(result.message || 'Credentials saved');
      }
    } catch (error: any) {
      toastError(`Failed to save credentials: ${error.message}`);
    }
  };

  const handleInstallWebhooks = async () => {
    setVerificationFailedBanner(null);
    try {
      const result = await installWebhooks.mutateAsync();
      const verified = result.verified === true || result.webhookUrlConfigured === true;
      if (verified) {
        toastSuccess('Webhooks installed and verified');
      } else if (result.success && result.verified === false) {
        setVerificationFailedBanner('Install reported success but verification failed. Use "Copy Setup Diagnostics" to debug.');
      } else if (!result.success) {
        toastError(result.message || 'Webhook install failed');
      }
    } catch (error: any) {
      toastError(`Failed to install webhooks: ${error.message}`);
    }
  };

  const handleCopyDiagnostics = async () => {
    try {
      const res = await fetch('/api/ops/twilio-setup-diagnostics');
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || 'Failed to fetch diagnostics');
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setDiagnosticsCopied(true);
      setTimeout(() => setDiagnosticsCopied(false), 2000);
      toastSuccess('Setup diagnostics copied');
    } catch (e: any) {
      toastError(e?.message || 'Failed to copy diagnostics');
    }
  };

  if (providerLoading || webhookLoading || readinessLoading) {
    return <Skeleton height={400} />;
  }

  const setupSteps = [
    {
      label: 'Connect account',
      ready: readiness?.provider.ready ?? false,
      detail: providerStatus?.connected
        ? 'Twilio credentials are saved and the account is reachable.'
        : 'Add your Account SID and Auth Token to unlock number sync and SMS testing.',
    },
    {
      label: 'Sync numbers',
      ready: readiness?.numbers.ready ?? false,
      detail: readiness?.numbers.ready
        ? readiness?.numbers.message
        : 'Pull your Twilio numbers into Snout OS so the app can choose the right sending line.',
    },
    {
      label: 'Install webhooks',
      ready: readiness?.webhooks.ready ?? false,
      detail: readiness?.webhooks.ready
        ? readiness?.webhooks.message
        : 'Install inbound webhooks so replies and delivery events come back into the workspace.',
    },
  ];
  const completedSteps = setupSteps.filter((step) => step.ready).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="warning">Optional U.S. business connector</Badge>
              <Badge variant={readiness?.overall ? 'success' : 'warning'}>
                {readiness?.overall ? 'Launch-ready' : `${completedSteps}/3 setup steps complete`}
              </Badge>
            </div>
            <h2 className="text-xl font-bold mb-1">
              Twilio business messaging
            </h2>
            <p className="text-sm text-text-secondary">
              Use Twilio when you want a dedicated business line, masked routing, or automated carrier-backed SMS flows. If your team is happy using normal phone numbers, native phone mode is still the recommended default.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleCopyDiagnostics}>
            {diagnosticsCopied ? 'Copied' : 'Copy Setup Diagnostics'}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Best for</p>
          <p className="text-sm text-text-secondary">Teams that want a shared business number, masked sitter routing, and auditable SMS delivery.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Recommended setup</p>
          <p className="text-sm text-text-secondary">Connect the account, sync numbers, install webhooks, then send one owner test before going live.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">What masking does</p>
          <p className="text-sm text-text-secondary">Clients see the business line, sitters can reply through routed numbers, and the office keeps visibility across the full thread.</p>
        </Card>
      </div>

      {verificationFailedBanner && (
        <Card className="p-4" style={{ borderLeft: '4px solid #dc2626', backgroundColor: '#fef2f2' }}>
          <div className="flex justify-between items-start gap-3">
            <p className="m-0 text-sm font-medium">
              {verificationFailedBanner}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={handleCopyDiagnostics}>
                Copy Setup Diagnostics
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setVerificationFailedBanner(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Guided setup</h3>
            <p className="text-sm text-text-secondary">Follow these steps in order to make Twilio fully usable inside the workspace.</p>
          </div>
          <Badge variant={readiness?.overall ? 'success' : 'warning'}>
            {readiness?.overall ? 'Ready to use' : 'Still in setup'}
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {setupSteps.map((step, index) => (
            <div key={step.label} className="rounded-xl border border-border-default bg-surface-secondary p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-sm font-semibold">{index + 1}. {step.label}</div>
                <Badge variant={step.ready ? 'success' : 'warning'}>
                  {step.ready ? 'Done' : 'Next'}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary">{step.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">
            Step 1: Connect account
          </h3>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTestModal(true)}
            >
              Test Connection
            </Button>
            <Button
              variant={providerStatus?.connected ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowConnectModal(true)}
            >
              {providerStatus?.connected ? 'Update Credentials' : 'Connect Provider'}
            </Button>
          </div>
        </div>

        {providerStatus?.connected ? (
          <div>
            <Badge variant="success" className="mb-2">
              Connected ✓
            </Badge>
            <div className="text-sm text-text-secondary">
              <div>Account SID: {providerStatus.accountSid || 'Not set'}</div>
              {providerStatus.checkedAt && (
                <div>Last checked: {new Date(providerStatus.checkedAt).toLocaleString()}</div>
              )}
              {providerStatus.lastTestedAt && (
                <div>Last tested: {new Date(providerStatus.lastTestedAt).toLocaleString()}</div>
              )}
              {providerStatus.testResult && (
                <div>
                  Test result: <Badge variant={providerStatus.testResult.success ? 'success' : 'error'}>
                    {providerStatus.testResult.message}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <Badge variant="error">Not Connected</Badge>
            {providerStatus?.errorDetail && (
              <p className="text-sm text-[#dc2626] mt-2">
                {providerStatus.errorDetail}
              </p>
            )}
            <p className="text-sm text-text-secondary mt-2">
              Connect your Twilio account to enable provider-backed SMS in this workspace.
            </p>
            {providerStatus?.checkedAt && (
              <div className="text-xs text-text-secondary mt-1">
                Last checked: {new Date(providerStatus.checkedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">
            Step 2: Install inbound webhooks
          </h3>
          <Button
            variant={webhookStatus?.installed ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleInstallWebhooks}
            disabled={installWebhooks.isPending}
          >
            {installWebhooks.isPending ? 'Installing...' : webhookStatus?.installed ? 'Reinstall' : 'Install Webhooks'}
          </Button>
        </div>

        {webhookStatus?.installed ? (
          <div>
            <Badge variant="success" className="mb-2">
              Installed ✓
            </Badge>
            <div className="text-sm text-text-secondary">
              {(webhookStatus.matchedNumbers?.length ?? 0) > 0 && (
                <div>Installed on {webhookStatus.matchedNumbers!.length} number{webhookStatus.matchedNumbers!.length !== 1 ? 's' : ''}</div>
              )}
              <div>URL: <code className="font-mono text-[11px]">{webhookStatus.url || 'Not set'}</code></div>
              {webhookStatus.checkedAt && (
                <div>Last checked: {new Date(webhookStatus.checkedAt).toLocaleString()}</div>
              )}
              {webhookStatus.lastReceivedAt && (
                <div>Last received: {new Date(webhookStatus.lastReceivedAt).toLocaleString()}</div>
              )}
              <div>Status: <Badge variant={webhookStatus.status === 'installed' ? 'success' : 'warning'}>{webhookStatus.status}</Badge></div>
            </div>
          </div>
        ) : (
          <div>
            <Badge variant="error">Not Installed</Badge>
            {webhookStatus?.errorDetail && (
              <p className="text-sm text-[#dc2626] mt-2">
                {webhookStatus.errorDetail}
              </p>
            )}
            {webhookStatus?.unmatchedNumbers?.length ? (
              <p className="text-sm text-[#dc2626] mt-2">
                First mismatch: {webhookStatus.unmatchedNumbers[0].e164} → {webhookStatus.unmatchedNumbers[0].smsUrl || 'not set'}
              </p>
            ) : null}
            <p className="text-sm text-text-secondary mt-2">
              Install webhooks so inbound messages and delivery activity flow back into Snout OS.
            </p>
            {webhookStatus?.checkedAt && (
              <div className="text-xs text-text-secondary mt-1">
                Last checked: {new Date(webhookStatus.checkedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">
            Step 3: Sync numbers and send a live test
          </h3>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => syncNumbers.mutate(undefined, { onSuccess: (d) => toastSuccess(d?.message ?? 'Numbers synced'), onError: (e: any) => toastError(e?.message ?? 'Sync failed') })}
              disabled={!providerStatus?.connected || syncNumbers.isPending}
            >
              {syncNumbers.isPending ? 'Syncing...' : 'Sync numbers'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowTestSMSModal(true)}
              disabled={!providerStatus?.connected}
            >
              Send Test SMS
            </Button>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          Sync your Twilio inventory first if the app says no sending number is available. Then send a real test through the same pipeline your team will use in production.
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">Launch readiness</h3>
            <p className="text-sm text-text-secondary">These checks confirm whether Twilio is actually ready to carry live messages.</p>
          </div>
          <Badge variant={readiness?.overall ? 'success' : 'warning'}>
            {readiness?.overall ? 'Ready' : 'Needs attention'}
          </Badge>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span>Provider Connection</span>
            <Badge variant={readiness?.provider.ready ? 'success' : 'error'}>
              {readiness?.provider.ready ? 'Ready' : 'Not Ready'}
            </Badge>
          </div>
          {!readiness?.provider.ready && (
            <div className="text-sm text-text-secondary ml-4">
              {readiness?.provider.message}
            </div>
          )}

          <div className="flex justify-between items-center">
            <span>Numbers</span>
            <Badge variant={readiness?.numbers.ready ? 'success' : 'error'}>
              {readiness?.numbers.ready ? 'Ready' : 'Not Ready'}
            </Badge>
          </div>
          {!readiness?.numbers.ready && (
            <div className="text-sm text-text-secondary ml-4">
              {readiness?.numbers.message}
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncNumbers.mutate(undefined)}
                  disabled={syncNumbers.isPending}
                >
                  {syncNumbers.isPending ? 'Syncing...' : 'Sync Numbers Now'}
                </Button>
                <Link href="/messaging/numbers">
                  <Button variant="secondary" size="sm">Open Numbers Inventory</Button>
                </Link>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span>Webhooks</span>
            <Badge variant={readiness?.webhooks.ready ? 'success' : 'error'}>
              {readiness?.webhooks.ready ? 'Ready' : 'Not Ready'}
            </Badge>
          </div>
          {!readiness?.webhooks.ready && (
            <div className="text-sm text-text-secondary ml-4">
              {readiness?.webhooks.message}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border-default">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Overall Status</span>
              <Badge variant={readiness?.overall ? 'success' : 'error'}>
                {readiness?.overall ? 'Ready' : 'Not Ready'}
              </Badge>
            </div>
            {readiness?.checkedAt && (
              <div className="text-xs text-text-secondary mt-2">
                Last checked: {new Date(readiness.checkedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </Card>

      {providerStatus?.connected && (
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Owner delivery check</p>
              <p className="text-sm text-text-secondary">
                Send one live message to the owner phone before opening Twilio to staff or customers.
              </p>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/api/setup/test-owner-sms', { method: 'POST' });
                  const json = await res.json();
                  if (json.success) {
                    toastSuccess(`Test sent to ${json.phone} via ${json.provider}`);
                  } else {
                    toastError(`Failed: ${json.error}`);
                  }
                } catch {
                  toastError('Failed to send test');
                }
              }}
            >
              Send test
            </Button>
          </div>
        </Card>
      )}

      {providerStatus?.connected && (
        <Card className="p-4">
          <p className="font-semibold mb-2">Specialist compliance note</p>
          <p className="text-sm text-text-secondary mb-2">
            U.S. carriers require A2P 10DLC registration for business SMS. Without it, delivery can be filtered or blocked even if setup tests pass.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="warning">Check Twilio Console</Badge>
            <a
              href="https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline text-primary"
            >
              Open A2P registration →
            </a>
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            If you're using OpenPhone instead, A2P registration is handled by OpenPhone.
          </p>
        </Card>
      )}

      {showConnectModal && (
        <Modal isOpen={showConnectModal} title="Connect Twilio Provider" onClose={() => setShowConnectModal(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block mb-2 font-medium">
                Account SID
              </label>
              <Input
                type="text"
                value={connectForm.accountSid}
                onChange={(e) => setConnectForm({ ...connectForm, accountSid: e.target.value })}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">
                Auth Token
              </label>
              <Input
                type="password"
                value={connectForm.authToken}
                onChange={(e) => setConnectForm({ ...connectForm, authToken: e.target.value })}
                placeholder="Your Twilio Auth Token"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => setShowConnectModal(false)} variant="secondary">
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={connectProvider.isPending || !connectForm.accountSid || !connectForm.authToken}
                variant="primary"
              >
                {connectProvider.isPending ? 'Saving...' : 'Save Credentials'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <Modal isOpen={showTestModal} title="Test Connection" onClose={() => setShowTestModal(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Test connection with credentials (optional - uses saved credentials if not provided)
            </p>
            <div>
              <label className="block mb-2 font-medium">
                Account SID (optional)
              </label>
              <Input
                type="text"
                value={testForm.accountSid}
                onChange={(e) => setTestForm({ ...testForm, accountSid: e.target.value })}
                placeholder="Leave empty to use saved credentials"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">
                Auth Token (optional)
              </label>
              <Input
                type="password"
                value={testForm.authToken}
                onChange={(e) => setTestForm({ ...testForm, authToken: e.target.value })}
                placeholder="Leave empty to use saved credentials"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => setShowTestModal(false)} variant="secondary">
                Cancel
              </Button>
              <Button
                onClick={handleTest}
                disabled={testConnection.isPending}
                variant="primary"
              >
                {testConnection.isPending ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Test SMS Modal - enter phone number to send test SMS */}
      {showTestSMSModal && (
        <Modal isOpen={showTestSMSModal} title="Send Test SMS" onClose={() => setShowTestSMSModal(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Enter your phone number in E.164 format (e.g. +15551234567). The test message will be sent from your connected Twilio number.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">
                Phone number
              </label>
              <Input
                type="tel"
                placeholder="+15551234567"
                value={testSMSForm.destinationE164}
                onChange={(e) => setTestSMSForm((f) => ({ ...f, destinationE164: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Send from
              </label>
              <select
                value={testSMSForm.fromClass}
                onChange={(e) => setTestSMSForm((f) => ({ ...f, fromClass: e.target.value as 'front_desk' | 'pool' | 'sitter' }))}
                className="w-full p-2 rounded text-sm border border-border-default"
              >
                <option value="front_desk">Front desk</option>
                <option value="pool">Pool</option>
                <option value="sitter">Sitter</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setShowTestSMSModal(false)} variant="secondary">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  testSMS.mutate(testSMSForm, {
                    onSuccess: () => {
                      setShowTestSMSModal(false);
                      setTestSMSForm({ destinationE164: '', fromClass: 'front_desk' });
                      toastSuccess('Test SMS sent');
                    },
                    onError: (err: any) => toastError(err?.message || 'Failed to send test SMS'),
                  });
                }}
                disabled={!testSMSForm.destinationE164.trim() || testSMS.isPending}
              >
                {testSMS.isPending ? 'Sending...' : 'Send Test SMS'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
