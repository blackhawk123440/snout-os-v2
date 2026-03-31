/**
 * React Query hooks for Sitter Portal pages.
 *
 * Uses cookie auth (NextAuth session) — plain fetch(), not apiGet/apiPost.
 * Does NOT replace sitter-hooks.ts (inbox) or sitter-dashboard-hooks.ts (dashboard).
 * Covers: bookings, earnings, performance, profile, calendar, availability, pets, reports, callout.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Shared fetch helper ────────────────────────────────────────────

async function sitterFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Query hooks ────────────────────────────────────────────────────

export function useSitterMe() {
  return useQuery({
    queryKey: ['sitter', 'me'],
    queryFn: () => sitterFetch('/api/sitter/me'),
    staleTime: 60000,
  });
}

export function useSitterBookings() {
  return useQuery({
    queryKey: ['sitter', 'bookings'],
    queryFn: () => sitterFetch('/api/sitter/bookings'),
  });
}

export function useSitterBookingDetail(id: string | null) {
  return useQuery({
    queryKey: ['sitter', 'bookings', id],
    queryFn: () => sitterFetch(`/api/sitter/bookings/${id}`),
    enabled: !!id,
  });
}

export function useSitterEarnings(from?: string, to?: string) {
  const params = from ? `?from=${from}${to ? `&to=${to}` : ''}` : '';
  return useQuery({
    queryKey: ['sitter', 'earnings', from, to],
    queryFn: () => sitterFetch(`/api/sitter/earnings${params}`),
  });
}

export function useSitterCompletedJobs() {
  return useQuery({
    queryKey: ['sitter', 'completed-jobs'],
    queryFn: () => sitterFetch('/api/sitter/completed-jobs'),
  });
}

export function useSitterTransfers() {
  return useQuery({
    queryKey: ['sitter', 'transfers'],
    queryFn: () => sitterFetch('/api/sitter/transfers'),
  });
}

export function useSitterAvailabilityFull() {
  return useQuery({
    queryKey: ['sitter', 'availability'],
    queryFn: () => sitterFetch('/api/sitter/availability?preview=7'),
  });
}

export function useSitterCalendar() {
  return useQuery({
    queryKey: ['sitter', 'calendar'],
    queryFn: () => sitterFetch('/api/sitter/calendar'),
  });
}

export function useSitterGoogleEvents(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ['sitter', 'google-events', weekStart, weekEnd],
    queryFn: () => sitterFetch(`/api/sitter/calendar/google-events?start=${weekStart}&end=${weekEnd}`),
    enabled: !!weekStart && !!weekEnd,
  });
}

export function useSitterPerformance() {
  return useQuery({
    queryKey: ['sitter', 'performance'],
    queryFn: () => sitterFetch('/api/sitter/me/srs'),
  });
}

export function useSitterPetDetail(id: string | null) {
  return useQuery({
    queryKey: ['sitter', 'pets', id],
    queryFn: () => sitterFetch(`/api/sitter/pets/${id}`),
    enabled: !!id,
  });
}

export function useSitterReports() {
  return useQuery({
    queryKey: ['sitter', 'reports'],
    queryFn: () => sitterFetch<{ reports: any[] }>('/api/sitter/reports'),
  });
}

export function useSitterReportDetail(id: string | null) {
  return useQuery({
    queryKey: ['sitter', 'reports', id],
    queryFn: () => sitterFetch(`/api/sitter/reports/${id}`),
    enabled: !!id,
  });
}

export function useSitterStripeStatus() {
  return useQuery({
    queryKey: ['sitter', 'stripe-status'],
    queryFn: () => sitterFetch('/api/sitter/stripe/status'),
  });
}

export function useSitterProfile() {
  return useQuery({
    queryKey: ['sitter', 'profile'],
    queryFn: async () => {
      const [profile, availability, stripe] = await Promise.all([
        sitterFetch('/api/sitter/me'),
        sitterFetch('/api/sitter/availability').catch(() => null),
        sitterFetch('/api/sitter/stripe/status').catch(() => null),
      ]);
      return { profile, availability, stripe };
    },
  });
}

export function useSitterRoute(date: string) {
  return useQuery({
    queryKey: ['sitter', 'route', date],
    queryFn: () => sitterFetch(`/api/sitter/route?date=${date}`),
    enabled: !!date,
  });
}

export function useSitterBadges() {
  return useQuery({
    queryKey: ['sitter', 'badges'],
    queryFn: async () => {
      const [threadsRes, todayRes] = await Promise.all([
        sitterFetch('/api/sitter/threads').catch(() => []),
        sitterFetch('/api/sitter/today').catch(() => ({ bookings: [] })),
      ]);
      const threads = Array.isArray(threadsRes) ? threadsRes : [];
      const hasUnreadMessages = threads.some((t: any) => t.ownerUnreadCount > 0 || t.unreadCount > 0);
      const todayBookings = Array.isArray(todayRes?.bookings) ? todayRes.bookings : [];
      const hasReportTodo = todayBookings.some(
        (b: any) => b.status === 'completed' && !b.reportId
      );
      return { hasUnreadMessages, hasReportTodo };
    },
    refetchInterval: 60000,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────

export function useSitterCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; lat?: number; lng?: number }) =>
      sitterFetch(`/api/bookings/${params.bookingId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: params.lat, lng: params.lng }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'today'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'bookings'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'dashboard'] });
    },
  });
}

export function useSitterCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; lat?: number; lng?: number }) =>
      sitterFetch(`/api/bookings/${params.bookingId}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: params.lat, lng: params.lng }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'today'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'bookings'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'dashboard'] });
    },
  });
}

export function useToggleSitterAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (availabilityEnabled: boolean) =>
      sitterFetch('/api/sitter/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityEnabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'profile'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'me'] });
    },
  });
}

export function useAddSitterBlockOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      sitterFetch('/api/sitter/block-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'profile'] });
    },
  });
}

export function useRemoveSitterBlockOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sitterFetch(`/api/sitter/block-off/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
      qc.invalidateQueries({ queryKey: ['sitter', 'profile'] });
    },
  });
}

export function useBulkReplaceAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { rules: Array<{ daysOfWeek: number[]; startTime: string; endTime: string }> }) =>
      sitterFetch('/api/sitter/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
    },
  });
}

export function useCreateAvailabilityOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; startTime: string; endTime: string; isAvailable: boolean }) =>
      sitterFetch('/api/sitter/availability-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
    },
  });
}

export function useDeleteAvailabilityOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sitterFetch(`/api/sitter/availability-overrides/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
    },
  });
}

export function useCreateAvailabilityRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { daysOfWeek: number[]; startTime: string; endTime: string }) =>
      sitterFetch('/api/sitter/availability-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
    },
  });
}

export function useDeleteAvailabilityRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sitterFetch(`/api/sitter/availability-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'availability'] });
    },
  });
}

export function useSitterCallout() {
  return useMutation({
    mutationFn: (data: { date: string; reason: string; notes?: string }) =>
      sitterFetch('/api/sitter/callout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
  });
}

export function useSitterDeleteAccount() {
  return useMutation({
    mutationFn: () =>
      sitterFetch('/api/sitter/delete-account', { method: 'POST' }),
  });
}

export function useConnectSitterStripe() {
  return useMutation({
    mutationFn: () =>
      sitterFetch('/api/sitter/stripe/connect', { method: 'POST' }),
  });
}

export function useUpdateSitterReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      sitterFetch(`/api/sitter/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'reports', reportId] });
    },
  });
}

export function useUpdateSitterChecklist(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string; checked: boolean }) =>
      sitterFetch(`/api/sitter/bookings/${bookingId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'bookings', bookingId] });
    },
  });
}

export function useAddSitterPetHealthLog(petId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string; note: string }) =>
      sitterFetch(`/api/sitter/pets/${petId}/health-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sitter', 'pets', petId] });
    },
  });
}
