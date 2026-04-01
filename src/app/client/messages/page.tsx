'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, ChevronRight, Send } from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button } from '@/components/ui';
import { renderClientPreview } from '@/lib/strip-emojis';
import { useClientMessages } from '@/lib/api/client-hooks';

export default function ClientMessagesPage() {
  const router = useRouter();
  const { data, isLoading: loading, error, refetch } = useClientMessages();
  const threads = data?.threads ?? [];

  const formatRelative = (d: string | null) => {
    if (!d) return '';
    const now = Date.now();
    const then = new Date(d).getTime();
    const mins = Math.floor((now - then) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <LayoutWrapper variant="narrow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight sm:text-2xl">
            Messages
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">
            {threads.length > 0
              ? `${threads.length} conversation${threads.length !== 1 ? 's' : ''} with your care team`
              : 'Chat with your sitter or care team'}
          </p>
        </div>
        <ClientRefreshButton onRefresh={refetch} loading={loading} />
      </div>

      {loading ? (
        <MessagesSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load messages" subtitle={error.message || 'Unable to load messages'} onRetry={() => void refetch()} />
      ) : threads.length === 0 ? (
        <div className="rounded-2xl bg-accent-tertiary p-8 text-center mt-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
            <MessageCircle className="h-7 w-7 text-text-inverse" />
          </div>
          <p className="text-xl font-bold text-text-primary">No messages yet</p>
          <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
            Conversations with your sitter will appear here after you book a visit. Your care team may also contact you from their regular business number.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/client/bookings/new">
              <Button variant="primary" size="md">Book a visit</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Thread list */}
          <div className="rounded-2xl bg-surface-primary shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Conversations</h2>
              <span className="text-[11px] font-semibold text-text-disabled tabular-nums">{threads.length}</span>
            </div>
            <div className="divide-y divide-border-muted">
              {threads.map((thread) => {
                const sitterName = thread.sitter?.name || 'Sitter';
                const sitterInitial = sitterName.charAt(0).toUpperCase();
                const serviceName = thread.booking?.service || null;
                const rawPreview = thread.preview
                  ? renderClientPreview(thread.preview, 80).trim()
                  : null;
                // If preview is empty after stripping (e.g. was just a URL), show the service name
                const previewText = (rawPreview && rawPreview.length > 1) ? rawPreview : (serviceName || 'Tap to view conversation');
                const isUnread = thread.status === 'unread';

                return (
                  <div
                    key={thread.id}
                    className="flex items-center gap-3 px-5 py-4 min-h-[76px] cursor-pointer hover:bg-surface-secondary transition-colors"
                    onClick={() => router.push(`/client/messages/${thread.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/client/messages/${thread.id}`)}
                  >
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${isUnread ? 'bg-accent-primary text-text-inverse' : 'bg-accent-tertiary text-accent-primary'}`}>
                      {sitterInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className={`text-[14px] truncate ${isUnread ? 'font-bold text-text-primary' : 'font-semibold text-text-primary'}`}>
                            {sitterName}
                          </p>
                          {isUnread && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-accent-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-text-tertiary tabular-nums shrink-0">
                          {formatRelative(thread.lastActivityAt)}
                        </p>
                      </div>
                      {serviceName && (
                        <p className="text-[12px] text-text-tertiary mt-0.5 truncate">{serviceName}</p>
                      )}
                      <p className={`text-[13px] truncate mt-0.5 ${isUnread ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                        {previewText}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-disabled shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contextual footer */}
          <div className="rounded-2xl bg-gradient-to-br from-accent-secondary via-surface-primary to-accent-secondary/30 border border-accent-secondary p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-primary shadow-sm">
                <Send className="h-5 w-5 text-text-inverse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-text-primary">Need to reach your sitter?</p>
                <p className="text-[13px] text-text-secondary mt-0.5">Open a conversation above, or book a new visit to start one. Some teams may also follow up by phone outside the app.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </LayoutWrapper>
  );
}

function MessagesSkeleton() {
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden animate-pulse">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="h-3 w-24 rounded bg-surface-tertiary" />
          <div className="h-3 w-4 rounded bg-surface-tertiary" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4 min-h-[76px]">
            <div className="w-11 h-11 rounded-2xl bg-surface-tertiary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 rounded bg-surface-tertiary" />
              <div className="h-3 w-16 rounded bg-surface-tertiary" />
              <div className="h-3 w-48 rounded bg-surface-tertiary" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border-default bg-surface-primary p-5">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-2xl bg-surface-tertiary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-surface-tertiary" />
            <div className="h-3 w-64 rounded bg-surface-tertiary" />
          </div>
        </div>
      </div>
    </div>
  );
}
