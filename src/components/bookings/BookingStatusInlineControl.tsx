/**
 * BookingStatusInlineControl Component
 * 
 * Shared primitive for inline status change on booking cards.
 * Shows current status and allows change with confirmation.
 */

'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { tokens } from '@/lib/design-tokens';

export interface BookingStatusInlineControlProps {
  bookingId: string;
  currentStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  onStatusChange: (bookingId: string, newStatus: string) => Promise<void>;
  compact?: boolean;
}

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'error' | 'neutral' => {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'error';
    default:
      return 'neutral';
  }
};

export const BookingStatusInlineControl: React.FC<BookingStatusInlineControlProps> = ({
  bookingId,
  currentStatus,
  onStatusChange,
  compact = false,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>(currentStatus);
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async () => {
    if (newStatus === currentStatus) {
      setShowModal(false);
      return;
    }
    setSaving(true);
    try {
      await onStatusChange(bookingId, newStatus);
      setShowModal(false);
    } catch (error) {
      console.error('Failed to change status:', error);
      alert('Failed to change status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        style={{
          display: 'inline-flex',
          cursor: 'pointer',
        }}
      >
        <Badge variant={getStatusVariant(currentStatus)}>
          {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
        </Badge>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setNewStatus(currentStatus);
        }}
        title="Change Booking Status"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
          <Select
            label="New Status"
            options={statusOptions}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          />
          <div style={{ display: 'flex', gap: tokens.spacing[3], justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setNewStatus(currentStatus);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleStatusChange} isLoading={saving}>
              Update Status
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

