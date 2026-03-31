/**
 * React Query hooks for Sitter API calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { usePageVisible } from '@/hooks/usePageVisible';
import { apiGet, apiPost, apiPatch, ApiError } from './client';
import { z } from 'zod';

// Reuse Thread and Message schemas from hooks.ts
const threadSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  clientId: z.string(),
  sitterId: z.string().nullable(),
  numberId: z.string(),
  threadType: z.enum(['front_desk', 'assignment', 'pool', 'other']),
  status: z.enum(['active', 'inactive']),
  ownerUnreadCount: z.number(),
  lastActivityAt: z.string().transform((s) => new Date(s)),
  client: z.object({
    id: z.string(),
    name: z.string(),
    contacts: z.array(z.object({ e164: z.string() })),
  }),
  sitter: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  messageNumber: z.object({
    id: z.string(),
    e164: z.string(),
    class: z.string(),
    status: z.string(),
  }),
  assignmentWindows: z.array(z.object({
    id: z.string(),
    startsAt: z.string().transform((s) => new Date(s)),
    endsAt: z.string().transform((s) => new Date(s)),
  })).optional(),
});

const messageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  senderType: z.enum(['client', 'sitter', 'owner', 'system', 'automation']),
  senderId: z.string().nullable(),
  body: z.string(),
  redactedBody: z.string().nullable(),
  hasPolicyViolation: z.boolean(),
  createdAt: z.string().transform((s) => new Date(s)),
  deliveries: z.array(z.object({
    id: z.string(),
    attemptNo: z.number(),
    status: z.enum(['queued', 'sent', 'delivered', 'failed']),
    providerErrorCode: z.string().nullable(),
    providerErrorMessage: z.string().nullable(),
    createdAt: z.string().transform((s) => new Date(s)),
  })),
  policyViolations: z.array(z.object({
    id: z.string(),
    violationType: z.string(),
    detectedSummary: z.string(),
    actionTaken: z.string(),
  })),
});

export type SitterThread = z.infer<typeof threadSchema>;
export type SitterMessage = z.infer<typeof messageSchema>;

export function useSitterThreads() {
  return useQuery({
    queryKey: ['sitter', 'threads'],
    queryFn: async () => {
      const response = await apiGet<SitterThread[]>(
        '/api/sitter/threads',
        z.array(threadSchema)
      );
      return response;
    },
    refetchInterval: (query) => {
      if (typeof document !== 'undefined' && document.hidden) {
        return false;
      }
      return 5000; // Poll every 5s when page is visible
    },
  });
}

export function useSitterMessages(threadId: string | null) {
  const refetchRef = useRef<() => void>();
  const sseUrl = threadId && typeof window !== 'undefined'
    ? `${window.location.origin}/api/realtime/messages/threads/${threadId}`
    : null;
  const pageVisible = usePageVisible();
  const { error: sseError } = useSSE(
    sseUrl,
    () => refetchRef.current?.(),
    !!threadId && pageVisible
  );

  const query = useQuery({
    queryKey: ['sitter', 'threads', threadId, 'messages'],
    queryFn: async () => {
      if (!threadId) return [];
      const response = await apiGet<SitterMessage[]>(
        `/api/sitter/threads/${threadId}/messages`,
        z.array(messageSchema)
      );
      return response;
    },
    enabled: !!threadId,
    refetchInterval: threadId && sseError && pageVisible ? 3000 : false,
    refetchOnWindowFocus: false,
  });
  refetchRef.current = query.refetch;

  return query;
}

export function useSitterSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      return apiPost<{ messageId: string }>(
        `/api/sitter/threads/${threadId}/messages`,
        { body },
        z.object({ messageId: z.string() })
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sitter', 'threads', variables.threadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['sitter', 'threads'] });
    },
  });
}
