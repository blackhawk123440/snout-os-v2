'use client';

import React from 'react';

/** Tier 1 primary card: key summary panels, main dashboard blocks. Mobile: rounded-xl, more padding. */
const CARD_BASE =
  'rounded-xl border border-border-default bg-surface-primary px-4 py-4 shadow-sm lg:rounded-lg lg:px-0 lg:py-0';

export interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AppCard({ children, className = '', onClick }: AppCardProps) {
  return (
    <div
      className={`${CARD_BASE} ${onClick ? 'cursor-pointer transition hover:border-border-strong hover:bg-surface-secondary' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export interface AppCardHeaderProps {
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

export function AppCardHeader({ title, children, className = '' }: AppCardHeaderProps) {
  return (
    <div className={`px-0 pt-0 pb-2 lg:px-4 lg:pt-4 ${className}`}>
      {title ? (
        <h3 className="text-sm font-semibold tracking-tight text-text-primary lg:text-base">{title}</h3>
      ) : (
        children
      )}
    </div>
  );
}

export interface AppCardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function AppCardBody({ children, className = '' }: AppCardBodyProps) {
  return (
    <div className={`px-0 pb-0 text-sm text-text-secondary lg:px-4 lg:pb-4 ${className}`}>
      {children}
    </div>
  );
}

export interface AppCardActionsProps {
  children: React.ReactNode;
  className?: string;
  /** Stop click propagation (e.g. when card is tappable but actions should not trigger navigation) */
  stopPropagation?: boolean;
}

export function AppCardActions({ children, className = '', stopPropagation: stop = false }: AppCardActionsProps) {
  return (
    <div
      className={`flex flex-wrap gap-2 px-0 pb-0 pt-2 lg:px-4 lg:pb-4 ${className}`}
      onClick={stop ? (e) => e.stopPropagation() : undefined}
      onKeyDown={stop ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </div>
  );
}
