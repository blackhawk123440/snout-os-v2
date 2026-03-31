/**
 * React Query hooks for Owner Portal — shared endpoints accessed by multiple pages.
 * Uses cookie auth (NextAuth session) — plain fetch().
 * Page-specific queries use local useQuery() calls in each page file.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

async function ownerFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Query hooks ────────────────────────────────────────────────────

export function useOwnerBookings(filters: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  payment?: string;
  from?: string;
  to?: string;
  sitterId?: string;
  clientId?: string;
}) {
  return useQuery({
    queryKey: ['owner', 'bookings', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.search) params.set('search', filters.search);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.payment && filters.payment !== 'all') params.set('paymentStatus', filters.payment);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.sitterId) params.set('sitterId', filters.sitterId);
      if (filters.clientId) params.set('clientId', filters.clientId);
      return ownerFetch<{ items: any[]; total: number }>(`/api/bookings?${params.toString()}`);
    },
  });
}

export function useOwnerBookingDetail(id: string | null) {
  return useQuery({
    queryKey: ['owner', 'bookings', id],
    queryFn: () => ownerFetch(`/api/bookings/${id}`),
    enabled: !!id,
  });
}

export function useOwnerClients(filters: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['owner', 'clients', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      if (filters.search) params.set('search', filters.search);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      return ownerFetch<{ items: any[]; total: number }>(`/api/clients?${params.toString()}`);
    },
  });
}

export function useOwnerClientDetail(id: string | null) {
  return useQuery({
    queryKey: ['owner', 'clients', id],
    queryFn: () => ownerFetch(`/api/clients/${id}`),
    enabled: !!id,
  });
}

export function useOwnerSitters(filters: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['owner', 'sitters', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      return ownerFetch<{ items: any[]; total: number }>(`/api/sitters?${params.toString()}`);
    },
  });
}

export function useOwnerSitterDetail(id: string | null) {
  return useQuery({
    queryKey: ['owner', 'sitters', id],
    queryFn: () => ownerFetch(`/api/sitters/${id}`),
    enabled: !!id,
  });
}

export function useOwnerSittersList() {
  return useQuery({
    queryKey: ['owner', 'sitters-list'],
    queryFn: () => ownerFetch<{ items: any[] }>('/api/sitters?page=1&pageSize=200'),
    staleTime: 60000,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────

export function useQuickAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { bookingId: string; sitterId: string }) =>
      ownerFetch('/api/ops/daily-board/quick-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner', 'bookings'] });
      qc.invalidateQueries({ queryKey: ['owner', 'daily-board'] });
    },
  });
}

export function useUpdateBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      ownerFetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner', 'bookings', id] });
      qc.invalidateQueries({ queryKey: ['owner', 'bookings'] });
    },
  });
}
