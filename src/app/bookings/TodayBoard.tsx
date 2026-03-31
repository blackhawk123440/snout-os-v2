/**
 * Today Board Component - Enterprise Rebuild
 *
 * Complete rebuild using design system and components.
 * Zero legacy styling - all through components and tokens.
 */

'use client';

import {
  assignSitterToBooking,
  sendPaymentLinkToBooking,
  resendConfirmation,
  markBookingComplete
} from '@/lib/today-board-helpers';
import {
  Card,
  Button,
  Badge,
  Select,
  StatCard,
  useToast,
} from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { CalendarCheck, Users, DollarSign, AlertTriangle } from 'lucide-react';
import { formatServiceName } from '@/lib/format-utils';

interface Booking {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  service: string;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  sitterId?: string | null;
  sitter?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  pets: Array<{ species: string; name?: string }>;
  notes?: string | null;
}

interface TodayBoardProps {
  todayBoardData: {
    today: Booking[];
    unassigned: Booking[];
    unpaid: Booking[];
    atRisk: Booking[];
    stats: {
      todayCount: number;
      unassignedCount: number;
      unpaidCount: number;
      atRiskCount: number;
    };
  };
  sitters: Array<{ id: string; firstName: string; lastName: string }>;
  onRefresh: () => void;
  onBookingClick: (booking: Booking) => void;
}

