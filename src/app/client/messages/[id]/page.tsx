'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { LayoutWrapper, PageHeader, Section } from '@/components/layout';
import { AppCard, AppCardBody, AppErrorState, AppSkeletonList } from '@/components/app';
import { Button } from '@/components/ui';
import { toastSuccess } from '@/lib/toast';
import { formatServiceName } from '@/lib/format-utils';
import {
  useClientMessageThread,
  useSendClientMessage,
  type ClientMessage,
  type ClientThreadDetail,
} from '@/lib/api/client-hooks';

export default function ClientMessageThreadPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [composerValue, setComposerValue] = useState('');

  const { data: thread, isLoading: loading, error, refetch } = useClientMessageThread(id);
  const sendMutation = useSendClientMessage(id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages?.length]);

  const handleSend = async () => {
    const body = composerValue.trim();
    if (!body || !id || sendMutation.isPending) return;
    const tempId = `pending-${Date.now()}`;
    const optimisticMsg: ClientMessage = {
      id: tempId,
      body,
      direction: 'outbound',
      actorType: 'client',
      createdAt: new Date().toISOString(),
      isFromClient: true,
    };
    setComposerValue('');
    // Optimistic update
    queryClient.setQueryData<ClientThreadDetail>(['client', 'messages', id], (old) =>
      old ? { ...old, messages: [...old.messages, optimisticMsg] } : old
    );
    try {
      await sendMutation.mutateAsync(body);
      toastSuccess('Message sent');
    } catch {
      // Roll back optimistic update
      queryClient.setQueryData<ClientThreadDetail>(['client', 'messages', id], (old) =>
        old ? { ...old, messages: old.messages.filter((m) => m.id !== tempId) } : old
      );
      setComposerValue(body);
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <LayoutWrapper variant="narrow">
      <PageHeader
        title={thread?.sitter?.name || thread?.booking?.service || 'Conversation'}
        subtitle={thread?.booking?.service ? formatServiceName(thread.booking.service) : undefined}
        actions={
          <button
            type="button"
            onClick={() => router.back()}
            className="min-h-[44px] text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Back
          </button>
        }
      />
      <Section>
      {loading ? (
        <AppSkeletonList count={3} />
      ) : error ? (
        <AppErrorState title="Couldn't load thread" subtitle={error.message || 'Thread not found'} onRetry={() => void refetch()} />
      ) : thread ? (
        <>
          <div className="flex-1 space-y-3">
            {thread.messages?.length === 0 ? (
              <div className="rounded-2xl bg-accent-tertiary p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary shadow-sm mb-4">
                  <MessageSquare className="h-7 w-7 text-text-inverse" />
                </div>
                <p className="text-xl font-bold text-text-primary">No messages yet</p>
                <p className="mt-2 text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed">
                  Send the first message to start the conversation.
                </p>
              </div>
            ) : (
              thread.messages?.map((m) => {
                const isPending = String(m.id).startsWith('pending-');
                return (
                  <div
                    key={m.id}
                    className={`flex ${m.isFromClient ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        m.isFromClient
                          ? 'bg-surface-inverse text-text-inverse'
                          : 'bg-surface-tertiary text-text-primary'
                      }`}
                    >
                      <p className="text-sm">{m.body}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          m.isFromClient ? 'text-text-inverse/60' : 'text-text-tertiary'
                        }`}
                      >
                        {isPending ? 'Sending…' : formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend()}
              placeholder="Type a message..."
              className="flex-1 min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
              disabled={sendMutation.isPending}
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSend()}
              disabled={!composerValue.trim() || sendMutation.isPending}
              isLoading={sendMutation.isPending}
            >
              Send
            </Button>
          </div>
        </>
      ) : null}
      </Section>
    </LayoutWrapper>
  );
}
