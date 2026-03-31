/**
 * PayrollTab - Extracted from payroll/page.tsx for embedding in sitters view.
 *
 * Single source of truth: Booking -> PayoutTransfer -> Ledger.
 * Shows payroll runs (weekly from PayoutTransfer), summary, approve, export.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { toastError } from '@/lib/toast';
import {
  Card,
  Button,
  Badge,
  Table,
  TableColumn,
  StatCard,
  Skeleton,
  EmptyState,
  Modal,
  Flex,
  Grid,
  GridCol,
} from '@/components/ui';
import { useMobile } from '@/lib/use-mobile';
import { formatServiceName } from '@/lib/format-utils';

interface PayrollRunListItem {
  id: string;
  startDate: string;
  endDate: string;
  sitterCount: number;
  totalPayout: number;
  status: string;
}

interface PayrollRunDetail {
  run: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    totalPayout: number;
  };
  sitters: Array<{
    sitterId: string;
    sitterName: string;
    bookingCount: number;
    earnings: number;
    commission: number;
    payoutAmount: number;
    stripeAccount: boolean;
  }>;
  bookings: Array<{
    bookingId: string;
    bookingDate: string;
    service: string;
    totalPrice: number;
    commissionPercentage: number;
    commissionAmount: number;
    status: string;
  }>;
}

export function PayrollTab() {
  const isMobile = useMobile();
  const [runs, setRuns] = useState<PayrollRunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PayrollRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [runToApprove, setRunToApprove] = useState<PayrollRunListItem | null>(null);
  const [approving, setApproving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      const response = await fetch(`/api/payroll?${params}`);
      if (!response.ok) throw new Error('Failed to fetch payroll');
      const data = await response.json();
      setRuns(data.payPeriods || []);
    } catch (error) {
      // fetch error handled by empty state
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleViewDetails = useCallback(async (run: PayrollRunListItem) => {
    setSelectedRunId(run.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/payroll/${run.id}`);
      if (response.ok) {
        const data = await response.json();
        setDetail(data as PayrollRunDetail);
      }
    } catch (error) {
      toastError('Failed to load run details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleApprove = async () => {
    if (!selectedRunId) return;
    setApproving(true);
    try {
      const response = await fetch(`/api/payroll/${selectedRunId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'owner' }),
      });
      if (response.ok) {
        setShowApprovalModal(false);
        setRunToApprove(null);
        setSelectedRunId(null);
        setDetail(null);
        fetchPayroll();
      } else {
        const json = await response.json().catch(() => ({}));
        toastError(json.error || 'Failed to approve');
      }
    } catch (error) {
      // approval error handled above via toastError
      toastError('Failed to approve. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  const handleExportCSV = useCallback(async (runId?: string) => {
    try {
      const params = runId ? new URLSearchParams({ runId }) : new URLSearchParams();
      const response = await fetch(`/api/payroll/export?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to export payroll');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // export error handled above via toastError
      toastError('Failed to export payroll.');
    }
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      pending: 'warning',
      approved: 'success',
      paid: 'success',
      canceled: 'error',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const filteredRuns = filterStatus === 'all' ? runs : runs.filter((r) => r.status === filterStatus);
  const totalPending = runs.filter((r) => r.status === 'pending' || r.status === 'draft').reduce((s, r) => s + r.totalPayout, 0);
  const totalApproved = runs.filter((r) => r.status === 'approved').reduce((s, r) => s + r.totalPayout, 0);
  const totalPaid = runs.filter((r) => r.status === 'paid').reduce((s, r) => s + r.totalPayout, 0);
  const currentRun = runs[0] ?? null;

  const runColumns: TableColumn<PayrollRunListItem>[] = [
    {
      key: 'period',
      header: 'Pay Period',
      render: (r) => (
        <div className="font-medium">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </div>
      ),
    },
    { key: 'sitters', header: 'Sitters', render: (r) => r.sitterCount, align: 'center' as const },
    {
      key: 'payout',
      header: 'Total Payout',
      render: (r) => (
        <div className="font-semibold">
          {formatCurrency(r.totalPayout)}
        </div>
      ),
      align: 'right' as const,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => getStatusBadge(r.status),
      align: 'center' as const,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <Flex gap={2}>
          <Button variant="tertiary" size="sm" onClick={() => handleViewDetails(r)}>
            View
          </Button>
          {r.status === 'pending' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setRunToApprove(r);
                setSelectedRunId(r.id);
                setShowApprovalModal(true);
              }}
            >
              Approve
            </Button>
          )}
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => handleExportCSV(r.id)}
            leftIcon={<Download size={14} />}
          >
            Export
          </Button>
        </Flex>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 mb-3">
        <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={() => handleExportCSV()}>Export</Button>
        <Button variant="tertiary" size="sm" onClick={fetchPayroll} disabled={loading} leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>Refresh</Button>
      </div>

      <div className="mb-6">
        <div className="mb-4">
          <Card className="border-2 border-border-default bg-surface-secondary/50 p-4">
            <Grid gap={4}>
              <GridCol span={12} md={5}>
                <div className="mb-1 text-sm text-text-secondary">
                  Current pay period
                </div>
                <div className="text-xl font-bold">
                  {currentRun
                    ? `${formatDate(currentRun.startDate)} – ${formatDate(currentRun.endDate)}`
                    : '—'}
                </div>
                <div className="mt-2 text-sm text-text-secondary">
                  {(currentRun?.sitterCount) ?? (runs.reduce((s, r) => s + r.sitterCount, 0) || 0)} sitters · {currentRun?.status ?? '—'}
                </div>
              </GridCol>
              <GridCol span={12} md={4}>
                <div className="mb-1 text-sm text-text-secondary">
                  Total payout (all runs)
                </div>
                <div className="text-2xl font-bold text-status-success-text">
                  {formatCurrency(runs.reduce((s, r) => s + r.totalPayout, 0))}
                </div>
              </GridCol>
              <GridCol span={12} md={3}>
                <Flex direction="column" gap={2}>
                  <div className="text-sm text-text-secondary">
                    Pending: <strong>{formatCurrency(totalPending)}</strong>
                  </div>
                  <div className="text-sm text-text-secondary">
                    Approved: <strong>{formatCurrency(totalApproved)}</strong>
                  </div>
                  <div className="text-sm text-text-secondary">
                    Paid: <strong>{formatCurrency(totalPaid)}</strong>
                  </div>
                </Flex>
              </GridCol>
            </Grid>
          </Card>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary min-h-[44px] focus:border-border-focus focus:outline-none"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {loading ? (
          <Card>
            <Skeleton height={400} />
          </Card>
        ) : filteredRuns.length === 0 ? (
          <Card>
            <EmptyState
              icon="💰"
              title="No payroll runs found"
              description="Payroll runs appear once completed visits have been paid out to sitters."
            />
          </Card>
        ) : (
          <Card padding={false} className="overflow-hidden">
            <Table
              columns={runColumns}
              data={filteredRuns}
              emptyMessage="No payroll runs found"
              className="[&_tbody_tr]:border-b [&_tbody_tr:hover]:bg-surface-secondary [&_tbody_td]:py-3"
            />
          </Card>
        )}
      </div>

      {/* Run Detail Modal */}
      <Modal
        isOpen={!!selectedRunId && !showApprovalModal}
        onClose={() => {
          setSelectedRunId(null);
          setDetail(null);
        }}
        title={
          detail
            ? `Pay Period – ${formatDate(detail.run.startDate)} to ${formatDate(detail.run.endDate)}`
            : 'Pay Period Details'
        }
        size="lg"
      >
        {detailLoading ? (
          <Skeleton height={200} />
        ) : detail ? (
          <Flex direction="column" gap={4}>
            <Grid gap={4}>
              <GridCol span={12} md={6}>
                <Card>
                  <div className="text-sm text-text-secondary mb-1">
                    Total Payout
                  </div>
                  <div className="text-xl font-bold text-status-success-text">
                    {formatCurrency(detail.run.totalPayout)}
                  </div>
                </Card>
              </GridCol>
              <GridCol span={12} md={6}>
                <Card>
                  <div className="text-sm text-text-secondary mb-1">
                    Sitters
                  </div>
                  <div className="text-xl font-bold">
                    {detail.sitters.length}
                  </div>
                </Card>
              </GridCol>
            </Grid>

            <div className="font-semibold mb-2">Sitter payout rows</div>
            <div className="rounded-lg border border-border-default overflow-hidden">
              <Table
                columns={[
                  { key: 'sitter', header: 'Sitter', render: (s) => <span className="font-medium">{s.sitterName}</span> },
                  { key: 'bookings', header: 'Bookings', render: (s) => s.bookingCount, align: 'center' as const },
                  { key: 'earnings', header: 'Earnings', render: (s) => formatCurrency(s.earnings), align: 'right' as const },
                  { key: 'commission', header: 'Commission', render: (s) => formatCurrency(s.commission), align: 'right' as const },
                  { key: 'payout', header: 'Payout', render: (s) => <span className="font-semibold">{formatCurrency(s.payoutAmount)}</span>, align: 'right' as const },
                  { key: 'stripe', header: 'Stripe', render: (s) => (s.stripeAccount ? 'Connected' : '—'), align: 'center' as const },
                ]}
                data={detail.sitters}
                emptyMessage="No sitters"
              />
            </div>

            {detail.bookings.length > 0 && (
              <>
                <div className="font-semibold">
                  Booking Breakdown ({detail.bookings.length})
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {detail.bookings.map((b) => (
                    <Card key={b.bookingId} className="mb-2">
                      <Flex justify="space-between" align="center">
                        <div>
                          <div className="font-medium">{formatServiceName(b.service)}</div>
                          <div className="text-sm text-text-secondary">
                            {formatDate(b.bookingDate)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div>{formatCurrency(b.totalPrice)}</div>
                          <div className="text-sm text-text-secondary">
                            {formatCurrency(b.commissionAmount)} ({b.commissionPercentage}%)
                          </div>
                        </div>
                      </Flex>
                    </Card>
                  ))}
                </div>
              </>
            )}

            <Button variant="primary" size="sm" onClick={() => selectedRunId && handleExportCSV(selectedRunId)} leftIcon={<Download size={14} />}>
              Export this period
            </Button>
          </Flex>
        ) : null}
      </Modal>

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => { setShowApprovalModal(false); setRunToApprove(null); }}
        title="Approve Payroll Run"
        size="md"
      >
        {runToApprove && (
          <Flex direction="column" gap={4}>
            <div>
              <div className="mb-2">
                Approve payroll run for period <strong>{formatDate(runToApprove.startDate)} – {formatDate(runToApprove.endDate)}</strong>?
                Total payout: <strong>{formatCurrency(runToApprove.totalPayout)}</strong> ({runToApprove.sitterCount} sitter{runToApprove.sitterCount !== 1 ? 's' : ''}).
              </div>
            </div>
            <Flex gap={3}>
              <Button variant="primary" onClick={handleApprove} disabled={approving} className="flex-1">
                {approving ? 'Approving...' : 'Approve'}
              </Button>
              <Button variant="tertiary" onClick={() => { setShowApprovalModal(false); setRunToApprove(null); }} className="flex-1">
                Cancel
              </Button>
            </Flex>
          </Flex>
        )}
      </Modal>
    </div>
  );
}
