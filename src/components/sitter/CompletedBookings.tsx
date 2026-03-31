/**
 * Completed Bookings Component
 *
 * Collapsed by default. Shows earnings breakdown and history
 */

'use client';

import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { type SitterBooking } from '@/lib/api/sitter-dashboard-hooks';
import { format } from 'date-fns';
import { formatServiceName } from '@/lib/format-utils';

interface CompletedBookingsProps {
  bookings: SitterBooking[];
  totalEarnings: number | null;
}

export function CompletedBookings({ bookings, totalEarnings }: CompletedBookingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort by completion date (most recent first)
  const sortedBookings = [...bookings].sort((a, b) =>
    new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  );

  return (
    <Card className="p-4">
      <div className={`flex justify-between items-center ${isExpanded ? 'mb-4' : ''}`}>
        <div>
          <h2 className="text-xl font-bold mb-1">
            Completed Bookings
          </h2>
          <div className="text-sm text-text-secondary">
            {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} completed
            {totalEarnings !== null && (
              <span className="ml-2">
                • Total earnings: <strong>${totalEarnings.toFixed(2)}</strong>
              </span>
            )}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-3">
          {sortedBookings.length === 0 ? (
            <div className="p-4 text-center text-text-secondary text-sm">
              No completed bookings yet. Completed bookings will appear here with earnings details.
            </div>
          ) : (
            sortedBookings.map((booking) => {
              const clientName = booking.client
                ? `${booking.client.firstName} ${booking.client.lastName}`
                : `${booking.firstName} ${booking.lastName}`;

              const payout = booking.totalPrice * 0.8; // Placeholder - should come from sitter commission

              return (
                <Card
                  key={booking.id}
                  className="p-3 border border-border-default bg-neutral-50"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium mb-1">
                        {clientName} • {formatServiceName(booking.service)}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {format(new Date(booking.endAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-success">
                      ${payout.toFixed(2)}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}
