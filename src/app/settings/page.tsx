/**
 * Settings Page - Canonical owner control plane
 *
 * Single source of truth for: Business, Services, Pricing, Notifications,
 * Tiers (link), AI (link), Integrations (link), Advanced (rotation, service areas).
 * All sections that have controls persist via /api/settings/* (org-scoped).
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Building2, Palette, ConciergeBell, Tag, Bell, Layers, Bot, Plug, SlidersHorizontal, ClipboardList, Star, Mail, Package, Phone, GitBranch, Radio, Smartphone } from 'lucide-react';
import { ChangePasswordSection } from '@/components/auth/ChangePasswordSection';
import { TemplatesSection } from './sections/TemplatesSection';
import { ReviewsSection } from './sections/ReviewsSection';
import { DigestSection } from './sections/DigestSection';
import { BundlesSection } from './sections/BundlesSection';
import { IntegrationsFullSection } from './sections/IntegrationsFullSection';
import { IntegrationStackSection } from './sections/IntegrationStackSection';
import { NumbersPanel } from '@/components/messaging/NumbersPanel';
import { AssignmentsPanel } from '@/components/messaging/AssignmentsPanel';
import { TwilioSetupPanel } from '@/components/messaging/TwilioSetupPanel';
import { OpenPhoneSetupPanel } from '@/components/messaging/OpenPhoneSetupPanel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Input,
  Select,
  Button,
  FormRow,
  Skeleton,
  Flex,
  Alert,
  Badge,
  EmptyState,
  Modal,
} from '@/components/ui';
import { OwnerAppShell } from '@/components/layout';
import { AppPageHeader } from '@/components/app';

type SettingsSection =
  | 'business'
  | 'branding'
  | 'services'
  | 'pricing'
  | 'notifications'
  | 'tiers'
  | 'ai'
  | 'templates'
  | 'reviews'
  | 'digest'
  | 'bundles'
  | 'integrations'
  | 'numbers'
  | 'routing'
  | 'twilio'
  | 'openphone'
  | 'advanced';

const SECTION_IDS: SettingsSection[] = [
  'business',
  'branding',
  'services',
  'pricing',
  'notifications',
  'tiers',
  'ai',
  'templates',
  'reviews',
  'digest',
  'bundles',
  'integrations',
  'numbers',
  'routing',
  'twilio',
  'openphone',
  'advanced',
];

const SECTION_GROUPS: { label: string; items: SettingsSection[] }[] = [
  { label: 'General', items: ['business', 'branding'] },
  { label: 'Services', items: ['services', 'pricing', 'tiers', 'bundles'] },
  { label: 'Communication', items: ['notifications', 'templates', 'reviews', 'digest'] },
  { label: 'Messaging', items: ['numbers', 'routing', 'twilio', 'openphone'] },
  { label: 'Advanced', items: ['ai', 'integrations', 'advanced'] },
];

const SECTION_DESCRIPTIONS: Record<SettingsSection, string> = {
  business: 'Company name, phone, email, and timezone',
  branding: 'Logo, colors, and client-facing appearance',
  services: 'Service types and configurations',
  pricing: 'Rates, add-ons, and dynamic pricing rules',
  notifications: 'Email and SMS notification preferences',
  tiers: 'Sitter tier levels and requirements',
  ai: 'AI assistant settings and prompt templates',
  templates: 'Message templates for automations',
  reviews: 'Review collection and display settings',
  digest: 'Daily and weekly digest email configuration',
  bundles: 'Service bundle packages',
  integrations: 'Messaging, payments, calendar, accounting, and booking intake',
  numbers: 'Phone number management',
  routing: 'Message thread routing and assignments',
  twilio: 'Twilio account configuration',
  openphone: 'OpenPhone account configuration',
  advanced: 'Rotation rules, service areas, and system config',
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const sectionParam = searchParams?.get('section') as SettingsSection | null;
  const [activeTab, setActiveTab] = useState<SettingsSection>(
    sectionParam && SECTION_IDS.includes(sectionParam) ? sectionParam : 'business'
  );

  useEffect(() => {
    if (sectionParam && SECTION_IDS.includes(sectionParam)) {
      setActiveTab(sectionParam);
    }
  }, [sectionParam]);

  return (
    <OwnerAppShell>
      <AppPageHeader
        title="Settings"
        subtitle="Business, services, pricing, notifications, and advanced configuration"
      />

      {/* Mobile: horizontally scrollable grouped chips */}
      <div className="lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
          {SECTION_GROUPS.flatMap((g) => g.items).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`shrink-0 scroll-snap-align-start rounded-full px-3 py-1.5 text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-accent-primary text-text-inverse'
                  : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary'
              }`}
              style={{ scrollSnapAlign: 'start' }}
            >
              {sectionLabel(id)}
            </button>
          ))}
        </div>
        <div className="mb-2">
          <p className="text-xs text-text-tertiary">{SECTION_DESCRIPTIONS[activeTab]}</p>
        </div>
        <SectionContent section={activeTab} />
      </div>

      {/* Desktop: sidebar navigation + content */}
      <div className="hidden lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
        <nav className="space-y-5">
          {SECTION_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-disabled">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 min-h-[36px] text-sm transition-all ${
                      activeTab === id
                        ? 'bg-accent-secondary text-accent-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                    }`}
                  >
                    <span className="w-4 h-4 shrink-0">{sectionIcon(id)}</span>
                    <span>{sectionLabel(id)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{sectionLabel(activeTab)}</h2>
            <p className="text-sm text-text-tertiary mt-0.5">{SECTION_DESCRIPTIONS[activeTab]}</p>
          </div>
          <SectionContent section={activeTab} />
        </div>
      </div>
    </OwnerAppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<OwnerAppShell><AppPageHeader title="Settings" subtitle="Loading…" /><Card><Skeleton height={400} /></Card></OwnerAppShell>}>
      <SettingsContent />
    </Suspense>
  );
}

