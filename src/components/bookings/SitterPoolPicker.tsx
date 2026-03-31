/**
 * SitterPoolPicker Component
 * 
 * Shared primitive for selecting multiple sitters for a booking pool.
 * Used on booking cards and booking detail.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/lib/design-tokens';
import { SitterTierBadge, SitterInfo } from '@/components/sitter';

export interface SitterPoolPickerProps {
  bookingId: string;
  currentPool: SitterInfo[];
  availableSitters: SitterInfo[];
  onPoolChange: (bookingId: string, sitterIds: string[]) => Promise<void>;
  compact?: boolean;
}

export const SitterPoolPicker: React.FC<SitterPoolPickerProps> = ({
  bookingId,
  currentPool,
  availableSitters,
  onPoolChange,
  compact = false,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedSitterIds, setSelectedSitterIds] = useState<Set<string>>(
    new Set(currentPool.map(s => s.id))
  );
  const [saving, setSaving] = useState(false);

  const handleToggleSitter = (sitterId: string) => {
    setSelectedSitterIds(prev => {
      const next = new Set(prev);
      if (next.has(sitterId)) {
        next.delete(sitterId);
      } else {
        next.add(sitterId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onPoolChange(bookingId, Array.from(selectedSitterIds));
      setShowModal(false);
    } catch (error) {
      console.error('Failed to update sitter pool:', error);
      alert('Failed to update sitter pool');
    } finally {
      setSaving(false);
    }
  };

  const displayText = currentPool.length === 0
    ? 'Add sitter pool'
    : currentPool.length <= 2
    ? `Pool: ${currentPool.map(s => `${s.firstName} ${s.lastName}`).join(', ')}`
    : `Pool: ${currentPool.slice(0, 2).map(s => `${s.firstName} ${s.lastName}`).join(', ')}, plus ${currentPool.length - 2}`;

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: tokens.typography.fontSize.sm[0],
          color: tokens.colors.text.secondary,
          textAlign: 'left',
        }}
      >
        {displayText}
      </button>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedSitterIds(new Set(currentPool.map(s => s.id)));
        }}
        title="Edit Sitter Pool"
        size="full"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
            {[...availableSitters]
              // Sort by tier priority (higher tier = higher priority)
              .sort((a, b) => {
                const aPriority = a.currentTier?.priorityLevel || 0;
                const bPriority = b.currentTier?.priorityLevel || 0;
                return bPriority - aPriority; // Descending order
              })
              .map(sitter => {
              const isSelected = selectedSitterIds.has(sitter.id);
              return (
                <label
                  key={sitter.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[3],
                    padding: tokens.spacing[3],
                    cursor: 'pointer',
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.border.default}`,
                    backgroundColor: isSelected ? tokens.colors.background.secondary : tokens.colors.background.primary,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSitter(sitter.id)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                      {sitter.firstName} {sitter.lastName}
                    </div>
                    {sitter.currentTier && (
                      <div style={{ marginTop: tokens.spacing[1] }}>
                        <SitterTierBadge tier={sitter.currentTier} />
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: tokens.spacing[3], justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setSelectedSitterIds(new Set(currentPool.map(s => s.id)));
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} isLoading={saving}>
              Save Pool
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

