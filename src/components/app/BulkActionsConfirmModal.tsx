'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface BulkActionsConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string;
  actionLabel: string;
  selectedCount: number;
  onConfirm: () => void;
}

export function BulkActionsConfirmModal({
  isOpen,
  onClose,
  actionId,
  actionLabel,
  selectedCount,
  onConfirm,
}: BulkActionsConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-confirm-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-[1101] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-default bg-surface-overlay p-6 shadow-xl"
          >
            <h2 id="bulk-confirm-title" className="text-lg font-semibold text-text-primary">
              {actionLabel} {selectedCount} item{selectedCount !== 1 ? 's' : ''}?
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              This action will apply to the selected items. (Stub – no backend.)
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-text-inverse focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
