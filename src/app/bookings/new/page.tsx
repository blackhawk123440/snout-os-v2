'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Users, MessageSquare, CreditCard, CalendarDays } from 'lucide-react';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui';
import { toastSuccess } from '@/lib/toast';

export default function NewBookingPage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(800);

  const { data: onboardingData } = useQuery({
    queryKey: ['owner', 'onboarding', 'booking-entry'],
    queryFn: async () => {
      const res = await fetch('/api/ops/onboarding');
      return res.ok ? res.json() : null;
    },
    staleTime: 120000,
  });

  const { data: clientDirectory } = useQuery({
    queryKey: ['owner', 'clients', 'booking-entry'],
    queryFn: async () => {
      const res = await fetch('/api/clients?page=1&pageSize=1');
      return res.ok ? res.json() : null;
    },
    staleTime: 120000,
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'bookingCreated' && event.data.bookingId) {
        toastSuccess('Booking created');
        router.push('/bookings/' + event.data.bookingId);
      }
      if (event.data?.type === 'searchClients') {
        fetch('/api/clients?search=' + encodeURIComponent(event.data.query) + '&pageSize=5')
          .then(r => r.json())
          .then(data => {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'clientResults',
              clients: (data.items || []).map((c: any) => ({
                id: c.id,
                name: [c.firstName, c.lastName].filter(Boolean).join(' '),
                email: c.email || '',
                phone: c.phone || '',
                address: c.address || '',
              })),
            }, '*');
          })
          .catch(() => {});
      }
      if (event.data?.type === 'formHeight' && typeof event.data.height === 'number') {
        setIframeHeight(event.data.height + 40);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [router]);

  const incompleteSteps = Array.isArray(onboardingData?.steps)
    ? onboardingData.steps.filter((step: any) => !step.completed)
    : [];
  const clientCount = clientDirectory?.pagination?.totalItems ?? clientDirectory?.total ?? clientDirectory?.count ?? 0;
  const likelyFirstBooking = clientCount === 0 || incompleteSteps.some((step: any) => step.key === 'first_booking');
  const bookingTips = [
    {
      title: 'Client details',
      description: clientCount > 0
        ? 'Search an existing client from inside the form or add their details directly.'
        : 'No client records yet. This booking may double as your first client profile setup.',
      icon: Users,
    },
    {
      title: 'Messaging path',
      description: 'Use the booking flow you want customers and staff to experience in real life, including native phone mode if that is your launch model.',
      icon: MessageSquare,
    },
    {
      title: 'Billing readiness',
      description: 'Confirm service price, timing, and payment expectations so the first invoice feels polished.',
      icon: CreditCard,
    },
  ];

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader title="Create booking" subtitle="Build the customer-facing visit exactly the way your team plans to run it." />

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
                  {likelyFirstBooking ? 'First-booking mode' : 'Owner booking flow'}
                </span>
                {likelyFirstBooking && (
                  <span className="inline-flex rounded-full bg-status-warning-bg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-status-warning-text">
                    Rehearsal recommended
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-text-primary">
                {likelyFirstBooking ? 'Make your first booking feel premium' : 'Create a visit without leaving the owner workspace'}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                {likelyFirstBooking
                  ? 'Treat this like a launch rehearsal: client details, timing, pricing, and communication should feel exactly the way you want the product to work for a paying customer.'
                  : 'This is the same booking path your business depends on day to day, so use it to create a clean, customer-ready visit record.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/clients">
                  <Button variant="secondary" size="sm">Open client directory</Button>
                </Link>
                <Link href="/setup">
                  <Button variant="secondary" size="sm">Review launch checklist</Button>
                </Link>
                <Link href="/settings?section=integrations">
                  <Button variant="secondary" size="sm">Check messaging and billing</Button>
                </Link>
              </div>
            </div>

            <iframe
              ref={iframeRef}
              src="/booking-form.html?variant=owner"
              style={{ width: '100%', height: iframeHeight, border: 'none', borderRadius: 24, overflow: 'hidden' }}
              title="Booking Form"
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-text-tertiary" />
                <p className="text-sm font-semibold text-text-primary">Before you save</p>
              </div>
              <div className="mt-4 space-y-3">
                {bookingTips.map((tip) => {
                  const Icon = tip.icon;
                  return (
                    <div key={tip.title} className="rounded-xl border border-border-default bg-surface-secondary p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-text-tertiary" />
                        <p className="text-sm font-medium text-text-primary">{tip.title}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">{tip.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {incompleteSteps.length > 0 && (
              <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
                <p className="text-sm font-semibold text-text-primary">Launch checklist</p>
                <p className="mt-1 text-xs text-text-secondary">
                  A polished SaaS launch means the booking flow works inside a complete business setup.
                </p>
                <div className="mt-4 space-y-2">
                  {incompleteSteps.slice(0, 4).map((step: any) => (
                    <Link
                      key={step.key}
                      href={STEP_LINKS[step.key] || '/settings'}
                      className="flex min-h-[44px] items-center justify-between rounded-xl border border-border-default bg-surface-secondary px-3 py-2 hover:bg-surface-tertiary transition"
                    >
                      <div className="flex items-center gap-2">
                        {step.completed ? <CheckCircle2 className="h-4 w-4 text-status-success-text" /> : <Circle className="h-4 w-4 text-status-warning-text fill-status-warning-fill" />}
                        <span className="text-sm text-text-primary">{step.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
              <p className="text-sm font-semibold text-text-primary">Directory status</p>
              <p className="mt-2 text-2xl font-bold text-text-primary">{clientCount}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {clientCount > 0
                  ? 'Client records already exist, so this form can stay focused on the booking itself.'
                  : 'No client records found yet. Expect this booking to carry more setup responsibility than usual.'}
              </p>
            </div>
          </aside>
        </div>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

const STEP_LINKS: Record<string, string> = {
  business_profile: '/settings?section=business',
  services_created: '/settings?section=services',
  team_setup: '/sitters',
  messaging_setup: '/settings?section=integrations',
  payments_setup: '/settings?section=integrations',
  branding_done: '/settings?section=branding',
  first_client: '/clients',
  first_booking: '/bookings/new',
};
