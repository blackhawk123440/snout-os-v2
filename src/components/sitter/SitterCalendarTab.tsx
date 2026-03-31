/**
 * Sitter Calendar Tab
 *
 * Displays Google Calendar sync status and upcoming bookings.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Info, MapPin, Pause, Play } from 'lucide-react';
import { Card, Button, Badge, EmptyState, Skeleton, SectionHeader } from '@/components/ui';
import { toastError } from '@/lib/toast';
import { BookingScheduleDisplay } from '@/components/booking';
import { useMobile } from '@/lib/use-mobile';
import { formatServiceName } from '@/lib/format-utils';

interface CalendarStatus {
  connected: boolean;
  syncEnabled: boolean;
  calendarId: string | null;
  calendarName: string | null;
  lastSyncAt: string | null;
}

interface Booking {
  id: string;
  firstName: string;
  lastName: string;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
  address?: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface SitterCalendarTabProps {
  sitterId: string;
}

export function SitterCalendarTab({ sitterId }: SitterCalendarTabProps) {
  const isMobile = useMobile();
  const [loading, setLoading] = useState(true);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [toggling, setToggling] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sitters/${sitterId}/calendar`);
      if (response.ok) {
        const data = await response.json();
        setCalendarStatus(data.status);
        setUpcomingBookings(data.upcomingBookings || []);
      }
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [sitterId]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handleToggleSync = async () => {
    if (!calendarStatus?.connected) {
      return;
    }

    setToggling(true);
    try {
      const response = await fetch(`/api/sitters/${sitterId}/calendar/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !calendarStatus.syncEnabled }),
      });

      if (response.ok) {
        await fetchCalendarData();
      } else {
        const error = await response.json();
        toastError(error.error || 'Failed to toggle sync');
      }
    } catch (error) {
      console.error('Failed to toggle sync:', error);
      toastError('Failed to toggle sync');
    } finally {
      setToggling(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Redirect to Google OAuth flow
      window.location.href = `/api/integrations/google/start?sitterId=${sitterId}`;
    } catch (error) {
      console.error('Failed to start OAuth:', error);
      toastError('Failed to connect Google Calendar');
      setConnecting(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton height={200} />
        <Skeleton height={400} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sync Status Card */}
      <Card>
        <SectionHeader title="Google Calendar Sync" />
        <div className="p-4">
          {calendarStatus?.connected ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="success">Connected</Badge>
                <Badge variant={calendarStatus.syncEnabled ? 'success' : 'default'}>
                  {calendarStatus.syncEnabled ? 'Sync Enabled' : 'Sync Disabled'}
                </Badge>
              </div>

              {calendarStatus.calendarName && (
                <div className="text-sm text-text-secondary">
                  <Calendar className="w-4 h-4 mr-2" />
                  {calendarStatus.calendarName}
                  {calendarStatus.calendarId && calendarStatus.calendarId !== 'primary' && (
                    <span className="ml-2 opacity-70">
                      ({calendarStatus.calendarId})
                    </span>
                  )}
                </div>
              )}

              {calendarStatus.lastSyncAt ? (
                <div className="text-sm text-text-secondary">
                  <Clock className="w-4 h-4 mr-2" />
                  Last synced: {formatDate(calendarStatus.lastSyncAt)} at {formatTime(calendarStatus.lastSyncAt)}
                </div>
              ) : (
                <div className="text-sm text-text-secondary italic">
                  <Info className="w-4 h-4 mr-2" />
                  No syncs yet
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant={calendarStatus.syncEnabled ? 'secondary' : 'primary'}
                  onClick={handleToggleSync}
                  disabled={toggling}
                  leftIcon={calendarStatus.syncEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                >
                  {toggling ? 'Updating...' : calendarStatus.syncEnabled ? 'Disable Sync' : 'Enable Sync'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="error">Not Connected</Badge>
              </div>
              <div className="text-sm text-text-secondary">
                Connect your Google Calendar to automatically sync booking assignments.
              </div>
              <Button
                variant="primary"
                onClick={handleConnect}
                disabled={connecting}
                leftIcon={<span className="font-bold text-sm">G</span>}
              >
                {connecting ? 'Connecting...' : 'Connect Google Calendar'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Upcoming Bookings */}
      <Card>
        <SectionHeader title="Upcoming Bookings" />
        <div className="p-4">
          {upcomingBookings.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No upcoming bookings"
              description="Bookings will appear here once assigned"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="p-3 border border-border-default rounded-md flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold mb-1">
                        {booking.firstName} {booking.lastName}
                      </div>
                      <div className="text-sm text-text-secondary">
                        {formatServiceName(booking.service)}
                      </div>
                    </div>
                    <Badge variant={booking.status === 'confirmed' ? 'success' : 'default'}>
                      {booking.status}
                    </Badge>
                  </div>
                  <BookingScheduleDisplay
                    service={formatServiceName(booking.service)}
                    startAt={booking.startAt}
                    endAt={booking.endAt}
                  />
                  {booking.address && (
                    <div className="text-sm text-text-secondary">
                      <MapPin className="w-4 h-4 mr-2" />
                      {booking.address}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
