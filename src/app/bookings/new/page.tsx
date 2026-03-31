'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
import { toastSuccess } from '@/lib/toast';

export default function NewBookingPage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(800);

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

  return (
    <OwnerAppShell>
      <LayoutWrapper>
        <PageHeader title="New Booking" subtitle="Create a new booking" />
        <iframe
          ref={iframeRef}
          src="/booking-form.html?variant=owner"
          style={{ width: '100%', height: iframeHeight, border: 'none', borderRadius: 16, overflow: 'hidden' }}
          title="Booking Form"
        />
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