function sectionLabel(id: SettingsSection): string {
  const labels: Record<SettingsSection, string> = {
    business: 'Business',
    branding: 'Branding',
    services: 'Services',
    pricing: 'Pricing',
    notifications: 'Notifications',
    tiers: 'Tiers',
    ai: 'AI',
    templates: 'Templates',
    reviews: 'Reviews',
    digest: 'Digest',
    bundles: 'Bundles',
    integrations: 'Integrations',
    numbers: 'Numbers',
    routing: 'Routing',
    twilio: 'Twilio',
    openphone: 'OpenPhone',
    advanced: 'Advanced',
  };
  return labels[id];
}

function sectionIcon(id: SettingsSection): React.ReactNode {
  const icons: Record<SettingsSection, React.ReactNode> = {
    business: <Building2 className="w-4 h-4" />,
    branding: <Palette className="w-4 h-4" />,
    services: <ConciergeBell className="w-4 h-4" />,
    pricing: <Tag className="w-4 h-4" />,
    notifications: <Bell className="w-4 h-4" />,
    tiers: <Layers className="w-4 h-4" />,
    ai: <Bot className="w-4 h-4" />,
    templates: <ClipboardList className="w-4 h-4" />,
    reviews: <Star className="w-4 h-4" />,
    digest: <Mail className="w-4 h-4" />,
    bundles: <Package className="w-4 h-4" />,
    integrations: <Plug className="w-4 h-4" />,
    numbers: <Phone className="w-4 h-4" />,
    routing: <GitBranch className="w-4 h-4" />,
    twilio: <Radio className="w-4 h-4" />,
    openphone: <Smartphone className="w-4 h-4" />,
    advanced: <SlidersHorizontal className="w-4 h-4" />,
  };
  return icons[id];
}

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case 'business':
      return <BusinessSection />;
    case 'branding':
      return <BrandingSection />;
    case 'services':
      return <ServicesSection />;
    case 'pricing':
      return <PricingSection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'tiers':
      return <TiersSection />;
    case 'ai':
      return <AISection />;
    case 'templates':
      return <TemplatesSection />;
    case 'reviews':
      return <ReviewsSection />;
    case 'digest':
      return <DigestSection />;
    case 'bundles':
      return <BundlesSection />;
    case 'integrations':
      return <IntegrationStackSection />;
    case 'numbers':
      return <NumbersPanel />;
    case 'routing':
      return <AssignmentsPanel />;
    case 'twilio':
      return <TwilioSetupPanel />;
    case 'openphone':
      return <OpenPhoneSetupPanel />;
    case 'advanced':
      return <AdvancedSection />;
    default:
      return null;
  }
}

