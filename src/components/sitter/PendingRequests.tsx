/**
 * Pending Requests Component
 *
 * Shows booking requests that require sitter action (accept/decline)
 * Highest priority section - appears at top if any exist
 */

'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Card } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { toastError } from '@/lib/toast';
import { useAcceptBooking, useDeclineBooking, type SitterBooking } from '@/lib/api/sitter-dashboard-hooks';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { formatServiceName } from '@/lib/format-utils';

/**
 * Countdown Timer Component
 * Updates every second to show time remaining
 */
function CountdownTimer({ expiresAt }: { expiresAt: Date }) {
  const [timeRemaining, setTimeRemaining] = useState(() => {
    const now = new Date();
    return expiresAt.getTime() - now.getTime();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const remaining = expiresAt.getTime() - now.getTime();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeRemaining <= 0) {
    return (
      <div className="p-2 bg-status-danger-bg rounded-md text-sm text-status-danger-text">
        This request has expired
      </div>
    );
  }

  return (
    <div className="p-2 bg-status-warning-bg rounded-md text-sm font-medium text-status-warning-text">
      ⏰ Response deadline: {formatDistanceToNow(expiresAt, { addSuffix: true })}
    </div>
  );
}

interface PendingRequestsProps {
  bookings: SitterBooking[];
  sitterId: string;
  showHeader?: boolean; // Allow parent to control header rendering
}

export function PendingRequests({ bookings, sitterId, showHeader = true }: PendingRequestsProps) {
  const acceptBooking = useAcceptBooking();
  const declineBooking = useDeclineBooking();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (bookingId: string) => {
    setProcessingId(bookingId);
    try {
      await acceptBooking.mutateAsync({ bookingId, sitterId });
    } catch (error) {
      console.error('Failed to accept booking:', error);
      toastError('Failed to accept booking. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (bookingId: string) => {
    setProcessingId(bookingId);
    try {
      await declineBooking.mutateAsync({ bookingId, sitterId });
    } catch (error) {
      console.error('Failed to decline booking:', error);
      toastError('Failed to decline booking. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (bookings.length === 0) {
    return (
      <>
        {showHeader && (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              Pending Requests
            </h2>
          </div>
        )}
        <Card className="p-6 text-center">
          <div className="text-xl mb-2">
            📋
          </div>
          <div className="text-base font-semibold mb-2 text-text-primary">
            No pending requests
          </div>
          <div className="text-sm text-text-secondary max-w-[500px] mx-auto leading-relaxed">
            New booking requests will appear here. You can accept, decline, or message the client directly from each request.
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      {showHeader && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Pending Requests
          </h2>
          <Badge variant="warning" className="text-sm">
            {bookings.length} {bookings.length === 1 ? 'request' : 'requests'}
          </Badge>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {bookings.map((booking) => {
          // Support both legacy sitterPoolOffer and new offerEvent
          const offer = (booking as any).offerEvent || booking.sitterPoolOffer;
          const expiresAt = offer?.expiresAt ? new Date(offer.expiresAt) : null;
          const now = new Date();
          const timeRemaining = expiresAt ? expiresAt.getTime() - now.getTime() : null;
          const isExpired = timeRemaining !== null && timeRemaining <= 0;
          const isProcessing = processingId === booking.id;

          const clientName = booking.client
            ? `${booking.client.firstName} ${booking.client.lastName}`
            : `${booking.firstName} ${booking.lastName}`;

          const petNames = booking.pets.map(p => p.name).join(', ') || 'No pets listed';

          // Calculate payout (assuming commission percentage - will need to fetch from sitter)
          const payout = booking.totalPrice * 0.8; // Placeholder - should come from sitter commission

          return (
            <div
              key={booking.id}
              className="p-4 rounded-md"
              style={{
                border: `2px solid ${isExpired ? tokens.colors.error[300] : tokens.colors.warning[300]}`,
                backgroundColor: isExpired ? tokens.colors.error[50] : tokens.colors.background.primary,
              }}
            >
              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">
                      {clientName}
                    </h3>
                    <div className="text-sm text-text-secondary">
                      {petNames}
                    </div>
                  </div>
                  {isExpired && (
                    <Badge variant="error">Expired</Badge>
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 text-sm">
                  <div>
                    <strong>Date & Time:</strong><br />
                    {format(new Date(booking.startAt), 'MMM d, yyyy')}<br />
                    {format(new Date(booking.startAt), 'h:mm a')} - {format(new Date(booking.endAt), 'h:mm a')}
                  </div>
                  <div>
                    <strong>Location:</strong><br />
                    {booking.address || 'Not specified'}
                  </div>
                  <div>
                    <strong>Service:</strong><br />
                    {formatServiceName(booking.service)}
                  </div>
                  <div>
                    <strong>Payout:</strong><br />
                    <span className="text-lg font-semibold text-success">
                      ${payout.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Countdown Timer */}
                {expiresAt && !isExpired && (
                  <CountdownTimer expiresAt={expiresAt} />
                )}

                {isExpired && (
                  <div className="p-2 bg-status-danger-bg rounded-md text-sm text-status-danger-text">
                    This request has expired and will be re-assigned.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleAccept(booking.id)}
                    disabled={isProcessing || isExpired}
                    style={{ flex: '1 1 auto', minWidth: '120px' }}
                  >
                    {isProcessing && processingId === booking.id ? 'Processing...' : 'Accept Booking'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleDecline(booking.id)}
                    disabled={isProcessing || isExpired}
                    style={{ flex: '1 1 auto', minWidth: '120px' }}
                  >
                    Decline
                  </Button>
                  {booking.threadId && (
                    <Link href={`/sitter/inbox?thread=${booking.threadId}`}>
                      <Button
                        variant="secondary"
                        size="md"
                        style={{ flex: '1 1 auto', minWidth: '120px' }}
                      >
                        Message
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
