'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useAuth } from '@/lib/auth-client';
import { cn } from '@/components/ui/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';

type OwnerNavItem = {
  label: string;
  href: string;
  icon: string;
};

type SidebarItem = {
  label: string;
  href: string;
  icon: string;
  children?: Array<{ label: string; href: string; icon: string }>;
  defaultCollapsed?: boolean;
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
  muted?: boolean;
};

/** Final owner sidebar: clean, executive, one submenu open at a time. Routes unchanged. */
export const OWNER_SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'fas fa-chart-line' },
      { label: 'Bookings', href: '/bookings', icon: 'fas fa-calendar-check' },
      { label: 'Calendar', href: '/calendar', icon: 'fas fa-calendar-alt' },
      { label: 'Clients', href: '/clients', icon: 'fas fa-address-book' },
      { label: 'Sitters', href: '/sitters', icon: 'fas fa-user-friends' },
      { label: 'Messages', href: '/messaging', icon: 'fas fa-comments' },
      { label: 'Billing', href: '/money', icon: 'fas fa-dollar-sign' },
      { label: 'Settings', href: '/settings', icon: 'fas fa-cog' },
    ],
  },
];

export const OWNER_SUPPORT_SECTION: SidebarSection = {
  title: 'Support Tools',
  muted: true,
  items: [
    {
      label: 'Operations Center',
      href: '/ops/diagnostics',
      icon: 'fas fa-stethoscope',
      defaultCollapsed: true,
      children: [
        { label: 'Automation Failures', href: '/ops/automation-failures', icon: 'fas fa-triangle-exclamation' },
        { label: 'Queue Failures', href: '/ops/failures', icon: 'fas fa-list-check' },
        { label: 'Message Failures', href: '/ops/message-failures', icon: 'fas fa-comment-slash' },
        { label: 'Calendar Repair', href: '/ops/calendar-repair', icon: 'fas fa-calendar-check' },
        { label: 'Payout Operations', href: '/ops/payouts', icon: 'fas fa-sack-dollar' },
        { label: 'Reconciliation', href: '/ops/finance/reconciliation', icon: 'fas fa-scale-balanced' },
        { label: 'AI Ops', href: '/ops/ai', icon: 'fas fa-robot' },
        { label: 'Exceptions', href: '/exceptions', icon: 'fas fa-flag' },
      ],
    },
  ],
};

/** Flat list of all sidebar links (for mobile drawer and active matching). */
function flattenSidebarItems(sections: SidebarSection[]): OwnerNavItem[] {
  const out: OwnerNavItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      out.push({ label: item.label, href: item.href, icon: item.icon });
      if (item.children) {
        for (const c of item.children) {
          out.push({ label: c.label, href: c.href, icon: c.icon });
        }
      }
    }
  }
  return out;
}

const OWNER_SIDEBAR_NAV_FLAT = flattenSidebarItems(OWNER_SIDEBAR_SECTIONS);

const OWNER_PRIMARY_NAV: OwnerNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'fas fa-chart-line' },
  { label: 'Bookings', href: '/bookings', icon: 'fas fa-calendar-check' },
  { label: 'Calendar', href: '/calendar', icon: 'fas fa-calendar-alt' },
  { label: 'Messages', href: '/messaging', icon: 'fas fa-comments' },
  { label: 'Billing', href: '/money', icon: 'fas fa-dollar-sign' },
];

