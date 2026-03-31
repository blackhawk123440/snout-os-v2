/**
 * Conversation List Component
 *
 * Displays a list of conversations with masked numbers
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, EmptyState, Skeleton, Tabs, TabPanel } from '@/components/ui';

interface Conversation {
  id: string;
  participantName: string;
  participantPhone: string;
  participantType: 'client' | 'sitter';
  bookingId: string | null;
  bookingTitle: string | null;
  lastMessage: string;
  lastMessageAt: Date | string;
  unreadCount: number;
  messageCount: number;
  // Phase 4.1: Enhanced fields
  numberClass?: 'front_desk' | 'sitter' | 'pool';
  assignedSitterId?: string | null;
  assignedSitterName?: string | null;
  hasActiveWindow?: boolean;
  scope?: string;
  hasAntiPoachingFlag?: boolean;
  isBlocked?: boolean;
  blockedEventId?: string | null;
}

interface ConversationListProps {
  role?: 'owner' | 'sitter';
  sitterId?: string;
  onSelectConversation?: (conversation: Conversation) => void;
  scope?: 'internal' | 'all'; // Phase 4.1: Filter by scope (internal = owner inbox)
}

export default function ConversationList({
  role = 'owner',
  sitterId,
  onSelectConversation,
  scope = 'all', // Phase 4.1: Default to all threads
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Phase 4.1: Use new messaging endpoints with scope filtering
      // Feature flag is checked server-side in the API route
      const params = new URLSearchParams();

      // Add filters if provided
      if (sitterId) {
        params.append('sitterId', sitterId);
      }
      params.append('pageSize', '50');

      // Phase 4.1: Filter by scope for owner inbox
      if (scope === 'internal') {
        params.append('scope', 'internal');
      }

      const endpoint = `/api/messages/threads?${params}`;
      console.log('[ConversationList] Fetching threads from:', endpoint);
      const response = await fetch(endpoint);
      if (!response.ok) {
        // Fallback to old endpoint if new one fails (backward compatibility)
        if (response.status === 404) {
          const oldParams = new URLSearchParams({ role });
          if (sitterId) {
            oldParams.append('sitterId', sitterId);
          }
          const oldResponse = await fetch(`/api/conversations?${oldParams}`);
          if (oldResponse.ok) {
            const oldData = await oldResponse.json();
            setConversations(oldData.conversations || []);
            setLoading(false);
            return;
          }
        }
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.items || data.threads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [role, sitterId, scope]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton height={80} />
        <Skeleton height={80} />
        <Skeleton height={80} />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#fef2f2] border-[#fecaca]">
        <div className="p-4 text-[#b91c1c]">
          {error}
          <button
            onClick={fetchConversations}
            className="ml-3 px-3 py-1 text-white border-none rounded-md cursor-pointer bg-error"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="No conversations"
        description="Start messaging clients or sitters to see conversations here"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {conversations.map((conversation) => (
        <Card
          key={conversation.id}
          className="cursor-pointer transition-colors duration-200 bg-surface-secondary hover:bg-surface-tertiary"
          onClick={() => onSelectConversation?.(conversation)}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl bg-primaryLight">
              {conversation.participantName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div className="font-semibold text-base text-text-primary">
                  {conversation.participantName}
                </div>
                {/* Phase 4.1: Number class badge */}
                {conversation.numberClass && (
                  <Badge
                    variant={
                      conversation.numberClass === 'front_desk' ? 'default' :
                      conversation.numberClass === 'sitter' ? 'info' :
                      'default'
                    }
                  >
                    {conversation.numberClass === 'front_desk' ? 'Front Desk' :
                     conversation.numberClass === 'sitter' ? 'Sitter' :
                     'Pool'}
                  </Badge>
                )}
                {/* Phase 4.1: Assignment status */}
                {conversation.assignedSitterName && (
                  <Badge variant="info" className="text-xs">
                    {conversation.assignedSitterName}
                  </Badge>
                )}
                {/* Phase 4.1: Anti-poaching flag */}
                {conversation.hasAntiPoachingFlag && (
                  <Badge variant="error" title="Anti-poaching violation detected">
                    ⚠️
                  </Badge>
                )}
                {/* Phase 4.1: Owner inbox indicator */}
                {conversation.scope === 'internal' && (
                  <Badge variant="warning">Owner Inbox</Badge>
                )}
                {conversation.unreadCount > 0 && (
                  <Badge variant="warning">{conversation.unreadCount}</Badge>
                )}
              </div>
              {conversation.bookingTitle && (
                <div className="text-sm text-text-secondary mb-1">
                  {conversation.bookingTitle}
                </div>
              )}
              <div className="text-sm text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                {conversation.lastMessage}
              </div>
            </div>
            <div className="text-xs text-text-tertiary shrink-0">
              {formatTime(conversation.lastMessageAt)}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
