'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, HeartPulse, DollarSign,
  Headphones, ToggleLeft, Server, LogOut, Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-client';
import { cn } from '@/components/ui/utils';
import { Skeleton } from '@/components/ui/Skeleton';

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Orgs', href: '/admin/orgs', icon: Building2 },
  { label: 'Health', href: '/admin/health', icon: HeartPulse },
  { label: 'Billing', href: '/admin/billing', icon: DollarSign },
  { label: 'Support', href: '/admin/support', icon: Headphones },
  { label: 'Features', href: '/admin/features', icon: ToggleLeft },
  { label: 'System', href: '/admin/system', icon: Server },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = (user as any)?.role;
  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.replace('/login');
    }
  }, [authLoading, isSuperAdmin, router]);

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex bg-surface-secondary" style={{ maxHeight: '100dvh' }}>
        <aside className="hidden w-60 shrink-0 border-r border-border-default bg-surface-primary lg:flex lg:flex-col">
          <div className="px-4 pt-6">
            <Skeleton variant="text" width="70%" height={16} />
            <div className="mt-6 flex flex-col gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={44} style={{ borderRadius: 8 }} />
              ))}
            </div>
          </div>
        </aside>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-14 items-center border-b border-border-default bg-surface-primary px-6">
            <Skeleton variant="text" width={120} height={20} />
          </div>
          <div className="flex-1 p-6">
            <Skeleton variant="rectangular" height={200} style={{ borderRadius: 12 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="fixed inset-0 flex bg-surface-secondary" style={{ maxHeight: '100dvh' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-surface-inverse/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border-default bg-surface-primary transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-danger-bg">
            <Shield className="h-4 w-4 text-status-danger-text" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Snout OS</p>
            <p className="text-[10px] font-medium text-status-danger-text uppercase tracking-wider">Platform Admin</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item.href);
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex h-11 min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                  active
                    ? 'bg-accent-secondary text-accent-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                )}
              >
                <IconComponent className="w-[18px] h-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border-default px-4 py-3">
          <p className="text-[11px] text-text-disabled truncate">{user?.email || 'superadmin'}</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border-default bg-surface-primary px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary lg:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold text-text-primary lg:text-base">Platform Admin</h1>
          </div>
          <Link
            href="/dashboard"
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm text-text-secondary hover:bg-surface-secondary transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Exit admin</span>
          </Link>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
