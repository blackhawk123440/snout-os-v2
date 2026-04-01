'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LayoutWrapper } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import { toastSuccess } from '@/lib/toast';
import { AppErrorState, AppPageHeader } from '@/components/app';
import { Button } from '@/components/ui';
import { ArrowRight, ShieldCheck } from 'lucide-react';

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
      <AppPageHeader title="Book a visit" subtitle="Share the care details and submit your request." />
      <div className="space-y-5">
        <div className="rounded-3xl border border-border-default bg-surface-primary p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Request care</h2>
              <p className="mt-1 text-sm text-text-secondary">Add the essentials. Review pets or profile details if anything has changed.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-secondary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Payment is collected before the visit
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/client/pets">
              <Button variant="secondary" size="sm">Review pets</Button>
            </Link>
            <Link href="/client/profile">
              <Button variant="secondary" size="sm">Review profile</Button>
            </Link>
            <Link href="/client/bookings">
              <Button variant="tertiary" size="sm" className="gap-1.5">
                Existing bookings
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <iframe
          ref={iframeRef}
          src={'/booking-form.html?' + params.toString()}
          className="w-full rounded-3xl border border-border-default bg-surface-primary"
          style={{ height: iframeHeight }}
          title="Booking Form"
        />
      </div>
    </LayoutWrapper>
  );
}
