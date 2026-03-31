/**
 * SideNav Component
 * UI Constitution V1 - Layout Primitive
 *
 * Desktop fixed panel navigation. Mobile becomes Drawer trigger.
 * Supports collapsed mode and active route state.
 */

'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { cn } from './utils';

export interface SideNavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface SideNavProps {
  items: SideNavItem[];
  activeRoute?: string;
  collapsed?: boolean;
  onCollapseToggle?: (collapsed: boolean) => void;
  mobileDrawerTrigger?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function SideNav({
  items,
  activeRoute,
  collapsed: controlledCollapsed,
  onCollapseToggle,
  mobileDrawerTrigger,
  className,
  'data-testid': testId,
}: SideNavProps) {
  const pathname = usePathname();
  const isMobile = useMobile();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const handleToggle = () => {
    const newCollapsed = !collapsed;
    if (controlledCollapsed === undefined) setInternalCollapsed(newCollapsed);
    onCollapseToggle?.(newCollapsed);
  };

  if (isMobile && mobileDrawerTrigger) return <>{mobileDrawerTrigger}</>;

  const width = collapsed
    ? tokens.layout.appShell.sidebarWidthCollapsed
    : tokens.layout.appShell.sidebarWidth;

  const isActive = (href: string) => {
    if (activeRoute) return activeRoute === href;
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <nav
      data-testid={testId || 'side-nav'}
      className={cn(
        'h-full bg-surface-primary border-r border-border-default flex flex-col shrink-0',
        'transition-[width] duration-normal ease-standard',
        className
      )}
      style={{ width, minWidth: width }}
      aria-label="Main navigation"
    >
      {/* Collapse Toggle */}
      <button
        onClick={handleToggle}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        className={cn(
          'p-2 border-none bg-transparent cursor-pointer',
          'flex items-center justify-center',
          'text-text-secondary transition-colors duration-fast ease-standard',
          'hover:text-text-primary',
          'min-h-[44px] min-w-[44px]'
        )}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Nav Items */}
      <div className="flex-1 flex flex-col p-2 gap-1 overflow-y-auto overflow-x-hidden">
        {items.map((item, index) => {
          const active = isActive(item.href);
          return (
            <Link
              key={index}
              href={item.disabled ? '#' : item.href}
              aria-current={active ? 'page' : undefined}
              onClick={(e) => { if (item.disabled) e.preventDefault(); }}
              className={cn(
                'flex items-center gap-3 p-3 rounded-md no-underline text-base',
                'transition-all duration-fast ease-standard min-h-[44px] relative',
                active
                  ? 'text-text-primary bg-accent-secondary font-semibold'
                  : 'text-text-secondary font-normal bg-transparent hover:bg-surface-secondary',
                item.disabled && 'opacity-50 cursor-not-allowed',
                !item.disabled && 'cursor-pointer',
              )}
            >
              {item.icon && (
                <span className="flex items-center justify-center shrink-0 w-5">
                  {item.icon}
                </span>
              )}
              {!collapsed && (
                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {item.label}
                </span>
              )}
              {!collapsed && item.badge && (
                <span className="shrink-0">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
