/**
 * Status & Availability Component
 * 
 * Shows availability toggle and active status indicator
 */

'use client';

import { Card, Switch, Badge } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { toastError } from '@/lib/toast';
import { useUpdateAvailability } from '@/lib/api/sitter-dashboard-hooks';
import { useState } from 'react';

interface StatusAvailabilityProps {
  isAvailable: boolean;
  sitterId: string;
}

export function StatusAvailability({ isAvailable, sitterId }: StatusAvailabilityProps) {
  const updateAvailability = useUpdateAvailability();
  const [localAvailable, setLocalAvailable] = useState(isAvailable);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setLocalAvailable(checked);
    setIsUpdating(true);
    try {
      await updateAvailability.mutateAsync({ sitterId, isAvailable: checked });
    } catch (error) {
      console.error('Failed to update availability:', error);
      // Revert on error
      setLocalAvailable(!checked);
      toastError('Failed to update availability. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card style={{ 
      padding: tokens.spacing[4],
      backgroundColor: localAvailable ? tokens.colors.success[50] : tokens.colors.neutral[100],
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
      }}>
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: tokens.spacing[2],
            marginBottom: tokens.spacing[1],
          }}>
            <h3 style={{ 
              fontSize: tokens.typography.fontSize.lg[0], 
              fontWeight: tokens.typography.fontWeight.semibold,
            }}>
              Availability Status
            </h3>
            <Badge variant={localAvailable ? 'success' : 'default'}>
              {localAvailable ? 'Available' : 'Unavailable'}
            </Badge>
          </div>
          <div style={{ 
            fontSize: tokens.typography.fontSize.sm[0],
            color: tokens.colors.text.secondary,
          }}>
            {localAvailable 
              ? 'You are currently available to receive booking requests'
              : 'You are currently unavailable and will not receive new requests'}
          </div>
        </div>
        <Switch
          checked={localAvailable}
          onChange={handleToggle}
          disabled={isUpdating}
          label={localAvailable ? 'Available' : 'Unavailable'}
        />
      </div>
    </Card>
  );
}