const HEADER_MAP: Array<{ match: (p: string) => boolean; title: string; subtitle: string }> = [
  {
    match: (p) => p.startsWith('/dashboard'),
    title: 'Dashboard',
    subtitle: 'Today’s business health and next actions',
  },
  {
    match: (p) => p.startsWith('/bookings'),
    title: 'Bookings',
    subtitle: 'Requests, assignments, and service status',
  },
  {
    match: (p) => p.startsWith('/calendar'),
    title: 'Calendar',
    subtitle: 'Schedules, coverage, and conflicts',
  },
  {
    match: (p) => p.startsWith('/clients'),
    title: 'Clients',
    subtitle: 'Households, pets, and booking history',
  },
  {
    match: (p) => p.startsWith('/sitters'),
    title: 'Sitters',
    subtitle: 'Availability, performance, and payroll readiness',
  },
  {
    match: (p) => p.startsWith('/messaging'),
    title: 'Messages',
    subtitle: 'Client and sitter conversations',
  },
  {
    match: (p) => p.startsWith('/money'),
    title: 'Billing',
    subtitle: 'Payments, payouts, and ledger status',
  },
  {
    match: (p) => p.startsWith('/ops/automation-failures'),
    title: 'Automation Failures',
    subtitle: 'Failures and retries',
  },
  {
    match: (p) => p.startsWith('/ops/failures'),
    title: 'Queue Failures',
    subtitle: 'Queue job failures and retries',
  },
  {
    match: (p) => p.startsWith('/ops/payouts'),
    title: 'Payouts',
    subtitle: 'Transfer state and exceptions',
  },
  {
    match: (p) => p.startsWith('/ops/message-failures'),
    title: 'Message Failures',
    subtitle: 'Delivery exceptions and retries',
  },
  {
    match: (p) => p.startsWith('/ops/calendar-repair'),
    title: 'Calendar Repair',
    subtitle: 'Calendar sync remediation',
  },
  {
    match: (p) => p.startsWith('/ops/finance/reconciliation'),
    title: 'Reconciliation',
    subtitle: 'Ledger and Stripe comparison',
  },
  {
    match: (p) => p.startsWith('/ops/ai'),
    title: 'AI Operations',
    subtitle: 'Governance and controls',
  },
  {
    match: (p) => p.startsWith('/ops/proof'),
    title: 'System Verification',
    subtitle: 'Runtime connectivity and worker health checks',
  },
  {
    match: (p) => p.startsWith('/ops/diagnostics'),
    title: 'Diagnostics',
    subtitle: 'System health, failure recovery, and verification tools',
  },
  {
    match: (p) => p.startsWith('/exceptions'),
    title: 'Exceptions',
    subtitle: 'Booking exceptions and resolution queue',
  },
  {
    match: (p) => p.startsWith('/finance'),
    title: 'Finance',
    subtitle: 'Revenue, payouts, and reconciliation',
  },
  {
    match: (p) => p.startsWith('/integrations'),
    title: 'Integrations',
    subtitle: 'Third-party services and connectivity status',
  },
  {
    match: (p) => p.startsWith('/settings'),
    title: 'Settings',
    subtitle: 'Business setup, integrations, and policies',
  },
];

function matches(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/messaging') return pathname === '/messaging' || pathname.startsWith('/messaging/');
  // Avoid /payments matching /payroll and vice versa (exact or single-segment path only)
  if (href === '/payroll') return pathname === '/payroll' || pathname.startsWith('/payroll/');
  if (href === '/payments') return pathname === '/payments' || pathname.startsWith('/payments/');
  return pathname.startsWith(href);
}

