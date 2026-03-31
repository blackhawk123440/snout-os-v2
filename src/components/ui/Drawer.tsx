/**
 * Drawer Component
 * UI Constitution V1 - Overlay Component
 *
 * Side drawer overlay with right and left placements.
 * Mobile default pattern for navigation.
 *
 * @example
 * ```tsx
 * <Drawer
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   placement="left"
 *   title="Navigation"
 * >
 *   <SideNav items={items} />
 * </Drawer>
 * ```
 */

'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
  title?: string;
  placement?: 'left' | 'right';
  width?: string;
  className?: string;
  'data-testid'?: string;
}

export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  placement = 'right',
  width,
  className,
  'data-testid': testId,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const drawerWidth = width || '16rem';

  useEffect(() => {
    if (isOpen) {
      previousActiveRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';
      drawerRef.current?.focus();
    } else {
      document.body.style.overflow = '';
      previousActiveRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = '';
      if (isOpen) previousActiveRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        data-testid="drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-layer-overlay transition-opacity duration-normal ease-decelerated"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', opacity: isOpen ? 1 : 0 }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        data-testid={testId || 'drawer'}
        className={cn('fixed top-0 bottom-0 max-w-[90vw] bg-surface-overlay shadow-lg z-layer-modal flex flex-col overflow-y-auto overflow-x-hidden transition-transform duration-normal ease-decelerated', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        tabIndex={-1}
        style={{ [placement]: 0, width: drawerWidth }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-border-default shrink-0">
            <h2
              id="drawer-title"
              className="text-2xl font-bold text-text-primary m-0 tracking-tight"
            >
              {title}
            </h2>
            <IconButton
              icon={<X className="w-4 h-4" />}
              variant="ghost"
              onClick={onClose}
              aria-label="Close drawer"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
