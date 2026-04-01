'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LayoutWrapper } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import { toastSuccess } from '@/lib/toast';
import { AppErrorState, AppPageHeader } from '@/components/app';
import { Button } from '@/components/ui';
import { CalendarDays, PawPrint, ShieldCheck, MessageCircle } from 'lucide-react';

export default function ClientNewBookingPage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(800);

  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ['client', 'me'],
    queryFn: async () => {
      const r = await fetch('/api/client/me');
      if (!r.ok) throw new Error('Failed to load profile');
      return r.json();
    },
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'bookingCreated' && event.data.bookingId) {
        toastSuccess('Booking created');
        router.push('/client/bookings/' + event.data.bookingId);
      }
      if (event.data?.type === 'formHeight' && typeof event.data.height === 'number') {
        setIframeHeight(event.data.height + 40);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [router]);

  if (isLoading) {
    return (
      <LayoutWrapper variant="narrow">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-surface-tertiary" />
          <div className="h-4 w-64 rounded bg-surface-tertiary" />
          <div className="rounded-2xl border border-border-default bg-surface-primary p-6 space-y-4">
            <div className="h-5 w-24 rounded bg-surface-tertiary" />
            <div className="h-11 w-full rounded-xl bg-surface-tertiary" />
            <div className="h-5 w-20 rounded bg-surface-tertiary" />
            <div className="h-11 w-full rounded-xl bg-surface-tertiary" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-11 rounded-xl bg-surface-tertiary" />
              <div className="h-11 rounded-xl bg-surface-tertiary" />
            </div>
            <div className="h-5 w-32 rounded bg-surface-tertiary" />
            <div className="h-11 w-full rounded-xl bg-surface-tertiary" />
            <div className="h-5 w-28 rounded bg-surface-tertiary" />
            <div className="h-24 w-full rounded-xl bg-surface-tertiary" />
          </div>
          <div className="h-11 w-full rounded-xl bg-surface-tertiary" />
        </div>
      </LayoutWrapper>
    );
  }

  if (error) {
    return (
      <LayoutWrapper variant="narrow">
        <div className="flex items-center justify-center min-h-[400px]">
          <AppErrorState
            message="Couldn't load booking form"
            subtitle="Check your connection and try again."
            onRetry={() => void refetch()}
          />
        </div>
      </LayoutWrapper>
    );
  }

  const params = new URLSearchParams();
  params.set('variant', 'client');
  if (profile) {
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    if (name) params.set('clientName', name);
    if (profile.email) params.set('clientEmail', profile.email);
    if (profile.phone) params.set('clientPhone', profile.phone);
    if (profile.address) params.set('clientAddress', profile.address);
  }

  return (
    <LayoutWrapper variant="narrow">
      <AppPageHeader title="Book a visit" subtitle="Choose the care you need and send a clean request to your care team." />
      <div className="space-y-4">
        <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex rounded-full bg-accent-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary">
              Booking request
            </span>
          </div>
          <h2 className="text-xl font-bold text-text-primary">Tell us what care you need</h2>
          <p className="mt-2 text-sm text-text-secondary">
            This form is the fastest way to request a visit. Your care team will use the details you add here to confirm timing, prepare sitter instructions, and keep everything organized.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: 'Pet details',
                description: 'Make sure pet names and care needs are current before you submit.',
                icon: PawPrint,
              },
              {
                title: 'Home access',
                description: 'Up-to-date home access information helps visits start smoothly.',
                icon: ShieldCheck,
              },
              {
                title: 'Scheduling clarity',
                description: 'Choose the date and time that best match when care is actually needed.',
                icon: CalendarDays,
              },
              {
                title: 'Communication',
                description: 'Your care team may follow up in the app or from a regular business number depending on workspace setup.',
                icon: MessageCircle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-border-default bg-surface-secondary p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-text-tertiary" />
                    <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">{item.description}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/client/pets">
              <Button variant="secondary" size="sm">Review pets</Button>
            </Link>
            <Link href="/client/profile">
              <Button variant="secondary" size="sm">Update profile</Button>
            </Link>
          </div>
        </div>

        <iframe
          ref={iframeRef}
          src={'/booking-form.html?' + params.toString()}
          className="w-full rounded-3xl border-none overflow-hidden"
          style={{ height: iframeHeight }}
          title="Booking Form"
        />
      </div>
    </LayoutWrapper>
  );
}
