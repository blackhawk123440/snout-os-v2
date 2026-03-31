/**
 * Sitter Dashboard Content
 *
 * Main dashboard layout with all sections
 */

'use client';

import { PageHeader, Button } from '@/components/ui';
import Link from 'next/link';
import { PendingRequests } from './PendingRequests';
import { UpcomingBookings } from './UpcomingBookings';
import { CompletedBookings } from './CompletedBookings';
import { PerformanceSnapshot } from './PerformanceSnapshot';
import { StatusAvailability } from './StatusAvailability';
import { SitterTierCard } from './SitterTierCard';
import { MessagingInboxCard } from './MessagingInboxCard';
import type { SitterDashboardData } from '@/lib/api/sitter-dashboard-hooks';

interface SitterDashboardContentProps {
  dashboardData: SitterDashboardData | null | undefined;
  sitterId: string;
}

export function SitterDashboardContent({ dashboardData, sitterId }: SitterDashboardContentProps) {
  if (!dashboardData) {
    return null;
  }

  const hasPendingRequests = dashboardData.pendingRequests.length > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={
          <Link href="/api/auth/signout">
            <Button variant="secondary" size="sm">Logout</Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-4 p-4">
        {/* Status & Availability - Top Priority */}
        <StatusAvailability
          isAvailable={dashboardData.isAvailable}
          sitterId={sitterId}
        />

        {/* Pending Requests - Highest Priority if any exist */}
        {hasPendingRequests && (
          <PendingRequests
            bookings={dashboardData.pendingRequests}
            sitterId={sitterId}
          />
        )}

        {/* Performance & Tier - Side by side on desktop */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
          <PerformanceSnapshot
            performance={dashboardData.performance}
            currentTier={dashboardData.currentTier}
          />
          <SitterTierCard
            currentTier={dashboardData.currentTier}
          />
        </div>

        {/* Messaging Inbox Card */}
        <MessagingInboxCard
          unreadCount={dashboardData.unreadMessageCount}
        />

        {/* Upcoming Bookings */}
        <UpcomingBookings
          bookings={dashboardData.upcomingBookings}
        />

        {/* Completed Bookings - Collapsed by default */}
        <CompletedBookings
          bookings={dashboardData.completedBookings}
          totalEarnings={dashboardData.performance.totalEarnings}
        />
      </div>
    </>
  );
}
