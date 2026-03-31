'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string | number;
  side?: 'left' | 'right';
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

export function AppDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = '480px',
  side = 'right',
}: AppDrawerProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (!panel || e.key !== 'Tab') return;
      const focusable = getFocusableElements(panel);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const focusable = getFocusableElements(panelRef.current);
    const first = focusable[0];
    if (first) first.focus();
    return () => {
      previousActiveRef.current?.focus?.();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'app-drawer-title' : undefined}
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 z-50 flex flex-col bg-surface-overlay shadow-xl outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-surface-overlay"
            style={{
              width: typeof width === 'number' ? `${width}px` : width,
              [side]: 0,
            }}
            tabIndex={-1}
          >
            {(title || subtitle) && (
              <div
                className="flex items-center justify-between border-b border-border-default"
                style={{ padding: 'var(--density-padding)' }}
              >
                <div>
                  {title && (
                    <h2
                      id="app-drawer-title"
                      className="text-lg font-semibold text-text-primary"
                    >
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-text-tertiary transition hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--density-padding)' }}>
              {children}
            </div>
            {footer && (
              <div
                className="flex justify-end gap-2 border-t border-border-default bg-surface-secondary"
                style={{ padding: 'var(--density-padding)' }}
              >
                {footer}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
