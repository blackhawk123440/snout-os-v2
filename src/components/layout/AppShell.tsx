/**
 * AppShell Component
 *
 * Enterprise application shell with sidebar navigation, top bar, and content container.
 * All dashboard pages must use this layout.
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { ownerNavigation, navigation, type NavItem } from '@/lib/navigation';
import { useAuth } from '@/lib/auth-client';
import { useTheme } from '@/lib/theme-context';
import { Icon } from '@/components/ui/Icon';
import { X, Menu as MenuIcon, Search, Sun, Moon } from 'lucide-react';

export type { NavItem } from '@/lib/navigation';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useMobile();
  const { user, isOwner, isSitter } = useAuth();
  const { mode, toggleMode, density, setDensity } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Use owner nav for owners, legacy nav filtered for others
  const baseNav = isOwner ? ownerNavigation : navigation;
  const filteredNavigation = baseNav.filter((item) => {
    // Sitters should not see owner-only pages
    if (isSitter) {
      // Sitters can see: Dashboard (redirected to inbox), Messages (redirected to sitter inbox)
      // Hide: Bookings, Calendar, Clients, Sitters, Automations, Payments, Payroll, Settings
      if (item.href === '/messages') {
        return false; // Sitters use /sitter/inbox instead
      }
      if (['/bookings', '/calendar', '/clients', '/bookings/sitters', '/automations', '/payments', '/payroll', '/pricing', '/settings'].includes(item.href)) {
        return false;
      }
    }
    // Owners see all navigation items
    return true;
  });

  // Add sitter-specific navigation
  const sitterNavItems: NavItem[] = isSitter ? [
    { label: 'Inbox', href: '/sitter/inbox', icon: 'fas fa-inbox' },
  ] : [];

  const displayNavigation = isSitter ? sitterNavItems : filteredNavigation;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  // Prevent body scroll - AppShell owns all scrolling
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Always prevent body scroll when AppShell is mounted
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';

      // Additional prevention when sidebar is open on mobile
      if (sidebarOpen && window.innerWidth < 1024) {
        // Already set above, no additional changes needed
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      }
    };
  }, [sidebarOpen]);

  const isActive = (href: string) => {
    if (href === '/' || href === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col w-full overflow-hidden"
      style={{
        backgroundColor: tokens.colors.background.primary,
        height: '100%',
        maxHeight: '100vh',
      }}
    >
      {/* Blurred Backdrop - Only show when sidebar is open */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 pointer-events-auto"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 1020,
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Always overlay, never pushes content */}
      <aside
        style={{
          position: 'fixed',
          left: sidebarOpen ? 0 : `-${tokens.layout.appShell.sidebarWidth}`,
          top: 0,
          bottom: 0,
          width: tokens.layout.appShell.sidebarWidth,
          backgroundColor: tokens.colors.background.primary,
          borderRight: `1px solid ${tokens.colors.border.default}`,
          zIndex: 1030,
          transition: `left ${tokens.transitions.duration.slow} ease-in-out`,
          boxShadow: sidebarOpen ? '2px 0 12px rgba(0, 0, 0, 0.15)' : 'none',
          pointerEvents: sidebarOpen ? 'auto' : 'none',
        }}
        className="flex flex-col overflow-y-auto"
      >
        {/* Logo/Brand */}
        <div
          className="p-6 flex items-center gap-3"
          style={{
            borderBottom: `1px solid ${tokens.colors.border.default}`,
            height: tokens.layout.appShell.topBarHeight,
          }}
        >
          <div className="w-8 h-8 bg-accent-primary rounded-md flex items-center justify-center text-text-inverse text-xl font-bold">
            S
          </div>
          <div>
            <div className="text-base font-bold text-text-primary">
              Snout OS
            </div>
            <div className="text-xs text-text-secondary">
              Enterprise
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {displayNavigation.map((item) => {
            const groupActive = item.children?.some((child) => isActive(child.href)) ?? false;
            const parentActive = isActive(item.href) || groupActive;
            const parentHighlight = isActive(item.href) && !groupActive;

            return (
              <div key={item.href} className="mb-1">
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    marginBottom: item.children?.length ? 0 : undefined,
                    color: parentActive
                      ? tokens.colors.primary.DEFAULT
                      : tokens.colors.text.primary,
                    backgroundColor: parentHighlight
                      ? tokens.colors.primary[100]
                      : 'transparent',
                    fontWeight: parentActive
                      ? tokens.typography.fontWeight.semibold
                      : tokens.typography.fontWeight.normal,
                    transition: `all ${tokens.transitions.duration.DEFAULT}`,
                  }}
                  className="flex items-center gap-3 py-3 px-4 rounded-md no-underline cursor-pointer pointer-events-auto"
                  onMouseEnter={(e) => {
                    if (!parentActive) {
                      e.currentTarget.style.backgroundColor = tokens.colors.background.secondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!parentActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {item.icon && (
                    <Icon name={item.icon} className="w-4 h-4" />
                  )}
                  <span className="flex-1 text-base">
                    {item.label}
                  </span>
                  {item.badge && item.badge > 0 && (
                    <span className="bg-status-danger-fill text-text-inverse rounded-full py-1 px-2 text-xs font-semibold min-w-[1.25rem] text-center">
                      {item.badge}
                    </span>
                  )}
                </Link>

                {item.children && item.children.length > 0 && (
                  <div className="mt-1 ml-5 flex flex-col gap-1">
                    {item.children.map((child) => {
                      const childActive = isActive(child.href);

                      return (
                        <Link
                          key={`${item.href}-${child.href}`}
                          href={child.href}
                          onClick={() => setSidebarOpen(false)}
                          style={{
                            color: childActive
                              ? tokens.colors.primary.DEFAULT
                              : tokens.colors.text.secondary,
                            backgroundColor: childActive
                              ? tokens.colors.primary[50]
                              : 'transparent',
                            fontWeight: childActive
                              ? tokens.typography.fontWeight.semibold
                              : tokens.typography.fontWeight.normal,
                            transition: `all ${tokens.transitions.duration.DEFAULT}`,
                          }}
                          className="flex items-center gap-3 py-2 px-3 rounded-md no-underline text-sm cursor-pointer pointer-events-auto"
                          onMouseEnter={(e) => {
                            if (!childActive) {
                              e.currentTarget.style.backgroundColor = tokens.colors.background.secondary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!childActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          {child.icon && (
                            <Icon name={child.icon} className="w-4 h-4" />
                          )}
                          <span className="flex-1 text-sm">
                            {child.label}
                          </span>
                          {child.badge && child.badge > 0 && (
                            <span className="bg-status-danger-fill text-text-inverse rounded-full py-1 px-2 text-xs font-semibold min-w-[1.25rem] text-center">
                              {child.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area - Always full width, never resized */}
      <div className="flex-1 w-full flex flex-col min-h-0 ml-0 overflow-hidden">
        {/* Top Bar */}
        <header
          className="flex items-center justify-between sticky top-0 w-full"
          style={{
            height: tokens.layout.appShell.topBarHeight,
            backgroundColor: tokens.colors.background.primary,
            borderBottom: `1px solid ${tokens.colors.border.default}`,
            padding: `0 ${tokens.spacing[6]}`,
            zIndex: tokens.zIndex.sticky,
          }}
        >
          {/* Hamburger Button - Always visible on all screen sizes */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-md cursor-pointer"
            style={{
              border: `1px solid ${tokens.colors.border.default}`,
              backgroundColor: 'transparent',
              color: tokens.colors.text.primary,
              transition: `background-color ${tokens.transitions.duration.DEFAULT}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.background.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
          {/* Global search stub - opens Command Palette (Cmd+K) */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 flex-1 ml-4 py-2 px-3 rounded-md bg-surface-secondary text-text-tertiary text-sm text-left cursor-pointer"
            style={{
              maxWidth: isMobile ? 100 : 240,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
            aria-label="Search (Cmd+K)"
          >
            <Search className="w-4 h-4 text-text-tertiary" />
            <span>Search...</span>
            <span className="ml-auto text-xs">⌘K</span>
          </button>
          <div className="flex-1" />
          {/* Theme + density (owners) */}
          {isOwner && (
            <div className="flex items-center gap-2 mr-3">
              <select
                value={density}
                onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable' | 'spacious')}
                className="py-1 px-2 rounded-md text-sm text-text-secondary bg-transparent"
                style={{
                  border: `1px solid ${tokens.colors.border.default}`,
                }}
                aria-label="UI density"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
              <button
                type="button"
                onClick={toggleMode}
                className="p-2 rounded-md border-none bg-transparent text-text-secondary cursor-pointer"
                aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          )}
          {/* User menu with logout */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 py-2 px-3 rounded-md text-text-secondary text-sm">
                <span>{user.email}</span>
                <span className="text-border-default">|</span>
                <button
                  onClick={handleLogout}
                  className="bg-transparent border-none text-text-secondary cursor-pointer text-sm p-0 no-underline"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = tokens.colors.text.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = tokens.colors.text.secondary;
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content - Phase B4: Constrained centered layout, Phase E: Single scroll surface */}
        <main
          style={{
            maxWidth: isMobile ? '100vw' : tokens.layout.page.maxWidth,
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y pinch-zoom',
            WebkitTapHighlightColor: 'transparent',
          }}
          className="flex-[1_1_0] py-5 px-6 w-full mx-auto overflow-x-hidden overflow-y-auto scroll-smooth min-h-0 max-h-full relative"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
