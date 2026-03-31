'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, User, MoreVertical } from 'lucide-react';
import { BookingStatusBadge, PaymentStatusBadge } from './BookingStatusBadge';
import { DropdownMenu, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatServiceName } from '@/lib/format-utils';

export interface BookingCardData {
  id: string;
  status: string;
  service: string;
  startAt: string;
  endAt?: string;
  firstName: string;
  lastName: string;
  sitter?: { firstName: string; lastName: string } | null;
  totalPrice: number;
  paymentStatus: string;
}

export interface BookingCardProps {
  booking: BookingCardData;
  onActionComplete?: () => void;
}

export function BookingCard({ booking, onActionComplete }: BookingCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
    onActionComplete?.();
  };

  const handleConfirm = async () => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Confirm failed');
      toastSuccess('Booking confirmed');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Confirm failed');
    }
  };

  const handleMarkPaid = async () => {
    try {
      const res = await fetch(`/api/ops/bookings/${booking.id}/mark-paid`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Mark paid failed');
      toastSuccess('Marked as paid');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Mark paid failed');
    }
  };

  const handleCancel = async () => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Owner cancelled' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Cancel failed');
      toastSuccess('Booking cancelled');
      invalidate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const canConfirm = ['pending', 'pending_payment'].includes(booking.status);
  const canMarkPaid = ['confirmed', 'completed'].includes(booking.status) && booking.paymentStatus !== 'paid';
  const canCancel = !['cancelled', 'completed', 'expired'].includes(booking.status);
  const sitterName = booking.sitter
    ? `${booking.sitter.firstName} ${booking.sitter.lastName}`.trim()
    : null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-border-default bg-surface-primary px-4 py-3 transition hover:bg-surface-secondary cursor-pointer"
      onClick={() => router.push(`/bookings/${booking.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/bookings/${booking.id}`)}
    >
      {/* Service icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-tertiary text-accent-primary">
        <Calendar className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-text-primary truncate">
            {booking.firstName} {booking.lastName}
          </p>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          {formatServiceName(booking.service)} · {formatDate(booking.startAt)} · {formatTime(booking.startAt)}
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
          {sitterName ? (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {sitterName}
            </span>
          ) : (
            <span className="text-status-warning-text font-medium">Unassigned</span>
          )}
          <span className="tabular-nums">${Number(booking.totalPrice).toFixed(2)}</span>
          <PaymentStatusBadge status={booking.paymentStatus} bookingStatus={booking.status} />
        </div>
      </div>

      {/* Actions menu */}
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <DropdownMenu
          trigger={
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary transition"
              aria-label="Booking actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          }
          placement="bottom-end"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/bookings/${booking.id}`)}>
              View details
            </DropdownMenuItem>
            {canConfirm && (
              <DropdownMenuItem onClick={() => void handleConfirm()}>
                Confirm
              </DropdownMenuItem>
            )}
            {canMarkPaid && (
              <DropdownMenuItem onClick={() => void handleMarkPaid()}>
                Mark paid
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="danger" onClick={() => void handleCancel()}>
                  Cancel booking
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenu>
      </div>
    </div>
  );
}
