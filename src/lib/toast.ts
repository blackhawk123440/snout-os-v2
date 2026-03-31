/**
 * Toast wrapper - Consistent tone: short, direct, actionable.
 * Use toastSuccess, toastError, toastInfo. Enforce copy rules.
 */

import type { ToastVariant } from '@/components/ui/Toast';

type ToastHandler = (message: string, opts?: { duration?: number }) => void;

let toastHandler: ((message: string, variant: ToastVariant, opts?: { duration?: number }) => void) | null = null;

export function setToastHandler(
  handler: ((message: string, variant: ToastVariant, opts?: { duration?: number }) => void) | null
) {
  toastHandler = handler;
}

export function toastSuccess(message: string, opts?: { duration?: number }): void {
  if (toastHandler) {
    toastHandler(message, 'success', opts);
  } else {
    console.info('[toast]', message);
  }
}

export function toastError(message: string, opts?: { duration?: number }): void {
  if (toastHandler) {
    toastHandler(message, 'error', opts);
  } else {
    console.error('[toast]', message);
  }
}

export function toastInfo(message: string, opts?: { duration?: number }): void {
  if (toastHandler) {
    toastHandler(message, 'info', opts);
  } else {
    console.info('[toast]', message);
  }
}

export function toastWarning(message: string, opts?: { duration?: number }): void {
  if (toastHandler) {
    toastHandler(message, 'warning', opts);
  } else {
    console.warn('[toast]', message);
  }
}