export default function TodayBoard({
  todayBoardData,
  sitters,
  onRefresh,
  onBookingClick
}: TodayBoardProps) {
  const { showToast } = useToast();
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatPets = (pets: Array<{ species: string }>) => {
    const counts: Record<string, number> = {};
    pets.forEach(pet => {
      counts[pet.species] = (counts[pet.species] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([species, count]) => `${count} ${species}${count > 1 ? 's' : ''}`)
      .join(', ');
  };

  const handleQuickAction = async (
    action: 'assign' | 'payment' | 'resend' | 'complete',
    booking: Booking,
    sitterId?: string
  ) => {
    try {
      let result;
      switch (action) {
        case 'assign':
          if (!sitterId) {
            showToast({ variant: 'warning', message: 'Please select a sitter first' });
            return;
          }
          result = await assignSitterToBooking(booking.id, sitterId);
          break;
        case 'payment':
          result = await sendPaymentLinkToBooking(booking.id);
          if (result.success) {
            showToast({ variant: 'success', message: 'Payment link sent to client.' });
          }
          break;
        case 'resend':
          result = await resendConfirmation(booking.id);
          break;
        case 'complete':
          result = await markBookingComplete(booking.id);
          break;
      }

      if (result?.success) {
        onRefresh();
      } else {
        showToast({ variant: 'error', message: result?.error || 'Action failed' });
      }
    } catch (error) {
      console.error('Quick action failed:', error);
      showToast({ variant: 'error', message: 'Action failed. Please try again.' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="success">confirmed</Badge>;
      case 'pending':
        return <Badge variant="warning">pending</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const renderBookingCard = (booking: Booking, section: string) => {
    const isUnassigned = !booking.sitterId;
    const isUnpaid = booking.paymentStatus === 'unpaid';
    const isAtRisk = section === 'atRisk';

    const borderColor = isAtRisk
      ? tokens.colors.error[300]
      : isUnpaid
      ? tokens.colors.warning[300]
      : isUnassigned
      ? tokens.colors.warning[400]
      : tokens.colors.border.default;

    const backgroundColor = isAtRisk
      ? tokens.colors.error[50]
      : isUnpaid
      ? tokens.colors.warning[50]
      : isUnassigned
      ? tokens.colors.warning[50]
      : tokens.colors.background.primary;

    return (
      <Card
        key={booking.id}
        className="mb-3"
        style={{
          borderColor,
          backgroundColor,
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="font-bold text-lg text-text-primary">
                {booking.firstName} {booking.lastName}
              </div>
              {getStatusBadge(booking.status)}
              {isUnpaid && (
                <Badge variant="error">Unpaid</Badge>
              )}
              {isUnassigned && (
                <Badge variant="warning">Unassigned</Badge>
              )}
            </div>
            <div className="text-sm text-text-secondary flex flex-col gap-1">
              <div><strong>Service:</strong> {formatServiceName(booking.service)}</div>
              <div><strong>Date:</strong> {formatDate(booking.startAt)} at {formatTime(booking.startAt)}</div>
              <div><strong>Pets:</strong> {formatPets(booking.pets)}</div>
              <div><strong>Total:</strong> ${booking.totalPrice.toFixed(2)}</div>
              {booking.sitter && (
                <div><strong>Sitter:</strong> {booking.sitter.firstName} {booking.sitter.lastName}</div>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onBookingClick(booking)}
            className="ml-4"
          >
            Details
          </Button>
        </div>

        {/* Quick Action Buttons */}
        <div
          className="flex flex-wrap gap-2 pt-3"
          style={{
            borderTop: `1px solid ${tokens.colors.border.default}`,
          }}
        >
          {isUnassigned && sitters.length > 0 && (
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleQuickAction('assign', booking, e.target.value);
                }
              }}
              options={[
                { value: '', label: 'Assign Sitter...' },
                ...sitters.map(sitter => ({
                  value: sitter.id,
                  label: `${sitter.firstName} ${sitter.lastName}`,
                })),
              ]}
              style={{ minWidth: '150px' }}
            />
          )}
          {isUnpaid && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleQuickAction('payment', booking)}
            >
              Send Payment Link
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleQuickAction('resend', booking)}
          >
            Resend Confirmation
          </Button>
          {booking.status !== 'completed' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickAction('complete', booking)}
            >
              Mark Complete
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Summary */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <StatCard
          label="Today's Bookings"
          value={todayBoardData.stats.todayCount}
          icon={<CalendarCheck className="w-4 h-4" />}
        />
        <StatCard
          label="Unassigned"
          value={todayBoardData.stats.unassignedCount}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Unpaid"
          value={todayBoardData.stats.unpaidCount}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          label="At Risk"
          value={todayBoardData.stats.atRiskCount}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
      </div>

      {/* Today's Bookings */}
      {todayBoardData.today.length > 0 && (
        <Card>
          <div className="font-bold text-lg text-text-primary mb-4">
            Today&apos;s Bookings ({todayBoardData.today.length})
          </div>
          {todayBoardData.today.map(booking => renderBookingCard(booking, 'today'))}
        </Card>
      )}

      {/* Unassigned Bookings */}
      {todayBoardData.unassigned.length > 0 && (
        <Card style={{ borderColor: tokens.colors.warning[300] }}>
          <div className="font-bold text-lg mb-4" style={{ color: tokens.colors.warning[700] }}>
            Unassigned Bookings ({todayBoardData.unassigned.length})
          </div>
          {todayBoardData.unassigned.map(booking => renderBookingCard(booking, 'unassigned'))}
        </Card>
      )}

      {/* Unpaid Bookings */}
      {todayBoardData.unpaid.length > 0 && (
        <Card style={{ borderColor: tokens.colors.warning[300] }}>
          <div className="font-bold text-lg mb-4" style={{ color: tokens.colors.warning[700] }}>
            Unpaid Bookings ({todayBoardData.unpaid.length})
          </div>
          {todayBoardData.unpaid.map(booking => renderBookingCard(booking, 'unpaid'))}
        </Card>
      )}

      {/* At Risk Bookings */}
      {todayBoardData.atRisk.length > 0 && (
        <Card style={{ borderColor: tokens.colors.error[300] }}>
          <div className="font-bold text-lg mb-4" style={{ color: tokens.colors.error[700] }}>
            At Risk Bookings ({todayBoardData.atRisk.length})
          </div>
          {todayBoardData.atRisk.map(booking => renderBookingCard(booking, 'atRisk'))}
        </Card>
      )}

      {/* Empty State */}
      {todayBoardData.today.length === 0 &&
       todayBoardData.unassigned.length === 0 &&
       todayBoardData.unpaid.length === 0 &&
       todayBoardData.atRisk.length === 0 && (
        <Card>
          <div className="text-center p-8">
            <CalendarCheck className="w-12 h-12 text-neutral-300 mb-4" />
            <div className="text-text-secondary">
              No bookings for today. Great job!
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