export function OwnerAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isOwner, loading } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const [headerShadow, setHeaderShadow] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  /** Only one collapsible open at a time. Messaging open only when on a messaging route; Diagnostics always starts collapsed. */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [deployInfo, setDeployInfo] = useState<{
    envName: string;
    commitSha: string;
    buildTime: string | null;
  } | null>(null);
  const isSupportRoute =
    pathname.startsWith('/ops') ||
    pathname.startsWith('/exceptions') ||
    pathname.startsWith('/numbers') ||
    pathname.startsWith('/assignments') ||
    pathname.startsWith('/twilio-setup') ||
    pathname.startsWith('/integrations') ||
    pathname.startsWith('/finance');
  const sidebarSections = isSupportRoute
    ? [...OWNER_SIDEBAR_SECTIONS, OWNER_SUPPORT_SECTION]
    : OWNER_SIDEBAR_SECTIONS;

  useEffect(() => {
    if (!loading && !isOwner) router.replace('/login');
  }, [loading, isOwner, router]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setHeaderShadow(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/messaging')) setExpandedKey('/messaging');
    else if (pathname.startsWith('/ops')) setExpandedKey('/ops/diagnostics');
    else setExpandedKey(null);
  }, [pathname]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        const envName = String(data?.envName ?? 'unknown');
        const sha = String(data?.commitSha ?? data?.version ?? '').slice(0, 7);
        const buildTime = data?.buildTime ? String(data.buildTime) : null;
        setDeployInfo({ envName, commitSha: sha, buildTime });
      })
      .catch(() => {});
  }, []);

  const header = useMemo(() => {
    const found = HEADER_MAP.find((entry) => entry.match(pathname));
    return found ?? { title: 'Owner Workspace', subtitle: 'Operations' };
  }, [pathname]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex bg-surface-secondary">
        <aside className="hidden w-60 shrink-0 border-r border-border-default bg-surface-primary lg:flex lg:flex-col">
          <div className="flex flex-col gap-3 px-4 pt-6">
            <Skeleton variant="text" width="70%" height={16} />
            <div className="mt-4 flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" height={40} style={{ borderRadius: 8 }} />
              ))}
            </div>
          </div>
        </aside>
        <div className="flex flex-1 flex-col">
          <div className="flex h-14 items-center justify-between border-b border-border-default bg-surface-primary px-6">
            <Skeleton variant="text" width={160} height={20} />
            <div className="flex items-center gap-3">
              <Skeleton variant="rectangular" width={44} height={36} style={{ borderRadius: 8 }} />
              <Skeleton variant="circular" width={36} height={36} />
            </div>
          </div>
          <div className="flex-1 p-6">
            <div className="mx-auto max-w-6xl flex flex-col gap-4">
              <Skeleton variant="text" width="30%" height={28} />
              <Skeleton variant="text" width="50%" height={14} />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={100} style={{ borderRadius: 12 }} />
                ))}
              </div>
              <Skeleton variant="rectangular" height={300} style={{ borderRadius: 12 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwner || !user) {
    return null;
  }

  const showDeployInfo = deployInfo && deployInfo.envName !== 'prod' && deployInfo.envName !== 'production';

  return (
    <div className="fixed inset-0 flex bg-surface-secondary">
      <aside className="hidden w-64 shrink-0 border-r border-border-default bg-surface-primary lg:flex lg:flex-col">
        <div className="h-14 border-b border-border-default px-4">
          <div className="flex h-full items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Owner</p>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: '/login' })}
              className="min-h-[44px] rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-secondary"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Owner navigation">
          {sidebarSections.map((section) => {
            const isMuted = section.muted ?? false;
            const isDiagnostics = section.title === 'Support Tools';
            return (
              <div key={section.title || 'main'} className={cn('mb-3', isMuted && 'opacity-80')}>
                {section.title && (
                  <p
                    className={cn(
                      'mb-1 px-2.5 py-0.5 font-semibold uppercase tracking-wider',
                      isDiagnostics ? 'text-[9px] text-text-disabled' : isMuted ? 'text-[10px] text-text-disabled' : 'text-[10px] text-text-tertiary'
                    )}
                  >
                    {section.title}
                  </p>
                )}
                {section.items.map((item) => {
                  if (!item.children?.length) {
                    const active = matches(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'mb-px flex min-h-[44px] items-center gap-2 rounded-md px-2.5 text-sm',
                          active
                            ? 'bg-surface-tertiary font-medium text-text-primary'
                            : isDiagnostics
                              ? 'text-text-disabled hover:bg-surface-secondary hover:text-text-secondary'
                              : isMuted
                                ? 'text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary'
                                : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                        )}
                      >
                        <Icon name={item.icon} className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  }
                  const isExpanded = expandedKey === item.href;
                  const activeChild = item.children?.find((c) => pathname === c.href || pathname.startsWith(c.href + '/'));
                  const isActive =
                    pathname === item.href || (activeChild != null);
                  return (
                    <div key={item.href} className="mb-px">
                      <div
                        className={cn(
                          'flex min-h-[44px] w-full items-center gap-0 rounded-md text-sm',
                          isActive
                            ? 'bg-surface-tertiary font-medium text-text-primary border-l-2 border-border-strong'
                            : isDiagnostics
                              ? 'text-text-disabled hover:bg-surface-secondary hover:text-text-secondary'
                              : isMuted
                                ? 'text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary'
                                : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                        )}
                      >
                        <Link
                          href={item.href}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2"
                          aria-expanded={isExpanded}
                        >
                          <Icon name={item.icon} className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedKey(isExpanded ? null : item.href);
                          }}
                          className="flex min-h-[44px] w-7 shrink-0 items-center justify-center rounded-md text-text-disabled hover:bg-surface-tertiary hover:text-text-secondary"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          aria-expanded={isExpanded}
                        >
                          <i
                            className={cn('text-[10px] transition-transform', isExpanded ? 'rotate-90' : '')}
                            style={{ fontFamily: 'ui-monospace' }}
                            aria-hidden
                          >
                            ▶
                          </i>
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="ml-3 mt-0.5 border-l border-border-default pl-1.5">
                          {item.children.map((c) => {
                            const childActive =
                              pathname === c.href || pathname.startsWith(c.href + '/');
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                className={cn(
                                  'mb-0.5 flex min-h-[44px] items-center gap-2 rounded-md px-2 text-[13px]',
                                  childActive
                                    ? 'bg-surface-tertiary font-medium text-text-primary border-l-2 border-border-strong pl-2.5'
                                    : isDiagnostics
                                      ? 'text-text-disabled hover:bg-surface-secondary hover:text-text-secondary'
                                      : isMuted
                                        ? 'text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary'
                                        : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                                )}
                              >
                                <Icon name={c.icon} className="w-3.5 h-3.5 shrink-0 text-text-disabled" />
                                <span className="truncate">{c.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border-default px-4 py-3 text-[11px] text-text-tertiary">
          {!isSupportRoute && (
            <Link
              href="/ops/diagnostics"
              className="mb-2 inline-flex min-h-[32px] items-center rounded-md px-2 py-1 text-xs font-medium text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary"
            >
              Open support tools
            </Link>
          )}
          {showDeployInfo && (
            <div>
              {deployInfo.envName} · {deployInfo.commitSha}
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-20 h-14 border-b border-border-default bg-surface-primary px-4',
            headerShadow && 'shadow-sm'
          )}
        >
          <div className="flex h-full items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-text-primary">{header.title}</p>
                {isSupportRoute && (
                  <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Support
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-text-tertiary">
                {isSupportRoute ? 'Internal tools for support, diagnostics, and recovery' : header.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="min-h-[44px] rounded-md border border-border-strong bg-surface-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
              >
                Menu
              </button>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: '/login' })}
                className="min-h-[44px] rounded-md border border-border-strong bg-surface-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main
          ref={mainRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:pb-0"
        >
          {children}
          {showDeployInfo && (
            <div className="px-4 pb-2 text-right text-[11px] text-text-tertiary lg:hidden">
              {deployInfo.envName} · {deployInfo.commitSha}
            </div>
          )}
        </main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-14 border-t border-border-default bg-surface-primary lg:hidden"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        aria-label="Owner primary navigation"
      >
        {OWNER_PRIMARY_NAV.map((item) => {
          const active = matches(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border-t-2 text-xs',
                active ? 'border-text-primary text-text-primary' : 'border-transparent text-text-tertiary'
              )}
            >
              <Icon name={item.icon} className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/25 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-[86%] max-w-sm overflow-y-auto border-l border-border-default bg-surface-primary px-3 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Owner</p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-secondary"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-0">
              {sidebarSections.map((section) => (
                <div key={section.title || 'main'} className={cn('mb-3', section.muted && 'opacity-80')}>
                  {section.title && (
                    <p className="mb-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      {section.title}
                    </p>
                  )}
                  {section.items.map((item) => {
                    const links: Array<{ href: string; label: string; icon: string }> = item.children
                      ? [{ href: item.href, label: item.label, icon: item.icon }, ...item.children]
                      : [{ href: item.href, label: item.label, icon: item.icon }];
                    return links.map((link) => {
                      const active = matches(pathname, link.href);
                      return (
                        <Link
                          key={`mobile-${link.href}`}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'mb-px flex min-h-[44px] items-center gap-2 rounded-md px-2.5 text-sm',
                            active
                              ? 'bg-surface-tertiary font-medium text-text-primary'
                              : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                          )}
                        >
                          <Icon name={link.icon} className="w-4 h-4 shrink-0" />
                          <span>{link.label}</span>
                        </Link>
                      );
                    });
                  })}
                </div>
              ))}
              {!isSupportRoute && (
                <Link
                  href="/ops/diagnostics"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-2 flex min-h-[44px] items-center gap-2 rounded-md px-2.5 text-sm text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
                >
                  <Icon name="fas fa-stethoscope" className="w-4 h-4 shrink-0" />
                  <span>Open support tools</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
