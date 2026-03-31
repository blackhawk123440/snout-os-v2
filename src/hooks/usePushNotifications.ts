'use client';

import { useCallback, useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus = 'unsupported' | 'prompt' | 'granted' | 'denied' | 'subscribed' | 'loading';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      setStatus('unsupported');
      return;
    }

    // Check current permission state
    const permission = Notification.permission;
    if (permission === 'denied') {
      setStatus('denied');
      return;
    }

    // Check if already subscribed
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setStatus('subscribed');
        } else {
          setStatus(permission === 'granted' ? 'granted' : 'prompt');
        }
      });
    }).catch(() => {
      setStatus('unsupported');
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      setError('Push notifications not configured');
      return false;
    }

    try {
      setError(null);
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const sub = subscription.toJSON();
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        throw new Error('Invalid subscription data');
      }

      // Send to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) throw new Error('Failed to save subscription');

      setStatus('subscribed');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to subscribe';
      setError(msg);
      if (Notification.permission === 'denied') {
        setStatus('denied');
      }
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      setError(null);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }

      setStatus('prompt');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to unsubscribe';
      setError(msg);
      return false;
    }
  }, []);

  return { status, error, subscribe, unsubscribe };
}