function BusinessSection() {
  const queryClient = useQueryClient();
  const [data, setData] = useState({
    businessName: '',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    timeZone: 'America/New_York',
  });
  const [success, setSuccess] = useState(false);

  const { isLoading, error: queryError } = useQuery({
    queryKey: ['owner', 'settings', 'business'],
    queryFn: async () => {
      const res = await fetch('/api/settings/business');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const s = json.settings ?? {};
      const parsed = {
        businessName: s.businessName ?? '',
        businessPhone: s.businessPhone ?? '',
        businessEmail: s.businessEmail ?? '',
        businessAddress: s.businessAddress ?? '',
        timeZone: s.timeZone ?? 'America/New_York',
      };
      setData(parsed);
      return parsed;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof data) => {
      const res = await fetch('/api/settings/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'settings', 'business'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <Skeleton height={320} />
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-4 text-lg">
        Business Information
      </h3>
      {(queryError?.message || saveMutation.error?.message) && (
        <Alert variant="error" className="mb-4">
          {queryError?.message || saveMutation.error?.message}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4">
          Saved.
        </Alert>
      )}
      <FormRow label="Business Name" required>
        <Input
          value={data.businessName}
          onChange={(e) => setData((p) => ({ ...p, businessName: e.target.value }))}
        />
      </FormRow>
      <FormRow label="Business Phone">
        <Input
          type="tel"
          value={data.businessPhone}
          onChange={(e) => setData((p) => ({ ...p, businessPhone: e.target.value }))}
        />
      </FormRow>
      <FormRow label="Business Email">
        <Input
          type="email"
          value={data.businessEmail}
          onChange={(e) => setData((p) => ({ ...p, businessEmail: e.target.value }))}
        />
      </FormRow>
      <FormRow label="Business Address">
        <Input
          value={data.businessAddress}
          onChange={(e) => setData((p) => ({ ...p, businessAddress: e.target.value }))}
        />
      </FormRow>
      <FormRow label="Time zone">
        <Select
          value={data.timeZone}
          onChange={(e) => setData((p) => ({ ...p, timeZone: e.target.value }))}
          options={[
            { value: 'America/New_York', label: 'Eastern' },
            { value: 'America/Chicago', label: 'Central' },
            { value: 'America/Denver', label: 'Mountain' },
            { value: 'America/Los_Angeles', label: 'Pacific' },
          ]}
        />
      </FormRow>
      <div className="mt-6">
        <Button variant="primary" onClick={() => saveMutation.mutate(data)} isLoading={saveMutation.isPending}>
          Save business settings
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t border-border-default">
        <h3 className="mb-4 text-lg">Account Security</h3>
        <ChangePasswordSection />
      </div>
    </Card>
  );
}

function ServicesSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);

  const { data: list = [], isLoading, error: queryError } = useQuery({
    queryKey: ['owner', 'settings', 'services'],
    queryFn: async () => {
      const res = await fetch('/api/settings/services');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      return (json.configs ?? []) as { id: string; serviceName: string; enabled: boolean }[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/services/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      setDeleteServiceId(null);
      queryClient.invalidateQueries({ queryKey: ['owner', 'settings', 'services'] });
    },
  });

  const deleteOne = (id: string) => {
    setDeleteServiceId(id);
  };

  if (isLoading) {
    return (
      <Card>
        <Skeleton height={200} />
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-4 text-lg">
        Service catalog
      </h3>
      {(queryError?.message || deleteMutation.error?.message) && (
        <Alert variant="error" className="mb-4">
          {queryError?.message || deleteMutation.error?.message}
        </Alert>
      )}
      {list.length === 0 ? (
        <EmptyState
          title="No services"
          description="Add services to define what you offer (e.g. dog walking, drop-in visits)."
          action={{ label: 'Add service', onClick: () => router.push('/settings?section=services') }}
        />
      ) : (
        <ul className="list-none p-0 m-0">
          {list.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between p-3 border-b border-border-default"
            >
              <span>{s.serviceName}</span>
              <Flex align="center" gap={3}>
                <Badge variant={s.enabled ? 'success' : 'neutral'}>{s.enabled ? 'On' : 'Off'}</Badge>
                <Button variant="secondary" size="sm" onClick={() => deleteOne(s.id)}>
                  Delete
                </Button>
              </Flex>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-text-secondary">
        Create and edit services via the API or a future form. List loads from <code>/api/settings/services</code>.
      </p>
      <Modal isOpen={!!deleteServiceId} onClose={() => !deleteMutation.isPending && setDeleteServiceId(null)} title="Delete service" size="sm"
        footer={<div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setDeleteServiceId(null)} disabled={deleteMutation.isPending}>Cancel</Button><Button variant="danger" onClick={() => deleteServiceId && deleteMutation.mutate(deleteServiceId)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Deleting...' : 'Delete'}</Button></div>}
      ><p className="text-sm text-text-secondary">Delete this service? This cannot be undone.</p></Modal>
    </Card>
  );
}

function PricingSection() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'rule' | 'discount'; id: string } | null>(null);

  const { data: pricingData, isLoading, error: queryError } = useQuery({
    queryKey: ['owner', 'settings', 'pricing'],
    queryFn: async () => {
      const [rulesRes, discountsRes] = await Promise.all([
        fetch('/api/settings/pricing'),
        fetch('/api/settings/discounts'),
      ]);
      if (!rulesRes.ok) throw new Error('Failed to load pricing');
      if (!discountsRes.ok) throw new Error('Failed to load discounts');
      const rulesJson = await rulesRes.json();
      const discountsJson = await discountsRes.json();
      return {
        rules: (rulesJson.rules ?? []) as { id: string; name: string; type: string; enabled: boolean }[],
        discounts: (discountsJson.discounts ?? []) as { id: string; name: string; code: string | null; type: string; value: number; valueType: string; enabled: boolean }[],
      };
    },
  });

  const rules = pricingData?.rules ?? [];
  const discounts = pricingData?.discounts ?? [];

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/pricing/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'settings', 'pricing'] });
    },
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/discounts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'settings', 'pricing'] });
    },
  });

  const deleteRule = (id: string) => setDeleteTarget({ type: 'rule', id });
  const deleteDiscount = (id: string) => setDeleteTarget({ type: 'discount', id });

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'rule') deleteRuleMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
    else deleteDiscountMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const mutationError = deleteRuleMutation.error?.message || deleteDiscountMutation.error?.message;

  if (isLoading) {
    return (
      <Card>
        <Skeleton height={200} />
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-4 text-lg">
        Pricing rules
      </h3>
      {(queryError?.message || mutationError) && (
        <Alert variant="error" className="mb-4">
          {queryError?.message || mutationError}
        </Alert>
      )}
      {rules.length === 0 ? (
        <EmptyState
          title="No pricing rules"
          description="Pricing rules define fees, discounts, or multipliers. Add rules via API or future UI."
        />
      ) : (
        <ul className="list-none p-0 m-0">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between p-3 border-b border-border-default"
            >
              <span>{r.name}</span>
              <Flex align="center" gap={3}>
                <Badge variant="neutral">{r.type}</Badge>
                <Badge variant={r.enabled ? 'success' : 'neutral'}>{r.enabled ? 'On' : 'Off'}</Badge>
                <Button variant="secondary" size="sm" onClick={() => deleteRule(r.id)}>
                  Delete
                </Button>
              </Flex>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-8 mb-4 text-lg">
        Discounts
      </h3>
      {discounts.length === 0 ? (
        <EmptyState
          title="No discounts"
          description="Discount codes and automatic discounts. Add via API or future UI."
        />
      ) : (
        <ul className="list-none p-0 m-0">
          {discounts.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between p-3 border-b border-border-default"
            >
              <span>
                {d.name}
                {d.code && (
                  <Badge variant="neutral" className="ml-2">
                    {d.code}
                  </Badge>
                )}
              </span>
              <Flex align="center" gap={3}>
                <Badge variant="neutral">{d.type}</Badge>
                <span className="text-sm text-text-secondary">
                  {d.value}
                  {d.valueType === 'percentage' ? '%' : ' fixed'}
                </span>
                <Badge variant={d.enabled ? 'success' : 'neutral'}>{d.enabled ? 'On' : 'Off'}</Badge>
                <Button variant="secondary" size="sm" onClick={() => deleteDiscount(d.id)}>
                  Delete
                </Button>
              </Flex>
            </li>
          ))}
        </ul>
      )}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`Delete ${deleteTarget?.type === 'rule' ? 'pricing rule' : 'discount'}`} size="sm"
        footer={<div className="flex gap-2 justify-end"><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" onClick={handleConfirmDelete}>Delete</Button></div>}
      ><p className="text-sm text-text-secondary">Delete this {deleteTarget?.type === 'rule' ? 'pricing rule' : 'discount'}? This cannot be undone.</p></Modal>
    </Card>
  );
}

