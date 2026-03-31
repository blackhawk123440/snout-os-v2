/**
 * React Query hooks for Messaging API calls
 */

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { usePageVisible } from '@/hooks/usePageVisible';
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from './client';
import { z } from 'zod';

// ============================================
// Threads
// ============================================

const threadSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  clientId: z.string(),
  sitterId: z.string().nullable(),
  numberId: z.string(),
  threadType: z.enum(['front_desk', 'assignment', 'pool', 'other']),
  laneType: z.enum(['company', 'service']).optional(),
  activationStage: z.enum(['intake', 'staffing', 'meet_and_greet', 'service', 'follow_up']).optional(),
  lifecycleStatus: z.enum(['active', 'grace', 'expired', 'archived']).optional(),
  assignedRole: z.enum(['front_desk', 'sitter', 'owner', 'automation']).optional(),
  clientApprovedAt: z.string().nullable().optional(),
  sitterApprovedAt: z.string().nullable().optional(),
  serviceWindow: z
    .object({
      startAt: z.string().transform((s) => new Date(s)),
      endAt: z.string().transform((s) => new Date(s)),
    })
    .nullable()
    .optional(),
  graceEndsAt: z.string().nullable().optional(),
  flags: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        severity: z.string(),
        createdAt: z.string(),
      })
    )
    .optional(),
  availabilityResponses: z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        requestedAt: z.string(),
        respondedAt: z.string().nullable(),
        responseLatencySec: z.number().nullable(),
        sitterId: z.string(),
      })
    )
    .optional(),
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

export type Thread = z.infer<typeof threadSchema>;

const threadListSchema = z.object({
  items: z.array(threadSchema),
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
  pageSize: z.number().optional(),
});

export function useThreads(filters?: {
  clientId?: string;
  sitterId?: string;
  status?: string;
  unreadOnly?: boolean;
  hasPolicyViolation?: boolean;
  hasDeliveryFailure?: boolean;
  search?: string;
  inbox?: 'all' | 'owner'; // Filter by inbox type: 'all' = all threads, 'owner' = owner inbox only
  pageSize?: number;
}) {
  const queryParams = new URLSearchParams();
  if (filters?.clientId) queryParams.set('clientId', filters.clientId);
  if (filters?.sitterId) queryParams.set('sitterId', filters.sitterId);
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.unreadOnly) queryParams.set('unreadOnly', 'true');
  if (filters?.hasPolicyViolation) queryParams.set('hasPolicyViolation', 'true');
  if (filters?.hasDeliveryFailure) queryParams.set('hasDeliveryFailure', 'true');
  if (filters?.search) queryParams.set('participant', filters.search);
  if (filters?.pageSize) queryParams.set('pageSize', String(filters.pageSize));
  if (filters?.inbox) {
    if (filters.inbox === 'owner') {
      queryParams.set('scope', 'internal'); // Owner inbox uses scope='internal'
    }
    // 'all' means no scope filter
  }

  const queryString = queryParams.toString();
  const baseEndpoint = `/api/messages/threads${queryString ? `?${queryString}` : ''}`;

  return useInfiniteQuery({
    queryKey: ['threads', filters],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const url = pageParam ? `${baseEndpoint}${queryString ? '&' : '?'}cursor=${pageParam}` : baseEndpoint;
      const response = await apiGet(url, threadListSchema);
      return response;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Prevent excessive refetching
    refetchInterval: false,
    refetchOnWindowFocus: false, // Disable to prevent 429s on tab switch
    refetchOnMount: false, // Only refetch if data is stale
    refetchOnReconnect: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 429 (rate limit) - wait for manual refresh
      if (error?.status === 429 || error?.statusCode === 429) {
        return false;
      }
      // Retry other errors up to 1 time
      return failureCount < 1;
    },
  });
}

