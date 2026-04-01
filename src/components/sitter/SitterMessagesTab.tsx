/**
 * Sitter Messages Tab
 *
 * Sitter-scoped inbox view for sitter messages
 * Shows ONLY threads where assignedSitterId === sitterId
 * NO tier content, NO tier metrics, NO tier badges
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, Button, EmptyState, Skeleton, Badge } from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';
import { SITTER_BOUNDARY_HELPER } from '@/lib/messaging/policy-copy';
import { formatServiceName } from '@/lib/format-utils';

interface SitterMessagesTabProps {
  sitterId: string;
}

interface SitterThread {
  id: string;
  clientName: string;
  bookingId: string | null;
  booking: {
    id: string;
    clientName: string;
    service: string;
    startAt: string;
    endAt: string;
  } | null;
  lastMessage: {
    id: string;
    body: string;
    direction: string;
    createdAt: string;
    actorType: string;
  } | null;
  lastMessageAt: string;
  hasActiveWindow: boolean;
  maskedNumber: string | null;
  status: string;
}

export function SitterMessagesTab({ sitterId }: SitterMessagesTabProps) {
  const [threads, setThreads] = useState<SitterThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSitterThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sitters/${sitterId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to fetch sitter messages');
      }
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [sitterId]);

  useEffect(() => {
    fetchSitterThreads();
  }, [fetchSitterThreads]);

  if (loading) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <Skeleton height={200} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="p-4">
          <EmptyState
            title="Error Loading Messages"
            description={error}
            icon="⚠️"
          />
        </Card>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="p-4">
        <Card className="p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">
            Messages
          </h2>
          <p className="text-text-secondary text-sm">
            Conversations tied to this sitter's active work windows. Native phone workflows can still happen outside the app if the office uses them.
          </p>
        </div>

          <EmptyState
            title="No Messages"
            description="No active visit conversations yet."
            icon="💬"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Card className="p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">
            Messages ({threads.length})
          </h2>
          <p className="text-text-secondary text-sm">
            {SITTER_BOUNDARY_HELPER}
          </p>
          <p className="text-text-tertiary text-xs mt-1">
            Some workspaces use normal phone numbers alongside the inbox. Follow office guidance and use active-window rules for anything sent here.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {threads.map((thread) => (
            <Card
              key={thread.id}
              className="p-3 cursor-pointer border border-border-default"
              role="button"
              tabIndex={0}
              onClick={() => window.location.href = `/messages?thread=${thread.id}&sitterId=${sitterId}`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.location.href = `/messages?thread=${thread.id}&sitterId=${sitterId}`;
                }
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="font-semibold mb-1">
                    {thread.clientName}
                  </div>
                  {thread.booking && (
                    <div className="text-sm text-text-secondary mb-1">
                      {formatServiceName(thread.booking.service)} • {new Date(thread.booking.startAt).toLocaleDateString()}
                    </div>
                  )}
                  {thread.lastMessage && (
                    <div className="text-sm text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
                      {thread.lastMessage.body.substring(0, 100)}
                      {thread.lastMessage.body.length > 100 ? '...' : ''}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {thread.hasActiveWindow && (
                    <Badge variant="success">Active</Badge>
                  )}
                  <div className="text-xs text-text-secondary">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={() => window.location.href = `/messages?tab=inbox&sitterId=${sitterId}`}
          className="mt-4 w-full"
          leftIcon={<ExternalLink className="w-4 h-4" />}
        >
          Open Full Inbox
        </Button>
      </Card>
    </div>
  );
}
