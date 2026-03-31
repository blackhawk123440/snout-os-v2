/**
 * Dashboard Home Page - Enterprise Rebuild
 * 
 * Complete rebuild using design system and components.
 * Real-time metrics via /api/ops/metrics (poll every 15s).
 * Revenue forecast chart via /api/ops/forecast/revenue.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, StatCard, Card, Button, Skeleton } from '@/components/ui';
import { OwnerAppShell } from '@/components/layout';
import { tokens } from '@/lib/design-tokens';
import { useAuth } from '@/lib/auth-client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { MapPin, CalendarCheck, DollarSign, Users, CreditCard } from 'lucide-react';

const RevenueChart = dynamic(
  () => import('@/components/charts/RevenueChart').then((m) => m.RevenueChart),
  { ssr: false, loading: () => <div style={{ minHeight: 200, background: 'var(--color-surface-secondary)' }} /> }
);

interface MetricsData {
  activeVisitsCount: number;
  openBookingsCount: number;
  revenueYTD: number;
  retentionRate: number;
  timestamp?: string;
}

interface ForecastData {
  daily: { date: string; amount: number }[];
  aiCommentary: string;
}

export default function DashboardHomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect based on authentication and role
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=/');
      } else {
        const isSitter = (user as any).sitterId || (user as any).role === 'sitter';
        const isClient = (user as any).clientId || (user as any).role === 'client';
        if (isClient) {
          router.replace('/client/home');
        } else if (isSitter) {
          router.replace('/sitter/dashboard');
        } else {
          router.replace('/dashboard');
        }
      }
    }
  }, [user, authLoading, router]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/ops/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // Fallback: try legacy endpoints
      const [bookingsRes, sittersRes] = await Promise.all([
        fetch('/api/bookings?page=1&pageSize=200').catch(() => null),
        fetch('/api/sitters?page=1&pageSize=200').catch(() => null),
      ]);
      const bookings = bookingsRes?.ok ? await bookingsRes.json() : { items: [] };
      const sitters = sittersRes?.ok ? await sittersRes.json() : { items: [] };
      const activeBookings = (bookings.items || []).filter(
        (b: any) => b.status !== 'cancelled' && b.status !== 'completed'
      );
      setMetrics({
        activeVisitsCount: activeBookings.filter((b: any) => b.status === 'in_progress').length,
        openBookingsCount: activeBookings.length,
        revenueYTD: (bookings.items || []).reduce((s: number, b: any) => s + (b.totalPrice || 0), 0),
        retentionRate: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(async () => {
    try {
      // Deterministic only (fast). Use ?ai=true for AI commentary.
      const res = await fetch('/api/ops/forecast/revenue?range=90d');
      if (res.ok) {
        const data = await res.json();
        setForecast(data);
      }
    } catch {
      setForecast(null);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchMetrics();
      fetchForecast();
    }
  }, [user, fetchMetrics, fetchForecast]);

  // Poll metrics every 15s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, [user, fetchMetrics]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: tokens.colors.text.secondary }}>Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated (handled by useEffect, but show nothing while redirecting)
  if (!user) {
    return null;
  }

  return (
    <OwnerAppShell>
      <PageHeader
        title="Dashboard"
        description="Overview of your pet care business operations"
        actions={
          <Link href="/bookings">
            <Button variant="primary">
              View All Bookings
            </Button>
          </Link>
        }
      />

      {/* Real-time metrics (poll every 15s) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: tokens.spacing[2],
          marginBottom: tokens.spacing[4],
        }}
      >
        {loading ? (
          <>
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
          </>
        ) : metrics ? (
          <>
            <div style={{
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.borderRadius.sm,
              padding: tokens.spacing[1],
              boxShadow: tokens.shadows.md,
            }}>
              <StatCard
                label="Active Visits (GPS)"
                value={metrics.activeVisitsCount}
                icon={<MapPin className="w-4 h-4" />}
              />
            </div>
            <StatCard
              label="Open Bookings"
              value={metrics.openBookingsCount}
              icon={<CalendarCheck className="w-4 h-4" />}
            />
            <StatCard
              label="Revenue YTD"
              value={`$${metrics.revenueYTD.toFixed(2)}`}
              icon={<DollarSign className="w-4 h-4" />}
            />
            <StatCard
              label="Retention %"
              value={`${metrics.retentionRate}%`}
              icon={<Users className="w-4 h-4" />}
            />
          </>
        ) : (
          <Skeleton height="120px" />
        )}
      </div>

      {/* Revenue forecast chart */}
      {forecast && forecast.daily.length > 0 && (
        <Card
          header={
            <div style={{
              fontSize: tokens.typography.fontSize.base[0],
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.text.secondary,
            }}>
              Revenue (last 90 days)
            </div>
          }
        >
          <RevenueChart daily={forecast.daily} aiCommentary={forecast.aiCommentary} />
        </Card>
      )}

      {/* Quick Actions - Phase B6: Secondary to stats */}
      <Card
        header={
          <div
            style={{
              fontSize: tokens.typography.fontSize.base[0], // Phase B6: Smaller heading
              fontWeight: tokens.typography.fontWeight.medium, // Phase B6: Lighter weight
              color: tokens.colors.text.secondary, // Phase B6: Less prominent
            }}
          >
            Quick Actions
          </div>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: tokens.spacing[4],
          }}
        >
          <Link href="/bookings">
            <Button variant="secondary" leftIcon={<CalendarCheck className="w-4 h-4" />}>
              View Bookings
            </Button>
          </Link>
          <Link href="/clients">
            <Button variant="secondary" leftIcon={<Users className="w-4 h-4" />}>
              Manage Clients
            </Button>
          </Link>
          <Link href="/sitters">
            <Button variant="secondary" leftIcon={<Users className="w-4 h-4" />}>
              Manage Sitters
            </Button>
          </Link>
          <Link href="/money">
            <Button variant="secondary" leftIcon={<CreditCard className="w-4 h-4" />}>
              View Payments
            </Button>
          </Link>
        </div>
      </Card>
    </OwnerAppShell>
  );
}
