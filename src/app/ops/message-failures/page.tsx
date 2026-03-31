'use client';

/**
 * Message Failures - Admin view: failed SMS/message deliveries + Retry.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OwnerAppShell, LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { Button, DataTableShell, EmptyState, Table, TableSkeleton } from '@/components/ui';
import { formatDateTime } from '@/lib/format-utils';

function sanitizeError(error: string): string {
  let clean = error.replace(/TWILIO_\w+/g, '***');
  clean = clean.replace(/in \/setup/g, 'in Settings');
  clean = clean.replace(/Connect provider/g, 'Connect messaging provider');
  return clean;
}
import { PageSkeleton } from '@/components/ui/loading-state';

interface MessageFailureItem {
  id: string;
  threadId: string;
  body: string;
  error: string;
  errorCode?: string;
  createdAt: string;
  attemptCount: number;
  client: { id: string; name: string } | null;
  sitter: { id: string; name: string } | null;
}

export default function MessageFailuresPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<MessageFailureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/message-failures?limit=50');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to load');
        setItems([]);
        return;
      }
      setItems(json.items || []);
    } catch {
      setError('Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, sessionStatus, router]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const sseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/realtime/ops/failures` : null;
  useSSE(sseUrl, () => void load(), !!session);

  const handleRetry = async (messageId: string) => {
    setRetryingId(messageId);
    try {
      const res = await fetch(`/api/messages/${messageId}/retry`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Retry failed');
        return;
      }
      if (json.success) {
        void load();
      } else {
        alert(json.error || 'Retry failed');
      }
    } finally {
      setRetryingId(null);
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <OwnerAppShell>
        <LayoutWrapper>
          <PageHeader title="Message Failures" subtitle="Loading..." />
          <PageSkeleton />
        </LayoutWrapper>
      </OwnerAppShell>
    );
  }
  if (!session) return null;

  return (
    <OwnerAppShell>
      <LayoutWrapper>
        <PageHeader
          title="Message Failures"
          subtitle="Failed message deliveries with retry controls"
        />
        <Section>
      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : error ? (
        <AppErrorState title="Couldn't load" subtitle={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No failed messages"
          description="Failed deliveries will appear here. You can retry from the inbox or this page."
        />
      ) : (
        <DataTableShell stickyHeader>
          <Table<MessageFailureItem>
            columns={[
              {
                key: 'recipient',
                header: 'Recipient',
                mobileLabel: 'Recipient',
                mobileOrder: 1,
                render: (row) => (
                  <div>
                    <p className="font-medium text-text-primary">{row.client?.name ?? 'Unknown client'}</p>
                    <p className="text-xs text-text-tertiary">
                      {row.sitter ? `Sitter: ${row.sitter.name}` : 'No sitter'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'failure',
                header: 'Failure',
                mobileLabel: 'Failure',
                mobileOrder: 2,
                hideBelow: 'md',
                render: (row) => (
                  <div className="max-w-[520px]">
                    <p className="line-clamp-2 text-sm text-text-secondary">{row.body}</p>
                    <p className="line-clamp-2 text-xs text-text-tertiary">{sanitizeError(row.error)}</p>
                  </div>
                ),
              },
              {
                key: 'meta',
                header: 'Meta',
                mobileLabel: 'Meta',
                mobileOrder: 3,
                hideBelow: 'lg',
                render: (row) => (
                  <span className="text-xs text-text-tertiary">
                    {formatDateTime(row.createdAt)} · Attempt {row.attemptCount}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                mobileLabel: 'Actions',
                mobileOrder: 4,
                align: 'right',
                render: (row) => (
                  <div className="flex justify-end gap-2">
                    <Link href={`/messages?thread=${row.threadId}`}>
                      <Button variant="secondary" size="sm">Thread</Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleRetry(row.id)}
                      disabled={retryingId === row.id}
                    >
                      {retryingId === row.id ? 'Retrying' : 'Retry'}
                    </Button>
                  </div>
                ),
              },
            ]}
            data={items}
            keyExtractor={(row) => row.id}
            emptyMessage="No failed messages"
            forceTableLayout
          />
        </DataTableShell>
      )}
        </Section>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
