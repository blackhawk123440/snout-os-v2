/**
 * BottomSheet Component
 * UI Constitution V1 - Overlay Component
 *
 * Mobile primary overlay pattern with optional drag handle.
 * Escape closes.
 *
 * @example
 * ```tsx
 * <BottomSheet
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Actions"
 *   dragHandle
 * >
 *   <Button>Action 1</Button>
 * </BottomSheet>
 * ```
 */

'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './utils';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
  title?: string;
  dragHandle?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  dragHandle = false,
  className,
  'data-testid': testId,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      sheetRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
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
        data-testid="bottom-sheet-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-layer-overlay transition-opacity duration-150 ease-decelerated"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', opacity: isOpen ? 1 : 0 }}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        data-testid={testId || 'bottom-sheet'}
        className={cn('fixed bottom-0 left-0 right-0 max-h-[90vh] bg-surface-overlay rounded-t-2xl shadow-xl z-layer-modal flex flex-col overflow-hidden transition-transform duration-normal ease-in-out', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
        tabIndex={-1}
      >
        {/* Drag Handle */}
        {dragHandle && (
          <div className="pt-3 flex justify-center shrink-0">
            <div className="w-10 h-1 bg-border-default rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-border-default shrink-0">
            <h2
              id="bottom-sheet-title"
              className="text-xl font-bold text-text-primary m-0"
            >
              {title}
            </h2>
            <IconButton
              icon={<X className="w-4 h-4" />}
              variant="ghost"
              onClick={onClose}
              aria-label="Close"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0">
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
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
