/**
 * Payroll Tab
 *
 * Earnings summary, pending payouts, completed payouts, adjustments
 */

'use client';

import { Card, SectionHeader, EmptyState, Skeleton, Table, TableColumn } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';

interface PayrollData {
  earningsSummary: {
    totalEarnings: number;
    pendingPayouts: number;
    completedPayouts: number;
    nextPayoutDate?: string;
  };
  pendingPayouts: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    amount: number;
    status: string;
  }>;
  completedPayouts: Array<{
    id: string;
    periodStart: string;
    periodEnd: string;
    amount: number;
    paidAt: string;
    status: string;
  }>;
  adjustments: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
  }>;
}

interface PayrollTabProps {
  sitterId: string;
}

export function PayrollTab({ sitterId }: PayrollTabProps) {
  const { data, isLoading } = useQuery<PayrollData>({
    queryKey: ['sitter-payroll', sitterId],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/sitter/${sitterId}`);
      if (!res.ok) {
        // If endpoint doesn't exist or no data, return foundation state
        if (res.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch payroll data');
      }
      return res.json();
    },
    retry: false,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton height={400} />
      </div>
    );
  }

  // Foundation state - no data yet
  if (!data) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <SectionHeader title="Payroll" />
          <EmptyState
            title="Payroll activates after completed bookings"
            description="Payroll information will appear here once the sitter has completed bookings and earnings are calculated. This includes earnings summaries, pending payouts, completed payouts, and any adjustments."
            icon="💰"
          />
        </Card>
      </div>
    );
  }

  const payoutColumns: TableColumn<PayrollData['pendingPayouts'][0]>[] = [
    {
      key: 'period',
      header: 'Period',
      render: (row) => `${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatCurrency(row.amount),
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => row.status,
    },
  ];

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Earnings Summary */}
      <Card className="p-4">
        <SectionHeader title="Earnings Summary" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <div>
            <div className="text-text-secondary mb-1">
              Total Earnings
            </div>
            <div className="text-xl font-bold text-success">
              {formatCurrency(data.earningsSummary.totalEarnings)}
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">
              Pending Payouts
            </div>
            <div className="text-lg font-semibold">
              {formatCurrency(data.earningsSummary.pendingPayouts)}
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">
              Completed Payouts
            </div>
            <div className="text-lg font-semibold">
              {formatCurrency(data.earningsSummary.completedPayouts)}
            </div>
          </div>
          {data.earningsSummary.nextPayoutDate && (
            <div>
              <div className="text-text-secondary mb-1">
                Next Payout
              </div>
              <div className="text-sm">
                {formatDate(data.earningsSummary.nextPayoutDate)}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Pending Payouts */}
      {data.pendingPayouts.length > 0 && (
        <Card className="p-4">
          <SectionHeader title="Pending Payouts" />
          <Table
            columns={payoutColumns}
            data={data.pendingPayouts}
            emptyMessage="No pending payouts"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {/* Completed Payouts */}
      {data.completedPayouts.length > 0 && (
        <Card className="p-4">
          <SectionHeader title="Completed Payouts" />
          <Table
            columns={[
              ...payoutColumns,
              {
                key: 'paidAt',
                header: 'Paid At',
                render: (row) => formatDate(row.paidAt),
              },
            ]}
            data={data.completedPayouts}
            emptyMessage="No completed payouts"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {/* Adjustments */}
      {data.adjustments.length > 0 && (
        <Card className="p-4">
          <SectionHeader title="Adjustments" />
          <Table
            columns={[
              {
                key: 'type',
                header: 'Type',
                render: (row) => row.type,
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (row) => formatCurrency(row.amount),
                align: 'right',
              },
              {
                key: 'reason',
                header: 'Reason',
                render: (row) => row.reason,
              },
              {
                key: 'createdAt',
                header: 'Date',
                render: (row) => formatDate(row.createdAt),
              },
            ]}
            data={data.adjustments}
            emptyMessage="No adjustments"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}
    </div>
  );
}
