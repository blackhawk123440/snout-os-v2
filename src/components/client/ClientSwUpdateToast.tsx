'use client';

import { useEffect, useState } from 'react';

/**
 * Listens for service worker updates. On update available, calls registration.update()
 * and shows a non-intrusive toast with "Update available → Refresh".
 * Only runs when SW is enabled (production/staging with Serwist).
 */
export function ClientSwUpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      setShow(true);
    };

    const onUpdate = () => {
      setShow(true);
    };

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      if (registration.waiting) {
        setShow(true);
        return;
      }
      registration.addEventListener('updatefound', () => {
        const newWorker = registration!.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const checkUpdate = () => {
      registration?.update().catch(() => {});
    };
    checkUpdate();
    const interval = setInterval(checkUpdate, 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-primary px-3 py-2 shadow-lg lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm"
    >
      <span className="text-sm text-text-secondary">Update available</span>
      <button
        type="button"
        onClick={handleRefresh}
        className="shrink-0 text-sm font-medium text-text-primary underline focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
      >
        Refresh
      </button>
    </div>
  );
}
