/**
 * Inbox View Component
 *
 * Owner inbox with thread list, message view, routing drawer, retries, policy handling
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useThreads,
  useThread,
  useMessages,
  useSendMessage,
  useRetryMessage,
  useMarkThreadRead,
  useRoutingHistory,
  useMessagePoolHealth,
  useUpdateThreadLifecycle,
  useThreadTimeline,
  useThreadWorkflowAction,
  type Thread,
  type Message,
} from '@/lib/api/hooks';
import { formatDistanceToNow } from 'date-fns';
import { Card, Button, Badge, EmptyState, Skeleton, Input, Textarea } from '@/components/ui';
import { Plus, MessageSquare, Users, ChevronRight, HelpCircle, RefreshCw, Settings, Filter } from 'lucide-react';
import { useAuth } from '@/lib/auth-client';
import { isMessagingEnabled } from '@/lib/flags';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { NewMessageModal } from './NewMessageModal';
import { MESSAGING_POLICY_RULES, OWNER_LIFECYCLE_HELPERS } from '@/lib/messaging/policy-copy';
import { formatLabel } from '@/lib/format-utils';

interface InboxViewProps {
  role?: 'owner' | 'sitter';
  sitterId?: string;
  initialThreadId?: string;
  inbox?: 'all' | 'owner'; // Filter by inbox type
}

function InboxViewContent({ role = 'owner', sitterId, initialThreadId, inbox = 'all' }: InboxViewProps) {
  const searchParams = useSearchParams();
  const threadParam = searchParams.get('thread');
  const sitterParam = searchParams.get('sitterId');

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId || threadParam || null
  );
  const [filters, setFilters] = useState<{
    unreadOnly?: boolean;
    hasPolicyViolation?: boolean;
    hasDeliveryFailure?: boolean;
    sitterId?: string;
    search?: string;
  }>({
    sitterId: sitterId || sitterParam || undefined,
  });
  const [showRoutingDrawer, setShowRoutingDrawer] = useState(false);
  const [composeMessage, setComposeMessage] = useState('');
  const [showPolicyOverride, setShowPolicyOverride] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [showPoolExhaustedConfirm, setShowPoolExhaustedConfirm] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Array<{ tempId: string; body: string; status: 'sending' | 'failed'; error?: string }>>([]);

  // Apply filters to API call - explicitly pass each filter
  const threadsQuery = useThreads({
    unreadOnly: filters.unreadOnly,
    hasPolicyViolation: filters.hasPolicyViolation,
    hasDeliveryFailure: filters.hasDeliveryFailure,
    sitterId: filters.sitterId,
    search: filters.search,
    inbox, // Pass inbox filter to hook
    pageSize: 40,
  });
  const threads = threadsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const threadsLoading = threadsQuery.isLoading;
  const threadsError = threadsQuery.error;
  const { data: selectedThread } = useThread(selectedThreadId);
  const { data: timelineData } = useThreadTimeline(selectedThreadId);
  const { data: poolHealth } = useMessagePoolHealth();
  const updateLifecycle = useUpdateThreadLifecycle();
  const workflowAction = useThreadWorkflowAction();
  const messagesQuery = useMessages(selectedThreadId, { pageSize: 50 });
  const messages = messagesQuery.data?.pages.slice().reverse().flatMap((p) => p.items) ?? [];
  const messagesLoading = messagesQuery.isLoading;
  const { data: routingHistory } = useRoutingHistory(selectedThreadId);
  const sendMessage = useSendMessage();
  const retryMessage = useRetryMessage();
  const markRead = useMarkThreadRead();
  const { user } = useAuth();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [manualStage, setManualStage] = useState<'intake' | 'staffing' | 'meet_and_greet' | 'follow_up'>('staffing');
  const [meetAndGreetAt, setMeetAndGreetAt] = useState('');
  const [lastFetch, setLastFetch] = useState<{ url?: string; status?: number; responseSize?: number; error?: string } | null>(null);

  // Poll window.__lastThreadsFetch for diagnostics (set by apiRequest in client.ts)
  useEffect(() => {
    const checkFetch = () => {
      if (typeof window !== 'undefined' && (window as any).__lastThreadsFetch) {
        setLastFetch((window as any).__lastThreadsFetch);
      }
    };
    checkFetch();
    const interval = setInterval(checkFetch, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update filters when sitterId changes
  useEffect(() => {
    if (sitterId || sitterParam) {
      setFilters((f) => ({ ...f, sitterId: sitterId || sitterParam || undefined }));
    }
  }, [sitterId, sitterParam]);

  // Auto-select most recent thread when sitter filter is applied
  useEffect(() => {
    if ((sitterId || sitterParam) && threads.length > 0 && !selectedThreadId) {
      // Select the most recent thread (first in list, sorted by lastActivityAt desc)
      setSelectedThreadId(threads[0].id);
    }
  }, [sitterId, sitterParam, threads, selectedThreadId]);

  // Mark thread as read when selected
  useEffect(() => {
    if (selectedThreadId) {
      markRead.mutate(selectedThreadId);
    }
  }, [selectedThreadId, markRead]);

  // Filter threads by search
  const filteredThreads = threads.filter((thread) => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      thread.client.name.toLowerCase().includes(searchLower) ||
      thread.messageNumber.e164.includes(searchLower) ||
      (thread.sitter?.name.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const handleSendMessage = async (confirmPoolFallback = false) => {
    if (!selectedThreadId || !composeMessage.trim()) return;

    const body = composeMessage.trim();
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingMessages((prev) => [...prev, { tempId, body, status: 'sending' }]);
    setComposeMessage('');
    setShowPoolExhaustedConfirm(false);

    try {
      await sendMessage.mutateAsync({
        threadId: selectedThreadId,
        body,
        forceSend: false,
        confirmPoolFallback,
      });
      setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
    } catch (error: any) {
      const errorData = error?.response?.data || error?.data || {};
      const errorCode = errorData.errorCode || error?.errorCode || error?.code;
      const errorMessage = errorData.userMessage || errorData.error || error.message || 'Failed to send';

      if (errorCode === 'POOL_EXHAUSTED') {
        setShowPoolExhaustedConfirm(true);
        setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
        setComposeMessage(body);
      } else if (error.message?.includes('Policy violation') || errorData.error?.includes('Policy violation')) {
        setShowPolicyOverride(selectedThreadId);
        setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
        setComposeMessage(body);
      } else {
        setPendingMessages((prev) =>
          prev.map((p) => (p.tempId === tempId ? { ...p, status: 'failed' as const, error: errorMessage } : p))
        );
      }
    }
  };

  const handleRetryPending = (tempId: string) => {
    const pending = pendingMessages.find((p) => p.tempId === tempId);
    if (!pending || !selectedThreadId) return;
    setPendingMessages((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, status: 'sending' as const } : p)));
    sendMessage
      .mutateAsync({ threadId: selectedThreadId, body: pending.body, forceSend: false })
      .then(() => setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId)))
      .catch((err: any) => {
        const msg = err?.response?.data?.userMessage || err?.message || 'Failed to send';
        setPendingMessages((prev) =>
          prev.map((p) => (p.tempId === tempId ? { ...p, status: 'failed' as const, error: msg } : p))
        );
      });
  };

  const handleOverrideAndSend = async () => {
    if (!selectedThreadId || !composeMessage.trim() || !overrideReason.trim()) return;

    const body = composeMessage.trim();
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingMessages((prev) => [...prev, { tempId, body, status: 'sending' }]);
    setComposeMessage('');
    setOverrideReason('');
    setShowPolicyOverride(null);

    try {
      await sendMessage.mutateAsync({
        threadId: selectedThreadId,
        body,
        forceSend: true,
      });
      setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
    } catch (error: any) {
      const msg = error?.response?.data?.userMessage || error?.message || 'Failed to send';
      setPendingMessages((prev) =>
        prev.map((p) => (p.tempId === tempId ? { ...p, status: 'failed' as const, error: msg } : p))
      );
    }
  };

  const handleRetry = async (messageId: string) => {
    try {
      await retryMessage.mutateAsync(messageId);
    } catch (error: any) {
      alert(`Failed to retry: ${error.message}`);
    }
  };

  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const response = await fetch('/api/messages/seed-proof', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert('Demo data created! Refreshing to show proof scenarios...');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to create demo data');
      }
    } catch (error: any) {
      alert(`Failed to create demo data: ${error.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // Update lastFetch when window.__lastThreadsFetch changes (lastFetch already declared above at line 70)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkFetchData = () => {
      const fetchData = (window as any).__lastThreadsFetch;
      if (fetchData) {
        setLastFetch(fetchData);
      }
    };

    // Check immediately
    checkFetchData();

    // Also check periodically (in case fetch completes outside React cycle)
    const interval = setInterval(checkFetchData, 1000);

    return () => clearInterval(interval);
  }, [threadsLoading, threadsError, threads.length]); // Update when fetch state or data changes

  const getDeliveryStatus = (message: Message) => {
    if (message.direction === 'inbound') {
      return { status: 'delivered', label: 'Received' };
    }

    const latestDelivery = message.deliveries[message.deliveries.length - 1];
    if (!latestDelivery) {
      return { status: 'unknown', label: 'Unknown' };
    }

    return {
      status: latestDelivery.status,
      label:
        latestDelivery.status === 'delivered'
          ? 'Delivered'
          : latestDelivery.status === 'sent'
            ? 'Sent'
            : latestDelivery.status === 'failed'
              ? 'Failed'
              : 'Queued',
      error: latestDelivery.providerErrorMessage,
    };
  };

  const getSenderLabel = (message: Message) => {
    if (message.direction === 'inbound') {
      return selectedThread?.client.name || 'Client';
    }

    switch (message.senderType) {
      case 'owner':
        return 'You';
      case 'sitter':
        return selectedThread?.sitter?.name || 'Sitter';
      case 'system':
        return 'System';
      case 'automation':
        return 'Automation';
      default:
        return 'Unknown';
    }
  };

  const stageLabel = (value?: string) => {
    if (!value) return 'Intake';
    if (value === 'meet_and_greet') return 'Meet & Greet';
    return value
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const lifecycleLabel = (value?: string) => {
    if (!value) return 'Active';
    if (value === 'grace') return 'Post-service grace';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const runLifecycleAction = async (payload: Record<string, unknown>) => {
    if (!selectedThreadId) return;
    try {
      await updateLifecycle.mutateAsync({ threadId: selectedThreadId, payload });
    } catch (error: any) {
      alert(error?.message || 'Failed to update lifecycle');
    }
  };

  const runWorkflowAction = async (
    payload:
      | { action: 'schedule_meet_and_greet'; scheduledAt: string }
      | { action: 'confirm_meet_and_greet' }
      | { action: 'client_approves_sitter' }
      | { action: 'sitter_approves_client' }
  ) => {
    if (!selectedThreadId) return;
    try {
      await workflowAction.mutateAsync({ threadId: selectedThreadId, payload });
    } catch (error: any) {
      alert(error?.message || 'Failed to run workflow action');
    }
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden h-full">
      {/* Left: Thread List - App design system */}
      <div className="w-1/3 flex flex-col min-h-0 border-r border-border-default bg-surface-secondary">
        {/* Filters */}
        <div className="border-b border-border-default bg-surface-primary" style={{ padding: 'var(--density-padding)' }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-text-primary">Threads</h2>
            {role === 'owner' && (
              <Button variant="primary" size="sm" onClick={() => setShowNewMessageModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
                New message
              </Button>
            )}
          </div>
          <Input
            type="text"
            placeholder="Search threads..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            aria-label="Search threads"
            size="sm"
            fullWidth
            className="mb-3"
          />

          <div className="relative">
            <Button
              variant={
                (filters.unreadOnly || filters.hasPolicyViolation || filters.hasDeliveryFailure)
                  ? 'primary'
                  : 'secondary'
              }
              size="sm"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              leftIcon={<Filter className="w-3.5 h-3.5" />}
            >
              Filters
              {(() => {
                const count = [filters.unreadOnly, filters.hasPolicyViolation, filters.hasDeliveryFailure].filter(Boolean).length;
                return count > 0 ? ` (${count})` : '';
              })()}
            </Button>
            {showFilterDropdown && (
              <div className="absolute left-0 top-full mt-1 z-10 w-52 rounded-lg border border-border-default bg-surface-primary shadow-lg p-2">
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text-primary hover:bg-surface-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!filters.unreadOnly}
                    onChange={() => setFilters({ ...filters, unreadOnly: filters.unreadOnly ? undefined : true })}
                    className="rounded border-border-default"
                  />
                  Unread
                </label>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text-primary hover:bg-surface-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!filters.hasPolicyViolation}
                    onChange={() => setFilters({ ...filters, hasPolicyViolation: filters.hasPolicyViolation ? undefined : true })}
                    className="rounded border-border-default"
                  />
                  Policy Issues
                </label>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text-primary hover:bg-surface-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!filters.hasDeliveryFailure}
                    onChange={() => setFilters({ ...filters, hasDeliveryFailure: filters.hasDeliveryFailure ? undefined : true })}
                    className="rounded border-border-default"
                  />
                  Delivery Failures
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {threadsLoading ? (
            <div className="p-4 text-center text-text-secondary">
              <Skeleton height={60} />
              <Skeleton height={60} />
              <Skeleton height={60} />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-text-secondary">
              {threads.length === 0 ? (
                <EmptyState
                  title="No threads yet"
                  description={process.env.NODE_ENV === 'development' || process.env.ALLOW_DEV_SEED === 'true'
                    ? "Create demo data to get started with messaging"
                    : "Start a conversation or send a new message to see threads here."}
                  icon={<MessageSquare className="w-12 h-12 text-neutral-300" />}
                  action={
                    role === 'owner'
                      ? { label: 'New message', onClick: () => setShowNewMessageModal(true), variant: 'primary' as const }
                      : undefined
                  }
                />
              ) : (
                <div>
                  {filters.sitterId ? (
                    <EmptyState
                      title="No active conversations for this sitter"
                      description="Create an assignment window and thread to enable messaging for this sitter."
                      icon={<Users className="w-12 h-12 text-neutral-300" />}
                    />
                  ) : (
                    <div>No threads match your filters</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {filteredThreads.map((thread) => {
                const isSelected = selectedThreadId === thread.id;
                const clientName = thread.client.name || 'Unknown';
                const initial = clientName.charAt(0).toUpperCase();
                const hasUnread = thread.ownerUnreadCount > 0;
                const sitterName = thread.sitter?.name;
                const lastActivity = formatDistanceToNow(thread.lastActivityAt, { addSuffix: true });
                const hasFlags = (thread.flags?.length || 0) > 0;

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedThreadId(thread.id)}
                    className={`group cursor-pointer border-b border-border-default px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-inset ${
                      isSelected
                        ? 'bg-accent-secondary border-l-2 border-l-accent-primary'
                        : hasUnread
                          ? 'bg-surface-primary hover:bg-surface-secondary'
                          : 'bg-surface-primary hover:bg-surface-secondary'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        hasUnread ? 'bg-accent-primary text-text-inverse' : 'bg-surface-tertiary text-text-secondary'
                      }`}>
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${hasUnread ? 'font-semibold text-text-primary' : 'font-medium text-text-primary'}`}>
                            {clientName}
                          </span>
                          <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
                            {lastActivity}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {sitterName ? (
                            <span className="truncate text-xs text-text-secondary">{sitterName}</span>
                          ) : (
                            <span className="text-xs text-text-tertiary">Unassigned</span>
                          )}
                          {hasFlags && (
                            <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-status-warning-fill" />
                          )}
                        </div>
                        {(thread as any).preview && (
                          <p className="mt-0.5 truncate text-xs text-text-tertiary">{(thread as any).preview}</p>
                        )}
                      </div>
                      {hasUnread && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-primary text-[10px] font-bold text-text-inverse">
                          {thread.ownerUnreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {threadsQuery.hasNextPage && (
                <div className="p-3 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => threadsQuery.fetchNextPage()}
                    disabled={threadsQuery.isFetchingNextPage}
                  >
                    {threadsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Message View */}
      <div className="flex-1 min-h-0 flex flex-col">
        {selectedThreadId ? (
          <>
            {/* Thread Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border-default bg-surface-primary px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-text-primary">
                    {selectedThread?.client.name || 'Unknown'}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    selectedThread?.laneType === 'service'
                      ? 'bg-status-success-bg text-status-success-text'
                      : 'bg-surface-tertiary text-text-secondary'
                  }`}>
                    {selectedThread?.laneType === 'service' ? 'Visit' : 'Office'}
                  </span>
                  {selectedThread?.lifecycleStatus === 'active' && (
                    <span className="shrink-0 h-2 w-2 rounded-full bg-status-success-fill" title="Active" />
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
                  {selectedThread?.sitter && (
                    <span>Sitter: <span className="font-medium text-text-primary">{selectedThread.sitter.name}</span></span>
                  )}
                  {selectedThread?.messageNumber?.e164 && (
                    <span className="text-text-tertiary tabular-nums">{selectedThread.messageNumber.e164}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRoutingDrawer(!showRoutingDrawer)}
                  aria-label="Thread details"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">Details</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void messagesQuery.refetch()}
                  aria-label="Refresh messages"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 'var(--density-padding)' }}>
              {messagesLoading ? (
                <div className="text-center text-text-secondary">
                  <Skeleton height={100} />
                  <Skeleton height={100} />
                </div>
              ) : messages.length === 0 && pendingMessages.length === 0 ? (
                <div className="text-center text-text-secondary">No messages yet</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messagesQuery.hasNextPage && (
                    <div className="flex justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => messagesQuery.fetchNextPage()}
                        disabled={messagesQuery.isFetchingNextPage}
                      >
                        {messagesQuery.isFetchingNextPage ? 'Loading...' : 'Load earlier messages'}
                      </Button>
                    </div>
                  )}
                  {messages.map((message) => {
                    const delivery = getDeliveryStatus(message);
                    const senderLabel = getSenderLabel(message);

                    return (
                      <Card
                        key={message.id}
                        className={`p-3 ${
                          message.direction === 'outbound'
                            ? 'ml-auto max-w-[80%] bg-surface-inverse text-text-inverse rounded-2xl rounded-br-sm'
                            : 'max-w-full bg-surface-tertiary rounded-2xl rounded-bl-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-sm font-medium mb-0.5">
                              {senderLabel}
                            </div>
                            <div className="text-xs text-text-secondary">
                              {formatDistanceToNow(message.createdAt, { addSuffix: true })}
                            </div>
                          </div>
                          <Badge
                            variant={
                              delivery.status === 'delivered'
                                ? 'success'
                                : delivery.status === 'failed'
                                  ? 'error'
                                  : delivery.status === 'sent'
                                    ? 'info'
                                    : 'default'
                            }
                            className="text-xs"
                          >
                            {delivery.label}
                          </Badge>
                        </div>

                        <div className="text-sm mb-2 leading-relaxed">
                          {message.redactedBody || message.body}
                        </div>
                        {message.routingDisposition && message.routingDisposition !== 'normal' && (
                          <div className="text-xs mb-2">
                            <Badge variant={message.routingDisposition === 'rerouted' ? 'warning' : 'error'}>
                              Routing: {message.routingDisposition}
                            </Badge>
                          </div>
                        )}

                        {message.hasPolicyViolation && (
                          <div className="text-xs text-status-danger-text bg-status-danger-bg p-2 rounded-sm mb-2">
                            ⚠️ Policy violation detected
                            {message.policyViolations?.[0] && (
                              <div className="mt-1 text-xs">
                                {message.policyViolations[0].detectedSummary}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {delivery.status === 'failed' && message.direction === 'outbound' && (
                            <Button
                              variant="tertiary"
                              size="sm"
                              onClick={() => handleRetry(message.id)}
                              disabled={retryMessage.isPending}
                              leftIcon={<RefreshCw className="w-4 h-4" />}
                            >
                              {retryMessage.isPending ? 'Retrying...' : 'Retry'}
                            </Button>
                          )}

                          {delivery.error && (
                            <div className="text-xs text-status-danger-text bg-status-danger-bg px-2 py-1 rounded-sm max-w-full break-words" title={delivery.error}>
                              Error: {delivery.error}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  {selectedThreadId &&
                    pendingMessages.map((p) => (
                      <Card
                        key={p.tempId}
                        className="p-3 ml-auto max-w-[80%] bg-surface-inverse text-text-inverse rounded-2xl rounded-br-sm opacity-70"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-sm font-medium mb-0.5">
                              You
                            </div>
                            <div className="text-xs text-text-secondary">
                              Just now
                            </div>
                          </div>
                          <Badge
                            variant={p.status === 'failed' ? 'error' : 'default'}
                            className="text-xs"
                          >
                            {p.status === 'sending' ? 'Sending' : 'Failed'}
                          </Badge>
                        </div>
                        <div className="text-sm mb-2 leading-relaxed">
                          {p.body}
                        </div>
                        {p.status === 'failed' && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              variant="tertiary"
                              size="sm"
                              onClick={() => handleRetryPending(p.tempId)}
                              disabled={sendMessage.isPending}
                              leftIcon={<RefreshCw className="w-4 h-4" />}
                            >
                              Retry
                            </Button>
                            {p.error && (
                              <div
                                className="text-xs text-status-danger-text bg-status-danger-bg px-2 py-1 rounded-sm max-w-full break-words"
                                title={p.error}
                              >
                                {p.error}
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                </div>
              )}
            </div>

            {/* Compose Box - App design system */}
            <div className="flex-shrink-0 border-t border-border-default bg-surface-primary" style={{ padding: 'var(--density-padding)' }}>
              <Textarea
                value={composeMessage}
                onChange={(e) => setComposeMessage(e.target.value)}
                placeholder="Type a message..."
                rows={3}
                size="sm"
                fullWidth
                className="mb-2 resize-none"
                aria-label="Compose message"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex justify-between items-center">
                <div className="text-xs text-text-secondary">
                  Press {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to send
                </div>
                <Button
                  variant="primary"
                  onClick={() => handleSendMessage()}
                  disabled={!composeMessage.trim() || sendMessage.isPending}
                  className="focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
                >
                  {sendMessage.isPending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-text-disabled" />
              <p className="mt-3 text-sm font-medium text-text-secondary">Select a conversation</p>
              <p className="mt-1 text-xs text-text-tertiary">Choose a thread from the list to view messages</p>
            </div>
          </div>
        )}
      </div>

      {/* Thread Details & Ops Drawer */}
      {showRoutingDrawer && selectedThreadId && (
        <div
          className="fixed inset-0 bg-black/50 z-layer-overlay flex items-center justify-center p-4"
          onClick={() => setShowRoutingDrawer(false)}
        >
          <Card
            style={{ maxWidth: '42rem', maxHeight: '80vh', overflowY: 'auto' }}
            className="bg-surface-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Thread Details</h3>
                <Button variant="tertiary" size="sm" onClick={() => setShowRoutingDrawer(false)}>
                  ✕
                </Button>
              </div>

              {/* Thread Info */}
              <div className="text-sm text-text-secondary flex flex-col gap-2 mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={selectedThread?.laneType === 'service' ? 'success' : 'default'}>
                    {selectedThread?.laneType === 'service' ? 'Visit line' : 'Office line'}
                  </Badge>
                  <Badge variant="neutral">{stageLabel(selectedThread?.activationStage)}</Badge>
                  <Badge variant={selectedThread?.lifecycleStatus === 'active' ? 'success' : 'warning'}>
                    {lifecycleLabel(selectedThread?.lifecycleStatus)}
                  </Badge>
                </div>
                {selectedThread?.laneType === 'service' ? (
                  <div className="text-xs text-text-secondary">{OWNER_LIFECYCLE_HELPERS.serviceLane}</div>
                ) : (
                  <div className="text-xs text-text-secondary">{OWNER_LIFECYCLE_HELPERS.companyLane}</div>
                )}
                <div className="flex items-center gap-2">
                  <span>Business Number:</span>
                  <span className="font-mono">{selectedThread?.messageNumber.e164}</span>
                  <Badge
                    variant={
                      selectedThread?.messageNumber.class === 'front_desk' ? 'default' :
                      selectedThread?.messageNumber.class === 'pool' ? 'info' :
                      selectedThread?.messageNumber.class === 'sitter' ? 'success' : 'default'
                    }
                    className="text-xs"
                  >
                    {selectedThread?.messageNumber.class ? formatLabel(selectedThread.messageNumber.class) : ''}
                  </Badge>
                </div>
                {selectedThread?.sitter && (
                  <div>
                    <span className="font-medium">Assigned Sitter:</span> {selectedThread.sitter.name}
                  </div>
                )}
                <div>
                  <span className="font-medium">Approvals:</span>{' '}
                  Client {selectedThread?.clientApprovedAt ? 'approved' : 'pending'} / Sitter {selectedThread?.sitterApprovedAt ? 'approved' : 'pending'}
                </div>
                <div className="text-xs text-text-secondary">{OWNER_LIFECYCLE_HELPERS.approvals}</div>
                {selectedThread?.serviceWindow && (
                  <div>
                    <span className="font-medium">Service Window:</span>{' '}
                    {selectedThread.serviceWindow.startAt.toLocaleString()} - {selectedThread.serviceWindow.endAt.toLocaleString()}
                  </div>
                )}
                {selectedThread?.graceEndsAt && (
                  <div>
                    <span className="font-medium">Grace Ends:</span>{' '}
                    {new Date(selectedThread.graceEndsAt).toLocaleString()}
                  </div>
                )}
                {(selectedThread?.availabilityResponses?.length || 0) > 0 && (
                  <div>
                    <span className="font-medium">Availability:</span>{' '}
                    {selectedThread?.availabilityResponses
                      ?.map((r) => `${r.status.toUpperCase()}${r.responseLatencySec != null ? ` (${r.responseLatencySec}s)` : ''}`)
                      .join(' | ')}
                  </div>
                )}
                {(selectedThread?.flags?.length || 0) > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Flags:</span>
                    {selectedThread?.flags?.map((flag) => (
                      <Badge key={flag.id} variant={flag.severity === 'high' || flag.severity === 'critical' ? 'error' : 'warning'}>
                        {flag.type}:{flag.severity}
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedThread?.assignmentWindows?.[0] && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Window Status:</span>
                    <Badge variant="success">Active</Badge>
                    <span className="text-xs text-text-tertiary">
                      (ends {formatDistanceToNow(selectedThread.assignmentWindows[0].endsAt, { addSuffix: true })})
                    </span>
                  </div>
                )}
                {selectedThread?.assignmentWindows && selectedThread.assignmentWindows.length === 0 && (
                  <div>
                    <Badge variant="default">No active window</Badge>
                  </div>
                )}
              </div>

              {/* Workflow & Lifecycle Actions (owner only) */}
              {role === 'owner' && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-text-primary mb-2">Workflow Actions</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="datetime-local"
                      value={meetAndGreetAt}
                      onChange={(e) => setMeetAndGreetAt(e.target.value)}
                      className="border border-border-default rounded-sm px-2 py-1 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (!meetAndGreetAt) return;
                        const iso = new Date(meetAndGreetAt).toISOString();
                        void runWorkflowAction({ action: 'schedule_meet_and_greet', scheduledAt: iso });
                      }}
                    >
                      Schedule M&G
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => runWorkflowAction({ action: 'confirm_meet_and_greet' })}>
                      Confirm M&G
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => runWorkflowAction({ action: 'client_approves_sitter' })}>
                      Client approved
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => runWorkflowAction({ action: 'sitter_approves_client' })}>
                      Sitter approved
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <select
                      value={manualStage}
                      onChange={(e) => setManualStage(e.target.value as typeof manualStage)}
                      className="border border-border-default rounded-sm px-2 py-1 text-xs"
                    >
                      <option value="intake">intake</option>
                      <option value="staffing">staffing</option>
                      <option value="meet_and_greet">meet_and_greet</option>
                      <option value="follow_up">follow_up</option>
                    </select>
                    <Button size="sm" variant="secondary" onClick={() => runLifecycleAction({ action: 'set_stage', stage: manualStage })}>
                      Override stage
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => runLifecycleAction({ action: 'meet_and_greet_confirmed' })}>
                      M&G confirmed
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        runLifecycleAction({
                          action: 'activate_service_lane',
                          sitterId: selectedThread?.sitter?.id,
                          serviceWindowStart:
                            selectedThread?.serviceWindow?.startAt?.toISOString() ??
                            selectedThread?.assignmentWindows?.[0]?.startsAt?.toISOString(),
                          serviceWindowEnd:
                            selectedThread?.serviceWindow?.endAt?.toISOString() ??
                            selectedThread?.assignmentWindows?.[0]?.endsAt?.toISOString(),
                        })
                      }
                    >
                      Activate service lane
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => runLifecycleAction({ action: 'expire_if_needed' })}>
                      Check reroute state
                    </Button>
                    <span className="text-xs text-text-secondary">{OWNER_LIFECYCLE_HELPERS.reroute}</span>
                  </div>
                </div>
              )}

              {/* Policy behavior (owner only) */}
              {role === 'owner' && (
                <details className="rounded border border-border-default p-2 text-xs mb-4">
                  <summary className="cursor-pointer font-medium text-text-primary">Policy behavior</summary>
                  <div className="mt-2 flex flex-col gap-1 text-text-secondary">
                    {MESSAGING_POLICY_RULES.map((rule) => (
                      <div key={rule.key}>
                        <strong>{rule.scenario}:</strong> {rule.userFacingBehavior}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Audit timeline (owner only) */}
              {role === 'owner' && (
                <details className="rounded border border-border-default p-2 text-xs mb-4">
                  <summary className="cursor-pointer font-medium text-text-primary">Audit timeline</summary>
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    {(timelineData?.items ?? []).length === 0 ? (
                      <div className="text-text-secondary">No timeline events yet.</div>
                    ) : (
                      <div className="flex flex-col gap-2 text-text-secondary">
                        {(timelineData?.items ?? []).map((item) => (
                          <div key={`${item.kind}-${item.id}`} className="rounded border border-border-default p-2">
                            <div className="font-medium text-text-primary">{item.label}</div>
                            <div>{new Date(item.createdAt).toLocaleString()} • {item.status}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* System Health (owner only) */}
              {role === 'owner' && poolHealth && (
                <details className="rounded border border-border-default p-2 text-xs mb-4">
                  <summary className="cursor-pointer font-medium text-text-primary">System health</summary>
                  <div className="mt-1 text-text-secondary">
                    Office numbers: {poolHealth.availableCompany} available | Service numbers: {poolHealth.availableService} available | Assigned: {poolHealth.assigned}
                  </div>
                  {poolHealth.shouldProvision && (
                    <div className="mt-1 text-status-warning-text">Add numbers soon to avoid fallback routing.</div>
                  )}
                </details>
              )}

              {/* Diagnostics toggle */}
              <div className="mb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                >
                  {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
                </Button>
                {showDiagnostics && (
                  <div className="mt-3">
                    <DiagnosticsPanel
                      threadsCount={threads.length}
                      threadsLoading={threadsLoading}
                      threadsError={threadsError || null}
                      lastFetchUrl={lastFetch?.url}
                      lastFetchStatus={lastFetch?.status}
                      lastFetchResponseSize={lastFetch?.responseSize}
                      onSeed={handleSeed}
                    />
                  </div>
                )}
              </div>

              {/* Routing Explanation */}
              <h4 className="text-sm font-semibold text-text-primary mb-2">Routing Explanation</h4>
              {routingHistory?.events?.[0] ? (
                <div className="flex flex-col gap-4">
                  <div className="bg-accent-secondary p-3 rounded-lg">
                    <div className="font-medium text-sm mb-1">Final Decision</div>
                    <div className="text-sm">
                      <strong>Target:</strong> {routingHistory.events[0].decision.target}
                      {routingHistory.events[0].decision.targetId && (
                        <span> ({routingHistory.events[0].decision.targetId})</span>
                      )}
                    </div>
                    <div className="text-sm mt-1">
                      <strong>Reason:</strong> {routingHistory.events[0].decision.reason}
                    </div>
                  </div>

                  <div>
                    <div className="font-medium text-sm mb-2">Evaluation Steps</div>
                    <div className="flex flex-col gap-2">
                      {routingHistory.events[0].decision.evaluationTrace.map((step, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-sm text-sm ${step.result ? 'bg-status-success-bg' : 'bg-surface-secondary'}`}
                        >
                          <div className="font-medium">{step.rule}</div>
                          <div className="text-xs text-text-secondary mt-1">
                            {step.condition} → {step.result ? '✓' : '✗'}
                          </div>
                          <div className="text-xs text-text-tertiary mt-1">{step.explanation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-text-secondary">No routing history available</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Pool Exhausted Confirmation Dialog */}
      {showPoolExhaustedConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-layer-overlay flex items-center justify-center p-4"
          onClick={() => {
            setShowPoolExhaustedConfirm(false);
          }}
        >
          <Card
            style={{ maxWidth: '28rem' }}
            className="bg-surface-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Pool Exhausted
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                All pool numbers are at capacity. Your reply will send from the Front Desk number instead of a pool number.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowPoolExhaustedConfirm(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSendMessage(true)}
                  disabled={sendMessage.isPending}
                >
                  Send from Front Desk
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Policy Override Dialog */}
      {showPolicyOverride && (
        <div
          className="fixed inset-0 bg-black/50 z-layer-overlay flex items-center justify-center p-4"
          onClick={() => {
            setShowPolicyOverride(null);
            setOverrideReason('');
          }}
        >
          <Card
            style={{ maxWidth: '28rem' }}
            className="bg-surface-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Policy Violation Detected</h3>
              <p className="text-sm text-text-secondary mb-4">
                Your message contains content that violates our policy (phone numbers, emails, or external links).
                You can override and send anyway, but please provide a reason.
              </p>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for override..."
                className="w-full border border-border-default rounded-sm px-3 py-2 mb-4 resize-none text-sm font-[inherit]"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowPolicyOverride(null);
                    setOverrideReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleOverrideAndSend}
                  disabled={!overrideReason.trim()}
                >
                  Override & Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* New Message Modal */}
      {role === 'owner' && (
        <NewMessageModal
          isOpen={showNewMessageModal}
          onClose={() => setShowNewMessageModal(false)}
          onThreadCreated={(threadId) => {
            setSelectedThreadId(threadId);
            setShowNewMessageModal(false);
          }}
        />
      )}
    </div>
  );
}

export default function InboxView(props: InboxViewProps) {
  return (
    <Suspense fallback={<div className="p-4"><Skeleton height={400} /></div>}>
      <InboxViewContent {...props} />
    </Suspense>
  );
}
