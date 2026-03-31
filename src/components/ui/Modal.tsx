/**
 * Modal Component
 *
 * Enterprise dialog/modal component with backdrop and close handling.
 * On mobile, renders as full-height bottom sheet.
 */

'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useMobile } from '@/lib/use-mobile';
import { cn } from './utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
}) => {
  const isMobile = useMobile();

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const closeButton = closeOnBackdropClick && (
    <button
      onClick={onClose}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-md',
        'border-none bg-transparent text-text-secondary cursor-pointer',
        'transition-all duration-fast',
        'hover:bg-surface-secondary hover:text-text-primary',
        'ml-auto'
      )}
      aria-label="Close modal"
    >
      <X className="w-4 h-4" />
    </button>
  );

  // Mobile: Full-height bottom sheet
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-layer-modal flex flex-col justify-end">
        {/* Backdrop */}
        <div
          onClick={closeOnBackdropClick ? onClose : undefined}
          className={cn(
            'absolute inset-0 bg-black/35',
            'transition-opacity duration-fast ease-decelerated',
            closeOnBackdropClick ? 'cursor-pointer' : 'cursor-default'
          )}
          aria-hidden="true"
        />

        {/* Bottom Sheet */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full bg-surface-primary rounded-t-xl shadow-xl flex flex-col overflow-hidden mt-auto"
          style={{ maxHeight: '90vh', height: '90vh' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {/* Handle bar */}
          <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto my-2" />

          {/* Header */}
          {(title || closeOnBackdropClick) && (
            <div className="flex items-center justify-between p-4 border-b border-border-default shrink-0">
              {title && (
                <h2 id="modal-title" className="text-xl font-semibold text-text-primary m-0">
                  {title}
                </h2>
              )}
              {closeButton}
            </div>
          )}

          {/* Body */}
          <div
            className="flex-1 p-4 overflow-y-auto overflow-x-hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="p-4 border-t border-border-default bg-surface-secondary flex justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: Centered Modal
  return (
    <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={closeOnBackdropClick ? onClose : undefined}
        className={cn(
          'absolute inset-0 bg-black/35',
          closeOnBackdropClick ? 'cursor-pointer' : 'cursor-default'
        )}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full max-h-[90vh] bg-surface-modal shadow-xl rounded-lg flex flex-col overflow-hidden',
          sizeClasses[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {(title || closeOnBackdropClick) && (
          <div className="flex items-center justify-between p-6 border-b border-border-default">
            {title && (
              <h2 id="modal-title" className="text-xl font-semibold text-text-primary m-0">
                {title}
              </h2>
            )}
            {closeButton}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-border-default bg-surface-secondary flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
