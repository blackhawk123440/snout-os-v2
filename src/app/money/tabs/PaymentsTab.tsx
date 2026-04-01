/**
 * Payments Tab - Enterprise Control Surface
 *
 * Finance-grade payments dashboard. Calm, authoritative, legible.
 * Zero legacy styling - all through components and tokens.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  DollarSign, Clock, AlertTriangle, Undo2, Download,
  Search, AlertCircle,
} from 'lucide-react';
import {
  Card,
  Button,
  Select,
  Input,
  StatCard,
  Table,
  TableColumn,
  DataTableShell,
  Skeleton,
  EmptyState,
  Flex,
  Grid,
  GridCol,
} from '@/components/ui';
import { StatusChip } from '@/components/ui/status-chip';
import { PageSkeleton } from '@/components/ui/loading-state';
import { useMobile } from '@/lib/use-mobile';
import { getStatusPill } from '@/components/app/getStatusPill';
import { AppFilterBar } from '@/components/app';
import { MobileFilterDrawer } from '@/components/app/MobileFilterDrawer';

interface Payment {
  id: string;
  amount: number;
  status: string;
  created: Date | string;
  customerEmail: string;
  customerName?: string;
  description?: string;
  paymentMethod?: string;
  currency?: string;
  lastError?: string;
  bookingId?: string;
}

interface Analytics {
  totalRevenue: number;
  totalCustomers: number;
  totalInvoices: number;
  recentPayments: Payment[];
  monthlyRevenue: number;
  weeklyRevenue: number;
  dailyRevenue: number;
  averagePayment: number;
  paymentMethods: Record<string, number>;
  revenueByMonth: Record<string, number>;
  topCustomers: Array<{ email: string; totalSpent: number; paymentCount: number }>;
  conversionRate: number;
  refundRate: number;
  churnRate: number;
}

interface TimeRange {
  label: string;
  value: string;
  days: number;
}

export function PaymentsTab() {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalRevenue: 0,
    totalCustomers: 0,
    totalInvoices: 0,
    recentPayments: [],
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    dailyRevenue: 0,
    averagePayment: 0,
    paymentMethods: {},
    revenueByMonth: {},
    topCustomers: [],
    conversionRate: 0,
    refundRate: 0,
    churnRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [kpis, setKpis] = useState({
    totalCollected: 0,
    pendingCount: 0,
    pendingAmount: 0,
    failedCount: 0,
    failedAmount: 0,
    refundedAmount: 0,
  });
  const [comparison, setComparison] = useState<{
    previousPeriodTotal: number;
    periodComparison: number;
    isPositive: boolean;
  } | null>(null);
  const isMobile = useMobile();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>({
    label: 'Last 30 Days',
    value: '30d',
    days: 30,
  });

  const timeRanges: TimeRange[] = [
    { label: 'Last 7 Days', value: '7d', days: 7 },
    { label: 'Last 30 Days', value: '30d', days: 30 },
    { label: 'Last 90 Days', value: '90d', days: 90 },
    { label: 'Last Year', value: '1y', days: 365 },
  ];

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timeRange: selectedTimeRange.value,
        status: statusFilter,
        search: searchTerm,
      });

      const response = await fetch(`/api/payments?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch payment data');
      }
      const data = await response.json();

      // Convert charges to Payment format and update state
      const payments = (data.payments || []).map((p: any) => ({
        ...p,
        created: new Date(p.created),
      }));

      // Update KPIs and comparison from API response
      if (data.kpis) {
        setKpis(data.kpis);
      }
      if (data.comparison) {
        setComparison(data.comparison);
      }

      // Calculate derived metrics
      const totalRevenue = data.kpis?.totalCollected || 0;
      const monthlyTotal = data.revenueByMonth
        ? Object.values(data.revenueByMonth).reduce((sum: number, val: any) => sum + val, 0)
        : 0;

      // Calculate weekly and daily revenue from revenueByDay
      const now = new Date();
      const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      const dayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      const weeklyRevenue = data.revenueByDay
        ? Object.entries(data.revenueByDay as Record<string, number>)
            .filter(([day]) => new Date(day) >= weekAgo)
            .reduce((sum, [, amount]) => sum + (typeof amount === 'number' ? amount : 0), 0)
        : 0;

      const dailyRevenue = data.revenueByDay
        ? Object.entries(data.revenueByDay as Record<string, number>)
            .filter(([day]) => new Date(day) >= dayAgo)
            .reduce((sum, [, amount]) => sum + (typeof amount === 'number' ? amount : 0), 0)
        : 0;

      // Calculate payment methods breakdown
      const paymentMethods: Record<string, number> = {};
      payments.forEach((p: any) => {
        const method = p.paymentMethod || 'card';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      });

      setAnalytics({
        totalRevenue,
        totalCustomers: data.topCustomers?.length || 0,
        totalInvoices: payments.length,
        recentPayments: payments,
        monthlyRevenue: monthlyTotal,
        weeklyRevenue,
        dailyRevenue,
        averagePayment: payments.length > 0 ? totalRevenue / payments.length : 0,
        paymentMethods,
        revenueByMonth: data.revenueByMonth || {},
        topCustomers: data.topCustomers || [],
        conversionRate: 0, // Not available from charges
        refundRate: data.kpis?.refundedCount > 0 && payments.length > 0
          ? (data.kpis.refundedCount / payments.length) * 100
          : 0,
        churnRate: 0, // Not available from charges
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange.value, statusFilter, searchTerm]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        timeRange: selectedTimeRange.value,
        type: 'all',
      });

      const response = await fetch(`/api/payments/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to export payments');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-export-${selectedTimeRange.value}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export payments');
    }
  };

  const filteredPayments = useMemo(() => {
    let filtered = analytics.recentPayments || [];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => {
        const normalizedStatus = p.status.toLowerCase();
        if (statusFilter === 'paid') {
          return normalizedStatus === 'paid' || normalizedStatus === 'succeeded';
        }
        if (statusFilter === 'pending') {
          return normalizedStatus === 'pending' || normalizedStatus === 'processing';
        }
        if (statusFilter === 'failed') {
          return (
            normalizedStatus === 'failed' ||
            normalizedStatus === 'canceled' ||
            normalizedStatus === 'requires_payment_method'
          );
        }
        if (statusFilter === 'refunded') {
          return normalizedStatus === 'refunded';
        }
        return true;
      });
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.customerEmail.toLowerCase().includes(term) ||
          (p.customerName && p.customerName.toLowerCase().includes(term)) ||
          p.id.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }

    // Sort by date (newest first)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [analytics.recentPayments, statusFilter, searchTerm]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusChipVariant = (status: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    const normalized = status.toLowerCase();
    if (normalized === 'paid' || normalized === 'succeeded') return 'success';
    if (normalized === 'pending' || normalized === 'processing') return 'warning';
    if (
      normalized === 'failed' ||
      normalized === 'canceled' ||
      normalized === 'requires_payment_method'
    )
      return 'danger';
    if (normalized === 'refunded') return 'neutral';
    return 'neutral';
  };

  const getStatusLabel = (status: string) => getStatusPill(status).label;

  const getPaymentMethodLabel = (method?: string) => {
    if (!method) return 'Card';
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const paymentColumns: TableColumn<Payment>[] = [
    {
      key: 'client',
      header: 'Client',
      mobileLabel: 'Client',
      mobileOrder: 1,
      render: (payment) => (
        <div>
          <div className="font-medium">{payment.customerName || payment.customerEmail}</div>
          {payment.customerName && (
            <div className="text-sm text-text-secondary">{payment.customerEmail}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      mobileLabel: 'Amount',
      mobileOrder: 2,
      align: 'right',
      render: (payment) => (
        <div className="font-heading font-semibold tabular-nums">{formatCurrency(payment.amount)}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      mobileLabel: 'Status',
      mobileOrder: 3,
      render: (payment) => (
        <div>
          <StatusChip
            variant={getStatusChipVariant(payment.status)}
            ariaLabel={`Payment status: ${getStatusLabel(payment.status)}`}
          >
            {getStatusLabel(payment.status)}
          </StatusChip>
          {(payment.status === 'paid' || payment.status === 'succeeded') && (
            <div className="mt-1 text-xs text-text-secondary">
              Paid at {formatDateTime(payment.created)}
            </div>
          )}
          {payment.status === 'failed' && payment.lastError && (
            <div
              className="mt-1 text-xs text-status-danger-fill max-w-[200px]"
              title={payment.lastError}
            >
              {payment.lastError.slice(0, 50)}{payment.lastError.length > 50 ? '...' : ''}
            </div>
          )}
        </div>
      ),
      align: 'center',
    },
    {
      key: 'reference',
      header: 'Invoice',
      mobileLabel: 'Invoice #',
      mobileOrder: 4,
      hideBelow: 'md',
      render: (payment) => (
        <div>
          <div className="text-sm text-text-secondary font-mono tabular-nums">
            #{payment.id.slice(-8).toUpperCase()}
          </div>
          {payment.bookingId ? (
            <Link
              href={`/bookings/${payment.bookingId}`}
              className="text-xs text-accent-primary underline"
            >
              Booking {payment.bookingId.slice(0, 8)}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      mobileLabel: 'Payment Method',
      mobileOrder: 5,
      hideBelow: 'md',
      render: (payment) => (
        <div className="text-sm">{getPaymentMethodLabel(payment.paymentMethod)}</div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      mobileLabel: 'Date',
      mobileOrder: 6,
      hideBelow: 'lg',
      render: (payment) => (
        <div className="text-sm tabular-nums">{formatDateTime(payment.created)}</div>
      ),
    },
  ];

  if (loading && analytics.recentPayments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mb-6">
          <Select
            options={timeRanges.map((r) => ({ value: r.value, label: r.label }))}
            value={selectedTimeRange.value}
            onChange={(e) => {
              const range = timeRanges.find((r) => r.value === e.target.value);
              if (range) setSelectedTimeRange(range);
            }}
            style={{ minWidth: '150px' }}
          />
        </div>
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <Select
          options={timeRanges.map((r) => ({ value: r.value, label: r.label }))}
          value={selectedTimeRange.value}
          onChange={(e) => {
            const range = timeRanges.find((r) => r.value === e.target.value);
            if (range) setSelectedTimeRange(range);
          }}
          style={{ minWidth: '150px' }}
        />
      </div>

      {error && (
        <Card className="mb-6 border-status-danger-fill bg-status-danger-bg">
          <Flex align="center" justify="space-between">
            <div className="text-status-danger-fill">
              <Flex align="center" gap={3}>
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </Flex>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchAnalytics}>
              Retry
            </Button>
          </Flex>
        </Card>
      )}

      {/* Period comparison */}
      {comparison && !isMobile && (
        <Card className="border border-border-default bg-surface-secondary mb-4">
          <div className="p-3">
            <Flex align="center" justify="space-between" gap={4}>
              <div>
                <span className="text-xs text-text-secondary">
                  {selectedTimeRange.label} vs previous period
                </span>
                <span className="ml-2 text-sm font-semibold text-text-primary tabular-nums">
                  {comparison.isPositive ? '+' : ''}{comparison.periodComparison.toFixed(1)}%
                </span>
              </div>
              <span className="text-xs text-text-secondary tabular-nums">
                {formatCurrency(comparison.previousPeriodTotal)} → {formatCurrency(kpis.totalCollected)}
              </span>
            </Flex>
          </div>
        </Card>
      )}

      {/* KPI Summary Row */}
      <div className="mb-4">
        <Grid gap={isMobile ? 3 : 2}>
          <GridCol span={12} md={6} lg={3}>
            <StatCard
              label="Total Collected"
              value={formatCurrency(kpis.totalCollected)}
              icon={<DollarSign className="w-4 h-4" />}
            />
          </GridCol>
          <GridCol span={12} md={6} lg={3}>
            <StatCard
              label="Pending Payments"
              value={`${kpis.pendingCount} (${formatCurrency(kpis.pendingAmount)})`}
              icon={<Clock className="w-4 h-4" />}
            />
          </GridCol>
          <GridCol span={12} md={6} lg={3}>
            <StatCard
              label="Failed Payments"
              value={`${kpis.failedCount} (${formatCurrency(kpis.failedAmount)})`}
              icon={<AlertTriangle className="w-4 h-4" />}
            />
          </GridCol>
          <GridCol span={12} md={6} lg={3}>
            <StatCard
              label="Refunded"
              value={formatCurrency(kpis.refundedAmount || 0)}
              icon={<Undo2 className="w-4 h-4" />}
            />
          </GridCol>
        </Grid>
      </div>

      {/* Mobile Export Button */}
      {isMobile && (
        <Card className="mb-4">
          <Button
            variant="secondary"
            style={{ width: '100%' }}
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
        </Card>
      )}

      {/* Filters */}
      <Card className={`mb-4 ${isMobile ? 'p-3' : ''}`}>
        {!isMobile && (
          <div className="mb-3">
            <p className="text-sm font-semibold text-text-primary">Refine this payment view</p>
            <p className="mt-1 text-sm text-text-secondary">Search for a household, invoice, or failed transaction, then narrow by payment status only when you need a tighter collections view.</p>
          </div>
        )}
        {isMobile ? (
          <MobileFilterDrawer triggerLabel="Filters" activeCount={Number(Boolean(searchTerm)) + Number(statusFilter !== 'all')}>
            <AppFilterBar
              filters={[
                { key: 'search', label: 'Search', type: 'search', placeholder: 'Client, email, invoice' },
                {
                  key: 'status',
                  label: 'Status',
                  type: 'select',
                  options: [
                    { value: 'all', label: 'All Statuses' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'failed', label: 'Failed' },
                    { value: 'refunded', label: 'Refunded' },
                  ],
                },
              ]}
              values={{ search: searchTerm, status: statusFilter }}
              onChange={(k, v) => {
                if (k === 'search') setSearchTerm(v);
                if (k === 'status') setStatusFilter(v);
              }}
              onClear={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
            />
          </MobileFilterDrawer>
        ) : (
          <Flex direction="row" gap={4}>
            <Input
              placeholder="Search by client, email, or invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              style={{ flex: 1 }}
            />
            <Select
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'paid', label: 'Paid' },
                { value: 'pending', label: 'Pending' },
                { value: 'failed', label: 'Failed' },
                { value: 'refunded', label: 'Refunded' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: '200px' }}
            />
          </Flex>
        )}
      </Card>

      {/* Payments Table */}
      <Card padding={!loading}>
        {loading ? (
          <Skeleton height="400px" />
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            title="No payments found"
            description={
              searchTerm || statusFilter !== 'all'
                ? undefined // Phase E: Neutral, operational - no friendly guidance
                : undefined // Phase E: Neutral, operational - remove onboarding tone
            }
          />
        ) : (
          <DataTableShell stickyHeader>
            <Table
              columns={paymentColumns}
              data={filteredPayments}
              emptyMessage="No payments found"
              keyExtractor={(payment) => payment.id}
            />
          </DataTableShell>
        )}
      </Card>
    </div>
  );
}
