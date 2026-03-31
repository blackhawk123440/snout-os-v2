'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LayoutWrapper } from '@/components/layout';
import { useQuery } from '@tanstack/react-query';
import { toastSuccess } from '@/lib/toast';
import { AppErrorState, AppPageHeader } from '@/components/app';

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
      <AppPageHeader title="Book a visit" subtitle="Choose a service, date, and time" />
      <iframe
        ref={iframeRef}
        src={'/booking-form.html?' + params.toString()}
        className="w-full rounded-2xl border-none overflow-hidden"
        style={{ height: iframeHeight }}
        title="Booking Form"
      />
    </LayoutWrapper>
  );
}
