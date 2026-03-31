'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Skeleton, Switch } from '@/components/ui';

type IntegrationsSnapshot = {
  stripe: { ready: boolean; reachable: boolean; connectEnabled: boolean };
  twilio: { ready: boolean; numbersConfigured: boolean; webhooksInstalled: boolean };
  calendar: { ready: boolean; connectedSitters: number; lastSyncAt: string | null };
  ai: { ready: boolean; enabled: boolean };
};

export function IntegrationsFullSection() {
  const [snapshot, setSnapshot] = useState<IntegrationsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [stripeTestMessage, setStripeTestMessage] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/status');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Failed to load integrations status');
      setSnapshot(body);
    } catch (err: any) {
      setError(err?.message || 'Failed to load integrations');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSnapshot(); }, [loadSnapshot]);

  async function runAction(key: string, request: () => Promise<Response>) {
    setBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await request();
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.message || 'Action failed');
      await loadSnapshot();
      if (body.message) alert(body.message);
    } catch (err: any) {
      alert(err?.message || 'Action failed');
    } finally {
      setBusy((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function runStripeTest() {
    setBusy((prev) => ({ ...prev, stripeTest: true }));
    setStripeTestMessage(null);
    try {
      const response = await fetch('/api/integrations/stripe/test', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Stripe test failed');
      setStripeTestMessage(
        `connectivity=${body.connectivity ? 'ok' : 'fail'}, account=${body.accountReachable ? 'ok' : 'fail'}, transfers=${body.transfersEnabled ? 'enabled' : 'disabled'}`
      );
      await loadSnapshot();
    } catch (err: any) {
      setStripeTestMessage(err?.message || 'Stripe test failed');
    } finally {
      setBusy((prev) => ({ ...prev, stripeTest: false }));
    }
  }

  async function updateAiSettings(enabled: boolean) {
    setBusy((prev) => ({ ...prev, ai: true }));
    try {
      const response = await fetch('/api/ops/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update AI settings');
      }
      await loadSnapshot();
    } catch (err: any) {
      alert(err?.message || 'Failed to update AI settings');
    } finally {
      setBusy((prev) => ({ ...prev, ai: false }));
    }
  }

  if (loading) return <Card><div className="p-4"><Skeleton height={240} /></div></Card>;

  if (error) {
    return (
      <Card className="bg-status-danger-bg border-status-danger-border">
        <div className="p-4 text-status-danger-text">
          {error}
          <Button variant="tertiary" size="sm" onClick={loadSnapshot} className="ml-3">Retry</Button>
        </div>
      </Card>
    );
  }

  if (!snapshot) return <Card><div className="p-4">No integrations snapshot available.</div></Card>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="p-4 flex gap-2 flex-wrap">
          <Badge variant={snapshot.stripe.ready ? 'success' : 'warning'}>Stripe: {snapshot.stripe.ready ? 'Ready' : 'Needs setup'}</Badge>
          <Badge variant={snapshot.twilio.ready ? 'success' : 'warning'}>Twilio: {snapshot.twilio.ready ? 'Ready' : 'Needs setup'}</Badge>
          <Badge variant={snapshot.calendar.ready ? 'success' : 'warning'}>Calendar: {snapshot.calendar.ready ? 'Ready' : 'Needs setup'}</Badge>
          <Badge variant={snapshot.ai.ready ? 'success' : 'warning'}>AI/OpenAI: {snapshot.ai.ready ? 'Ready' : 'Needs setup'}</Badge>
          <Button variant="secondary" size="sm" onClick={loadSnapshot} className="ml-auto">Refresh</Button>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="font-semibold mb-2">Stripe</h3>
          <p className="text-text-secondary text-sm mb-1"><strong>Status:</strong> {snapshot.stripe.ready ? 'Ready' : 'Needs setup'}</p>
          <p className="text-text-secondary text-sm mb-3"><strong>Transfers:</strong> {snapshot.stripe.connectEnabled ? 'Connect enabled' : 'Connect not enabled'} &middot; {snapshot.stripe.reachable ? 'API reachable' : 'API unreachable'}</p>
          {stripeTestMessage && <p className="text-text-secondary text-sm mb-3">Latest test: {stripeTestMessage}</p>}
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={runStripeTest} disabled={!!busy.stripeTest}>{busy.stripeTest ? 'Testing...' : 'Test Stripe'}</Button>
            <Link href="/sitters?tab=payroll"><Button variant="primary" size="sm">Open Payroll</Button></Link>
            <Link href="/ops/payouts"><Button variant="secondary" size="sm">Payout Ops</Button></Link>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="font-semibold mb-2">Twilio</h3>
          <p className="text-text-secondary text-sm mb-1"><strong>Status:</strong> {snapshot.twilio.ready ? 'Ready' : 'Needs setup'}</p>
          <p className="text-text-secondary text-sm mb-3"><strong>Health:</strong> {snapshot.twilio.numbersConfigured ? 'Numbers configured' : 'Numbers missing'} &middot; {snapshot.twilio.webhooksInstalled ? 'Webhooks installed' : 'Webhooks missing'}</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => runAction('twilio-test', () => fetch('/api/setup/provider/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))} disabled={!!busy['twilio-test']}>{busy['twilio-test'] ? 'Testing...' : 'Test Provider'}</Button>
            <Button variant="secondary" size="sm" onClick={() => runAction('twilio-sync', () => fetch('/api/setup/numbers/sync', { method: 'POST' }))} disabled={!!busy['twilio-sync']}>{busy['twilio-sync'] ? 'Syncing...' : 'Sync Numbers'}</Button>
            <Button variant="secondary" size="sm" onClick={() => runAction('twilio-install', () => fetch('/api/setup/webhooks/install', { method: 'POST' }))} disabled={!!busy['twilio-install']}>{busy['twilio-install'] ? 'Installing...' : 'Install Webhooks'}</Button>
            <Link href="/settings?section=twilio"><Button variant="primary" size="sm">Twilio Setup</Button></Link>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="font-semibold mb-2">Calendar</h3>
          <p className="text-text-secondary text-sm mb-1"><strong>Status:</strong> {snapshot.calendar.ready ? 'Ready' : 'Needs setup'}</p>
          <p className="text-text-secondary text-sm mb-3"><strong>Connected sitters:</strong> {snapshot.calendar.connectedSitters} &middot; Last sync: {snapshot.calendar.lastSyncAt ? new Date(snapshot.calendar.lastSyncAt).toLocaleString() : 'Never'}</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/sitters"><Button variant="primary" size="sm">Open Sitters</Button></Link>
            <Link href="/ops/calendar-repair"><Button variant="secondary" size="sm">Calendar Repair</Button></Link>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <h3 className="font-semibold mb-2">AI / OpenAI</h3>
          <p className="text-text-secondary text-sm mb-1"><strong>Status:</strong> {snapshot.ai.ready ? 'Ready' : 'Needs setup'}</p>
          <p className="text-text-secondary text-sm mb-3"><strong>Enabled:</strong> {snapshot.ai.enabled ? 'Yes' : 'No'}</p>
          <div className="flex items-center gap-3 mb-3">
            <Switch checked={snapshot.ai.enabled} onChange={updateAiSettings} label="AI features enabled" disabled={!!busy.ai} />
          </div>
          <Link href="/ops/ai"><Button variant="secondary" size="sm">Open AI Ops</Button></Link>
        </div>
      </Card>
    </div>
  );
}
