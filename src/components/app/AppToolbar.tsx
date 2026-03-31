'use client';

import React from 'react';

export interface AppToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function AppToolbar({ children, className = '' }: AppToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 border-b border-border-muted bg-surface-secondary px-4 py-2 ${className}`}
    >
      {children}
    </div>
  );
}
