'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input } from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';
import { ProviderMessageLog } from '@/components/messaging/ProviderMessageLog';

export function OpenPhoneSetupPanel() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [testPhone, setTestPhone] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['messaging-provider-status'],
    queryFn: async () => {
      const res = await fetch('/api/settings/messaging-provider');
      return res.json();
    },
  });

  const connected = status?.openphone?.connected === true;
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/messages/webhook/openphone`
    : '';

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/messaging-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openphone',
          config: { apiKey, phoneNumberId, phoneNumber: phoneNumber || undefined },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
    },
    onSuccess: () => {
      toastSuccess('OpenPhone connected');
      queryClient.invalidateQueries({ queryKey: ['messaging-provider-status'] });
    },
    onError: (e: Error) => toastError(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/messaging-provider', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
    },
    onSuccess: () => {
      toastSuccess('OpenPhone disconnected');
      queryClient.invalidateQueries({ queryKey: ['messaging-provider-status'] });
    },
    onError: () => toastError('Failed to disconnect'),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/messaging-provider/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testPhone, message: 'Test from Snout OS via OpenPhone' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Test failed');
    },
    onSuccess: () => toastSuccess('Test message sent!'),
    onError: (e: Error) => toastError(e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-border-default bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
                Optional U.S. business connector
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                connected
                  ? 'bg-status-success-bg text-status-success-text'
                  : 'bg-status-warning-bg text-status-warning-text'
              }`}>
                {connected ? 'Connected' : 'Setup in progress'}
              </span>
            </div>
            <h2 className="text-xl font-bold mb-1">OpenPhone shared line</h2>
            <p className="text-sm text-text-secondary">
              Use OpenPhone when you want a shared business number with a simpler setup path than Twilio. It is optional. Native phone mode still works if your team prefers normal numbers.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Best for</p>
          <p className="text-sm text-text-secondary">Small teams that want one recognizable office line without full Twilio routing complexity.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Recommended setup</p>
          <p className="text-sm text-text-secondary">Connect the workspace, add the webhook URL in OpenPhone, then send one live test message.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">What to expect</p>
          <p className="text-sm text-text-secondary">OpenPhone gives you a shared business contact point, while Snout OS keeps messaging context tied to bookings and threads.</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-lg font-semibold">Guided setup</p>
            <p className="text-sm text-text-secondary">Use these steps to decide whether OpenPhone is the right fit and get it live cleanly.</p>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            connected
              ? 'bg-status-success-bg text-status-success-text'
              : 'bg-status-warning-bg text-status-warning-text'
          }`}>
            {connected ? 'Ready for webhook + test review' : 'Waiting for connection'}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            '1. Connect your OpenPhone workspace and choose the business number you want Snout OS to use.',
            '2. Add the webhook URL in OpenPhone so inbound messages and events flow back into the app.',
            '3. Send one live test to confirm the number, webhook, and booking thread behavior all line up.',
          ].map((step) => (
            <div key={step} className="rounded-xl border border-border-default bg-surface-secondary p-4 text-sm text-text-secondary">
              {step}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="font-semibold mb-2">Step 1: Connection status</p>
        {isLoading ? (
          <p className="text-sm text-text-tertiary">Loading...</p>
        ) : connected ? (
          <div>
            <p className="text-sm text-status-success-text">Connected</p>
            {status.openphone.phoneNumber && (
              <p className="text-sm text-text-secondary mt-1">Number: {status.openphone.phoneNumber}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-status-warning-text">Not connected</p>
        )}
      </Card>

      {!connected && (
        <Card className="p-4">
          <p className="font-semibold mb-1">Connect OpenPhone</p>
          <p className="text-sm text-text-secondary mb-3">Add the API key and phone number you want the office to use as its shared line.</p>
          <div className="flex flex-col gap-3">
            <Input label="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="op_..." type="password" />
            <Input label="Phone Number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="PN_xxx" />
            <Input label="Phone Number (E.164)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+12345678901" />
            <Button variant="primary" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending || !apiKey || !phoneNumberId}>
              {connectMutation.isPending ? 'Connecting...' : 'Connect OpenPhone'}
            </Button>
          </div>
        </Card>
      )}

      {connected && (
        <Card className="p-4">
          <p className="font-semibold mb-2">Step 2: Add webhook URL</p>
          <p className="text-xs text-text-tertiary mb-2">Add this URL in your OpenPhone dashboard under Settings &gt; Webhooks so replies and delivery events can reach Snout OS.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-sm font-mono break-all">
              {webhookUrl}
            </code>
            <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toastSuccess('Copied'); }}>
              Copy
            </Button>
          </div>
        </Card>
      )}

      {connected && (
        <Card className="p-4">
          <p className="font-semibold mb-1">Step 3: Send a live test</p>
          <p className="text-sm text-text-secondary mb-2">Use a real phone number so you can confirm the shared line and thread behavior before launch.</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input label="Phone number" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+12345678901" />
            </div>
            <Button variant="primary" onClick={() => testMutation.mutate()} disabled={testMutation.isPending || !testPhone}>
              {testMutation.isPending ? 'Sending...' : 'Send test'}
            </Button>
          </div>
        </Card>
      )}

      {connected && (
        <Card className="p-4">
          <p className="font-semibold mb-1">Recent activity</p>
          <p className="text-sm text-text-secondary mb-3">Review recent provider events here if you want a quick support check after setup.</p>
          <ProviderMessageLog provider="openphone" />
        </Card>
      )}

      {connected && (
        <Card className="p-4">
          <p className="font-semibold mb-1">Support tool: disconnect</p>
          <p className="text-sm text-text-tertiary mb-3">Remove the OpenPhone configuration if you are switching providers or returning to native phone mode. Provider-backed sends will stop.</p>
          <Button variant="secondary" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}
            className="border-status-danger-border text-status-danger-text hover:bg-status-danger-bg">
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect OpenPhone'}
          </Button>
        </Card>
      )}
    </div>
  );
}
