/**
 * Setup Wizard Page
 *
 * Full operational control for Twilio setup
 */

'use client';

import { useState } from 'react';
import { OwnerAppShell } from '@/components/layout';
import { PageHeader, Card, Button, Input, Badge, Skeleton } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
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

  if (authLoading) {
    return (
      <OwnerAppShell>
        <PageHeader title="Setup" />
        <div className="p-4">
          <Skeleton height={400} />
        </div>
      </OwnerAppShell>
    );
  }

  if (!isOwner) {
    return (
      <OwnerAppShell>
        <PageHeader title="Setup" />
        <div className="p-4">
          <Card>
            <p>Access denied. Owner access required.</p>
          </Card>
        </div>
      </OwnerAppShell>
    );
  }

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
      setConnectionError('Please enter both Account SID and Auth Token');
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

  const handleInstallWebhooks = async () => {
    try {
      await installWebhooks.mutateAsync();
    } catch (error: any) {
      alert(`Failed to install webhooks: ${error.message}`);
    }
  };

  const formatLastReceived = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute(s) ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour(s) ago`;
    return date.toLocaleString();
  };

  return (
    <OwnerAppShell>
      <PageHeader
        title="Messaging Setup"
        description="Configure your Twilio connection and verify system readiness"
      />
      <div className="p-6 max-w-[800px] mx-auto">
        {/* Provider Connection */}
        <Card className="mb-6">
          <h2 className="text-xl mb-4">
            Step 1: Connect Provider
          </h2>
          <p className="text-text-secondary mb-4">
            Enter your Twilio credentials to connect your messaging account.
          </p>

          <div className="mb-4">
            <label className="block mb-2 font-medium">
              Account SID
            </label>
            <Input
              type="text"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium">
              Auth Token
            </label>
            <Input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Enter your auth token"
            />
          </div>

          {connectionError && (
            <div className="p-3 bg-status-danger-bg border border-status-danger-border rounded-md mb-4">
              <p className="text-status-danger-text text-sm">
                {connectionError}
              </p>
            </div>
          )}

          {connectionTested && !connectionError && (
            <div className="p-3 bg-status-success-bg border border-status-success-border rounded-md mb-4">
              <p className="text-status-success-text text-sm">
                ✓ Connection successful
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
              variant="secondary"
            >
              {testConnection.isPending ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={handleConnectProvider}
              disabled={!connectionTested || connectProvider.isPending || !accountSid || !authToken}
              variant="primary"
            >
              {connectProvider.isPending ? 'Connecting...' : 'Connect & Save'}
            </Button>
          </div>
        </Card>

        {/* Provider Status */}
        <Card className="mb-6">
          <h2 className="text-xl mb-4">
            Provider Status
          </h2>
          {providerStatus.isLoading ? (
            <Skeleton height={100} />
          ) : (
            <div>
              <p>
                Status: <Badge variant={providerStatus.data?.connected ? 'success' : 'error'}>
                  {providerStatus.data?.connected ? 'Connected' : 'Not Connected'}
                </Badge>
              </p>
              {providerStatus.data?.accountSid && (
                <p className="text-text-secondary text-sm">
                  Account: {providerStatus.data.accountSid}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Numbers Status */}
        <Card className="mb-6">
          <h2 className="text-xl mb-4">
            Numbers Status
          </h2>
          {numbersStatus.isLoading ? (
            <Skeleton height={100} />
          ) : (
            <div>
              <p>
                Front Desk: <Badge variant={numbersStatus.data?.hasFrontDesk ? 'success' : 'error'}>
                  {numbersStatus.data?.hasFrontDesk ? `${numbersStatus.data.frontDesk.count} number(s)` : 'Not configured'}
                </Badge>
              </p>
              <p>
                Pool Numbers: <Badge>{numbersStatus.data?.pool.count || 0} number(s)</Badge>
              </p>
              <p>
                Sitter Numbers: <Badge>{numbersStatus.data?.sitter.count || 0} number(s)</Badge>
              </p>
            </div>
          )}
        </Card>

        {/* Webhook Status */}
        <Card className="mb-6">
          <h2 className="text-xl mb-4">
            Webhook Status
          </h2>
          {webhookStatus.isLoading ? (
            <Skeleton height={100} />
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p>
                  Status: <Badge variant={webhookStatus.data?.verified ? 'success' : 'error'}>
                    {webhookStatus.data?.verified ? 'Verified' : 'Not Verified'}
                  </Badge>
                </p>
                {!webhookStatus.data?.verified && (
                  <Button
                    onClick={handleInstallWebhooks}
                    disabled={installWebhooks.isPending}
                    variant="primary"
                    size="sm"
                  >
                    {installWebhooks.isPending ? 'Installing...' : 'Install Webhooks'}
                  </Button>
                )}
              </div>
              {webhookStatus.data?.webhookUrl && (
                <p className="text-text-secondary text-sm break-all mb-2">
                  URL: {webhookStatus.data.webhookUrl}
                </p>
              )}
              {lastWebhook.data && (
                <div className="mt-3">
                  <p className="text-sm">
                    <strong>Last webhook received:</strong> {formatLastReceived(lastWebhook.data.lastReceivedAt)}
                  </p>
                  <p className="text-sm mt-1">
                    <strong>Receiving:</strong>{' '}
                    <Badge variant={lastWebhook.data.receiving ? 'success' : 'error'}>
                      {lastWebhook.data.receiving ? '✓ Active' : '✗ Not receiving'}
                    </Badge>
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* System Readiness */}
        <Card>
          <h2 className="text-xl mb-4">
            System Readiness
          </h2>
          {readiness.isLoading ? (
            <Skeleton height={200} />
          ) : (
            <div>
              <p className="mb-4">
                Overall Status: <Badge variant={readiness.data?.ready ? 'success' : 'error'}>
                  {readiness.data?.ready ? 'Ready' : 'Not Ready'}
                </Badge>
              </p>
              {readiness.data?.checks.map((check, idx) => (
                <div key={idx} style={{
                  backgroundColor: check.passed ? tokens.colors.success[50] : tokens.colors.error[50],
                }} className="p-3 rounded-md mb-2">
                  <div className="flex items-center gap-2">
                    <span>{check.passed ? '✓' : '✗'}</span>
                    <span className="font-medium">{check.name}</span>
                  </div>
                  {check.error && (
                    <p className="text-status-danger-text text-sm mt-1">
                      {check.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </OwnerAppShell>
  );
}
