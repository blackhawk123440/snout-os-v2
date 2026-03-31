/**
 * React Query hooks for Number Inventory
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from './client';
import { z } from 'zod';

const numberSchema = z.object({
  id: z.string(),
  e164: z.string(),
  class: z.enum(['front_desk', 'sitter', 'pool']),
  status: z.enum(['active', 'quarantined', 'inactive', 'released']),
  assignedSitterId: z.string().nullable(),
  assignedSitter: z.object({
    id: z.string(),
    name: z.string(),
  }).nullable(),
  providerType: z.string(),
  purchaseDate: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  // Quarantine state
  quarantineReleaseAt: z.string().nullable().optional(),
  quarantinedReason: z.string().nullable().optional(),
  // Pool state
  activeThreadCount: z.number().nullable().optional(),
  capacityStatus: z.string().nullable().optional(),
  maxConcurrentThreads: z.number().nullable().optional(),
});

export type Number = z.infer<typeof numberSchema>;

export function useNumbers(filters?: {
  class?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['numbers', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.class) params.set('class', filters.class);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      return apiGet(`/api/numbers?${params.toString()}`, z.array(numberSchema));
    },
  });
}

export function useBuyNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      class: 'front_desk' | 'sitter' | 'pool';
      areaCode?: string;
      country?: string;
      quantity?: number;
    }) => apiPost('/api/numbers/buy', params, z.object({
      success: z.boolean(),
      numbers: z.array(z.object({
        id: z.string(),
        e164: z.string(),
        numberSid: z.string(),
        cost: z.number(),
      })),
      totalCost: z.number().optional(),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
      queryClient.invalidateQueries({ queryKey: ['setup', 'numbers'] });
    },
  });
}

export function useImportNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      e164?: string;
      numberSid?: string;
      class: 'front_desk' | 'sitter' | 'pool';
    }) => apiPost('/api/numbers/import', params, z.object({
      success: z.boolean(),
      number: z.object({
        id: z.string(),
        e164: z.string(),
        numberSid: z.string(),
      }),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
      queryClient.invalidateQueries({ queryKey: ['setup', 'numbers'] });
    },
  });
}

export function useQuarantineNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      numberId: string;
      reason: string;
      reasonDetail?: string;
      durationDays?: number;
      customReleaseDate?: string;
    }) => apiPost(`/api/numbers/${params.numberId}/quarantine`, {
      reason: params.reason,
      reasonDetail: params.reasonDetail,
      durationDays: params.durationDays,
      customReleaseDate: params.customReleaseDate,
    }, z.object({
      success: z.boolean(),
      impact: z.object({
        affectedThreads: z.number(),
        cooldownDays: z.number(),
        releaseAt: z.string(),
        message: z.string(),
      }),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
    },
  });
}

export function useReleaseNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      numberId: string;
      forceRestore?: boolean;
      restoreReason?: string;
    }) => apiPost(`/api/numbers/${params.numberId}/release`, {
      forceRestore: params.forceRestore || false,
      restoreReason: params.restoreReason,
    }, z.object({
      success: z.boolean(),
      message: z.string(),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
    },
  });
}

export function useAssignToSitter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      numberId: string;
      sitterId: string;
    }) => apiPost(`/api/numbers/${params.numberId}/assign`, {
      sitterId: params.sitterId,
    }, z.object({
      success: z.boolean(),
      message: z.string(),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
    },
  });
}

export function useReleaseToPool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (numberId: string) => apiPost(`/api/numbers/${numberId}/release-to-pool`, {}, z.object({
      success: z.boolean(),
      impact: z.object({
        affectedThreads: z.number(),
        message: z.string(),
      }),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
    },
  });
}

export function useSitters() {
  return useQuery({
    queryKey: ['sitters'],
    queryFn: async () => {
      const response = await apiGet('/api/sitters?pageSize=200', z.object({
        items: z.array(z.object({
          id: z.string(),
          name: z.string(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          isActive: z.boolean(),
          assignedNumberId: z.string().nullable().optional(), // Persistent sitter number
        })),
      }));
      return response.items;
    },
  });
}

export function useNumberDetail(numberId: string | null) {
  return useQuery({
    queryKey: ['numbers', numberId, 'detail'],
    queryFn: () => apiGet(`/api/numbers/${numberId}`, numberSchema.extend({
      activeThreadCount: z.number(),
      health: z.object({
        status: z.string(),
        deliveryRate: z.number().nullable(),
        errorRate: z.number().nullable(),
      }),
      deliveryErrors: z.array(z.any()),
    })),
    enabled: !!numberId,
  });
}

export function useChangeNumberClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      numberId: string;
      class: 'front_desk' | 'sitter' | 'pool';
    }) => apiPatch(`/api/numbers/${params.numberId}/class`, {
      class: params.class,
    }, z.object({
      success: z.boolean(),
      number: numberSchema,
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
    },
  });
}

export function useReleaseFromTwilio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (numberId: string) =>
      apiPost(
        `/api/numbers/${numberId}/release-from-twilio`,
        {},
        z.object({
          success: z.boolean(),
          message: z.string(),
          alreadyReleased: z.boolean().optional(),
          activeThreadsOrphaned: z.number().optional(),
          twilioNote: z.string().nullable().optional(),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
    },
  });
}

export function useDeactivateSitter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sitterId: string) => apiPost(`/api/numbers/sitters/${sitterId}/deactivate`, {}, z.object({
      success: z.boolean(),
      message: z.string(),
      activeAssignments: z.number(),
      numbersAffected: z.number(),
    })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
      queryClient.invalidateQueries({ queryKey: ['sitters'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useSitterAssignmentWindows(sitterId: string | null) {
  return useQuery({
    queryKey: ['assignments', 'windows', sitterId],
    queryFn: () => apiGet(`/api/assignments/windows?sitterId=${sitterId}`, z.array(z.object({
      id: z.string(),
      threadId: z.string(),
      sitterId: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      status: z.string(),
    }))),
    enabled: !!sitterId,
  });
}
