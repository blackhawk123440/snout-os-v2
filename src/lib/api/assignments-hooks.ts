/**
 * React Query hooks for Assignments & Windows
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiRequest } from './client';
import { z } from 'zod';

const assignmentWindowSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  sitterId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  bookingRef: z.string().nullable(),
  status: z.enum(['active', 'future', 'past']),
  thread: z.object({
    id: z.string(),
    client: z.object({
      id: z.string(),
      name: z.string(),
    }),
  }),
  sitter: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type AssignmentWindow = z.infer<typeof assignmentWindowSchema>;

const conflictSchema = z.object({
  conflictId: z.string(),
  windowA: assignmentWindowSchema,
  windowB: assignmentWindowSchema,
  thread: z.object({
    id: z.string(),
    client: z.object({
      id: z.string(),
      name: z.string(),
    }),
  }),
  overlapStart: z.string(),
  overlapEnd: z.string(),
});

export type Conflict = z.infer<typeof conflictSchema>;

export function useAssignmentWindows(filters?: {
  threadId?: string;
  sitterId?: string;
  status?: 'active' | 'future' | 'past';
}) {
  return useQuery({
    queryKey: ['assignment-windows', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.threadId) params.set('threadId', filters.threadId);
      if (filters?.sitterId) params.set('sitterId', filters.sitterId);
      if (filters?.status) params.set('status', filters.status);
      return apiGet(`/api/assignments/windows?${params.toString()}`, z.array(assignmentWindowSchema));
    },
  });
}

export function useConflicts() {
  return useQuery({
    queryKey: ['assignment-conflicts'],
    queryFn: () => apiGet('/api/assignments/conflicts', z.array(conflictSchema)),
  });
}

export function useCreateWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      threadId: string;
      sitterId: string;
      startsAt: string;
      endsAt: string;
      bookingRef?: string;
    }) => apiPost('/api/assignments/windows', params, assignmentWindowSchema),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-windows'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-conflicts'] });
    },
  });
}

export function useUpdateWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      windowId: string;
      startsAt?: string;
      endsAt?: string;
      sitterId?: string;
      bookingRef?: string;
    }) => apiPatch(`/api/assignments/windows/${params.windowId}`, {
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      sitterId: params.sitterId,
      bookingRef: params.bookingRef,
    }, assignmentWindowSchema),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-windows'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-conflicts'] });
    },
  });
}

export function useDeleteWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (windowId: string) => apiRequest(`/api/assignments/windows/${windowId}`, { method: 'DELETE' }, z.object({
      success: z.boolean(),
      wasActive: z.boolean(),
      message: z.string(),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-windows'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-conflicts'] });
    },
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      conflictId: string;
      strategy: 'keepA' | 'keepB' | 'split';
    }) => apiPost(`/api/assignments/conflicts/${params.conflictId}/resolve`, {
      strategy: params.strategy,
    }, z.object({
      success: z.boolean(),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-windows'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-conflicts'] });
    },
  });
}
