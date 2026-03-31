/**
 * Exceptions Page - Enterprise Rebuild
 *
 * Complete rebuild using design system and components.
 * Zero legacy styling - all through components and tokens.
 *
 * Displays exception queue for unpaid, unassigned, drift, and automation failures.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle2, DollarSign, UserX } from 'lucide-react';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  Button,
  Select,
  Badge,
  StatCard,
  EmptyState,
  Skeleton,
  Flex,
  Grid,
  GridCol,
} from '@/components/ui';
import { OwnerAppShell } from '@/components/layout';
import { tokens } from '@/lib/design-tokens';
import { formatDateTime, formatServiceName } from '@/lib/format-utils';

interface Exception {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  bookingId?: string;
  booking?: {
    id: string;
    firstName: string;
    lastName: string;
    service: string;
    startAt: Date | string;
    totalPrice?: number;
    paymentStatus?: string;
    sitterId?: string;
    address?: string;
    notes?: string;
    sitter?: any;
  };
  createdAt: Date | string;
  resolvedAt?: Date | string;
  metadata?: any;
}

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = typeFilter === "all"
        ? "/api/exceptions"
        : `/api/exceptions?type=${typeFilter}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch exceptions");
      }
      const data = await response.json();
      setExceptions(data.exceptions || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError('Failed to load exceptions');
      setExceptions([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const formatDate = (date: Date | string) => formatDateTime(date);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return <Badge variant="error">{severity.toUpperCase()}</Badge>;
      case "medium":
        return <Badge variant="warning">{severity.toUpperCase()}</Badge>;
      case "low":
        return <Badge variant="info">{severity.toUpperCase()}</Badge>;
      default:
        return <Badge variant="neutral">{severity.toUpperCase()}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "unpaid":
        return "Unpaid";
      case "unassigned":
        return "Unassigned";
      case "automation_failure":
        return "Automation Failure";
      case "at_risk":
        return "At Risk";
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "unpaid":
        return <DollarSign size={18} />;
      case "unassigned":
        return <UserX size={18} />;
      case "automation_failure":
        return <AlertTriangle size={18} />;
      case "at_risk":
        return <AlertCircle size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "unpaid", label: "Unpaid" },
    { value: "unassigned", label: "Unassigned" },
    { value: "automation_failure", label: "Automation Failures" },
    { value: "at_risk", label: "At Risk" },
  ];

  return (
    <OwnerAppShell>
      <PageHeader
        title="Exception Queue"
        description="Unpaid, unassigned, drift, and automation failures"
        actions={
          <Button
            variant="tertiary"
            onClick={fetchExceptions}
            disabled={loading}
            leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="p-6">
        {error && (
          <Card className="mb-6 bg-status-danger-bg border-status-danger-border">
            <div className="p-4 text-status-danger-text">
              {error}
              <Button
                variant="tertiary"
                size="sm"
                onClick={fetchExceptions}
                className="ml-3"
              >
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="mb-6">
            <Grid gap={4}> {/* Batch 5: UI Constitution compliance */}
              <GridCol span={12} md={6} lg={3}>
                <StatCard
                  label="Total Exceptions"
                  value={summary.total}
                  icon={<AlertTriangle size={16} />}
                />
              </GridCol>
              <GridCol span={12} md={6} lg={3}>
                <StatCard
                  label="High Severity"
                  value={summary.bySeverity?.high || 0}
                  icon={<AlertCircle size={16} />}
                />
              </GridCol>
              <GridCol span={12} md={6} lg={3}>
                <StatCard
                  label="Medium Severity"
                  value={summary.bySeverity?.medium || 0}
                  icon={<AlertTriangle size={16} />}
                />
              </GridCol>
              <GridCol span={12} md={6} lg={3}>
                <StatCard
                  label="Low Severity"
                  value={summary.bySeverity?.low || 0}
                  icon={<Info size={16} />}
                />
              </GridCol>
            </Grid>
          </div>
        )}

        {/* Type Filter */}
        <Card className="mb-6">
          <Flex align="center" gap={4}> {/* Batch 5: UI Constitution compliance */}
            <label className="text-sm font-medium text-text-primary">
              Filter by Type:
            </label>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={typeOptions}
              style={{ minWidth: '200px' }}
            />
          </Flex>
        </Card>

        {/* Exceptions List */}
        <Card>
          <div className="p-4 border-b border-border-default mb-0">
            <div className="font-bold text-lg text-text-primary">
              Exceptions ({exceptions.length})
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </div>
          ) : exceptions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No exceptions found"
                description="All bookings are in good standing!"
                icon={<CheckCircle2 size={48} className="text-success" />}
              />
            </div>
          ) : (
            <div>
              {exceptions.map((exception) => {
                const borderColor =
                  exception.severity === "high" ? tokens.colors.error[500] :
                  exception.severity === "medium" ? tokens.colors.warning[500] :
                  tokens.colors.info[500];

                return (
                  <div
                    key={exception.id}
                    className="p-4 border-b border-border-default"
                    style={{
                      borderLeft: `4px solid ${borderColor}`,
                    }}
                  >
                    <Flex align="flex-start" justify="space-between" gap={4}>
                      <div className="flex-1">
                        <Flex align="flex-start" gap={3}>
                        <div className="w-10 h-10 rounded-md bg-neutral-100 text-text-primary">
                          <Flex align="center" justify="center">
                            {getTypeIcon(exception.type)}
                          </Flex>
                        </div>
                        <div className="flex-1">
                          <div className="mb-1">
                            <Flex align="center" gap={2} wrap>
                              <div className="font-bold text-lg text-text-primary">
                                {exception.title}
                              </div>
                              {getSeverityBadge(exception.severity)}
                              <Badge variant="neutral">{getTypeLabel(exception.type)}</Badge>
                            </Flex>
                          </div>
                          <div className="text-sm text-text-secondary mb-2">
                            {exception.description}
                          </div>
                          {exception.booking && (
                            <div className="text-sm text-text-secondary mb-2">
                              <Flex direction="column" gap={1}>
                              <div>
                                <strong>Booking:</strong> {exception.booking.firstName} {exception.booking.lastName} - {formatServiceName(exception.booking.service)}
                              </div>
                              {exception.booking.startAt && (
                                <div>
                                  <strong>Start:</strong> {formatDate(exception.booking.startAt)}
                                </div>
                              )}
                              {exception.type === "unpaid" && exception.booking.totalPrice && (
                                <div>
                                  <strong>Amount:</strong> ${exception.booking.totalPrice.toFixed(2)}
                                </div>
                              )}
                              </Flex>
                            </div>
                          )}
                          <div className="text-xs text-text-tertiary mt-2">
                            Created: {formatDate(exception.createdAt)}
                          </div>
                        </div>
                        </Flex>
                      </div>
                      {exception.bookingId && (
                        <Link href={`/bookings/${exception.bookingId}`}>
                          <Button variant="secondary" size="sm">
                            View Booking
                          </Button>
                        </Link>
                      )}
                    </Flex>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </OwnerAppShell>
  );
}
