/**
 * BuildHash Component
 * 
 * Displays the current git commit hash and build time in the UI footer.
 * Falls back to /api/ops/build if env vars are not available.
 * Only visible to owners.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';

export const BuildHash: React.FC = () => {
  const { isOwner } = useAuth();
  const [buildInfo, setBuildInfo] = useState<{ envName: string; gitSha: string; buildTime: string }>({
    envName: process.env.NEXT_PUBLIC_ENV || 'staging',
    gitSha: process.env.NEXT_PUBLIC_GIT_SHA || process.env.NEXT_PUBLIC_BUILD_HASH || 'loading...',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'loading...',
  });

  useEffect(() => {
    // Resolve deploy identity from canonical health endpoint.
    if (buildInfo.gitSha === 'loading...' || buildInfo.gitSha === 'unknown' || buildInfo.envName === 'staging') {
      fetch('/api/health')
        .then(res => res.json())
        .then(data => {
          const sha = data.commitSha || data.version || 'unknown';
          setBuildInfo({
            envName: data.envName || process.env.NEXT_PUBLIC_ENV || 'staging',
            gitSha: sha,
            buildTime: data.buildTime || 'unknown',
          });
        })
        .catch(() => {
          setBuildInfo({
            envName: process.env.NEXT_PUBLIC_ENV || 'staging',
            gitSha: 'unknown',
            buildTime: 'unknown',
          });
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only fetch; buildInfo.gitSha not needed in deps
  }, []);

  // Always show to owners (no flag required)
  if (!isOwner) {
    return null;
  }

  const displaySha = buildInfo.gitSha === 'unknown' ? 'unknown' : buildInfo.gitSha.substring(0, 7);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        padding: '4px 8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        fontSize: '10px',
        fontFamily: 'monospace',
        zIndex: 9999,
        borderRadius: '4px 0 0 0',
      }}
    >
      Build: {buildInfo.envName} · {displaySha} | {buildInfo.buildTime === 'unknown' ? 'unknown' : new Date(buildInfo.buildTime).toLocaleString()}
    </div>
  );
};
