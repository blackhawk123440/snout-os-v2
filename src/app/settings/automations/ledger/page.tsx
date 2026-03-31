/**
 * Automation Ledger Page - Enterprise Rebuild
 *
 * Complete rebuild using design system and components.
 * Zero legacy styling - all through components and tokens.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Calendar, AlertCircle, Info } from 'lucide-react';
import {
  PageHeader,
  Card,
  Button,
  Select,
  Badge,
  EmptyState,
  Skeleton,
  FormRow,
  MobileFilterBar,
} from '@/components/ui';
import { OwnerAppShell } from '@/components/layout';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { formatServiceName } from '@/lib/format-utils';

interface AutomationRun {
  id: string;
  eventType: string;
  automationType: string | null;
  status: "success" | "failed" | "skipped" | "pending";
  error: string | null;
  metadata: any;
  bookingId: string | null;
  booking: {
    id: string;
    firstName: string;
    lastName: string;
    service: string;
    status: string;
  } | null;
  createdAt: string;
}

export default function AutomationLedgerPage() {
  const isMobile = useMobile();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [automationTypeFilter, setAutomationTypeFilter] = useState<string>("all");

  const { data: ledgerData, isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ['owner', 'automation-ledger', statusFilter, automationTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (automationTypeFilter !== "all") {
        params.append("automationType", automationTypeFilter);
      }
      params.append("limit", "100");

      const res = await fetch(`/api/automations/ledger?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      return { runs: json.runs || [], total: json.total || 0 };
    },
  });
  const runs = ledgerData?.runs || [];
  const total = ledgerData?.total || 0;
  const error = queryError ? (queryError as Error).message || 'Failed to load automation runs' : null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="success">{status.toUpperCase()}</Badge>;
      case "failed":
        return <Badge variant="error">{status.toUpperCase()}</Badge>;
      case "skipped":
        return <Badge variant="warning">{status.toUpperCase()}</Badge>;
      case "pending":
        return <Badge variant="info">{status.toUpperCase()}</Badge>;
      default:
        return <Badge variant="neutral">{status.toUpperCase()}</Badge>;
    }
  };

  const getAutomationTypeLabel = (type: string | null) => {
    if (!type) return "Unknown";
    return type
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "success", label: "Success" },
    { value: "failed", label: "Failed" },
    { value: "skipped", label: "Skipped" },
    { value: "pending", label: "Pending" },
  ];

  const automationTypeOptions = [
    { value: "all", label: "All Types" },
    { value: "bookingConfirmation", label: "Booking Confirmation" },
    { value: "ownerNewBookingAlert", label: "Owner Alert" },
    { value: "nightBeforeReminder", label: "Night Before Reminder" },
    { value: "paymentReminder", label: "Payment Reminder" },
    { value: "sitterAssignment", label: "Sitter Assignment" },
    { value: "postVisitThankYou", label: "Post Visit Thank You" },
    { value: "dailySummary", label: "Daily Summary" },
  ];

  return (
    <OwnerAppShell>
      <PageHeader
        title="Automation Run Ledger"
        description="View automation execution history and failures"
        actions={
          <Link href="/settings">
            <Button variant="tertiary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Settings
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        {error && (
          <Card
            className="mb-6"
            style={{
              backgroundColor: tokens.colors.error[50],
              borderColor: tokens.colors.error[200],
            }}
          >
            <div className="p-4" style={{ color: tokens.colors.error[700] }}>
              {error}
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => refetch()}
                className="ml-3"
              >
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <div className="flex flex-col gap-4">
            {isMobile ? (
              <>
                <div>
                  <div className="text-sm font-semibold text-text-secondary mb-2">
                    Status
                  </div>
                  <MobileFilterBar
                    activeFilter={statusFilter}
                    onFilterChange={(filterId) => setStatusFilter(filterId)}
                    options={statusOptions.map(opt => ({ id: opt.value, label: opt.label }))}
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-secondary mb-2">
                    Automation Type
                  </div>
                  <MobileFilterBar
                    activeFilter={automationTypeFilter}
                    onFilterChange={(filterId) => setAutomationTypeFilter(filterId)}
                    options={automationTypeOptions.map(opt => ({ id: opt.value, label: opt.label }))}
                  />
                </div>
              </>
            ) : (
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
              >
                <FormRow label="Filter by Status">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    options={statusOptions}
                  />
                </FormRow>
                <FormRow label="Filter by Automation Type">
                  <Select
                    value={automationTypeFilter}
                    onChange={(e) => setAutomationTypeFilter(e.target.value)}
                    options={automationTypeOptions}
                  />
                </FormRow>
              </div>
            )}
            <div className="text-sm text-text-secondary">
              Showing {runs.length} of {total} automation runs
            </div>
          </div>
        </Card>

        {/* Runs List */}
        <Card>
          {loading ? (
            <div className="p-8 text-center">
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </div>
          ) : runs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No automation runs found"
                description={
                  statusFilter !== "all" || automationTypeFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Automation runs will appear here once automations start executing"
                }
                icon={<Clock className="w-12 h-12 text-neutral-300" />}
              />
            </div>
          ) : (
            <div>
              {runs.map((run: AutomationRun) => (
                <div
                  key={run.id}
                  className="p-4"
                  style={{
                    borderBottom: `1px solid ${tokens.colors.border.default}`,
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(run.status)}
                      <Badge variant="neutral">{getAutomationTypeLabel(run.automationType)}</Badge>
                      <div className="text-xs text-text-tertiary">
                        {formatDate(run.createdAt)}
                      </div>
                    </div>

                    {run.booking && (
                      <div className="text-sm text-text-secondary">
                        <Calendar className="w-3.5 h-3.5 mr-1 inline-block" />
                        Booking: {run.booking.firstName} {run.booking.lastName} - {formatServiceName(run.booking.service)}
                        {run.bookingId && (
                          <Link
                            href={`/bookings/${run.bookingId}`}
                            className="ml-2 text-xs underline text-primary"
                          >
                            View Booking
                          </Link>
                        )}
                      </div>
                    )}

                    {run.error && (
                      <Card
                        style={{
                          backgroundColor: tokens.colors.error[50],
                          borderColor: tokens.colors.error[200],
                        }}
                      >
                        <div className="p-3">
                          <div
                            className="text-sm font-medium mb-1"
                            style={{ color: tokens.colors.error[800] }}
                          >
                            <AlertCircle className="w-3.5 h-3.5 mr-1 inline-block" />
                            Error:
                          </div>
                          <div className="text-sm whitespace-pre-wrap" style={{ color: tokens.colors.error[700] }}>
                            {run.error}
                          </div>
                        </div>
                      </Card>
                    )}

                    {run.metadata && Object.keys(run.metadata).length > 0 && (
                      <details>
                        <summary className="text-sm text-text-primary cursor-pointer font-medium">
                          <Info className="w-3.5 h-3.5 mr-1 inline-block" />
                          View Details
                        </summary>
                        <div
                          className="mt-2 p-3 bg-neutral-50 rounded-md text-xs font-mono overflow-x-auto"
                          style={{
                            border: `1px solid ${tokens.colors.border.default}`,
                          }}
                        >
                          <pre className="m-0 whitespace-pre-wrap break-words">
                            {JSON.stringify(run.metadata, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </OwnerAppShell>
  );
}