export function useThread(threadId: string | null) {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const response = await apiGet<{ thread: Thread }>(
        `/api/messages/threads/${threadId}`,
        z.object({ thread: threadSchema })
      );
      return response.thread;
    },
    enabled: !!threadId,
  });
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) =>
      apiPatch(`/api/messages/threads/${threadId}/mark-read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { phoneNumber: string; initialMessage?: string }) =>
      apiPost<{ threadId: string; clientId: string; reused: boolean }>(
        '/api/messages/threads',
        {
          phoneNumber: params.phoneNumber,
          initialMessage: params.initialMessage,
        },
        z.object({
          threadId: z.string(),
          clientId: z.string(),
          reused: z.boolean(),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

// ============================================
// Messages
// ============================================

const deliverySchema = z.object({
  id: z.string(),
  attemptNo: z.number(),
  status: z.enum(['queued', 'sent', 'delivered', 'failed']),
  providerErrorCode: z.string().nullable(),
  providerErrorMessage: z.string().nullable(),
  createdAt: z.string().transform((s) => new Date(s)),
});

const policyViolationSchema = z.object({
  id: z.string(),
  violationType: z.string(),
  detectedSummary: z.string(),
  actionTaken: z.string(),
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
  routingDisposition: z.enum(['normal', 'blocked', 'rerouted']).optional(),
  createdAt: z.string().transform((s) => new Date(s)),
  deliveries: z.array(deliverySchema),
  policyViolations: z.array(policyViolationSchema),
});

export type Message = z.infer<typeof messageSchema>;

const messageListSchema = z.object({
  items: z.array(messageSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  hasMore: z.boolean().optional(),
});

export function useMessages(
  threadId: string | null,
  options?: { useSSE?: boolean; pageSize?: number }
) {
  const useSSEEnabled = options?.useSSE ?? true;
  const refetchRef = useRef<() => void>();

  const sseUrl = threadId && typeof window !== 'undefined'
    ? `${window.location.origin}/api/realtime/messages/threads/${threadId}`
    : null;
  const pageVisible = usePageVisible();
  const { error: sseError } = useSSE(
    sseUrl,
    () => refetchRef.current?.(),
    !!threadId && useSSEEnabled && pageVisible
  );

  const query = useInfiniteQuery({
    queryKey: ['messages', threadId, options?.pageSize],
    queryFn: ({ pageParam }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1;
      const pageSize = options?.pageSize ?? 50;
      return apiGet(
        `/api/messages/threads/${threadId}/messages?page=${page}&pageSize=${pageSize}`,
        messageListSchema
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: !!threadId,
    refetchInterval: threadId && sseError ? 8000 : false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 5000,
    gcTime: 300000,
    retry: (failureCount, error: any) => {
      if (error?.status === 429 || error?.statusCode === 429) return false;
      return failureCount < 1;
    },
  });
  refetchRef.current = query.refetch;

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { threadId: string; body: string; forceSend?: boolean; confirmPoolFallback?: boolean }) =>
      apiPost<{ messageId: string; providerMessageSid?: string; hasPolicyViolation: boolean }>(
        `/api/messages/threads/${params.threadId}/messages`,
        {
          body: params.body,
          forceSend: params.forceSend || false,
        },
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

const poolHealthSchema = z.object({
  availableCompany: z.number(),
  availableService: z.number(),
  assigned: z.number(),
  exhausted: z.boolean(),
  shouldProvision: z.boolean(),
});

export function useMessagePoolHealth() {
  return useQuery({
    queryKey: ['messages', 'pool-health'],
    queryFn: () => apiGet('/api/messages/pool-health', poolHealthSchema),
    staleTime: 30000,
  });
}

export function useUpdateThreadLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { threadId: string; payload: Record<string, unknown> }) =>
      apiPatch(`/api/messages/threads/${params.threadId}/lifecycle`, params.payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['thread', vars.threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

const timelineItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['event', 'flag']),
  eventType: z.string(),
  label: z.string(),
  status: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().transform((s) => new Date(s)),
});

export function useThreadTimeline(threadId: string | null) {
  return useQuery({
    queryKey: ['thread', threadId, 'timeline'],
    queryFn: () =>
      apiGet<{ items: z.infer<typeof timelineItemSchema>[] }>(
        `/api/messages/threads/${threadId}/timeline`,
        z.object({ items: z.array(timelineItemSchema) })
      ),
    enabled: !!threadId,
    staleTime: 10000,
  });
}

export function useThreadWorkflowAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      threadId: string;
      payload:
        | { action: 'schedule_meet_and_greet'; scheduledAt: string }
        | { action: 'confirm_meet_and_greet' }
        | { action: 'client_approves_sitter' }
        | { action: 'sitter_approves_client' };
    }) => apiPost(`/api/messages/threads/${params.threadId}/workflow`, params.payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['thread', vars.threadId] });
      queryClient.invalidateQueries({ queryKey: ['thread', vars.threadId, 'timeline'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

export function useRetryMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      apiPost<{ success: boolean; attemptNo: number }>(
        `/api/messages/${messageId}/retry`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

// ============================================
// Routing
// ============================================

const routingEvaluationStepSchema = z.object({
  step: z.number(),
  rule: z.string(),
  condition: z.string(),
  result: z.boolean(),
  explanation: z.string(),
});

const routingDecisionSchema = z.object({
  target: z.enum(['owner_inbox', 'sitter', 'client']),
  targetId: z.string().optional(),
  reason: z.string(),
  evaluationTrace: z.array(routingEvaluationStepSchema),
  rulesetVersion: z.string(),
  evaluatedAt: z.string().transform((s) => new Date(s)),
  inputsSnapshot: z.record(z.string(), z.unknown()),
});

export type RoutingDecision = z.infer<typeof routingDecisionSchema>;

export function useRoutingHistory(threadId: string | null) {
  return useQuery({
    queryKey: ['routing-history', threadId],
    queryFn: () =>
      apiGet<{ events: Array<{ decision: RoutingDecision; timestamp: string }> }>(
        `/api/routing/threads/${threadId}/history`,
      ),
    enabled: !!threadId,
  });
}

export function useSimulateRouting() {
  return useMutation({
    mutationFn: (params: {
      threadId?: string;
      clientId?: string;
      timestamp?: Date;
      numberId?: string;
    }) =>
      apiPost<RoutingDecision>(
        '/api/routing/simulate',
        {
          ...params,
          timestamp: params.timestamp?.toISOString(),
        },
        routingDecisionSchema,
      ),
  });
}

// ============================================
// Routing Overrides
// ============================================

export function useCreateRoutingOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      threadId: string;
      target: 'owner_inbox' | 'sitter' | 'client';
      targetId?: string;
      durationHours?: number;
      reason: string;
    }) => apiPost('/api/routing/overrides', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-history'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

export function useRemoveRoutingOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { overrideId: string; reason?: string }) =>
      apiDelete(`/api/routing/overrides/${params.overrideId}`, undefined, {
        body: params.reason ? JSON.stringify({ reason: params.reason }) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-history'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
