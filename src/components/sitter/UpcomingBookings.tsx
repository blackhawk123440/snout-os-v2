/**
 * Upcoming Bookings Component
 *
 * Chronological list of confirmed upcoming bookings
 */

'use client';

import { Card, Button } from '@/components/ui';
import { type SitterBooking } from '@/lib/api/sitter-dashboard-hooks';
import { format } from 'date-fns';
import Link from 'next/link';
import { formatServiceName } from '@/lib/format-utils';

interface UpcomingBookingsProps {
  bookings: SitterBooking[];
}

export function UpcomingBookings({ bookings }: UpcomingBookingsProps) {
  // Sort by start date
  const sortedBookings = [...bookings].sort((a, b) =>
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  return (
    <Card className="p-4">
      <h2 className="text-xl font-bold mb-4">
        Upcoming Bookings
      </h2>

      {sortedBookings.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-xl mb-2">
            📅
          </div>
          <div className="text-base font-semibold mb-2 text-text-primary">
            No upcoming bookings
          </div>
          <div className="text-sm text-text-secondary max-w-[500px] mx-auto leading-relaxed">
            Accepted booking requests will appear here. Bookings are shown in chronological order
            with all details needed for your visits.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedBookings.map((booking) => {
            const clientName = booking.client
              ? `${booking.client.firstName} ${booking.client.lastName}`
              : `${booking.firstName} ${booking.lastName}`;

            const petNames = booking.pets.map(p => p.name).join(', ') || 'No pets listed';

            return (
              <Card
                key={booking.id}
                className="p-4 border border-border-default"
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
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 text-sm">
                    <div>
                      <strong>Date:</strong><br />
                      {format(new Date(booking.startAt), 'EEEE, MMM d, yyyy')}
                    </div>
                    <div>
                      <strong>Time:</strong><br />
                      {format(new Date(booking.startAt), 'h:mm a')} - {format(new Date(booking.endAt), 'h:mm a')}
                    </div>
                    <div>
                      <strong>Service:</strong><br />
                      {formatServiceName(booking.service)}
                    </div>
                    <div>
                      <strong>Address:</strong><br />
                      {booking.address || 'Not specified'}
                    </div>
                  </div>

                  {/* Notes */}
                  {booking.notes && (
                    <div className="p-2 bg-neutral-50 rounded-md text-sm">
                      <strong>Notes:</strong> {booking.notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/bookings/${booking.id}`}>
                      <Button variant="secondary" size="md">
                        View Details
                      </Button>
                    </Link>
                    {booking.threadId && (
                      <Link href={`/sitter/inbox?thread=${booking.threadId}`}>
                        <Button variant="secondary" size="md">
                          Message
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
