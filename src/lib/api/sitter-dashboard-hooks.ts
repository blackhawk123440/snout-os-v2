/**
 * React Query hooks for Sitter Dashboard API calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, ApiError } from './client';
import { z } from 'zod';

// Dashboard data schema
const bookingSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  service: z.string(),
  startAt: z.string().transform((s) => new Date(s)),
  endAt: z.string().transform((s) => new Date(s)),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  totalPrice: z.number(),
  status: z.string(),
  pets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    species: z.string(),
    breed: z.string().nullable(),
  })),
  client: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }).nullable(),
  sitterPoolOffer: z.object({
    id: z.string(),
    expiresAt: z.string().transform((s) => new Date(s)),
    status: z.string(),
  }).nullable(),
  offerEvent: z.object({
    id: z.string(),
    expiresAt: z.string().transform((s) => new Date(s)).nullable(),
    offeredAt: z.string().transform((s) => new Date(s)),
    status: z.string(),
  }).nullable(),
  threadId: z.string().nullable(),
});

const performanceMetricsSchema = z.object({
  acceptanceRate: z.number().nullable(),
  completionRate: z.number().nullable(),
  onTimeRate: z.number().nullable(),
  clientRating: z.number().nullable(),
  totalEarnings: z.number().nullable(),
  completedBookingsCount: z.number(),
});

const sitterTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  priorityLevel: z.number().nullable(),
  badgeColor: z.string().nullable(),
  badgeStyle: z.string().nullable(),
});

const dashboardDataSchema = z.object({
  pendingRequests: z.array(bookingSchema),
  upcomingBookings: z.array(bookingSchema),
  completedBookings: z.array(bookingSchema),
  performance: performanceMetricsSchema,
  currentTier: sitterTierSchema.nullable(),
  isAvailable: z.boolean(),
  unreadMessageCount: z.number(),
});

export type SitterDashboardData = z.infer<typeof dashboardDataSchema>;
export type SitterBooking = z.infer<typeof bookingSchema>;

/**
 * Fetch sitter dashboard data
 */
export function useSitterDashboard(sitterId: string | undefined) {
  return useQuery({
    queryKey: ['sitter', 'dashboard', sitterId],
    queryFn: async () => {
      if (!sitterId) return null;
      // Use self-scoped endpoint for sitter's own dashboard
      const response = await apiGet<SitterDashboardData>(
        `/api/sitter/me/dashboard`,
        dashboardDataSchema
      );
      return response;
    },
    enabled: !!sitterId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Accept a booking request
 */
export function useAcceptBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ bookingId, sitterId }: { bookingId: string; sitterId: string }) => {
      return apiPost<{ success: boolean }>(
        `/api/sitter/${sitterId}/bookings/${bookingId}/accept`,
        {},
        z.object({ success: z.boolean() })
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sitter', 'dashboard', variables.sitterId] });
      queryClient.invalidateQueries({ queryKey: ['sitter', 'bookings'] });
    },
  });
}

/**
 * Decline a booking request
 */
export function useDeclineBooking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ bookingId, sitterId }: { bookingId: string; sitterId: string }) => {
      return apiPost<{ success: boolean }>(
        `/api/sitter/${sitterId}/bookings/${bookingId}/decline`,
        {},
        z.object({ success: z.boolean() })
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sitter', 'dashboard', variables.sitterId] });
      queryClient.invalidateQueries({ queryKey: ['sitter', 'bookings'] });
    },
  });
}

/**
 * Update sitter availability
 */
export function useUpdateAvailability() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sitterId, isAvailable }: { sitterId: string; isAvailable: boolean }) => {
      // The API returns { sitter: {...} } but we just need to know it succeeded
      await apiPatch<{ sitter: any }>(
        `/api/sitters/${sitterId}`,
        { isActive: isAvailable },
        z.object({ sitter: z.any() })
      );
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sitter', 'dashboard', variables.sitterId] });
      queryClient.invalidateQueries({ queryKey: ['sitters', variables.sitterId] });
    },
  });
}
