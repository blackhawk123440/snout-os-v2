'use client';

/**
 * AI Governance - Owner settings: enable/disable, budget, usage logs.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppCard, AppCardBody, AppErrorState, getStatusPill } from '@/components/app';
import { Button, Input, EmptyState } from '@/components/ui';
import { PageSkeleton } from '@/components/ui/loading-state';
import { StatusChip } from '@/components/ui/status-chip';

interface AISettings {
  enabled: boolean;
  monthlyBudgetCents: number;
  hardStop: boolean;
  usageCentsThisMonth?: number;
}

interface UsageLog {
  id: string;
  featureKey: string;
  model: string;
  totalTokens: number;
  costCents: number;
  status: string;
  error?: string | null;
  createdAt: string;
}

interface PromptTemplate {
  id: string;
  key: string;
  version: number;
  template: string;
  active: boolean;
  scope: 'org' | 'global';
  createdAt: string;
}

export default function OpsAIPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, usageRes, templatesRes] = await Promise.all([
        fetch('/api/ops/ai/settings'),
        fetch('/api/ops/ai/usage'),
        fetch('/api/ops/ai/templates'),
      ]);
      const settingsJson = await settingsRes.json().catch(() => ({}));
      const usageJson = await usageRes.json().catch(() => ({}));
      const templatesJson = await templatesRes.json().catch(() => ({}));
      if (!settingsRes.ok) {
        setError(settingsJson.error || 'Failed to load');
        setSettings(null);
        return;
      }
      setSettings(settingsJson.usageCentsThisMonth !== undefined ? settingsJson : { ...settingsJson, usageCentsThisMonth: usageJson.usageCentsThisMonth ?? 0 });
      setLogs(usageJson.logs || []);
      setTemplates(templatesJson.templates || []);
      setBudgetInput(String(settingsJson.monthlyBudgetCents ?? 0));
    } catch {
      setError('Failed to load');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, sessionStatus, router]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const budget = parseInt(budgetInput, 10);
      const res = await fetch('/api/ops/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          monthlyBudgetCents: isNaN(budget) ? settings.monthlyBudgetCents : budget,
          hardStop: settings.hardStop,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      setSettings({ ...settings, monthlyBudgetCents: json.monthlyBudgetCents ?? settings.monthlyBudgetCents });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => {
    if (!settings) return;
    setSettings({ ...settings, enabled: !settings.enabled });
  };

  const toggleHardStop = () => {
    if (!settings) return;
    setSettings({ ...settings, hardStop: !settings.hardStop });
  };

  const createTemplate = async () => {
    if (!templateKey.trim() || !templateText.trim()) return;
    setCreatingTemplate(true);
    try {
      const res = await fetch('/api/ops/ai/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: templateKey.trim(), template: templateText.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      setTemplateKey('');
      setTemplateText('');
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create template');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const activateTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/ops/ai/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to activate');
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <OwnerAppShell>
        <LayoutWrapper>
          <PageHeader title="AI Settings" subtitle="Loading..." />
          <PageSkeleton />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }
  if (!session) return null;

  return (
    <OwnerAppShell>
      <LayoutWrapper>
        <PageHeader
          title="AI Settings"
          subtitle="Governance, budget, and usage"
          actions={
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          }
        />
        <Section>
      {loading ? (
        <PageSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load AI settings" subtitle={error} onRetry={() => void load()} />
      ) : settings ? (
        <div className="space-y-4">
          <AppCard>
            <AppCardBody>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">AI enabled</p>
                    <p className="text-sm text-neutral-600">When off, all AI endpoints are blocked</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.enabled}
                    onClick={toggleEnabled}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-text-tertiary focus:ring-offset-2 ${
                      settings.enabled ? 'bg-text-secondary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                        settings.enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Monthly budget</label>
                  <p className="text-xs text-neutral-500">Enter amount in cents. Leave at 0 for unlimited.</p>
                  <Input
                    type="number"
                    min={0}
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="mt-1 max-w-[200px]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">Hard stop when budget exceeded</p>
                    <p className="text-sm text-neutral-600">Block AI calls when monthly budget is reached</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.hardStop}
                    onClick={toggleHardStop}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-text-tertiary focus:ring-offset-2 ${
                      settings.hardStop ? 'bg-text-secondary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                        settings.hardStop ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <Button variant="primary" size="sm" onClick={() => void saveSettings()} disabled={saving}>
                  {saving ? 'Saving...' : 'Save settings'}
                </Button>
              </div>
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardBody>
              <p className="font-medium text-neutral-900">Usage this month</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">
                ${((settings.usageCentsThisMonth ?? 0) / 100).toFixed(2)}
              </p>
              <p className="text-sm text-neutral-600">
                Budget: {settings.monthlyBudgetCents === 0 ? 'Unlimited' : `$${(settings.monthlyBudgetCents / 100).toFixed(2)}/month`}
              </p>
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardBody>
              <p className="mb-3 font-medium text-neutral-900">Prompt templates</p>
              <p className="mb-3 text-sm text-neutral-600">
                Org overrides take precedence over global templates. Create an override to customize prompts for this org.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <Input
                  placeholder="Key (e.g. daily-delight)"
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  className="max-w-[200px]"
                />
                <Input
                  placeholder="Template text"
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  className="min-w-[200px] flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void createTemplate()}
                  disabled={creatingTemplate || !templateKey.trim() || !templateText.trim()}
                >
                  {creatingTemplate ? 'Creating...' : 'Create org override'}
                </Button>
              </div>
              {templates.length === 0 ? (
                <EmptyState
                  title="No templates"
                  description="Create an org override above or use global templates."
                />
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{t.key}</span>
                        <span className="ml-2 text-neutral-500">v{t.version}</span>
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${t.scope === 'org' ? 'bg-surface-tertiary text-text-secondary' : 'bg-neutral-100 text-neutral-600'}`}>
                          {t.scope}
                        </span>
                        {t.active && (
                          <span className="ml-2 rounded bg-surface-tertiary px-1.5 py-0.5 text-xs text-text-secondary">Active</span>
                        )}
                        <p className="mt-1 truncate text-neutral-500">{t.template.slice(0, 80)}{t.template.length > 80 ? '…' : ''}</p>
                      </div>
                      {t.scope === 'org' && !t.active && (
                        <Button variant="secondary" size="sm" onClick={() => void activateTemplate(t.id)}>
                          Activate
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardBody>
              <p className="mb-3 font-medium text-neutral-900">Recent AI usage (last 50)</p>
              {logs.length === 0 ? (
                <EmptyState
                  title="No AI usage yet"
                  description="Usage will appear here when AI features are used."
                />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{l.featureKey}</span>
                        <span className="ml-2 text-neutral-500">{l.model}</span>
                        <span className="ml-2 text-neutral-400">{l.totalTokens} tokens</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${(l.costCents / 100).toFixed(2)}</span>
                        <StatusChip
                          variant={
                            l.status === 'succeeded' ? 'success' : l.status === 'blocked' ? 'warning' : 'danger'
                          }
                        >
                          {getStatusPill(l.status).label}
                        </StatusChip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AppCardBody>
          </AppCard>
        </div>
      ) : null}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
