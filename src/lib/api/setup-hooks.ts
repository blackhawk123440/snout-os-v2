/**
 * React Query hooks for Setup Wizard
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './client';
import { z } from 'zod';

const providerStatusSchema = z.object({
  connected: z.boolean(),
  providerType: z.string(),
  accountSid: z.string().nullable(),
});

const testConnectionResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  accountName: z.string().optional(),
});

const numbersStatusSchema = z.object({
  hasFrontDesk: z.boolean(),
  frontDesk: z.object({
    count: z.number(),
    numbers: z.array(z.object({ e164: z.string(), id: z.string() })),
  }),
  sitter: z.object({
    count: z.number(),
    numbers: z.array(z.object({ e164: z.string(), id: z.string() })),
  }),
  pool: z.object({
    count: z.number(),
    numbers: z.array(z.object({ e164: z.string(), id: z.string() })),
  }),
});

const webhookStatusSchema = z.object({
  verified: z.boolean(),
  webhookUrl: z.string(),
  configured: z.boolean(),
});

const readinessCheckSchema = z.object({
  ready: z.boolean(),
  checks: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    error: z.string().optional(),
  })),
});

export function useProviderStatus() {
  return useQuery({
    queryKey: ['setup', 'provider-status'],
    queryFn: () => apiGet('/api/setup/provider/status', providerStatusSchema),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (config?: { accountSid?: string; authToken?: string }) =>
      apiPost('/api/setup/provider/test', config, testConnectionResponseSchema),
  });
}

export function useNumbersStatus() {
  return useQuery({
    queryKey: ['setup', 'numbers-status'],
    queryFn: () => apiGet('/api/setup/numbers/status', numbersStatusSchema),
  });
}

export function useWebhookStatus() {
  return useQuery({
    queryKey: ['setup', 'webhook-status'],
    queryFn: () => apiGet('/api/setup/webhooks/status', webhookStatusSchema),
    refetchInterval: 2000,
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: ['setup', 'readiness'],
    queryFn: () => apiGet('/api/setup/readiness', readinessCheckSchema),
    refetchInterval: 2000,
  });
}

export function useConnectProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: { accountSid: string; authToken: string }) =>
      apiPost('/api/setup/provider/connect', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup'] });
    },
  });
}

export function useInstallWebhooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/api/setup/webhooks/install'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup', 'webhooks'] });
    },
  });
}

export function useLastWebhookReceived() {
  return useQuery({
    queryKey: ['setup', 'webhooks', 'last-received'],
    queryFn: () => apiGet('/api/setup/webhooks/last-received', z.object({
      lastReceivedAt: z.string().nullable(),
      receiving: z.boolean(),
    })),
    refetchInterval: 5000, // Poll every 5 seconds
  });
}
