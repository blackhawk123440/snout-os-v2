'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-client';

const ALLOW_DEBUG =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_ENV !== 'production';

export function ClientDeployDebugOverlay() {
  const searchParams = useSearchParams();
  const { isOwner } = useAuth();
  const [health, setHealth] = useState<{
    commitSha?: string;
    buildTime?: string;
    envName?: string;
  } | null>(null);

  const debug = searchParams.get('debug') === '1';
  const allowed = isOwner || ALLOW_DEBUG;

  useEffect(() => {
    if (!debug || !allowed) return;
    fetch('/api/health')
      .then((r) => r.json().catch(() => ({})))
      .then(setHealth)
      .catch(() => {});
  }, [debug, allowed]);

  if (!debug || !allowed) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-14 left-0 z-50 rounded-tr bg-surface-inverse/90 px-2 py-1.5 font-mono text-[10px] text-text-inverse/70 lg:bottom-2"
      aria-hidden
    >
      {health ? (
        <>
          <span className="text-text-inverse/50">{health.envName ?? '—'}</span>
          {' · '}
          <span className="tabular-nums">{health.commitSha ?? '—'}</span>
          {health.buildTime && (
            <>
              {' · '}
              <span className="tabular-nums text-text-inverse/50">
                {health.buildTime}
              </span>
            </>
          )}
        </>
      ) : (
        <span className="text-text-inverse/40">Loading…</span>
      )}
    </div>
  );
}
