'use client';

import { useCallback } from 'react';
import { AppFilterBar, type AppFilterBarFilter } from '@/components/app/AppFilterBar';

export interface BookingFilterValues {
  search: string;
  status: string;
  payment: string;
  from: string;
  to: string;
}

const BOOKING_FILTERS: AppFilterBarFilter[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Client name or phone...',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'in_progress', label: 'In progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    key: 'payment',
    label: 'Payment',
    type: 'select',
    options: [
      { value: 'paid', label: 'Paid' },
      { value: 'unpaid', label: 'Unpaid' },
      { value: 'refunded', label: 'Refunded' },
    ],
  },
  { key: 'from', label: 'From', type: 'date' },
  { key: 'to', label: 'To', type: 'date' },
];

export interface OwnerBookingFiltersProps {
  values: BookingFilterValues;
  onChange: (values: BookingFilterValues) => void;
  className?: string;
}

export function OwnerBookingFilters({ values, onChange, className }: OwnerBookingFiltersProps) {
  const handleChange = useCallback(
    (key: string, value: string) => {
      onChange({ ...values, [key]: value });
    },
    [values, onChange],
  );

  const handleClear = useCallback(() => {
    onChange({ search: '', status: '', payment: '', from: '', to: '' });
  }, [onChange]);

  return (
    <AppFilterBar
      filters={BOOKING_FILTERS}
      values={values as unknown as Record<string, string>}
      onChange={handleChange}
      onClear={handleClear}
      className={className}
    />
  );
}

export const defaultBookingFilters: BookingFilterValues = {
  search: '',
  status: '',
  payment: '',
  from: '',
  to: '',
};
