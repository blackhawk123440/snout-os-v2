/**
 * Client Portal App Shell
 * Mobile: bottom nav. Desktop (lg+): left sidebar. Enterprise header + content alignment.
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { useTheme, type Theme } from '@/lib/theme-context';
import { ClientBottomNav } from './ClientBottomNav';
import { ClientSidebarNav } from './ClientSidebarNav';
import { ClientDeployDebugOverlay } from '@/components/client/ClientDeployDebugOverlay';
import { ClientSwUpdateToast } from '@/components/client/ClientSwUpdateToast';
import { Skeleton } from '@/components/ui/Skeleton';
import { useClientMe, useBranding } from '@/lib/api/client-hooks';

export interface ClientAppShellProps {
  children: React.ReactNode;
}

const THEME_OPTIONS: { value: Theme; label: string; fill: string; ring: string }[] = [
  { value: 'snout', label: 'Snout', fill: '#432f21', ring: '#fce1ef' },
  { value: 'light', label: 'Light', fill: '#ffffff', ring: '#d4d4d4' },
  { value: 'dark', label: 'Dark', fill: '#0f172a', ring: '#3b82f6' },
  { value: 'snout-dark', label: 'Brand Dark', fill: '#1a0802', ring: '#fce1ef' },
];

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="px-3 py-2">
      <p className="mb-1.5 text-xs font-medium text-text-tertiary">Theme</p>
      <div className="flex items-center gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-label={`Switch to ${opt.label} theme`}
            title={opt.label}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-border-focus"
          >
            <span
              className="block h-6 w-6 rounded-full border-2"
              style={{
                backgroundColor: opt.fill,
                borderColor: theme === opt.value ? opt.ring : 'transparent',
                boxShadow: theme === opt.value ? `0 0 0 2px ${opt.ring}` : 'none',
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

const CONTENT_CONTAINER = 'w-full px-4 sm:px-6 lg:mx-auto lg:max-w-6xl lg:px-8';
const CONTENT_INNER = 'flex w-full min-w-0 items-center justify-between gap-3 lg:mx-auto lg:max-w-4xl';

function getClientHeaderInfo(pathname: string, firstName: string): { title: string; subtitle: string } {
  if (pathname === '/client/home' || pathname === '/client') return { title: 'Home', subtitle: 'Your pet care hub' };
  if (pathname.startsWith('/client/bookings')) return { title: 'Bookings', subtitle: 'Your visits' };
  if (pathname.startsWith('/client/pets')) return { title: 'Pets', subtitle: 'Your furry family' };
  if (pathname.startsWith('/client/messages')) return { title: 'Messages', subtitle: 'Chat with your sitter' };
  if (pathname.startsWith('/client/billing')) return { title: 'Billing', subtitle: 'Invoices & loyalty' };
  if (pathname.startsWith('/client/profile')) return { title: 'Profile', subtitle: 'Account settings' };
  if (pathname.startsWith('/client/reports')) return { title: 'Visit reports', subtitle: 'Updates from your sitter' };
  return { title: 'Client portal', subtitle: `Hi, ${firstName}` };
}

export function ClientAppShell({ children }: ClientAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { user, isClient, loading: authLoading } = useAuth();
  const [headerShadow, setHeaderShadow] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const { data: meData } = useClientMe(isClient);
  const { data: branding } = useBranding();
  const clientName = meData?.name ?? (meData?.firstName && meData?.lastName ? `${meData.firstName} ${meData.lastName}`.trim() : null) ?? null;

  // Skip auth redirect for public setup page (client doesn't have a session yet)
  const isSetupPage = pathname === '/client/setup' || pathname.startsWith('/client/setup');

  useEffect(() => {
    if (!isSetupPage && !authLoading && !isClient) {
      router.replace('/login');
    }
  }, [authLoading, isClient, isSetupPage, router]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setHeaderShadow(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return;
      setAccountMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [accountMenuOpen]);

  // Setup page renders without shell chrome (no header, no nav, no auth required)
  if (isSetupPage) {
    return <>{children}</>;
  }

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex flex-col bg-surface-secondary" style={{ maxHeight: '100dvh' }}>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row min-[1024px]:flex-row">
          {/* Sidebar skeleton — desktop only */}
          <aside className="hidden shrink-0 border-r border-border-default bg-surface-primary lg:flex lg:w-60 lg:flex-col min-[1024px]:flex min-[1024px]:w-60 min-[1024px]:flex-col">
            <div className="flex flex-col gap-3 px-4 pt-6">
              <Skeleton variant="text" width="60%" height={12} />
              <div className="mt-4 flex flex-col gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={44} style={{ borderRadius: 8 }} />
                ))}
              </div>
            </div>
          </aside>

          {/* Main content skeleton */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Header skeleton */}
            <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border-default bg-surface-primary px-4 py-2 sm:px-6 lg:px-8">
              <Skeleton variant="text" width={120} height={20} />
              <Skeleton variant="circular" width={36} height={36} />
            </div>

            {/* Content skeleton */}
            <div className="flex-1 px-4 pt-6 sm:px-6 lg:mx-auto lg:max-w-4xl lg:px-8">
              <div className="flex flex-col gap-4">
                <Skeleton variant="text" width="40%" height={24} />
                <Skeleton variant="text" width="60%" height={14} />
                <div className="mt-4 flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={80} style={{ borderRadius: 12 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return null;
  }

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await signOut({ redirect: false });
    router.push('/login');
  };

  const displayName = clientName || user?.name || 'there';
  const firstName = displayName.split(' ')[0] || displayName;
  const { title: pageTitle, subtitle: pageSubtitle } = getClientHeaderInfo(pathname, firstName);
  // "New booking" CTA removed from header per client portal redesign — CTAs live on individual pages

  return (
    <div className="fixed inset-0 flex flex-col bg-surface-secondary" style={{ maxHeight: '100dvh' }}>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row min-[1024px]:flex-row">
        <ClientSidebarNav />

        <div className="flex min-h-0 flex-1 flex-col">
          <header
            className={`sticky top-0 z-10 flex min-h-[44px] items-center justify-between gap-3 border-b border-border-default bg-surface-primary py-2 transition-shadow ${
              headerShadow ? 'shadow-sm' : ''
            }`}
          >
            <div className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${CONTENT_CONTAINER}`}>
              <div className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${CONTENT_INNER}`}>
              <div className="min-w-0 flex-1 flex items-center gap-2 leading-tight">
                {branding?.logoUrl && (
                  <img src={branding.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', flexShrink: 0 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <div className="min-w-0 flex-1 flex flex-col">
                  <p className="truncate text-xl font-semibold text-text-primary lg:text-sm lg:font-semibold"
                    style={branding?.primaryColor ? { color: branding.primaryColor } : undefined}>
                    {branding?.businessName || pageTitle}
                  </p>
                  <p className="hidden truncate text-xs text-text-tertiary lg:block">{pageSubtitle}</p>
                </div>
              </div>
              <div className="relative flex shrink-0 items-center gap-2">
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  aria-label="Account menu"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="true"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded bg-surface-tertiary text-sm font-medium text-text-secondary transition hover:bg-surface-tertiary/70 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1"
                >
                  {(firstName || 'C').charAt(0).toUpperCase()}
                </button>
                {accountMenuOpen && (
                  <div
                    ref={menuRef}
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded border border-border-default bg-surface-primary py-1 shadow-lg"
                  >
                    <ThemePicker />
                    <div className="my-1 border-t border-border-muted" />
                    <Link
                      href="/client/profile"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center min-h-[44px] px-3 text-left text-sm text-text-secondary hover:bg-surface-secondary"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      className="flex items-center min-h-[44px] w-full px-3 text-left text-sm text-text-secondary hover:bg-surface-secondary"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              </div>
            </div>
          </header>

          <main
            ref={mainRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:pb-0"
          >
            <div className="min-h-0 flex-1 pt-3">{children}</div>
          </main>
        </div>
      </div>

      <ClientBottomNav />
      <ClientDeployDebugOverlay />
      <ClientSwUpdateToast />
    </div>
  );
}
