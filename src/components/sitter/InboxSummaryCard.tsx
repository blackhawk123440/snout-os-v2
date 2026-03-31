/**
 * Inbox Summary Card
 *
 * Shows unread count and latest thread preview for Dashboard tab
 */

'use client';

import { Card, Button, Badge, SectionHeader, EmptyState } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface InboxSummaryData {
  unreadCount: number;
  latestThread?: {
    id: string;
    clientName: string;
    lastMessage: string;
    lastActivityAt: string;
  };
}

interface InboxSummaryCardProps {
  sitterId: string;
}

export function InboxSummaryCard({ sitterId }: InboxSummaryCardProps) {
  const { data, isLoading } = useQuery<InboxSummaryData>({
    queryKey: ['sitter-inbox-summary', sitterId],
    queryFn: async () => {
      // Get from owner dashboard API which includes inboxSummary
      const res = await fetch(`/api/sitters/${sitterId}/dashboard`);
      if (!res.ok) {
        return { unreadCount: 0 };
      }
      const dashboard = await res.json();
      return {
        unreadCount: dashboard.inboxSummary?.unreadCount || dashboard.unreadMessageCount || 0,
        latestThread: dashboard.inboxSummary?.latestThread || undefined,
      };
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <SectionHeader title="Inbox" />
        <div className="text-sm text-text-secondary">
          Loading...
        </div>
      </Card>
    );
  }

  const unreadCount = data?.unreadCount || 0;

  return (
    <Card className="p-4">
      <SectionHeader title="Inbox" />
      <div className="flex flex-col gap-3">
        {unreadCount > 0 ? (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="warning">
                {unreadCount} {unreadCount === 1 ? 'unread message' : 'unread messages'}
              </Badge>
            </div>
            {data?.latestThread && (
              <div className="p-2 rounded-md text-sm bg-neutral-50">
                <div className="font-medium mb-1">
                  {data.latestThread.clientName}
                </div>
                <div className="text-text-secondary">
                  {formatDistanceToNow(new Date(data.latestThread.lastActivityAt), { addSuffix: true })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-text-secondary">
            No unread messages
          </div>
        )}
        <Link href={`/sitters/${sitterId}?tab=messages`}>
          <Button variant="secondary" size="sm" className="w-full mt-2">
            Open Inbox
          </Button>
        </Link>
      </div>
    </Card>
  );
}
