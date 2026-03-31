'use client';

import Link from 'next/link';
import { Wifi } from 'lucide-react';

/**
 * Offline fallback page shown when user navigates while offline.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="text-center">
        <Wifi className="w-10 h-10 text-amber-500" />
        <h1 className="mt-4 text-xl font-semibold text-neutral-900">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Check your connection and try again. If you were viewing Today, your cached data may still be available.
        </p>
        <Link
          href="/sitter/today"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          Try Today
        </Link>
      </div>
    </div>
  );
}
