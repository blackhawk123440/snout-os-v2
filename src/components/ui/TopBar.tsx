/**
 * TopBar Component
 * UI Constitution V1 - Layout Primitive
 *
 * Fixed height navigation bar with title, breadcrumb, and action slots.
 * Header-only component - no navigation behavior (use AppShell for pages).
 * No sticky behavior - must be inside PageShell or similar container.
 *
 * @example
 * ```tsx
 * <TopBar
 *   title="Dashboard"
 *   breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]}
 *   leftActions={<Button>Back</Button>}
 *   rightActions={<Button>Settings</Button>}
 * />
 * ```
 */

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from './utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface TopBarProps {
  title?: string;
  breadcrumb?: BreadcrumbItem[];
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function TopBar({
  title,
  breadcrumb,
  leftActions,
  rightActions,
  className,
  'data-testid': testId,
}: TopBarProps) {
  // Phase E: Removed navigation drawer logic - AppShell handles navigation now

  return (
    <header
      data-testid={testId || 'top-bar'}
      className={cn('flex items-center justify-between px-2 shrink-0 w-full mb-2', className)}
      style={{ height: '3.5rem', minHeight: '3.5rem' }}
    >
        {/* Left Section */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Phase E: Removed hamburger menu button - AppShell handles navigation */}

          {leftActions && (
          <div className="flex items-center gap-2">
            {leftActions}
          </div>
        )}

        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2"
          >
            {breadcrumb.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2"
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-sm text-text-secondary no-underline transition-colors duration-150 ease-in-out hover:text-text-primary"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-sm text-text-primary font-semibold">
                    {item.label}
                  </span>
                )}
                {index < breadcrumb.length - 1 && (
                  <span className="text-sm text-text-tertiary">
                    /
                  </span>
                )}
              </div>
            ))}
          </nav>
        )}

        {/* Title - Phase B3: Authoritative page title */}
        {title && !breadcrumb && (
          <h1 className="text-2xl font-bold text-text-primary m-0 tracking-tight leading-[1.2]">
            {title}
          </h1>
        )}
      </div>

      {/* Right Section */}
      {rightActions && (
        <div className="flex items-center gap-2 shrink-0">
          {rightActions}
        </div>
      )}
    </header>
  );
}
