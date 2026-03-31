/**
 * IntegrationStackSection
 *
 * Settings → Integrations replacement. Shows the five integration categories
 * with current provider selection, live status, and the ability to switch.
 *
 * Categories:
 *   1. Messaging Provider (none / twilio / openphone)
 *   2. Payment Provider (stripe / square / none)
 *   3. Calendar Provider (none / google)
 *   4. Accounting (none / quickbooks / xero)
 *   5. Booking Intake (embedded_form / client_portal / both)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  CreditCard,
  CalendarDays,
  BookOpen,
  FileInput,
  Check,
  AlertCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { Card, Badge, Button, Select, Skeleton, Alert } from '@/components/ui';

// ── Types ───────────────────────────────────────────────────────────

interface CategoryStatus {
  configured: boolean;
  detail: string;
  provider?: string;
  mode?: string;
}

interface IntegrationData {
  config: {
    messagingProvider: string;
    messagingFallbackPhone: string | null;
    paymentProvider: string;
    calendarProvider: string;
    accountingProvider: string;
    bookingIntake: string;
  };
  status: {
    messaging: CategoryStatus;
    payment: CategoryStatus;
    calendar: CategoryStatus;
    accounting: CategoryStatus;
    bookingIntake: CategoryStatus;
  };
}

interface ProviderOption {
  value: string;
  label: string;
  available: boolean;
}

interface CategoryConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  field: string;
  statusKey: keyof IntegrationData['status'];
  options: ProviderOption[];
  setupLink?: string;
  setupLabel?: string;
}

// ── Category definitions ────────────────────────────────────────────

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'messaging',
    label: 'Messaging',
    description: 'How your business sends and receives text messages with clients and sitters.',
    icon: <MessageSquare className="h-5 w-5" />,
    field: 'messagingProvider',
    statusKey: 'messaging',
    options: [
      { value: 'none', label: 'None — use personal phone', available: true },
      { value: 'twilio', label: 'Twilio — masked numbers, full automation', available: true },
      { value: 'openphone', label: 'OpenPhone — shared business line', available: true },
    ],
    setupLink: '/settings?section=twilio',
    setupLabel: 'Configure',
  },
  {
    key: 'payment',
    label: 'Payments',
    description: 'How you charge clients and pay sitters.',
    icon: <CreditCard className="h-5 w-5" />,
    field: 'paymentProvider',
    statusKey: 'payment',
    options: [
      { value: 'stripe', label: 'Stripe — checkout, subscriptions, Connect payouts', available: true },
      { value: 'square', label: 'Square', available: false },
      { value: 'none', label: 'None — manual invoicing', available: true },
    ],
    setupLink: '/integrations',
    setupLabel: 'Stripe settings',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Sync sitter schedules with external calendars.',
    icon: <CalendarDays className="h-5 w-5" />,
    field: 'calendarProvider',
    statusKey: 'calendar',
    options: [
      { value: 'none', label: 'None — in-app calendar only', available: true },
      { value: 'google', label: 'Google Calendar — bidirectional sync', available: true },
    ],
    setupLink: '/sitters',
    setupLabel: 'Connect sitters',
  },
  {
    key: 'accounting',
    label: 'Accounting',
    description: 'Sync revenue and expenses with your accounting software.',
    icon: <BookOpen className="h-5 w-5" />,
    field: 'accountingProvider',
    statusKey: 'accounting',
    options: [
      { value: 'none', label: 'None — use built-in ledger', available: true },
      { value: 'quickbooks', label: 'QuickBooks', available: false },
      { value: 'xero', label: 'Xero', available: false },
    ],
  },
  {
    key: 'bookingIntake',
    label: 'Booking Intake',
    description: 'How new clients submit booking requests to your business.',
    icon: <FileInput className="h-5 w-5" />,
    field: 'bookingIntake',
    statusKey: 'bookingIntake',
    options: [
      { value: 'embedded_form', label: 'Embedded form — add to your website', available: true },
      { value: 'client_portal', label: 'Client portal — clients book directly', available: true },
      { value: 'both', label: 'Both — form + portal', available: true },
    ],
  },
];

// ── Status indicator ────────────────────────────────────────────────

function StatusIndicator({ configured, detail }: { configured: boolean; detail: string }) {
  if (configured) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-status-success-text shrink-0" />
        <span className="text-xs text-text-secondary">{detail}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full bg-status-warning-text shrink-0" />
      <span className="text-xs text-text-secondary">{detail}</span>
    </div>
  );
}

// ── Category card ───────────────────────────────────────────────────

function CategoryCard({
  category,
  data,
  onProviderChange,
  saving,
}: {
  category: CategoryConfig;
  data: IntegrationData;
  onProviderChange: (field: string, value: string) => void;
  saving: boolean;
}) {
  const currentValue = (data.config as Record<string, any>)[category.field] as string;
  const status = data.status[category.statusKey];
  const availableOptions = category.options.filter((o) => o.available);
  const comingSoonOptions = category.options.filter((o) => !o.available);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-secondary text-text-secondary shrink-0">
              {category.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary">{category.label}</h3>
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{category.description}</p>
            </div>
          </div>

          <Badge variant={status.configured ? 'success' : 'warning'} className="shrink-0">
            {status.configured ? 'Ready' : 'Setup needed'}
          </Badge>
        </div>

        {/* Provider selection */}
        <div className="mt-3">
          <Select
            size="sm"
            value={currentValue}
            onChange={(e) => onProviderChange(category.field, e.target.value)}
            options={[
              ...availableOptions.map((o) => ({ value: o.value, label: o.label })),
              ...comingSoonOptions.map((o) => ({
                value: o.value,
                label: `${o.label} (coming soon)`,
                disabled: true,
              })),
            ]}
            disabled={saving}
          />
        </div>

        {/* Status detail */}
        <div className="mt-3 flex items-center justify-between">
          <StatusIndicator configured={status.configured} detail={status.detail} />

          {category.setupLink && !status.configured && currentValue !== 'none' && (
            <Link href={category.setupLink}>
              <Button variant="tertiary" size="sm" className="text-xs gap-1">
                {category.setupLabel || 'Setup'}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function IntegrationStackSection() {
  const [data, setData] = useState<IntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/integration-stack');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load');
      setData(body);
    } catch (err: any) {
      setError(err?.message || 'Failed to load integration configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleProviderChange(field: string, value: string) {
    if (!data) return;
    setSaving(true);
    setSaveMessage(null);

    // Optimistic update
    setData((prev) =>
      prev
        ? { ...prev, config: { ...prev.config, [field]: value } }
        : prev
    );

    try {
      const res = await fetch('/api/settings/integration-stack', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to save');
      setSaveMessage('Saved');
      // Reload to get fresh status
      await load();
    } catch (err: any) {
      setSaveMessage(err?.message || 'Save failed');
      // Revert on error
      await load();
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  // ── Loading state ───

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <div className="p-4">
              <Skeleton height={80} />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // ── Error state ───

  if (error || !data) {
    return (
      <Alert variant="error">
        <div className="flex items-center justify-between">
          <span>{error || 'Unable to load integration configuration.'}</span>
          <Button variant="tertiary" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  // ── Readiness summary ───

  const totalCategories = 5;
  const readyCount = [
    data.status.messaging.configured,
    data.status.payment.configured,
    data.status.calendar.configured,
    data.status.accounting.configured,
    data.status.bookingIntake.configured,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">
            {readyCount}/{totalCategories} configured
          </span>
          {readyCount === totalCategories && (
            <Badge variant="success">All systems go</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className={`text-xs ${saveMessage === 'Saved' ? 'text-status-success-text' : 'text-status-danger-text'}`}>
              {saveMessage}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Category cards */}
      {CATEGORIES.map((category) => (
        <CategoryCard
          key={category.key}
          category={category}
          data={data}
          onProviderChange={handleProviderChange}
          saving={saving}
        />
      ))}

      {/* Fallback phone note */}
      {data.config.messagingProvider === 'none' && (
        <Card className="border-border-subtle">
          <div className="p-4 flex items-start gap-3">
            <Phone className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-text-primary font-medium">No messaging provider selected</p>
              <p className="text-xs text-text-secondary mt-1">
                Clients will receive booking links via the portal. SMS features like visit notifications
                and automated reminders are disabled. You can still communicate with clients through
                the in-app message center or your personal phone.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
