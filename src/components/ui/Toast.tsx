/**
 * Toast System Component
 * UI Constitution V1 - Overlay Component
 * 
 * Toast notification system with queue, variants, dismiss, and tokenized duration.
 * 
 * @example
 * ```tsx
 * const { showToast } = useToast();
 * 
 * showToast({
 *   message: 'Success!',
 *   variant: 'success',
 *   duration: 3000,
 * });
 * ```
 */

'use client';

import { ReactNode, createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { setToastHandler } from '@/lib/toast';
import { tokens } from '@/lib/design-tokens';
import { IconButton } from './IconButton';
import { cn } from './utils';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 3000, // Tokenized: motion.duration.slow
    };
    
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    setToastHandler((message, variant, opts) => {
      showToast({ message, variant, duration: opts?.duration });
    });
    return () => setToastHandler(null);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        top: tokens.spacing[4],
        right: tokens.spacing[4],
        zIndex: tokens.z.layer.tooltip + 1,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing[2],
        maxWidth: '400px',
        width: '100%',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variantColors = {
    success: tokens.colors.success.DEFAULT,
    warning: tokens.colors.warning.DEFAULT,
    error: tokens.colors.error.DEFAULT,
    info: tokens.colors.info.DEFAULT,
  };

  const variantIcons = {
    success: <CheckCircle2 className="w-5 h-5" style={{ color: variantColors.success }} />,
    warning: <AlertTriangle className="w-5 h-5" style={{ color: variantColors.warning }} />,
    error: <XCircle className="w-5 h-5" style={{ color: variantColors.error }} />,
    info: <Info className="w-5 h-5" style={{ color: variantColors.info }} />,
  };

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const variant = toast.variant || 'info';
  const color = variantColors[variant];
  const icon = variantIcons[variant];

  return (
    <div
      className={cn('toast')}
      style={{
        backgroundColor: tokens.colors.surface.overlay, // Phase 8: Use overlay surface
        border: `1px solid ${color}`,
        borderLeftWidth: '4px',
        borderRadius: tokens.radius.lg, // Phase 8: Larger radius
        padding: tokens.spacing[4],
        boxShadow: tokens.shadow.lg,
        display: 'flex',
        alignItems: 'flex-start',
        gap: tokens.spacing[3],
        minWidth: '300px',
        transition: `transform ${tokens.motion.duration.normal} ${tokens.motion.easing.spring}, opacity ${tokens.motion.duration.fast} ${tokens.motion.easing.decelerated}`, // Phase 8: Spring motion
      }}
    >
      {icon && (
        <span style={{ flexShrink: 0, marginTop: '2px' }}>
          {icon}
        </span>
      )}
      <div
        style={{
          flex: 1,
          fontSize: tokens.typography.fontSize.base[0],
          color: tokens.colors.text.primary,
        }}
      >
        {toast.message}
      </div>
      <IconButton
        icon={<X className="w-3.5 h-3.5" />}
        variant="ghost"
        size="sm"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
      />
      
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
