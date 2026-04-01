/**
 * Sitter App Shell
 * Mobile-first app shell with bottom navigation for sitter dashboard.
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { ThemeToggle } from '@/components/app/ThemeToggle';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { SITTER_TABS, SITTER_BOTTOM_TABS } from '@/lib/sitter-nav';
import { SitterOfflineBanner } from '@/components/sitter/SitterOfflineBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSitterMe, useSitterBadges } from '@/lib/api/sitter-portal-hooks';
import { Icon } from '@/components/ui/Icon';

const NAV_ITEMS = SITTER_BOTTOM_TABS;

export interface SitterAppShellProps {
  children: React.ReactNode;
}

export function SitterAppShell({ children }: SitterAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const { user, isSitter, loading: authLoading } = useAuth();
  const [headerShadow, setHeaderShadow] = useState(false);

  const { data: meData } = useSitterMe();
  const sitterName = meData?.name || meData?.firstName || null;
  const availabilityEnabled = meData?.availabilityEnabled ?? false;

  const { data: badges } = useSitterBadges();
  const hasUnreadMessages = badges?.hasUnreadMessages ?? false;
  const hasReportTodo = badges?.hasReportTodo ?? false;

  // Skip auth redirect for public onboard page (sitter doesn't have a session yet)
  const isOnboardPage = pathname === '/sitter/onboard' || pathname.startsWith('/sitter/onboard');

  useEffect(() => {
    if (!isOnboardPage && !authLoading && !isSitter) {
      router.replace('/login');
    }
  }, [authLoading, isSitter, isOnboardPage, router]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setHeaderShadow(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Onboard page renders without shell chrome (no header, no nav, no auth required)
  if (isOnboardPage) {
    return <>{children}</>;
  }

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex flex-col bg-surface-secondary" style={{ maxHeight: '100dvh' }}>
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border-default bg-surface-primary px-4">
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" width={36} height={36} />
            <div className="flex flex-col gap-1">
              <Skeleton variant="text" width={100} height={16} />
              <Skeleton variant="text" width={50} height={12} />
            </div>
          </div>
          <Skeleton variant="rectangular" width={44} height={44} style={{ borderRadius: 12 }} />
        </header>
        <div className="flex-1 px-4 pt-4">
          <div className="mx-auto max-w-3xl flex flex-col gap-4">
            <Skeleton variant="text" width="50%" height={24} />
            <Skeleton variant="text" width="70%" height={14} />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={80} style={{ borderRadius: 12, flex: 1, minWidth: 100 }} />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={100} style={{ borderRadius: 12 }} />
            ))}
          </div>
        </div>
        <div className="h-14 border-t border-border-default bg-surface-primary" />
      </div>
    );
  }

  if (!isSitter) {
    return null;
  }

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/sitter/dashboard') return pathname === '/sitter/dashboard';
    if (href === '/sitter/today') return pathname === '/sitter/today';
    if (href === '/sitter/inbox') return pathname.startsWith('/sitter/inbox') || pathname.startsWith('/sitter/messages');
    return pathname.startsWith(href);
  };

  const displayName = sitterName || user?.name || 'there';
  const firstName = displayName.split(' ')[0] || displayName;

  return (
    <div className="fixed inset-0 flex flex-col bg-surface-secondary" style={{ maxHeight: '100dvh' }}>
      <SitterOfflineBanner />
      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:pb-8">
        {/* Sticky header: avatar + Hey name + status chip + bell */}
        <header
          className={`sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border-default bg-surface-primary px-4 transition-shadow ${
            headerShadow ? 'shadow-sm' : ''
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-secondary text-sm font-semibold text-text-brand">
              {(firstName || 'S').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-text-primary">
                Hey, {firstName}
              </p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  availabilityEnabled ? 'bg-status-success-bg text-status-success-text' : 'bg-status-warning-bg text-status-warning-text'
                }`}
              >
                {availabilityEnabled ? 'Available' : 'Off'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Notifications"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-text-tertiary transition hover:bg-surface-secondary hover:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex min-h-[44px] items-center rounded-xl px-3 text-sm text-text-tertiary transition hover:bg-surface-secondary hover:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 px-4 pt-4">{children}</div>
      </main>

      {/* Bottom nav - 44px hit targets */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex h-14 min-h-[56px] items-center justify-around border-t border-border-default bg-surface-primary"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        aria-label="Primary navigation"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const showDot =
            (item.id === 'inbox' && hasUnreadMessages);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 ${
                active ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Icon name={item.icon} className="w-5 h-5" />
              <span className="text-[10px] font-medium">
                {item.label}
                {showDot ? ' •' : ''}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
