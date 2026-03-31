'use client';

import React from 'react';
import { tokens } from '@/lib/design-tokens';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/components/app/ThemeToggle';

export interface AppTopbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export function AppTopbar({ left, right, children }: AppTopbarProps) {
  const { density, setDensity } = useTheme();

  return (
    <header
      className="flex items-center justify-between border-b border-border-default bg-surface-primary px-6"
      style={{
        height: tokens.layout.appShell.topBarHeight,
        position: 'sticky',
        top: 0,
        zIndex: tokens.zIndex.sticky,
      }}
    >
      <div className="flex items-center gap-3">{left}</div>
      {children && <div className="flex-1" />}
      <div className="flex items-center gap-2">
        {/* Density selector */}
        <select
          value={density}
          onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable' | 'spacious')}
          className="rounded-lg border border-border-default bg-transparent px-2 py-1 text-sm text-text-secondary"
          aria-label="UI density"
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
        <ThemeToggle />
        {right}
      </div>
    </header>
  );
}
