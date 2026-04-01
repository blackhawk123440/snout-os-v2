/**
 * Sitter Inbox Page
 * Mobile-first: thread list, tap → full conversation view. Desktop: split view.
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  SitterPageHeader,
  SitterSkeletonList,
  SitterEmptyState,
} from '@/components/sitter';
import { useAuth } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useOffline } from '@/hooks/useOffline';
import { enqueueAction } from '@/lib/offline';
import {
  useSitterThreads,
  useSitterMessages,
  useSitterSendMessage,
  type SitterThread,
  type SitterMessage,
} from '@/lib/api/sitter-hooks';
import { formatDistanceToNow, format } from 'date-fns';
import { toastSuccess, toastError } from '@/lib/toast';
import { triggerTemplateSend, type QuickTemplate } from './template-actions';
import { SITTER_BOUNDARY_HELPER } from '@/lib/messaging/policy-copy';

const formatThreadTime = (d: Date) => {
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday ? format(d, 'h:mm a') : format(d, 'MMM d');
};

const QUICK_TEMPLATES: QuickTemplate[] = ['On my way', 'Arrived', 'All done'];

function SitterInboxContent() {
  const { user, isSitter, isOwner, isClient, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isOnline, refreshQueuedCount } = useOffline();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composeMessage, setComposeMessage] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [pendingMessages, setPendingMessages] = useState<Array<{ tempId: string; body: string; status: 'sending' | 'failed'; error?: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<QuickTemplate | ''>('');

  const { data: threads = [], isLoading: threadsLoading, error: threadsError } = useSitterThreads();
  const { data: messages = [], isLoading: messagesLoading } = useSitterMessages(selectedThreadId);
  const sendMessage = useSitterSendMessage();
  const [isMobile, setIsMobile] = useState(false);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const activeWindow = selectedThread?.assignmentWindows?.[0];
  const isWindowActive =
    activeWindow && new Date() >= activeWindow.startsAt && new Date() <= activeWindow.endsAt;

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!authLoading && !isSitter) {
      if (isOwner) router.push('/messaging');
      else if (isClient) router.push('/client/home');
      else router.push('/login');
    }
  }, [authLoading, isSitter, isOwner, isClient, router]);

  useEffect(() => {
    if (!isMobile && threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0].id);
    }
  }, [isMobile, threads, selectedThreadId]);

  const sendBody = async (threadId: string, body: string) => {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingMessages((prev) => [...prev, { tempId, body, status: 'sending' }]);
    try {
      await sendMessage.mutateAsync({ threadId, body });
      setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.userMessage || err?.message || 'Failed to send';
      setPendingMessages((prev) =>
        prev.map((p) => (p.tempId === tempId ? { ...p, status: 'failed' as const, error: msg } : p))
      );
      return false;
    }
  };

  const handleSend = async () => {
    if (!selectedThreadId || !composeMessage.trim() || !isWindowActive) return;
    const body = composeMessage.trim();
    setComposeMessage('');
    const ok = await sendBody(selectedThreadId, body);
    if (!ok) {
      toastError('Failed to send');
    }
  };

  const handleTemplateSend = async (template: QuickTemplate) => {
    if (sendMessage.isPending) return;
    try {
      const ok = await triggerTemplateSend({
        template,
        selectedThreadId,
        isWindowActive: !!isWindowActive,
        isOnline,
        orgId: user?.orgId || 'default',
        sitterId: user?.sitterId || '',
        enqueueAction,
        sendNow: async (threadId, body) => {
          const sent = await sendBody(threadId, body);
          if (!sent) throw new Error('Failed to send');
        },
        onQueued: () => {
          toastSuccess('Queued template message');
          void refreshQueuedCount();
        },
        onSuccess: () => {
          toastSuccess('Template sent');
        },
      });
      if (!ok) {
        toastError('Select a thread in an active window');
      }
    } catch {
      toastError('Failed to send template');
    }
  };

  const handleRetryPending = (tempId: string) => {
    const pending = pendingMessages.find((p) => p.tempId === tempId);
    if (!pending || !selectedThreadId) return;
    setPendingMessages((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, status: 'sending' as const } : p)));
    sendMessage
      .mutateAsync({ threadId: selectedThreadId, body: pending.body })
      .then(() => setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId)))
      .catch((err: any) => {
        const msg = err?.response?.data?.userMessage || err?.message || 'Failed to send';
        setPendingMessages((prev) =>
          prev.map((p) => (p.tempId === tempId ? { ...p, status: 'failed' as const, error: msg } : p))
        );
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl pb-8">
        <SitterPageHeader title="Inbox" subtitle="Client conversations for active visits" />
        <SitterSkeletonList count={4} />
      </div>
    );
  }

  if (!isSitter) return null;

  const filteredThreads = (
    threadSearch.trim()
      ? threads.filter((t) =>
          t.client?.name?.toLowerCase().includes(threadSearch.toLowerCase())
        )
      : threads
  ).slice().sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

  const showListOnMobile = isMobile && !selectedThreadId;
  const showConversationOnMobile = isMobile && selectedThreadId;

  return (
    <div className="mx-auto max-w-4xl pb-8">
      {showConversationOnMobile ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedThreadId(null)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-text-secondary hover:bg-surface-tertiary"
              aria-label="Back to threads"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <SitterPageHeader
              title={selectedThread?.client?.name || 'Message'}
              subtitle="Conversation"
            />
          </div>
          <div className="flex flex-col rounded-2xl border border-border-default bg-surface-primary shadow-sm">
            {/* Messages + compose only */}
            <div className="flex-1 overflow-y-auto p-4 min-h-[50vh]">
              <div className="mb-3 rounded-xl bg-surface-secondary px-4 py-3">
                <p className="text-xs font-medium text-text-secondary">
                  Use this inbox for visit-safe updates. Some workspaces also use normal phone numbers outside the app, but booking-window rules still apply here.
                </p>
              </div>
              {messagesLoading ? (
                <SitterSkeletonList count={2} />
              ) : messages.length === 0 && pendingMessages.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-secondary mb-3">
                    <MessageSquare className="h-5 w-5 text-text-disabled" />
                  </div>
                  <p className="text-sm font-medium text-text-secondary">No messages yet</p>
                  <p className="mt-1 text-xs text-text-tertiary max-w-[220px] mx-auto">Use the quick templates below or type a professional visit update.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.direction === 'outbound'
                          ? 'ml-auto bg-surface-brand-subtle text-text-primary'
                          : 'bg-surface-tertiary text-text-primary'
                      }`}
                    >
                      <p className="text-xs font-medium text-text-secondary">
                        {msg.direction === 'inbound' ? selectedThread?.client?.name : 'You'} •{' '}
                        {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
                      </p>
                      <p className="mt-1 text-sm">{msg.redactedBody || msg.body}</p>
                    </div>
                  ))}
                  {pendingMessages.map((p) => (
                    <div
                      key={p.tempId}
                      className="ml-auto max-w-[85%] rounded-2xl bg-surface-brand-subtle px-4 py-3 text-text-primary"
                    >
                      <p className="text-xs font-medium text-text-secondary">
                        You • {p.status === 'sending' ? 'Sending…' : 'Failed'}
                      </p>
                      <p className="mt-1 text-sm">{p.body}</p>
                      {p.status === 'failed' && (
                        <Button variant="secondary" size="sm" onClick={() => handleRetryPending(p.tempId)} className="mt-2">
                          Retry
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {isWindowActive && (
              <div className="border-t border-border-default p-4">
                <div className="mb-2 flex flex-wrap gap-2 md:hidden">
                  {QUICK_TEMPLATES.map((template) => (
                    <Button
                      key={template}
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleTemplateSend(template)}
                      disabled={sendMessage.isPending || !selectedThreadId || !isWindowActive}
                    >
                      {template}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={composeMessage}
                    onChange={(e) => setComposeMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Share a visit update..."
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-border-strong bg-surface-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-border-focus"
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => void handleSend()}
                    disabled={!composeMessage.trim() || sendMessage.isPending}
                    className="shrink-0"
                  >
                    {sendMessage.isPending ? '…' : 'Send'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <SitterPageHeader
            title="Inbox"
            subtitle="Visit-related messages during active assignments"
          />
          <div className="mx-4 mt-3 rounded-xl bg-accent-tertiary px-4 py-3 md:mx-6">
            <p className="text-xs font-medium text-accent-primary leading-relaxed">{SITTER_BOUNDARY_HELPER}</p>
          </div>

          <div className="flex min-h-[60vh] flex-col gap-0 rounded-2xl bg-surface-primary shadow-md md:flex-row overflow-hidden">
            {/* Thread list - hidden on mobile when conversation open */}
            <div className={`flex w-full flex-col border-b border-border-default md:w-80 md:border-b-0 md:border-r bg-surface-secondary/50 ${showListOnMobile ? 'flex' : 'hidden md:flex'}`}>
          <div className="border-b border-border-default p-4 bg-surface-primary">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2.5">Threads</p>
            <input
              type="search"
              placeholder="Search clients..."
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              className="w-full rounded-xl border border-border-strong bg-surface-secondary px-3 py-2.5 text-sm outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus focus:bg-surface-primary"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {threadsLoading ? (
              <div className="p-4">
                <SitterSkeletonList count={3} />
              </div>
            ) : threadsError ? (
              <div className="p-4">
                <SitterEmptyState
                  title="Couldn't load threads"
                  subtitle="Give it another try in a moment."
                />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px] bg-surface-secondary">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-3">
                  <MessageSquare className="h-5 w-5 text-text-inverse" />
                </div>
                <p className="text-sm font-semibold text-text-primary">No active assignments</p>
                <p className="mt-1 text-xs text-text-tertiary max-w-[200px]">Client threads appear automatically when you're assigned to a visit.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const tw = thread.assignmentWindows?.[0];
                const isActive =
                  tw && new Date() >= tw.startsAt && new Date() <= tw.endsAt;
                const isSelected = selectedThreadId === thread.id;
                const displayName = thread.client?.name || 'Client';
                const initial = displayName.charAt(0).toUpperCase();
                const lastMsg = isSelected && messages.length > 0 ? messages[messages.length - 1] : null;
                const preview = lastMsg
                  ? ((lastMsg.redactedBody || lastMsg.body || '').slice(0, 50) + ((lastMsg.body?.length ?? 0) > 50 ? '…' : ''))
                  : 'Tap to view messages';

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`flex min-h-[72px] min-w-0 items-center gap-3 border-b border-border-default px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-inset ${
                      isSelected ? 'bg-status-info-bg' : 'hover:bg-surface-secondary'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-warning-bg text-sm font-semibold text-status-warning-text">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text-primary">
                        {displayName} • {formatThreadTime(thread.lastActivityAt)}
                      </p>
                      <p className="truncate text-xs text-text-tertiary">{preview}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isActive ? 'bg-status-success-bg text-status-success-text' : 'bg-surface-tertiary text-text-secondary'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                        {(thread.ownerUnreadCount ?? 0) > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-status-info-fill px-1.5 text-[10px] font-medium text-text-inverse">
                            {(thread.ownerUnreadCount ?? 0) > 99 ? '99+' : thread.ownerUnreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

            {/* Message view - hidden on mobile when showing list only */}
            <div className={`flex flex-1 flex-col min-h-0 ${showConversationOnMobile ? 'flex' : 'hidden md:flex'}`}>
          {selectedThreadId ? (
            <>
              {/* Thread header bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-primary p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-warning-bg text-sm font-semibold text-status-warning-text">
                    {(selectedThread?.client?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">
                      {selectedThread?.client?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {activeWindow
                        ? `Active until ${format(activeWindow.endsAt, 'MMM d, h:mm a')}`
                        : 'Outside your active window. Use booking details or office guidance for next steps.'}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => router.push('/sitter/today')}>
                  View visit
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-3 rounded-xl bg-surface-secondary px-4 py-3">
                  <p className="text-xs font-medium text-text-secondary">
                    Use this inbox for visit-safe updates. Some workspaces also use normal phone numbers outside the app, but booking-window rules still apply here.
                  </p>
                </div>
                {messagesLoading ? (
                  <SitterSkeletonList count={2} />
                ) : messages.length === 0 && pendingMessages.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-secondary mb-3">
                      <MessageSquare className="h-5 w-5 text-text-disabled" />
                    </div>
                    <p className="text-sm font-medium text-text-secondary">No messages yet</p>
                    <p className="mt-1 text-xs text-text-tertiary max-w-[220px] mx-auto">Send a quick update to let the client know you've arrived or how the visit is going.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          msg.direction === 'outbound'
                            ? 'ml-auto bg-surface-brand-subtle text-text-primary'
                            : 'bg-surface-tertiary text-text-primary'
                        }`}
                      >
                        <p className="text-xs font-medium text-text-secondary">
                          {msg.direction === 'inbound' ? selectedThread?.client?.name : 'You'} •{' '}
                          {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
                        </p>
                        <p className="mt-1 text-sm">{msg.redactedBody || msg.body}</p>
                      </div>
                    ))}
                    {pendingMessages.map((p) => (
                      <div
                        key={p.tempId}
                        className="ml-auto max-w-[85%] rounded-2xl bg-surface-brand-subtle px-4 py-3 text-text-primary"
                      >
                        <p className="text-xs font-medium text-text-secondary">
                          You • {p.status === 'sending' ? 'Sending…' : 'Failed'}
                        </p>
                        <p className="mt-1 text-sm">{p.body}</p>
                        {p.status === 'failed' && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleRetryPending(p.tempId)}
                              disabled={sendMessage.isPending}
                            >
                              Retry
                            </Button>
                            {p.error && (
                              <span className="text-xs text-status-danger-text" title={p.error}>
                                {p.error.slice(0, 60)}
                                {p.error.length > 60 ? '…' : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick templates */}
              <div className="border-t border-border-default bg-status-warning-bg p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text-primary">Quick templates</span>
                  <span className="text-xs text-text-tertiary">Use for short professional status updates.</span>
                </div>
                <div className="md:hidden flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((template) => (
                    <Button
                      key={template}
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleTemplateSend(template)}
                      disabled={sendMessage.isPending || !selectedThreadId || !isWindowActive}
                    >
                      {template}
                    </Button>
                  ))}
                </div>
                <div className="hidden md:block">
                  <label className="sr-only" htmlFor="quick-template-select">
                    Templates
                  </label>
                  <select
                    id="quick-template-select"
                    value={selectedTemplate}
                    onChange={(e) => {
                      const value = e.target.value as QuickTemplate | '';
                      setSelectedTemplate(value);
                      if (value) {
                        void handleTemplateSend(value);
                        setSelectedTemplate('');
                      }
                    }}
                    disabled={sendMessage.isPending || !selectedThreadId || !isWindowActive}
                    className="w-full max-w-xs rounded-lg border border-border-strong bg-surface-primary px-3 py-2 text-sm text-text-secondary outline-none focus:border-border-focus"
                  >
                    <option value="">Templates...</option>
                    {QUICK_TEMPLATES.map((template) => (
                      <option key={template} value={template}>
                        {template}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Compose */}
              <div className="border-t border-border-default p-4">
                {!isWindowActive ? (
                  <div className="rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-text">
                    <p className="font-medium">Can&apos;t send right now</p>
                    <p className="mt-0.5 text-xs">
                      Messaging is paused outside your active window. Office support continues client follow-up from the same thread.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <textarea
                      value={composeMessage}
                      onChange={(e) => setComposeMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Share a visit update..."
                      rows={2}
                      className="min-h-[44px] flex-1 resize-none rounded-xl border border-border-strong bg-surface-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus"
                    />
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleSend()}
                      disabled={!composeMessage.trim() || sendMessage.isPending}
                      className="shrink-0"
                    >
                      {sendMessage.isPending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-surface-secondary">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-5">
                <MessageSquare className="h-7 w-7 text-text-inverse" />
              </div>
              <p className="text-base font-semibold text-text-primary">
                {isMobile ? 'Tap a thread to open' : 'Select a conversation'}
              </p>
              <p className="mt-2 text-sm text-text-secondary max-w-[260px] leading-relaxed">
                Choose a client thread from the list to view and send messages during your active visit window.
              </p>
            </div>
          )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SitterInboxPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl pb-8">
          <SitterPageHeader title="Inbox" subtitle="Loading…" />
          <SitterSkeletonList count={4} />
        </div>
      }
    >
      <SitterInboxContent />
    </Suspense>
  );
}
