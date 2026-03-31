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
      <Card className="p-4">
        <p className="font-semibold mb-2">Connection Status</p>
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
          <p className="font-semibold mb-3">Connect OpenPhone</p>
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
          <p className="font-semibold mb-2">Webhook URL</p>
          <p className="text-xs text-text-tertiary mb-2">Add this URL in your OpenPhone dashboard under Settings &gt; Webhooks.</p>
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
          <p className="font-semibold mb-2">Send Test Message</p>
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
          <p className="font-semibold mb-3">Recent Activity</p>
          <ProviderMessageLog provider="openphone" />
        </Card>
      )}

      {connected && (
        <Card className="p-4">
          <p className="font-semibold mb-2">Disconnect</p>
          <p className="text-sm text-text-tertiary mb-3">Remove OpenPhone configuration. Messages will stop sending.</p>
          <Button variant="secondary" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}
            className="border-status-danger-border text-status-danger-text hover:bg-status-danger-bg">
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect OpenPhone'}
          </Button>
        </Card>
      )}
    </div>
  );
}