function NotificationsSection() {
  const queryClient = useQueryClient();
  const [data, setData] = useState({
    smsEnabled: true,
    emailEnabled: false,
    ownerAlerts: true,
    sitterNotifications: true,
    clientReminders: true,
    paymentReminders: true,
    conflictNoticeEnabled: true,
    reminderTiming: '24h',
  });
  const [success, setSuccess] = useState(false);

  const { isLoading, error: queryError } = useQuery({
    queryKey: ['owner', 'settings', 'notifications'],
    queryFn: async () => {
      const res = await fetch('/api/settings/notifications');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const s = json.settings ?? {};
      const parsed = {
        smsEnabled: s.smsEnabled !== false,
        emailEnabled: s.emailEnabled === true,
        ownerAlerts: s.ownerAlerts !== false,
        sitterNotifications: s.sitterNotifications !== false,
        clientReminders: s.clientReminders !== false,
        paymentReminders: s.paymentReminders !== false,
        conflictNoticeEnabled: s.conflictNoticeEnabled !== false,
        reminderTiming: s.reminderTiming ?? '24h',
      };
      setData(parsed);
      return parsed;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof data) => {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'settings', 'notifications'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <Skeleton height={320} />
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-4 text-lg">
        Notification preferences
      </h3>
      {(queryError?.message || saveMutation.error?.message) && (
        <Alert variant="error" className="mb-4">
          {queryError?.message || saveMutation.error?.message}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4">
          Saved.
        </Alert>
      )}
      <FormRow>
        <label style={{ cursor: 'pointer' }}>
          <Flex align="center" gap={3}>
            <input
              type="checkbox"
              checked={data.smsEnabled}
              onChange={(e) => setData((p) => ({ ...p, smsEnabled: e.target.checked }))}
            />
            <span>SMS notifications</span>
          </Flex>
        </label>
      </FormRow>
      <FormRow>
        <label style={{ cursor: 'pointer' }}>
          <Flex align="center" gap={3}>
            <input
              type="checkbox"
              checked={data.emailEnabled}
              onChange={(e) => setData((p) => ({ ...p, emailEnabled: e.target.checked }))}
            />
            <span>Email notifications</span>
          </Flex>
        </label>
      </FormRow>
      <FormRow>
        <label style={{ cursor: 'pointer' }}>
          <Flex align="center" gap={3}>
            <input
              type="checkbox"
              checked={data.ownerAlerts}
              onChange={(e) => setData((p) => ({ ...p, ownerAlerts: e.target.checked }))}
            />
            <span>Owner alerts</span>
          </Flex>
        </label>
      </FormRow>
      <FormRow>
        <label style={{ cursor: 'pointer' }}>
          <Flex align="center" gap={3}>
            <input
              type="checkbox"
              checked={data.sitterNotifications}
              onChange={(e) => setData((p) => ({ ...p, sitterNotifications: e.target.checked }))}
            />
            <span>Sitter notifications</span>
          </Flex>
        </label>
      </FormRow>
      <FormRow>
        <label style={{ cursor: 'pointer' }}>
          <Flex align="center" gap={3}>
            <input
              type="checkbox"
              checked={data.paymentReminders}
              onChange={(e) => setData((p) => ({ ...p, paymentReminders: e.target.checked }))}
            />
            <span>Payment reminders</span>
          </Flex>
        </label>
      </FormRow>
      <FormRow label="Reminder timing">
        <Select
          value={data.reminderTiming}
          onChange={(e) => setData((p) => ({ ...p, reminderTiming: e.target.value }))}
          options={[
            { value: '24h', label: '24 hours before' },
            { value: '12h', label: '12 hours before' },
            { value: '6h', label: '6 hours before' },
            { value: '1h', label: '1 hour before' },
          ]}
        />
      </FormRow>
      <div className="mt-6">
        <Button variant="primary" onClick={() => saveMutation.mutate(data)} isLoading={saveMutation.isPending}>
          Save notification settings
        </Button>
      </div>
    </Card>
  );
}

function TiersSection() {
  return (
    <Card>
      <h3 className="mb-4 text-lg">
        Policy tiers
      </h3>
      <p className="mb-4 text-text-secondary">
        Manage sitter tiers, point targets, and tier benefits. Tiers are org-scoped and fully persisted.
      </p>
      <Link href="/settings/tiers">
        <Button variant="primary" leftIcon={<Layers className="w-4 h-4" />}>
          Open tier settings
        </Button>
      </Link>
      <p className="mt-3 text-sm text-text-secondary">
        <Link href="/settings/tiers/new">Create new tier</Link>
      </p>
    </Card>
  );
}

function AISection() {
  return (
    <Card>
      <h3 className="mb-4 text-lg">
        AI governance
      </h3>
      <p className="mb-4 text-text-secondary">
        Enable/disable AI, set budgets, and manage prompt templates. AI settings are org-scoped.
      </p>
      <Link href="/ops/ai">
        <Button variant="primary" leftIcon={<Bot className="w-4 h-4" />}>
          Open AI settings
        </Button>
      </Link>
    </Card>
  );
}

function AdvancedSection() {
  const queryClient = useQueryClient();
  const [rotation, setRotation] = useState<Record<string, string | number>>({});

  const { isLoading: rotationLoading, error: rotationQueryError } = useQuery({
    queryKey: ['owner', 'settings', 'rotation'],
    queryFn: async () => {
      const res = await fetch('/api/settings/rotation');
      if (!res.ok) throw new Error('Failed to load rotation');
      const json = await res.json();
      setRotation(json);
      return json as Record<string, string | number>;
    },
  });

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['owner', 'settings', 'areas'],
    queryFn: async () => {
      const res = await fetch('/api/settings/service-areas');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      return (json.areas ?? []) as { id: string; name: string; type: string }[];
    },
  });

  const saveRotationMutation = useMutation({
    mutationFn: async (payload: Record<string, string | number>) => {
      const res = await fetch('/api/settings/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      const json = await res.json();
      setRotation(json);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'settings', 'rotation'] });
    },
  });

  const rotationError = rotationQueryError?.message || saveRotationMutation.error?.message;

  return (
    <>
      <Card className="mb-6">
        <h3 className="mb-4 text-lg">
          Rotation (pool number lifecycle)
        </h3>
        {rotationError && (
          <Alert variant="error" className="mb-4">
            {rotationError}
          </Alert>
        )}
        {rotationLoading ? (
          <Skeleton height={120} />
        ) : (
          <>
            <FormRow label="Pool selection strategy">
              <Select
                value={String(rotation.poolSelectionStrategy ?? 'LRU')}
                onChange={(e) =>
                  setRotation((p) => ({ ...p, poolSelectionStrategy: e.target.value }))
                }
                options={[
                  { value: 'LRU', label: 'Least Recently Used' },
                  { value: 'FIFO', label: 'First In First Out' },
                  { value: 'HASH_SHUFFLE', label: 'Hash Shuffle' },
                ]}
              />
            </FormRow>
            <FormRow label="Max concurrent threads per pool number">
              <Input
                type="number"
                min={1}
                value={String(rotation.maxConcurrentThreadsPerPoolNumber ?? 1)}
                onChange={(e) =>
                  setRotation((p) => ({
                    ...p,
                    maxConcurrentThreadsPerPoolNumber: parseInt(e.target.value, 10) || 1,
                  }))
                }
              />
            </FormRow>
            <div className="mt-4">
              <Button variant="primary" onClick={() => saveRotationMutation.mutate(rotation)} isLoading={saveRotationMutation.isPending}>
                Save rotation settings
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className="mb-6">
        <h3 className="mb-4 text-lg">
          Service areas
        </h3>
        {areasLoading ? (
          <Skeleton height={80} />
        ) : areas.length === 0 ? (
          <EmptyState
            title="No service areas"
            description="Define coverage zones (ZIPs, radius, or polygon). Add via API or future UI."
          />
        ) : (
          <ul className="list-none p-0 m-0">
            {areas.map((a) => (
              <li
                key={a.id}
                className="p-3 border-b border-border-default"
              >
                {a.name} <Badge variant="neutral">{a.type}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-4 text-lg">
          Org config
        </h3>
        <p className="text-text-secondary">
          Org metadata and feature flags are managed in the database. No editable controls here yet.
        </p>
      </Card>
    </>
  );
}

function BrandingSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    businessName: '',
    logoUrl: '',
    primaryColor: '#432f21',
    secondaryColor: '#fce1ef',
  });
  const [saved, setSaved] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['owner', 'settings', 'branding'],
    queryFn: async () => {
      const res = await fetch('/api/settings/branding');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setForm({
        businessName: data.businessName || '',
        logoUrl: data.logoUrl || '',
        primaryColor: data.primaryColor || '#432f21',
        secondaryColor: data.secondaryColor || '#fce1ef',
      });
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['owner', 'settings', 'branding'] });
    },
  });

  if (isLoading) return <Card><Skeleton height={200} /></Card>;

  return (
    <>
      <Card>
        <h3 className="mb-4 text-lg">
          Client-Facing Branding
        </h3>
        <p className="text-text-secondary mb-4 text-sm">
          Customize how your business appears to clients in the portal, emails, and native apps.
        </p>

        <FormRow label="Business Name" helperText="Replaces 'Snout OS' in all client-facing surfaces">
          <Input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            placeholder="Your Business Name"
          />
        </FormRow>

        <FormRow label="Logo URL" helperText="Square image recommended (at least 200×200px)">
          <Input
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="https://example.com/logo.png"
          />
          {form.logoUrl && (
            <div className="mt-2">
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="w-16 h-16 rounded-lg object-contain border border-border-default"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </FormRow>

        <FormRow label="Primary Color" helperText="Used for buttons, links, and accents">
          <Flex align="center" gap={2}>
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              style={{ width: 44, height: 44, border: 'none', cursor: 'pointer', borderRadius: 8 }}
            />
            <Input
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              style={{ width: 120 }}
              placeholder="#432f21"
            />
          </Flex>
        </FormRow>

        <FormRow label="Secondary Color" helperText="Used for backgrounds and highlights">
          <Flex align="center" gap={2}>
            <input
              type="color"
              value={form.secondaryColor}
              onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
              style={{ width: 44, height: 44, border: 'none', cursor: 'pointer', borderRadius: 8 }}
            />
            <Input
              value={form.secondaryColor}
              onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
              style={{ width: 120 }}
              placeholder="#fce1ef"
            />
          </Flex>
        </FormRow>

        <div className="mt-4">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save Branding'}
          </Button>
          {saved && <Badge variant="success" className="ml-2">Saved</Badge>}
        </div>
      </Card>

      {/* Live preview */}
      <Card>
        <h3 className="mb-4 text-lg">
          Preview
        </h3>
        <div className="border border-border-default rounded-xl overflow-hidden">
          <div className="py-3 px-4 flex items-center gap-3" style={{ backgroundColor: form.primaryColor || '#432f21' }}>
            {form.logoUrl && (
              <img src={form.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>
              {form.businessName || 'Your Business'}
            </span>
          </div>
          <div className="p-4" style={{ backgroundColor: form.secondaryColor || '#fef7fb' }}>
            <p style={{ color: '#333', fontSize: 14 }}>This is how clients will see your portal header.</p>
            <button className="mt-3 text-white border-none rounded-lg py-2 px-4 font-semibold cursor-pointer" style={{
              backgroundColor: form.primaryColor || '#432f21',
            }}>
              Book a Visit
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
